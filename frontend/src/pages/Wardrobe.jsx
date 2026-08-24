import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Heart, Plus, Search } from 'lucide-react'
import { CATEGORY_ICONS } from '../lib/categoryIcons'
import { fetchCategories, fetchClothingItems } from '../lib/api'
import { toCategoryNameMap, toClothingItems } from '../lib/transformers'
import ClothingCard from '../components/ClothingCard'
import SkeletonCard from '../components/SkeletonCard'
import QuickAddModal from '../components/QuickAddModal'
import PageHeader from '../components/ui/PageHeader'
import FilterPills from '../components/ui/FilterPills'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

const ALL = 'Tümü'
const SKELETON_COUNT = 8
const SKELETON_HEIGHTS = ['h-64', 'h-44', 'h-72', 'h-52', 'h-60', 'h-48', 'h-68', 'h-40']

function Wardrobe() {
  const [searchParams] = useSearchParams()
  const [items, setItems] = useState([])
  const [categoryNames, setCategoryNames] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [activeCategory, setActiveCategory] = useState(ALL)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  // Ana Sayfa'daki "Favori" kartı ?favori=1 ile buraya bağlanıyor (bkz.
  // Dashboard.jsx). Kategori filtresiyle aynı desen: yalnızca İLK yüklemede
  // URL'den okunur, sonrası yerel state'te kalır (URL'e geri yazılmaz).
  const [favoriteOnly, setFavoriteOnly] = useState(
    () => searchParams.get('favori') === '1',
  )

  // Yeni parça eklendikten sonra da çağrılabilmesi için efekt dışında tanımlı.
  // showSkeleton=false ile tazeleme sırasında liste yerinde kalır, iskelete dönmez.
  const loadWardrobe = useCallback(async ({ showSkeleton = true } = {}) => {
    if (showSkeleton) setIsLoading(true)
    setHasError(false)

    try {
      // Kategoriler paralel çekilir: parçalar yalnızca category_id taşıdığı
      // için ad eşlemesi olmadan filtre ve ikonlar çalışmaz.
      const [categoryRows, itemRows] = await Promise.all([
        fetchCategories(),
        fetchClothingItems(),
      ])

      const nameMap = toCategoryNameMap(categoryRows)
      setCategoryNames(categoryRows.map((row) => row.name))
      setItems(toClothingItems(itemRows, nameMap))
    } catch (error) {
      console.error('Gardırop verisi alınamadı:', error)
      setHasError(true)
      setItems([])
      setCategoryNames([])
    } finally {
      if (showSkeleton) setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadWardrobe()
  }, [loadWardrobe])

  // Favori değişimini listeye yansıtır ki sayaçlar ve kalp ikonu tutarlı kalsın.
  const handleFavoriteChange = useCallback((itemId, isFavorite) => {
    setItems((previous) =>
      previous.map((item) => (item.id === itemId ? { ...item, isFavorite } : item)),
    )
  }, [])

  // URL'deki ?kategori= yalnızca API'den gelen kategoriler bilindikten sonra
  // doğrulanabilir; bu yüzden ilk yüklemeden sonra uygulanır.
  useEffect(() => {
    const requested = searchParams.get('kategori')
    if (requested && categoryNames.includes(requested)) {
      setActiveCategory(requested)
    }
  }, [searchParams, categoryNames])

  const categoryCounts = useMemo(() => {
    const counts = { [ALL]: items.length }
    for (const name of categoryNames) {
      counts[name] = items.filter((item) => item.category === name).length
    }
    return counts
  }, [items, categoryNames])

  const favoriteCount = useMemo(
    () => items.filter((item) => item.isFavorite).length,
    [items],
  )

  const visibleItems = useMemo(() => {
    const byCategory =
      activeCategory === ALL
        ? items
        : items.filter((item) => item.category === activeCategory)

    const byFavorite = favoriteOnly ? byCategory.filter((item) => item.isFavorite) : byCategory

    const query = searchQuery.trim().toLowerCase()
    if (!query) return byFavorite

    return byFavorite.filter((item) => item.name.toLowerCase().includes(query))
  }, [items, activeCategory, favoriteOnly, searchQuery])

  // Yükleme bitmiş ve elde hiç parça yoksa (veri boş ya da istek başarısız)
  // sayfa çökmek yerine boş durum gösterir.
  const isEmpty = !isLoading && items.length === 0

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
        {isEmpty ? (
          <EmptyState
            title={hasError ? 'Gardırobuna şu an ulaşılamıyor.' : 'Gardırobun henüz boş.'}
            subtitle={
              hasError
                ? 'Sunucuya bağlanamadık. Bağlantını kontrol edip sayfayı yenilemeyi dene.'
                : 'İlk parçanı ekleyerek kendi stil koleksiyonunu oluşturmaya başla.'
            }
            actionLabel={hasError ? undefined : 'İlk Parçamı Ekle'}
            onAction={hasError ? undefined : () => setIsAddModalOpen(true)}
          />
        ) : (
          <>
            <PageHeader
              title="Gardırobum"
              subtitle="Tarzını oluşturan tüm parçalar, tek yerde."
              stats={
                isLoading ? [] : [`${items.length} Parça`, `${favoriteCount} Favori`]
              }
              actionLabel="Yeni Parça Ekle"
              onAction={() => setIsAddModalOpen(true)}
            />

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <div className="relative max-w-xs flex-1 sm:min-w-[220px]">
                <Search
                  size={16}
                  strokeWidth={1.75}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/40"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Kıyafet ara..."
                  className="w-full rounded-full border border-ink/15 bg-surface py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none"
                />
              </div>

              {/* FilterPills ile AYNI görsel dil (aktif/pasif hap) ama ayrı
                  bir bileşen: kategoriler gibi karşılıklı dışlayan bir set
                  değil, tek başına açık/kapalı bir anahtar. */}
              <button
                type="button"
                onClick={() => setFavoriteOnly((previous) => !previous)}
                aria-pressed={favoriteOnly}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  favoriteOnly
                    ? 'bg-burgundy text-on-primary'
                    : 'border border-ink/15 text-ink/60 hover:border-dusty-rose hover:text-accent-ink'
                }`}
              >
                <Heart
                  size={15}
                  strokeWidth={1.75}
                  className={favoriteOnly ? 'fill-on-primary stroke-on-primary' : ''}
                />
                Favoriler
                {favoriteCount > 0 && (
                  <span className={`text-xs font-normal ${favoriteOnly ? 'text-on-primary/70' : 'text-ink/40'}`}>
                    ({favoriteCount})
                  </span>
                )}
              </button>
            </div>

            {categoryNames.length > 0 && (
              <div className="mt-4">
                <FilterPills
                  options={[ALL, ...categoryNames]}
                  active={activeCategory}
                  onChange={setActiveCategory}
                  icons={CATEGORY_ICONS}
                  counts={categoryCounts}
                />
              </div>
            )}

            {isLoading ? (
              <div className="mt-12 columns-2 gap-6 sm:columns-3 lg:columns-4">
                {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                  <SkeletonCard
                    key={index}
                    imgHeight={SKELETON_HEIGHTS[index % SKELETON_HEIGHTS.length]}
                  />
                ))}
              </div>
            ) : visibleItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                <p className="text-sm text-ink/50">
                  {searchQuery.trim()
                    ? 'Aramanızla eşleşen bir parça bulunamadı.'
                    : favoriteOnly
                      ? 'Henüz favori işaretlediğin bir parça yok.'
                      : 'Bu kategoride henüz parça yok.'}
                </p>
                {!searchQuery.trim() && !favoriteOnly && (
                  <Button
                    variant="primary"
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-1 inline-flex items-center gap-1.5"
                  >
                    <Plus size={16} strokeWidth={1.75} />
                    Parça Ekle
                  </Button>
                )}
              </div>
            ) : (
              <div className="mt-12 columns-2 gap-6 sm:columns-3 lg:columns-4 animate-fade-in">
                {visibleItems.map((item) => (
                  <ClothingCard key={item.id} item={item} onFavoriteChange={handleFavoriteChange} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <QuickAddModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSaved={() => loadWardrobe({ showSkeleton: false })}
      />
    </div>
  )
}

export default Wardrobe
