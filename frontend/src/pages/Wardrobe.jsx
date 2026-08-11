import { useState } from 'react'
import { CATEGORIES, CLOTHES } from '../data/clothing'
import ClothingCard from '../components/ClothingCard'
import PageHeader from '../components/ui/PageHeader'
import FilterPills from '../components/ui/FilterPills'
import EmptyState from '../components/ui/EmptyState'

const ALL = 'Tümü'

function Wardrobe() {
  const [activeCategory, setActiveCategory] = useState(ALL)

  if (CLOTHES.length === 0) {
    return (
      <div className="min-h-screen bg-ivory">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
          <EmptyState
            title="Gardırobun henüz boş."
            subtitle="İlk parçanı ekleyerek kendi stil koleksiyonunu oluşturmaya başla."
            actionLabel="+ İlk Parçamı Ekle"
          />
        </div>
      </div>
    )
  }

  const items =
    activeCategory === ALL
      ? CLOTHES
      : CLOTHES.filter((item) => item.category === activeCategory)

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
        <PageHeader
          title="Gardırobum"
          subtitle="Tarzını oluşturan tüm parçalar, tek yerde."
          stats={[`${CLOTHES.length} Parça`, '8 Kombin', '5 Favori']}
          actionLabel="+ Yeni Parça Ekle"
        />

        <div className="mt-10">
          <FilterPills
            options={[ALL, ...CATEGORIES]}
            active={activeCategory}
            onChange={setActiveCategory}
          />
        </div>

        <div className="mt-12 columns-2 gap-6 sm:columns-3 lg:columns-4">
          {items.map((item) => (
            <ClothingCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Wardrobe
