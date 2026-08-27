const { NotFoundError, ValidationError, ForbiddenError, PremiumRequiredError } = require('../utils/errors')
const { FIELD_LIMITS, assertFieldLengths } = require('../utils/validators')
const { removeUploadedFile, fileNameFromImageUrl } = require('../config/upload')
const { FREE_LIMITS, isPremium } = require('../config/plans')

const FOREIGN_KEY_VIOLATION = '23503'

// Olmayan bir kullanıcı ya da kategoriye parça eklemek sunucu hatası değil,
// anlamlı bir istemci hatasıdır.
function translateForeignKeyError(error) {
  if (error.code !== FOREIGN_KEY_VIOLATION) return error

  return new ValidationError(
    error.constraint === 'clothing_items_category_id_fkey'
      ? 'Belirtilen categoryId ile bir kategori bulunamadı'
      : 'Belirtilen userId ile bir kullanıcı bulunamadı',
  )
}

class ClothingItemService {
  // userRepository, ücretsiz plan sınırını kontrol edebilmek için gerekir
  // (bkz. #assertUnderItemLimit). Diğer katmanlardaki "opsiyonel bağımlılık"
  // deseninden BİLEREK farklı: limit kontrolü ana yazma yolunun ayrılmaz bir
  // parçası, analiz/embedding gibi üstüne konan bir zenginleştirme değil.
  // storageRepository OPSİYONELDİR (clothingAnalysisService/vectorService ile
  // AYNI desen): verilmezse fotoğraflar yalnızca yerel diske yazılır/silinir,
  // R2 hiç devreye girmez.
  constructor(clothingItemRepository, userRepository, storageRepository = null) {
    this.clothingItemRepository = clothingItemRepository
    this.userRepository = userRepository
    this.storageRepository = storageRepository
  }

  async getItems(userId, categoryId) {
    if (!userId) {
      throw new ValidationError('userId zorunludur')
    }

    if (categoryId) {
      return this.clothingItemRepository.findByCategory(userId, categoryId)
    }

    return this.clothingItemRepository.findAll(userId)
  }

