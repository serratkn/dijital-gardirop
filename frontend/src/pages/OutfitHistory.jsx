import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Heart, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { CATEGORY_ICONS } from '../lib/categoryIcons'
import {
  getCurrentUserId,
  deleteOutfit,
  fetchCategories,
  fetchOutfits,
  toggleOutfitFavorite,
} from '../lib/api'
import { toCategoryNameMap } from '../lib/transformers'

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function OutfitCard({ outfit, categoryNames, onToggleFavorite, onRequestDelete }) {
  const [isPending, setIsPending] = useState(false)

  const handleFavorite = async () => {
    if (isPending) return
    setIsPending(true)
    await onToggleFavorite(outfit)
    setIsPending(false)
  }

  return (
    <article className="rounded-2xl border border-ink/10 bg-white p-6 shadow-[0_8px_24px_-14px_rgba(28,26,23,0.18)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.15em] text-dusty-rose">
            {outfit.occasion || 'Kombin'}
          </p>
          <p className="mt-1 text-xs text-ink/45">
            {dateFormatter.format(new Date(outfit.created_at))}
            {outfit.times_worn > 0 && ` · ${outfit.times_worn} kez giyildi`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleFavorite}
            disabled={isPending}
            aria-label={outfit.is_favorite ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            aria-pressed={outfit.is_favorite}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-warm-gray disabled:opacity-50"
          >
            <Heart
              size={17}
              strokeWidth={1.75}
              className={outfit.is_favorite ? 'fill-burgundy text-burgundy' : 'text-ink/35'}
            />
          </button>
          <button
            type="button"
            onClick={() => onRequestDelete(outfit)}
            aria-label="Kombini sil"
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink/35 transition-colors hover:bg-warm-gray hover:text-burgundy"
          >
            <Trash2 size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {outfit.items.length === 0 ? (
        <p className="mt-5 text-sm text-ink/50">
          Bu kombindeki parçalar gardırobundan silinmiş.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {outfit.items.map((item) => {
            const categoryName = categoryNames.get(item.category_id)
            const CategoryIcon = CATEGORY_ICONS[categoryName]
            return (
              <Link
                key={item.id}
                to={`/kiyafet/${item.id}`}
                className="group overflow-hidden rounded-xl border border-ink/10 transition-colors hover:border-dusty-rose"
              >
                <div className="flex h-20 items-center justify-center bg-warm-gray">
                  {CategoryIcon && (
                    <CategoryIcon size={20} strokeWidth={1.5} className="text-ink/35" />
                  )}
                </div>
                <p className="px-3 py-2 text-xs leading-snug text-ink/70">{item.name}</p>
              </Link>
            )
          })}
        </div>
      )}
    </article>
  )
}

function OutfitHistory() {
  const [outfits, setOutfits] = useState([])
  const [categoryNames, setCategoryNames] = useState(new Map())
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [actionError, setActionError] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const loadOutfits = useCallback(async () => {
    setIsLoading(true)
    setHasError(false)

    try {
      // Kategoriler parça kartlarındaki ikonlar için gerekli.
      const [categoryRows, outfitRows] = await Promise.all([
        fetchCategories(),
        fetchOutfits(getCurrentUserId()),
      ])

      setCategoryNames(toCategoryNameMap(categoryRows))
      setOutfits(outfitRows)
    } catch (error) {
      console.error('Kombinler alınamadı:', error)
      setHasError(true)
      setOutfits([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOutfits()
  }, [loadOutfits])

  // İyimser güncelleme: kalp anında dolar, hata olursa eski haline döner.
  const handleToggleFavorite = async (outfit) => {
    const previous = outfit.is_favorite
    setActionError('')
    setOutfits((rows) =>
      rows.map((row) => (row.id === outfit.id ? { ...row, is_favorite: !previous } : row)),
    )

    try {
      const updated = await toggleOutfitFavorite(outfit.id)
      setOutfits((rows) =>
        rows.map((row) => (row.id === outfit.id ? { ...row, is_favorite: updated.is_favorite } : row)),
      )
    } catch (error) {
      console.error('Kombin favorisi güncellenemedi:', error)
      setOutfits((rows) =>
        rows.map((row) => (row.id === outfit.id ? { ...row, is_favorite: previous } : row)),
      )
      setActionError(error.message)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return

    setIsDeleting(true)
    setActionError('')

    try {
      await deleteOutfit(pendingDelete.id)
      setOutfits((rows) => rows.filter((row) => row.id !== pendingDelete.id))
      setPendingDelete(null)
    } catch (error) {
      console.error('Kombin silinemedi:', error)
      setActionError(error.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const favoriteCount = outfits.filter((outfit) => outfit.is_favorite).length

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-4xl px-6 py-14 sm:px-8">
        <PageHeader
          title="Kombinlerim"
          subtitle="Kaydettiğin kombinler, en yeniden eskiye."
          stats={
            isLoading || hasError
              ? []
              : [`${outfits.length} Kombin`, `${favoriteCount} Favori`]
          }
        />

        {actionError && <p className="mt-6 text-sm text-burgundy">{actionError}</p>}

        {isLoading ? (
          <div className="mt-12 space-y-6">
            {[0, 1, 2].map((index) => (
              <div key={index} className="rounded-2xl border border-ink/10 bg-white p-6">
                <div className="h-3 w-24 animate-pulse rounded-full bg-warm-gray" />
                <div className="mt-2 h-3 w-32 animate-pulse rounded-full bg-warm-gray" />
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[0, 1, 2, 3].map((slot) => (
                    <div key={slot} className="h-28 animate-pulse rounded-xl bg-warm-gray" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : hasError ? (
          <EmptyState
            title="Kombinlerine şu an ulaşılamıyor."
            subtitle="Sunucuya bağlanamadık. Bağlantını kontrol edip sayfayı yenilemeyi dene."
          />
        ) : outfits.length === 0 ? (
          <EmptyState
            title="Henüz kaydettiğin bir kombin yok."
            subtitle="Kombin Öner sayfasından sana uygun bir kombin oluşturup kaydedebilirsin."
          />
        ) : (
          <div className="mt-12 space-y-6 animate-fade-in">
            {outfits.map((outfit) => (
              <OutfitCard
                key={outfit.id}
                outfit={outfit}
                categoryNames={categoryNames}
                onToggleFavorite={handleToggleFavorite}
                onRequestDelete={setPendingDelete}
              />
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={Boolean(pendingDelete)} onClose={() => !isDeleting && setPendingDelete(null)}>
        <h2 className="font-display text-2xl italic text-ink">Bu kombini sil</h2>
        <p className="mt-3 text-sm text-ink/60">
          <span className="font-medium text-ink">{pendingDelete?.occasion || 'Kombin'}</span> kaydı
          silinecek. Kombindeki parçalar gardırobunda kalır.
        </p>

        <div className="mt-8 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPendingDelete(null)}
            disabled={isDeleting}
            className="flex-1"
          >
            Vazgeç
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1"
          >
            {isDeleting ? 'Siliniyor...' : 'Sil'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

export default OutfitHistory
