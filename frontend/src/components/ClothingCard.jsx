import { useState } from 'react'
import { Link } from 'react-router-dom'

function ClothingCard({ item }) {
  const [isFavorite, setIsFavorite] = useState(false)

  const toggleFavorite = (event) => {
    event.preventDefault()
    event.stopPropagation()
    setIsFavorite((prev) => !prev)
  }

  return (
    <Link
      to={`/kiyafet/${item.id}`}
      className="group mb-6 block break-inside-avoid overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[0_8px_24px_-14px_rgba(28,26,23,0.18)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_36px_-14px_rgba(28,26,23,0.22)]"
    >
      <div className={`relative bg-warm-gray ${item.imgHeight}`}>
        <button
          type="button"
          onClick={toggleFavorite}
          aria-label="Favorilere ekle"
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
        <p className="text-[12px] font-medium uppercase tracking-[0.15em] text-dusty-rose">
          {item.category}
        </p>
        <p className="font-display text-[17px] font-semibold italic leading-snug text-ink">
          {item.name}
        </p>
      </div>
    </Link>
  )
}

export default ClothingCard
