import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WashingMachine } from 'lucide-react'
import { CATEGORY_ICONS } from '../lib/categoryIcons'
import {
  logImageOutcome,
  resolveImageUrl,
  toggleClothingItemCleanStatus,
  toggleClothingItemFavorite,
} from '../lib/api'

function ClothingCard({ item, onFavoriteChange, onCleanChange }) {
  const [isFavorite, setIsFavorite] = useState(item.isFavorite ?? false)
  // Alan gelmemişse (eski önbellek, kısmi yanıt) parça temiz sayılır.
  const [isClean, setIsClean] = useState(item.isClean ?? true)
  const [isPending, setIsPending] = useState(false)
  const [isCleanPending, setIsCleanPending] = useState(false)
  // Bozuk/silinmiş dosyada kırık resim ikonu yerine placeholder'a düşülür.
  const [imageFailed, setImageFailed] = useState(false)
  const CategoryIcon = CATEGORY_ICONS[item.category]
  const photoUrl = imageFailed ? null : resolveImageUrl(item.imageUrl)

  // Liste yeniden yüklendiğinde (örn. yeni parça eklendikten sonra)
  // karttaki durum tazelenen veriyle hizalanır.
  useEffect(() => {
    setIsFavorite(item.isFavorite ?? false)
  }, [item.isFavorite])

  useEffect(() => {
    setIsClean(item.isClean ?? true)
  }, [item.isClean])

  const toggleFavorite = async (event) => {
    // Kart bir Link olduğu için tıklama yönlendirmeyi tetiklememeli.
    event.preventDefault()
    event.stopPropagation()

    if (isPending) return

    const previous = isFavorite
    const next = !previous

    // İyimser güncelleme: arayüz anında tepki verir, istek arkada gider.
    setIsFavorite(next)
    setIsPending(true)

    try {
      const updated = await toggleClothingItemFavorite(item.id)
      // Sunucunun döndürdüğü değer nihai kaynaktır.
      setIsFavorite(updated.is_favorite)
      onFavoriteChange?.(item.id, updated.is_favorite)
    } catch (error) {
      console.error('Favori durumu güncellenemedi:', error)
      setIsFavorite(previous)
    } finally {
      setIsPending(false)
    }
  }

  // Favori toggle'ıyla aynı desen: iyimser güncelleme, hata olursa geri alınır.
  const toggleCleanStatus = async (event) => {
    event.preventDefault()
    event.stopPropagation()

    if (isCleanPending) return

    const previous = isClean

    setIsClean(!previous)
    setIsCleanPending(true)

    try {
      const updated = await toggleClothingItemCleanStatus(item.id)
      setIsClean(updated.is_clean)
      onCleanChange?.(item.id, updated.is_clean)
    } catch (error) {
      console.error('Temizlik durumu güncellenemedi:', error)
      setIsClean(previous)
    } finally {
      setIsCleanPending(false)
    }
  }

  return (
    <Link
      to={`/kiyafet/${item.id}`}
      className="group mb-6 block break-inside-avoid overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-[var(--dg-shadow-card)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[var(--dg-shadow-card-hover)]"
    >
      <div className={`relative overflow-hidden bg-warm-gray ${item.imgHeight}`}>
        {/* object-cover: fotoğraf oranı ne olursa olsun masonry yüksekliği korunur */}
        {photoUrl && (
          <img
            src={photoUrl}
            alt={item.name}
            loading="lazy"
            onLoad={() => logImageOutcome(item.name, photoUrl, 'YUKLENDI')}
            onError={() => {
              logImageOutcome(item.name, photoUrl, 'HATA')
              setImageFailed(true)
            }}
            className="h-full w-full object-cover"
          />
        )}
        {/* Rozet yalnızca kirliyken görünür; temiz parça için etiket gürültüdür. */}
        {!isClean && (
          <span className="pointer-events-none absolute left-3 top-3 flex items-center gap-1 rounded-full border border-dusty-rose/40 bg-ivory/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-burgundy/80 backdrop-blur-sm">
            <WashingMachine size={11} strokeWidth={1.75} />
            Kirli
          </span>
        )}

        {/* Toggle yalnızca hover'da çıkar: kalıcı gösterge zaten soldaki rozettir,
            buton da sürekli dursaydı köşe kalabalıklaşırdı. Dokunmatikte durum
            değiştirmek için detay sayfasındaki buton kullanılır (favori kalbi de
            aynı sınırlamaya sahip). */}
        <button
          type="button"
          onClick={toggleCleanStatus}
          aria-label={isClean ? 'Kirli olarak işaretle' : 'Temiz olarak işaretle'}
          aria-pressed={!isClean}
          className="absolute right-12 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ivory/70 opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100"
        >
          <WashingMachine
            size={15}
            strokeWidth={1.75}
            className={isClean ? 'text-accent-ink' : 'text-burgundy'}
          />
        </button>

        <button
          type="button"
          onClick={toggleFavorite}
          aria-label={isFavorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          aria-pressed={isFavorite}
          className={`absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ivory/70 backdrop-blur-sm transition-opacity duration-200 ${
            isFavorite ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          <svg viewBox="0 0 24 24" strokeWidth="1.5" className="h-4 w-4">
            <path
              d="M12 21s-7.5-4.6-10-9.3C.5 8 2 4.5 5.5 4c2-.3 3.8.7 6.5 3.2C14.7 4.7 16.5 3.7 18.5 4c3.5.5 5 4 3.5 7.7C19.5 16.4 12 21 12 21z"
              className={
                isFavorite
                  ? 'fill-burgundy stroke-burgundy'
                  : 'fill-none stroke-dusty-rose transition-colors duration-200 hover:fill-burgundy hover:stroke-burgundy'
              }
            />
          </svg>
        </button>
      </div>
      <div className="space-y-2 p-5">
        <p className="flex items-center gap-1 text-[12px] font-medium uppercase tracking-[0.15em] text-accent-ink">
          {CategoryIcon && <CategoryIcon size={12} strokeWidth={1.75} />}
          {item.category}
        </p>
        <p className="font-body text-[17px] font-medium leading-snug text-ink">
          {item.name}
        </p>
      </div>
    </Link>
  )
}

export default ClothingCard
