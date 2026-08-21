import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Loader2, Share2 } from 'lucide-react'
import ShareOutfitCard from '../ShareOutfitCard'
import {
  buildFileName,
  downloadBlob,
  embedItemImages,
  renderCardToBlob,
  toShareItems,
} from '../../lib/shareCard'

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

// Kombini Story oranında bir PNG olarak indirir.
//
// Kart yalnızca ÜRETİM SIRASINDA DOM'a girer (cardItems state'i doluyken) ve
// iş bitince kaldırılır: sayfada sürekli duran gizli bir kopya, her kombin
// kartı için ekstra DOM + görsel yükü demek olurdu.
function ShareButton({ occasion, items, createdAt, categoryNames, className = '', label = 'Paylaş' }) {
  const cardRef = useRef(null)
  const [cardItems, setCardItems] = useState(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState('')

  const isEmpty = !items || items.length === 0

  const handleShare = async () => {
    if (isBusy || isEmpty) return

    setIsBusy(true)
    setError('')

    try {
      // 1) Fotoğrafları data URI olarak göm (CORS/taint riskini bitirir)
      const prepared = await embedItemImages(toShareItems(items, categoryNames))

      // 2) Gizli kartı DOM'a al.
      // flushSync ŞART: React güncellemeyi kendi zamanlamasına göre işler ve
      // `setCardItems` sonrası DOM'un HAZIR OLDUĞU garanti değildir. Önce
      // setTimeout(0) ile beklenmişti; fotoğrafsız kombinde çalışıyor,
      // fotoğraflı olanda (embedItemImages'in await'i zamanlamayı kaydırınca)
      // cardRef.current null kalıyordu. flushSync commit'i senkron yapar.
      flushSync(() => setCardItems(prepared))

      if (!cardRef.current) throw new Error('Paylaşım kartı hazırlanamadı')

      // 3) PNG'ye çevir ve indir
      const blob = await renderCardToBlob(cardRef.current)
      downloadBlob(blob, buildFileName(occasion))
    } catch (caught) {
      // Sayfa ASLA çökmemeli: görsel üretimi tarayıcıya bağlıdır ve
      // desteklenmediği ortamlar olabilir.
      console.error('Kombin görseli oluşturulamadı:', caught)
      setError('Görsel oluşturulamadı. Tarayıcın bu özelliği desteklemiyor olabilir.')
    } finally {
      setCardItems(null)
      setIsBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleShare}
        disabled={isBusy || isEmpty}
        aria-label={isEmpty ? 'Paylaşılacak parça yok' : 'Kombini görsel olarak indir'}
        className={
          'inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-sm ' +
          'font-medium text-ink transition-colors duration-200 hover:border-dusty-rose ' +
          'hover:text-accent-ink disabled:pointer-events-none disabled:opacity-50 ' +
          className
        }
      >
        {isBusy ? (
          <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
        ) : (
          <Share2 size={15} strokeWidth={1.75} />
        )}
        {isBusy ? 'Hazırlanıyor...' : label}
      </button>

      {error && <p className="mt-2 text-sm text-burgundy">{error}</p>}

      {/* Ekran dışı sarmalayıcı. Konumlandırma KARTA DEĞİL buraya konur:
          html-to-image yakaladığı düğümün stillerini klona kopyaladığı için
          kartın kendisi `position:fixed` olsaydı görsel boş çıkardı.
          `display:none` de olamaz — o hâlde kartın ölçüsü sıfır olurdu. */}
      {cardItems && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', left: -10000, top: 0, pointerEvents: 'none', zIndex: -1 }}
        >
          <ShareOutfitCard
            ref={cardRef}
            occasion={occasion}
            items={cardItems}
            dateLabel={dateFormatter.format(createdAt ? new Date(createdAt) : new Date())}
          />
        </div>
      )}
    </>
  )
}

export default ShareButton
