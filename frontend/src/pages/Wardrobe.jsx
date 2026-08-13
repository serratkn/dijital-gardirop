import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { CATEGORIES, CLOTHES } from '../data/clothing'
import { CATEGORY_ICONS } from '../lib/categoryIcons'
import ClothingCard from '../components/ClothingCard'
import SkeletonCard from '../components/SkeletonCard'
import QuickAddModal from '../components/QuickAddModal'
import PageHeader from '../components/ui/PageHeader'
import FilterPills from '../components/ui/FilterPills'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'

const ALL = 'Tümü'
const LOADING_DURATION = 550

const CATEGORY_COUNTS = [ALL, ...CATEGORIES].reduce((acc, category) => {
  acc[category] =
    category === ALL ? CLOTHES.length : CLOTHES.filter((item) => item.category === category).length
  return acc
}, {})

// Test amaçlı: gardırobun tamamını boş göstermek için true yapın.
const DEV_FORCE_EMPTY = false
// Test amaçlı: belirli bir kategoriyi boş göstermek için kategori adını yazın (örn. 'Elbise'), kapatmak için null yapın.
const DEV_FORCE_EMPTY_CATEGORY = null

function Wardrobe() {
  const [searchParams] = useSearchParams()
  const [activeCategory, setActiveCategory] = useState(() => {
    const requested = searchParams.get('kategori')
    return CATEGORIES.includes(requested) ? requested : ALL
  })
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const loadingTimeoutRef = useRef(null)

  useEffect(() => {
    setIsLoading(true)
    clearTimeout(loadingTimeoutRef.current)
    loadingTimeoutRef.current = setTimeout(() => setIsLoading(false), LOADING_DURATION)
    return () => clearTimeout(loadingTimeoutRef.current)
  }, [activeCategory])

  const isEmpty = DEV_FORCE_EMPTY || CLOTHES.length === 0

  const categoryItems =
    activeCategory === DEV_FORCE_EMPTY_CATEGORY
      ? []
      : activeCategory === ALL
        ? CLOTHES
        : CLOTHES.filter((item) => item.category === activeCategory)

  const trimmedQuery = searchQuery.trim().toLowerCase()
  const items = trimmedQuery
    ? categoryItems.filter((item) => item.name.toLowerCase().includes(trimmedQuery))
    : categoryItems

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
        {isEmpty ? (
          <EmptyState
            title="Gardırobun henüz boş."
            subtitle="İlk parçanı ekleyerek kendi stil koleksiyonunu oluşturmaya başla."
            actionLabel="İlk Parçamı Ekle"
            onAction={() => setIsAddModalOpen(true)}
          />
        ) : (
          <>
            <PageHeader
              title="Gardırobum"
              subtitle="Tarzını oluşturan tüm parçalar, tek yerde."
              stats={[`${CLOTHES.length} Parça`, '8 Kombin', '5 Favori']}
              actionLabel="Yeni Parça Ekle"
              onAction={() => setIsAddModalOpen(true)}
            />

            <div className="mt-10 max-w-xs">
              <div className="relative">
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
                  className="w-full rounded-full border border-ink/15 bg-white py-2.5 pl-10 pr-4 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-4">
              <FilterPills
                options={[ALL, ...CATEGORIES]}
                active={activeCategory}
                onChange={setActiveCategory}
                icons={CATEGORY_ICONS}
                counts={CATEGORY_COUNTS}
              />
            </div>

            {items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
                <p className="text-sm text-ink/50">
                  {trimmedQuery
                    ? 'Aramanızla eşleşen bir parça bulunamadı.'
                    : 'Bu kategoride henüz parça yok.'}
                </p>
                {!trimmedQuery && (
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
            ) : isLoading ? (
              <div className="mt-12 columns-2 gap-6 sm:columns-3 lg:columns-4">
                {items.map((item) => (
                  <SkeletonCard key={item.id} imgHeight={item.imgHeight} />
                ))}
              </div>
            ) : (
              <div className="mt-12 columns-2 gap-6 sm:columns-3 lg:columns-4 animate-fade-in">
                {items.map((item) => (
                  <ClothingCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <QuickAddModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
    </div>
  )
}

export default Wardrobe
