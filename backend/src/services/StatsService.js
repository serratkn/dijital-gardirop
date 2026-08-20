const { NotFoundError } = require('../utils/errors')

// Kullanıcının kendi verisinden türetilen gardırop özeti.
//
// GENİŞLETİLEBİLİRLİK: Özet, bölümlerin (#buildX) birleştirilmesiyle kurulur.
// İleride "premium analiz raporu" eklenirken izlenecek yol:
//   1) StatsRepository'ye yeni bir sorgu metodu ekle,
//   2) burada onu okuyan bir #buildX bölümü yaz,
//   3) SECTIONS listesine ekle.
// Mevcut bölümlere ve uç noktanın sözleşmesine dokunmak gerekmez; yanıt
// yalnızca yeni bir anahtarla büyür.
class StatsService {
  constructor(statsRepository) {
    this.statsRepository = statsRepository
  }

  // Kullanıcı yalnızca kendi istatistiğine erişebilir. Sahiplik ihlalinde 404
  // döner — 403 "böyle bir kullanıcı var" bilgisini ele verirdi (UserService
  // ile aynı kalıp).
  async getWardrobeStats(userId, requesterId) {
    if (requesterId && userId !== requesterId) {
      throw new NotFoundError('Kullanıcı bulunamadı')
    }

    // Sorgular birbirinden bağımsız; sırayla beklemek yanıt süresini
    // gereksiz yere toplarlardı.
    const [items, categories, topColor, outfits, topOccasion] = await Promise.all([
      this.statsRepository.getItemSummary(userId),
      this.statsRepository.getCategoryDistribution(userId),
      this.statsRepository.getTopColor(userId),
      this.statsRepository.getOutfitSummary(userId),
      this.statsRepository.getTopOccasion(userId),
    ])

    const itemStats = this.#buildItemStats(items, categories)
    const outfitStats = this.#buildOutfitStats(outfits, topOccasion)

    return {
      // Frontend'in "yeni kullanıcı" boş durumunu tek bir alandan sürebilmesi
      // için burada karar veriliyor; istemcide yeniden türetilmesi gerekmesin.
      has_data: itemStats.total > 0 || outfitStats.total > 0,
      items: itemStats,
      colors: { top: this.#buildTopEntry(topColor) },
      outfits: outfitStats,
      generated_at: new Date().toISOString(),
    }
  }

  #buildItemStats(items, categories) {
    return {
      total: items.total,
      favorite: items.favorite,
      clean: items.clean,
      dirty: items.dirty,
      by_category: categories.map((row) => ({
        category_id: row.category_id,
        name: row.name,
        icon: row.icon,
        count: row.count,
      })),
    }
  }

  #buildOutfitStats(outfits, topOccasion) {
    return {
      total: outfits.total,
      favorite: outfits.favorite,
      total_worn: outfits.total_worn,
      top_occasion: this.#buildTopEntry(topOccasion),
    }
  }

  // "En çok ..." alanları veri yoksa NULL döner. Uydurma bir varsayılan
  // ("Beyaz", 0) göstermek kullanıcıya yanlış bilgi verirdi.
  #buildTopEntry(row) {
    if (!row) return null
    return { name: row.name, count: row.count }
  }
}

module.exports = StatsService