  // Başkasının kaydı için 403 yerine 404 dönüyoruz: 403, o id'de bir kaydın
  // VAR olduğunu ele verir. 404 ile kaynak varlığı da gizlenmiş olur.
  async getItemById(id, userId) {
    const item = await this.clothingItemRepository.findById(id)

    if (!item || item.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    // Kullanım başına maliyet YALNIZCA burada hesaplanır (liste uçlarında
    // DEĞİL) — repository'nin `total_times_worn`'u yalnızca `findById`'de
    // taşımasıyla AYNI kapsam kararı.
    return { ...item, cost_per_wear: this.#computeCostPerWear(item) }
  }

  async createItem(data) {
    this.#validateCreateData(data)
    await this.#assertUnderItemLimit(data.userId)

    try {
      // Belirtilmezse parça temiz kabul edilir (kolon varsayılanıyla aynı).
      return await this.clothingItemRepository.create({
        ...data,
        isClean: this.#normalizeIsClean(data.isClean, true),
        purchasePrice: this.#normalizePurchasePrice(data.purchasePrice, null),
      })
    } catch (error) {
      throw translateForeignKeyError(error)
    }
  }

  async updateItem(id, data, userId) {
    this.#validateUpdateData(data)

    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem || existingItem.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    try {
      return await this.clothingItemRepository.update(id, {
        ...data,
        // isClean gönderilmediyse mevcut değer korunur. true'ya düşmek, herhangi bir
        // düzenlemenin kirli bir parçayı sessizce temiz yapması anlamına gelirdi.
        isClean: this.#normalizeIsClean(data.isClean, existingItem.is_clean),
        // purchasePrice gönderilmediyse mevcut değer korunur (isClean'le AYNI
        // ilke) — `name`/`color` gibi ilgisiz bir alanı düzenlemek sessizce
        // fiyatı silmemeli. Kullanıcı fiyatı GERÇEKTEN temizlemek isterse
        // `null` göndermesi yeterli.
        purchasePrice: this.#normalizePurchasePrice(data.purchasePrice, existingItem.purchase_price),
        // imageUrl BU UÇTAN ASLA DEĞİŞMEZ. Fotoğraf yönetimi ayrı, adanmış
        // uçların işi (POST/DELETE .../image); bu uç yalnızca metin alanlarını
        // günceller. undefined/null bırakılsaydı repository'nin SQL'i
        // image_url'i NULL'a düşürürdü — BU HATA GERÇEKTEN YAŞANDI (gerçek
        // bir kıyafetin fotoğrafı bu yüzden bir kez kayboldu, elle geri
        // yüklendi) ve bu satır tam olarak onu önlüyor.
        imageUrl: existingItem.image_url,
      })
    } catch (error) {
      throw translateForeignKeyError(error)
    }
  }

  async deleteItem(id, userId) {
    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem || existingItem.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    const deleted = await this.clothingItemRepository.softDelete(id)

    // Kayıt soft delete edilse de dosya diskte/R2'de tutulmaz: erişilemeyen
    // fotoğraflar yer kaplamasın.
    await this.#removeStoredImage(existingItem.image_url)

    return deleted
  }

  // Fotoğraf yükleme. Sahiplik ihlalinde 403 döner (diğer uçlardaki 404'ten
  // farklı; bkz. utils/errors.js). Çağıran katman, hata durumunda yeni
  // yüklenen dosyayı silmekten sorumludur.
  async setImage(id, userId, imageUrl) {
    if (!imageUrl) {
      throw new ValidationError('Fotoğraf dosyası zorunludur')
    }

    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }
    if (existingItem.user_id !== userId) {
      throw new ForbiddenError('Bu kıyafete fotoğraf yükleyemezsiniz')
    }

    const updated = await this.clothingItemRepository.updateImageUrl(id, imageUrl)

    // Yeni fotoğraf kaydedildikten SONRA eskisi silinir; sıra tersine olsaydı
    // veritabanı güncellemesi patladığında kullanıcı fotoğrafsız kalırdı.
    if (existingItem.image_url && existingItem.image_url !== imageUrl) {
      await this.#removeStoredImage(existingItem.image_url)
    }

    return updated
  }

  async removeImage(id, userId) {
    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }
    if (existingItem.user_id !== userId) {
      throw new ForbiddenError('Bu kıyafetin fotoğrafını kaldıramazsınız')
    }

    const updated = await this.clothingItemRepository.updateImageUrl(id, null)
    await this.#removeStoredImage(existingItem.image_url)

    return updated
  }

  // Eski görseli HEM yerelden HEM (yapılandırılmışsa) R2'den kaldırır.
  // Yerel silme HER ZAMAN denenir — R2'ye yüklenen bir fotoğrafın arka plan
  // analizi (ClothingAnalysisService) için okunan yerel GEÇİCİ kopyası da
  // aynı dosya adını taşır (bkz. §8 "Fotoğraf depolama — Cloudflare R2"),
  // bu yüzden tek bir silme çağrısı ikisini de temizler. R2 silme yalnızca
  // `imageUrl` mutlak bir HTTP(S) adresiyse denenir (yerel `/uploads/...`
  // yolları R2'ye hiç yüklenmemiştir) ve BAŞARISIZLIĞI FIRLATILMAZ — bir
  // R2 objesinin silinememesi, kıyafetin kendisinin silinmesini engellememeli
  // (WeatherService/GeminiService'teki "isteğe bağlı zenginleştirme hata
  // yolu" ilkesiyle aynı ruh, burada "temizlik" için uygulanıyor).
  async #removeStoredImage(imageUrl) {
    if (!imageUrl) return

    await removeUploadedFile(fileNameFromImageUrl(imageUrl))

