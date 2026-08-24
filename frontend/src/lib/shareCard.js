import { toBlob } from 'html-to-image'
import { Capacitor } from '@capacitor/core'
import { resolveImageUrl } from './api'

// Kombini Instagram Story oranında (9:16) bir PNG'ye çeviren yardımcılar.
//
// KÜTÜPHANE SEÇİMİ — html-to-image:
// html2canvas'ın son gerçek sürümü Ocak 2022 (v1.4.1); html-to-image aktif
// bakımda. Daha önemlisi html-to-image, SVG <foreignObject> içinde TARAYICIYA
// çizdirir — yani Tailwind v4'ün ürettiği `color-mix(in oklab, …)` değerlerini
// tarayıcı zaten anlar. html2canvas kendi CSS ayrıştırıcısını kullandığı için
// modern renk fonksiyonlarında hata veriyor.

// Story oranı. CSS boyutu küçük tutulup pixelRatio ile büyütülür:
// 360×640 @3x = 1080×1920 (Instagram Story'nin tam ölçüsü).
export const CARD_WIDTH = 360
export const CARD_HEIGHT = 640
export const CARD_PIXEL_RATIO = 3

// Paylaşım görselinin paleti TEMADAN BAĞIMSIZDIR ve daima AÇIK MODdur.
// Token (var(--color-…)) kullanılsaydı karanlık modda koyu bir kart üretilirdi;
// oysa paylaşılan görsel kullanıcının ekran tercihine değil MARKAYA aittir.
// Bu yüzden değerler burada sabit hex olarak durur.
export const SHARE_PALETTE = {
  ivory: '#f7f3ed',
  surface: '#ffffff',
  ink: '#1c1a17',
  warmGray: '#e8e3db',
  dustyRose: '#c9a0a0',
  accentInk: '#995656',
  burgundy: '#7a3b3b',
}

// Kıyafet fotoğrafları backend'den (:3001) gelir, uygulama ise :5173'te çalışır.
// Görsel data: URI'ye çevrilmezse foreignObject serileştirmesi sırasında
// yüklenemez ya da canvas'ı "tainted" hâle getirir. Ağdan tek seferlik okuyup
// gömmek bu iki riski de tamamen ortadan kaldırır.
async function toDataUri(imageUrl) {
  const resolved = resolveImageUrl(imageUrl)
  if (!resolved) return null

  try {
    const response = await fetch(resolved)
    if (!response.ok) return null

    const blob = await response.blob()
    return await new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    // Tek bir fotoğrafın alınamaması paylaşımı engellememeli:
    // o parça yer tutucuyla çizilir.
    return null
  }
}

// İki sayfa iki farklı veri şekli taşıyor: Kombinlerim API satırını olduğu gibi
// kullanır (snake_case + category_id), Kombin Öner ise transformers.js'ten
// geçmiş camelCase nesneler tutar. Paylaşım kartı tek bir şekil bilsin diye
// normalizasyon burada yapılır.
export function toShareItems(items, categoryNames) {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    // camelCase (Kombin Öner) → category; snake_case (Kombinlerim) → category_id
    category: item.category ?? categoryNames?.get(item.category_id) ?? '',
    imageUrl: item.imageUrl ?? item.image_url ?? null,
  }))
}

// Fotoğrafları paralel gömer. Başarısız olanlar null kalır → yer tutucu.
export async function embedItemImages(shareItems) {
  return Promise.all(
    shareItems.map(async (item) => ({
      ...item,
      dataUri: await toDataUri(item.imageUrl),
    })),
  )
}

// Kartın DOM'a yerleşmesini ve fontların hazır olmasını bekler.
// İki rAF gerekiyor: ilki React'ın commit'inden sonraki layout'u, ikincisi
// paint'i garantiler. Fontlar beklenmezse başlık yedek serif ile çizilir.
async function waitForPaint() {
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready
    } catch {
      // Font API yoksa/başarısızsa yedek font ile devam edilir.
    }
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

export async function renderCardToBlob(node) {
  await waitForPaint()

  const blob = await toBlob(node, {
    pixelRatio: CARD_PIXEL_RATIO,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    // Kart ivory zeminlidir; şeffaf kalırsa bazı görüntüleyiciler siyah gösterir.
    backgroundColor: SHARE_PALETTE.ivory,
    // DİKKAT: `cacheBust` KULLANILMAZ. Kütüphane onu her kaynak URL'sinin
    // sonuna "?<zaman>" ekleyerek uygular — fotoğrafları zaten data: URI olarak
    // gömdüğümüz için bu, base64 yükünün sonunu bozar ve üretim askıda kalır
    // (yaşandı: fotoğrafsız kombin çalışıyor, fotoğraflı olan donuyordu).
    // Gömülü veride önbellek diye bir sorun da yoktur.
  })

  if (!blob) throw new Error('Görsel oluşturulamadı')
  return blob
}

