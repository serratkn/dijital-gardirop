import { Sparkles } from 'lucide-react'

// Kıyafet Detay sayfasındaki "Bu Parça Hakkında" bölümü.
// Veriyi Gemini üretir (bkz. backend GeminiService, Aşama 2) ve clothing_items.ai_analysis
// kolonunda saklanır. Kolon NULL olabilir — o durumda bu bileşen HİÇ render edilmez
// (null döner), sayfa analiz olmadan da eksiksiz çalışır.

// Anahtar → arayüz etiketi. Şema kategoriye göre değiştiği için tüm
// varyantların anahtarları burada toplanır; bir parçada yalnızca kendi
// şemasındakiler bulunur.
//
// BU NESNENİN SIRASI GÖSTERİM SIRASIDIR. Saklanan JSON'ın kendi sırasına
// güvenilemez: kolon JSONB'dir ve JSONB anahtarları uzunluk + bayt sırasına
// göre yeniden dizer. (İlk sürümde buna güvenilmişti; kartlar "Baskın Renk,
// Stil, Boyut, Çanta Türü, Tür…" gibi rastgele bir sırayla çıkıyordu.)
// Sıra hem giyim hem makyaj şemasında anlamlı okunacak biçimde seçildi.
const ALAN_ETIKETLERI = {
  alt_kategori: 'Tür',
  urun_turu: 'Ürün Türü',
  renk: 'Baskın Renk',
  ikincil_renkler: 'İkincil Renkler',
  kumas_deseni: 'Kumaş & Desen',
  bitis_efekti: 'Bitiş',
  stil: 'Stil',
  mevsim_uygunlugu: 'Mevsim',
  kesim_tipi: 'Kesim',
  topuk_yuksekligi: 'Topuk',
  ayakkabi_turu: 'Ayakkabı Türü',
  boyut: 'Boyut',
  canta_turu: 'Çanta Türü',
  urun_adi: 'Ürün',
}

// Etiket sözlüğünde olmayan (sonradan eklenmiş) bir alan kaybolmasın:
// bilinenler sırayla, bilinmeyenler sonda.
const ALAN_SIRASI = Object.keys(ALAN_ETIKETLERI)

function alanSirasi(key) {
  const index = ALAN_SIRASI.indexOf(key)
  return index === -1 ? ALAN_SIRASI.length : index
}

// Uyumluluk satırlarının sırası da buradan gelir (aynı JSONB gerekçesi).
const UYUMLULUK_ETIKETLERI = {
  vucut_tipi: 'Vücut Tipi',
  ten_tonu: 'Ten Tonu',
  goz_rengi: 'Göz Rengi',
  uyumlu_parca_turleri: 'İyi Gider',
  uyumsuz_kombinasyonlar: 'Kaçın',
}

const UYUMLULUK_SIRASI = Object.keys(UYUMLULUK_ETIKETLERI)

function uyumlulukSirasi(key) {
  const index = UYUMLULUK_SIRASI.indexOf(key)
  return index === -1 ? UYUMLULUK_SIRASI.length : index
}

// Kullanıcının zaten gördüğü ya da ayrı basılan alanlar ızgaraya girmez:
// "kategori" sayfanın başında gardırop kategorisi olarak duruyor,
// diğer ikisinin kendi bölümü var.
const IZGARA_DISI = new Set(['kategori', 'uyumluluk', 'genel_aciklama'])

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Şemaya sonradan eklenen bir alan etiketsiz kalmasın: anahtarı okunabilir
// bir başlığa çevirir (ai_analysis eski bir şemayla kaydedilmiş olabilir).
function etiketle(key, sozluk) {
  if (sozluk[key]) return sozluk[key]
  const kelime = key.replace(/_/g, ' ')
  return kelime.charAt(0).toLocaleUpperCase('tr-TR') + kelime.slice(1)
}

function doluMu(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value)
}

function Etiket({ children }) {
  return (
    <span className="rounded-full border border-dusty-rose/40 bg-dusty-rose/10 px-3 py-1 text-xs text-ink/75">
      {children}
    </span>
  )
}

function AiAnalysisPanel({ analysis }) {
  const veri = analysis?.veri
  if (!veri || typeof veri !== 'object') return null

  // Izgaraya girecek dolu alanlar, ALAN_ETIKETLERI sırasına göre.
  const alanlar = Object.entries(veri)
    .filter(([key, value]) => !IZGARA_DISI.has(key) && doluMu(value))
    .sort(([a], [b]) => alanSirasi(a) - alanSirasi(b))

  const uyumluluk = Object.entries(veri.uyumluluk ?? {})
    .filter(([, value]) => doluMu(value))
    .sort(([a], [b]) => uyumlulukSirasi(a) - uyumlulukSirasi(b))
  const aciklama = veri.genel_aciklama

  // Model hiçbir alanı dolduramadıysa boş bir başlık göstermek yerine
  // bölümü tamamen gizle.
  if (alanlar.length === 0 && uyumluluk.length === 0 && !aciklama) return null

  const analizTarihi = analysis.analiz_tarihi ? new Date(analysis.analiz_tarihi) : null

  return (
    <section className="mt-12 animate-fade-in">
      <div className="flex items-center gap-2">
        <Sparkles size={13} strokeWidth={1.75} className="text-accent-ink" />
        <p className="text-[12px] font-medium uppercase tracking-[0.15em] text-accent-ink">
          Yapay Zekâ Analizi
        </p>
      </div>
      <h2 className="mt-2 font-display text-2xl italic text-ink">Bu Parça Hakkında</h2>
      <div className="mt-3 h-px w-16 bg-dusty-rose" />

      {aciklama && (
        <p className="mt-5 font-body text-base leading-relaxed text-ink/75">{aciklama}</p>
      )}

      {alanlar.length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {alanlar.map(([key, value]) => (
            <div key={key} className="rounded-2xl border border-ink/10 bg-surface px-4 py-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-ink/45">
                {etiketle(key, ALAN_ETIKETLERI)}
              </p>
              {Array.isArray(value) ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {value.map((item) => (
                    <Etiket key={item}>{item}</Etiket>
                  ))}
                </div>
              ) : (
                <p className="mt-1 font-body text-sm text-ink">{value}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {uyumluluk.length > 0 && (
        <div className="mt-6 rounded-2xl border border-ink/10 bg-surface px-5 py-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-ink/45">
            Uyumluluk
          </p>
          <div className="mt-4 space-y-4">
            {uyumluluk.map(([key, value]) => (
              <div key={key}>
                <p className="font-body text-sm text-ink/60">
                  {etiketle(key, UYUMLULUK_ETIKETLERI)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {value.map((item) => (
                    <Etiket key={item}>{item}</Etiket>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kaynağı gizlemiyoruz: kullanıcı bu bilgilerin editöryal bir insan
          yorumu değil, otomatik bir analiz olduğunu bilmeli. */}
      <p className="mt-4 text-xs text-ink/40">
        {analysis.model ? `${analysis.model} ile ` : ''}otomatik oluşturuldu
        {analizTarihi && !Number.isNaN(analizTarihi.getTime())
          ? ` · ${dateFormatter.format(analizTarihi)}`
          : ''}
      </p>
    </section>
  )
}

export default AiAnalysisPanel
