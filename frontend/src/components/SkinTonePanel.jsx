import { resolveColorHex } from '../lib/colors'

// Ten tonu analizinin gösterimi. AiAnalysisPanel ile AYNI kart dilini kullanır
// (mikro etiket + rounded-2xl kartlar + etiket hapları) ama ayrı bir bileşen:
// veri şeması tamamen farklı ve bu panel Profil sayfasında yaşıyor.
//
// Analiz yoksa null döner — çağıran davet ekranını gösterir.

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Ten tonuna göre kısa bir açıklama. Gemini'nin "genel_tavsiye" alanından
// AYRI: bu sabit metin tonun ne demek olduğunu anlatır, tavsiye ise kişiye özel.
const TON_ACIKLAMALARI = {
  Sıcak: 'Altın, şeftali ve toprak tonları teninizin doğal ışığını öne çıkarır.',
  Soğuk: 'Gümüş, buz mavisi ve mücevher tonları teninizle daha uyumlu durur.',
  Nötr: 'Hem sıcak hem soğuk tonları rahatlıkla taşıyabilirsiniz.',
}

// Renk dairesi + adı. Palette olmayan bir renk (Gemini serbest metin üretir)
// sessizce dairesiz düz etikete düşer — uydurma bir renk göstermektense
// yalnızca adını yazmak doğru.
function RenkEtiketi({ ad, ustuCizili = false }) {
  const hex = resolveColorHex(ad)

  return (
    <span className="flex items-center gap-2 rounded-full border border-ink/10 bg-surface px-3 py-1.5">
      {hex && (
        <span
          className="h-4 w-4 shrink-0 rounded-full border border-ink/15"
          style={{ backgroundColor: hex }}
          aria-hidden="true"
        />
      )}
      <span className={`font-body text-sm text-ink/80 ${ustuCizili ? 'line-through opacity-70' : ''}`}>
        {ad}
      </span>
    </span>
  )
}

function SkinTonePanel({ analysis }) {
  const veri = analysis?.veri
  if (!veri || typeof veri !== 'object') return null

  const uyumlu = Array.isArray(veri.uyumlu_renkler) ? veri.uyumlu_renkler : []
  const uyumsuz = Array.isArray(veri.uyumsuz_renkler) ? veri.uyumsuz_renkler : []
  const metaller = Array.isArray(veri.uyumlu_metal_tonlari) ? veri.uyumlu_metal_tonlari : []

  const analizTarihi = analysis.analiz_tarihi ? new Date(analysis.analiz_tarihi) : null

  return (
    <div className="animate-fade-in" data-testid="ten-tonu-paneli">
      {/* Ten tonu — bölümün ana cevabı, öne çıkıyor. */}
      <div className="rounded-2xl border border-dusty-rose/40 bg-dusty-rose/10 px-5 py-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-accent-ink">
          Ten Tonun
        </p>
        <p className="mt-2 font-display text-3xl italic text-ink" data-testid="ten-tonu-degeri">
          {veri.ten_tonu}
        </p>
        {veri.ten_rengi_tanimi && (
          <p className="mt-1 font-body text-base text-ink/70">{veri.ten_rengi_tanimi}</p>
        )}
        {TON_ACIKLAMALARI[veri.ten_tonu] && (
          <p className="mt-3 font-body text-sm leading-relaxed text-ink/60">
            {TON_ACIKLAMALARI[veri.ten_tonu]}
          </p>
        )}
      </div>

      {uyumlu.length > 0 && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-surface px-5 py-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-ink/45">
            Sana Yakışan Renkler
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {uyumlu.map((renk) => (
              <RenkEtiketi key={renk} ad={renk} />
            ))}
          </div>
        </div>
      )}

      {uyumsuz.length > 0 && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-surface px-5 py-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-ink/45">
            Uzak Durman Önerilenler
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {uyumsuz.map((renk) => (
              <RenkEtiketi key={renk} ad={renk} ustuCizili />
            ))}
          </div>
        </div>
      )}

      {metaller.length > 0 && (
        <div className="mt-4 rounded-2xl border border-ink/10 bg-surface px-5 py-5">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-ink/45">
            Takı & Metal Tonu
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {metaller.map((metal) => (
              <RenkEtiketi key={metal} ad={metal} />
            ))}
          </div>
        </div>
      )}

      {veri.genel_tavsiye && (
        <p className="mt-5 font-body text-base leading-relaxed text-ink/75">
          {veri.genel_tavsiye}
        </p>
      )}

      {/* Kaynağı gizlemiyoruz (AiAnalysisPanel ile aynı ilke): kullanıcı bunun
          otomatik bir analiz olduğunu bilmeli. */}
      <p className="mt-4 text-xs text-ink/40">
        {analysis.model ? `${analysis.model} ile ` : ''}otomatik oluşturuldu
        {analizTarihi && !Number.isNaN(analizTarihi.getTime())
          ? ` · ${dateFormatter.format(analizTarihi)}`
          : ''}
      </p>
    </div>
  )
}

export default SkinTonePanel
export { RenkEtiketi }