    if (this.storageRepository?.isConfigured && /^https?:\/\//i.test(imageUrl)) {
      const key = `clothing-items/${fileNameFromImageUrl(imageUrl)}`
      try {
        await this.storageRepository.remove(key)
      } catch (error) {
        console.error('R2 dosyası silinemedi:', key, error.message)
      }
    }
  }

  async toggleFavorite(id, userId) {
    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem || existingItem.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    return this.clothingItemRepository.toggleFavorite(id)
  }

  async toggleCleanStatus(id, userId) {
    const existingItem = await this.clothingItemRepository.findById(id)
    if (!existingItem || existingItem.user_id !== userId) {
      throw new NotFoundError('Kıyafet bulunamadı')
    }

    return this.clothingItemRepository.toggleCleanStatus(id)
  }

  // Ücretsiz kullanıcı en fazla FREE_LIMITS.clothingItems parça saklayabilir.
  // Premium kullanıcı hiçbir kontrolden geçmez. Silme (soft delete) sayımı
  // düşürdüğü için kullanıcı bir parçayı silip yerine yenisini ekleyebilir —
  // bu "sınırsız kullanım hakkı" değil, "aynı anda en fazla N aktif parça" demek.
  async #assertUnderItemLimit(userId) {
    const user = await this.userRepository.findById(userId)
    if (isPremium(user)) return

    const count = await this.clothingItemRepository.countActive(userId)
    if (count >= FREE_LIMITS.clothingItems) {
      throw new PremiumRequiredError(
        `Ücretsiz planda en fazla ${FREE_LIMITS.clothingItems} parça saklayabilirsin. ` +
          'Daha fazlası için Profil > Premium Abonelik üzerinden yükselt.',
      )
    }
  }

  // Kolon NOT NULL: null/tanımsız değer veritabanına gitmeden burada karara bağlanır.
  // Gevşek dönüşüm (örn. Boolean("false") === true) bilinçli olarak yapılmaz.
  #normalizeIsClean(value, fallback) {
    if (value === undefined || value === null) return fallback
    if (typeof value !== 'boolean') {
      throw new ValidationError('isClean true veya false olmalıdır')
    }
    return value
  }

  // `purchase_price` NULLABLE'dır (isClean'in aksine) — üç durumu ayırt eder:
  // `undefined` (alan hiç gönderilmedi → mevcut değer korunur), `null`/`''`
  // (kullanıcı fiyatı BİLEREK temizledi → NULL yazılır), sayı (doğrulanıp
  // yazılır). Negatif bir fiyatın anlamı yok; `Number.isFinite` NaN/Infinity'yi
  // de eler (ör. kullanıcı metin gönderirse).
  #normalizePurchasePrice(value, fallback) {
    if (value === undefined) return fallback
    if (value === null || value === '') return null

    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new ValidationError('purchasePrice negatif olmayan bir sayı olmalıdır')
    }
    // İki ondalık basamağa yuvarlanır (para birimi hassasiyeti) — kolon zaten
    // NUMERIC(10,2), fazla basamaklar veritabanı tarafında sessizce
    // kırpılırdı; burada açıkça yapmak şaşırtıcı olmaz.
    return Math.round(parsed * 100) / 100
  }

  // Kullanım başına maliyet: fiyat YOKSA ya da parça HİÇ giyilmediyse (bir
  // kombinde bile kaydedilmediyse) hesaplanamaz — `0`'a bölmek ya da uydurma
  // bir değer döndürmek yerine `null` dönülür, arayüz bu durumu ayrı bir
  // davetle ele alır (bkz. ClothingDetail.jsx).
  #computeCostPerWear(item) {
    if (item.purchase_price === null || item.purchase_price === undefined) return null
    if (!item.total_times_worn || item.total_times_worn <= 0) return null

    const price = Number(item.purchase_price)
    return Math.round((price / item.total_times_worn) * 100) / 100
  }

  #validateCreateData(data) {
    if (!data.userId) {
      throw new ValidationError('userId zorunludur')
    }
    if (!data.categoryId) {
      throw new ValidationError('categoryId zorunludur')
    }
    if (!data.name || !data.name.trim()) {
      throw new ValidationError('name zorunludur')
    }
    assertFieldLengths(data, FIELD_LIMITS.clothingItems)
  }

  #validateUpdateData(data) {
    if (!data.categoryId) {
      throw new ValidationError('categoryId zorunludur')
    }
    if (!data.name || !data.name.trim()) {
      throw new ValidationError('name zorunludur')
    }
    assertFieldLengths(data, FIELD_LIMITS.clothingItems)
  }
}

module.exports = ClothingItemService