// Dosya adı: "dijital-gardirop-aksam-yemegi-2026-08-21.png"
export function buildFileName(occasion) {
  const slug = (occasion || 'kombin')
    .toLowerCase()
    .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u')
    .replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const today = new Date().toISOString().slice(0, 10)
  return `dijital-gardirop-${slug || 'kombin'}-${today}.png`
}

// Platforma göre ikiye ayrılır: web'de İNDİRME (<a download>), Android'de
// PAYLAŞIM (native share sheet). İkisi de "blob'u kullanıcıya teslim et" işini
// yapar ama farklı mekanizmalarla — Android WebView'de <a download> GÜVENİLİR
// DEĞİLDİR (bazı sürümlerde sessizce hiçbir şey olmaz), bu yüzden orada
// tarayıcı indirmesi yerine Capacitor Filesystem + Share'e geçilir.
export async function downloadBlob(blob, fileName) {
  if (Capacitor.isNativePlatform()) {
    await shareBlobNative(blob, fileName)
    return
  }

  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    if (typeof link.download === 'undefined') {
      throw new Error('Tarayıcı indirmeyi desteklemiyor')
    }
    link.href = url
    link.download = fileName
    link.rel = 'noopener'
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    // Hemen iptal edilirse indirme yarıda kalabilir; bir tur bekletiliyor.
    setTimeout(() => URL.revokeObjectURL(url), 10000)
  }
}

// Filesystem.writeFile encoding VERİLMEZSE base64 bekler (Capacitor'ın kendi
// belgelenmiş kuralı: "If you do not provide encoding and use non-base64
// data, an error will be thrown"). FileReader'ın ürettiği data: URI'nin
// virgülden SONRASI zaten ham base64'tür.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.slice(result.indexOf(',') + 1)
      if (!base64) {
        reject(new Error('Görsel okunamadı'))
        return
      }
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Görsel okunamadı'))
    reader.readAsDataURL(blob)
  })
}

// Android: görseli cihazın ÖNBELLEK (cache) klasörüne yazıp native paylaşım
// menüsünü açar — kullanıcı orada "Galeriye Kaydet" (Google Fotoğraflar gibi
// bir hedef üzerinden), "WhatsApp'ta Paylaş" vb. seçenekler arasından seçer.
//
// `Directory.Cache` BİLİNÇLİ seçildi: uygulamaya ÖZEL bir alandır (diğer
// uygulamalar doğrudan göremez), bu yüzden @capacitor/filesystem BURADA
// hiçbir çalışma zamanı izni İSTEMEZ — eklentinin kendi kodu yalnızca
// `Directory.Documents` / `Directory.ExternalStorage` gibi PAYLAŞILAN
// (public) dizinlere yazarken izin ister. `AndroidManifest.xml`'e bu yüzden
// YENİ BİR DEPOLAMA İZNİ EKLENMEDİ — eklenseydi gereksiz ve modern Android'in
// scoped storage modeliyle tutarsız olurdu. Paylaşım hedefi dosyayı zaten var
// olan `FileProvider` yapılandırması (`@capacitor/camera`'nın kurduğu
// `file_paths.xml`, `cache-path path="."` ile tüm önbellek dizinini kapsıyor)
// üzerinden `content://` olarak alır; "nereye kaydedileceği" kararı tamamen
// seçilen hedef uygulamaya aittir.
async function shareBlobNative(blob, fileName) {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')

  let uri
  try {
    const base64 = await blobToBase64(blob)
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64,
      directory: Directory.Cache,
    })
    uri = result.uri
  } catch (error) {
    const message = String(error?.message ?? error)
    // Teorik olarak Directory.Cache izin istemez, ama bir OEM tuhaflığı ya da
    // disk dolu gibi bir durumda da kullanıcı çökme yerine anlaşılır bir mesaj
    // görsün (photoPicker.js'teki aynı ayrım: izin reddi ayrı bir mesaj alır).
    if (/denied|permission/i.test(message)) {
      throw new Error('Depolama izni verilmedi. Ayarlar > Uygulamalar üzerinden izin verebilirsin.')
    }
    throw new Error('Görsel cihaza kaydedilemedi. Tekrar deneyebilirsin.')
  }

  try {
    await Share.share({
      title: 'Kombini Paylaş',
      url: uri,
      dialogTitle: 'Kombini Paylaş',
    })
  } catch (error) {
    const message = String(error?.message ?? error)
    // Kullanıcı paylaşım menüsünü kapattı — bu bir HATA DEĞİL (Android
    // tarafında RESULT_CANCELED "Share canceled" olarak reddedilir).
    if (/cancel/i.test(message)) return
    throw new Error('Paylaşım açılamadı. Tekrar deneyebilirsin.')
  }
}
