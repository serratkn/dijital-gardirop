import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CLOTHES, OUTFITS } from '../data/clothing'
import Button from '../components/ui/Button'

function ClothingDetail() {
  const { id } = useParams()
  const [isFavorite, setIsFavorite] = useState(false)

  const item = CLOTHES.find((clothing) => clothing.id === Number(id))
  const relatedOutfits = item
    ? OUTFITS.filter((outfit) => outfit.itemIds.includes(item.id))
    : []

  if (!item) {
    return (
      <div className="min-h-screen bg-ivory">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center sm:px-8">
          <p className="font-display text-2xl italic text-ink">Kıyafet bulunamadı.</p>
          <Link
            to="/gardirop"
            className="mt-6 inline-block text-sm text-ink/50 transition-colors hover:text-dusty-rose"
          >
            Gardıroba dön
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Link
            to="/gardirop"
            className="inline-flex items-center gap-2 text-sm text-ink/60 transition-colors hover:text-dusty-rose"
          >
            <svg viewBox="0 0 24 24" strokeWidth="1.5" className="h-4 w-4 fill-none stroke-current">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Gardıroba Geri Dön
          </Link>

          <nav className="flex items-center gap-1.5 text-xs text-ink/40">
            <Link to="/gardirop" className="transition-colors hover:text-dusty-rose">
              Gardırop
            </Link>
            <span className="text-ink/25">/</span>
            <Link
              to={`/gardirop?kategori=${encodeURIComponent(item.category)}`}
              className="transition-colors hover:text-dusty-rose"
            >
              {item.category}
            </Link>
            <span className="text-ink/25">/</span>
            <span className="text-ink/50">{item.name}</span>
          </nav>
        </div>

        <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-14">
          <div className="min-h-[24rem] rounded-3xl border border-ink/10 bg-warm-gray shadow-[0_8px_24px_-14px_rgba(28,26,23,0.18)] md:min-h-[32rem]" />

          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.15em] text-dusty-rose">
              {item.category}
            </p>
            <h1 className="mt-3 font-display text-4xl italic text-ink sm:text-5xl">{item.name}</h1>

            <div className="mt-6">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink/50">Renk</p>
              <p className="mt-1 font-body text-base text-ink">{item.color}</p>
            </div>

            <div className="mt-10">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink/50">
                Bu Kıyafetle Yapılan Kombinler
              </p>
              {relatedOutfits.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2.5">
                  {relatedOutfits.map((outfit) => (
                    <span
                      key={outfit.id}
                      className="rounded-full border border-ink/10 bg-warm-gray px-4 py-1.5 text-sm text-ink/70"
                    >
                      {outfit.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-ink/50">Henüz bir kombinde kullanılmadı.</p>
              )}
            </div>

            <div className="mt-10">
              <Button
                variant="outline"
                onClick={() => setIsFavorite((prev) => !prev)}
                className="inline-flex items-center gap-2"
              >
                <svg viewBox="0 0 24 24" strokeWidth="1.5" className="h-4 w-4">
                  <path
                    d="M12 21s-7.5-4.6-10-9.3C.5 8 2 4.5 5.5 4c2-.3 3.8.7 6.5 3.2C14.7 4.7 16.5 3.7 18.5 4c3.5.5 5 4 3.5 7.7C19.5 16.4 12 21 12 21z"
                    className={isFavorite ? 'fill-burgundy stroke-burgundy' : 'fill-none stroke-dusty-rose'}
                  />
                </svg>
                {isFavorite ? 'Favorilerde' : 'Favorilere Ekle'}
              </Button>
            </div>

            <button
              type="button"
              className="mt-10 text-xs text-burgundy/60 transition-colors hover:text-burgundy"
            >
              Sil
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClothingDetail
