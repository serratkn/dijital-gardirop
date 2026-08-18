import { useEffect, useState } from 'react'
import PageHeader from '../components/ui/PageHeader'
import FilterPills from '../components/ui/FilterPills'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import ClothingCard from '../components/ClothingCard'
import { getCurrentUserId, createOutfit, fetchCategories, fetchClothingItems } from '../lib/api'
import { toCategoryNameMap, toClothingItems } from '../lib/transformers'

const OCCASIONS = ['Üniversite', 'İş', 'Akşam Yemeği', 'Buluşma', 'Spor', 'Özel Davet']
const OUTFIT_CATEGORIES = ['Üst', 'Alt', 'Ayakkabı', 'Çanta']

// outfits.occasion kolonu VARCHAR(50); daha uzun metin veritabanı
// hatasına düşeceği için girişte sınırlanıyor.
const OCCASION_MAX_LENGTH = 50

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]

// Her kategoriden rastgele bir parça seçer; o kategoride hiç parça
// yoksa slot atlanır (kombin eksik parçayla da oluşabilir).
const buildRandomOutfit = (items) =>
  OUTFIT_CATEGORIES.map((category) => {
    const pool = items.filter((item) => item.category === category)
    return pool.length > 0 ? pickRandom(pool) : null
  }).filter(Boolean)

const isSameOutfit = (a, b) =>
  a.length === b.length && a.every((item, index) => item.id === b[index]?.id)

function OutfitSuggestion() {
  const [items, setItems] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const [selectedOccasion, setSelectedOccasion] = useState('')
  const [customText, setCustomText] = useState('')
  const [suggestionItems, setSuggestionItems] = useState([])

  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let isStale = false

    async function loadWardrobe() {
      setIsLoading(true)
      setHasError(false)

      try {
        // Kategoriler kombin kurulumu için şart: parçalar yalnızca
        // category_id taşır, seçim ise kategori adına göre yapılır.
        const [categoryRows, itemRows] = await Promise.all([
          fetchCategories(),
          fetchClothingItems(getCurrentUserId()),
        ])

        if (isStale) return

        setItems(toClothingItems(itemRows, toCategoryNameMap(categoryRows)))
      } catch (error) {
        if (isStale) return
        console.error('Gardırop verisi alınamadı:', error)
        setHasError(true)
        setItems([])
      } finally {
        if (!isStale) setIsLoading(false)
      }
    }

    loadWardrobe()

    return () => {
      isStale = true
    }
  }, [])

  const startSuggestion = (occasion) => {
    setSelectedOccasion(occasion)
    setSuggestionItems(buildRandomOutfit(items))
    setIsSaved(false)
    setSaveError('')
  }

  const handleCustomSubmit = (event) => {
    event.preventDefault()
    if (!customText.trim()) return
    startSuggestion(customText.trim())
  }

  const showAnother = () => {
    setSuggestionItems((previous) => {
      let next = buildRandomOutfit(items)
      let attempts = 0
      // Aynı kombinin üst üste gelmemesi için birkaç kez yeniden dener.
      while (attempts < 5 && isSameOutfit(next, previous)) {
        next = buildRandomOutfit(items)
        attempts += 1
      }
      return next
    })
    setIsSaved(false)
    setSaveError('')
  }

  const handleSave = async () => {
    if (suggestionItems.length === 0 || isSaving || isSaved) return

    setIsSaving(true)
    setSaveError('')

    try {
      await createOutfit({
        userId: getCurrentUserId(),
        occasion: selectedOccasion,
        clothingItemIds: suggestionItems.map((item) => item.id),
      })
      setIsSaved(true)
    } catch (error) {
      console.error('Kombin kaydedilemedi:', error)
      setSaveError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const saveButtonLabel = isSaving ? 'Kaydediliyor...' : isSaved ? 'Kaydedildi' : 'Bu Kombini Kaydet'

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
        <PageHeader
          title="Kombin Öner"
          subtitle="Bugün nereye gidiyorsun? Sana uygun kombini bulalım."
        />

        {isLoading ? (
          <div className="mt-12 rounded-3xl border border-ink/10 bg-warm-gray p-8 sm:p-10">
            <div className="h-3 w-32 animate-pulse rounded-full bg-ink/10" />
            <div className="mt-5 flex flex-wrap gap-2.5">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-9 w-28 animate-pulse rounded-full bg-ink/10" />
              ))}
            </div>
            <div className="mt-8 h-12 w-full animate-pulse rounded-full bg-ink/10" />
          </div>
        ) : hasError ? (
          <EmptyState
            title="Gardırobuna şu an ulaşılamıyor."
            subtitle="Kombin önerebilmek için gardırobundaki parçalara ihtiyacımız var. Bağlantını kontrol edip sayfayı yenilemeyi dene."
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="Önce gardırobunu dolduralım."
            subtitle="Kombin önerebilmemiz için gardırobunda en az bir parça olmalı."
          />
        ) : (
          <>
            <div className="mt-12 rounded-3xl border border-ink/10 bg-warm-gray p-8 sm:p-10">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink/50">
                Hazır Durumlar
              </p>
              <div className="mt-4">
                <FilterPills
                  options={OCCASIONS}
                  active={selectedOccasion}
                  onChange={startSuggestion}
                />
              </div>

              <div className="my-8 flex items-center gap-4">
                <span className="h-px flex-1 bg-ink/10" />
                <span className="text-xs uppercase tracking-widest text-ink/40">veya</span>
                <span className="h-px flex-1 bg-ink/10" />
              </div>

              <form onSubmit={handleCustomSubmit} className="flex flex-col gap-4 sm:flex-row">
                <input
                  type="text"
                  value={customText}
                  onChange={(event) => setCustomText(event.target.value)}
                  maxLength={OCCASION_MAX_LENGTH}
                  placeholder="Ya da kendi durumunu yaz..."
                  className="flex-1 rounded-full border border-ink/15 bg-white px-5 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none"
                />
                <Button type="submit" variant="primary">
                  Kombin Öner
                </Button>
              </form>
            </div>

            {selectedOccasion && (
              <section className="mt-16">
                <p className="font-display text-sm font-light italic text-ink/45">
                  Her gün yeni bir hikaye.
                </p>
                <h2 className="mt-2 font-display text-2xl italic text-ink">Senin İçin Önerimiz</h2>
                <p className="mt-2 text-sm text-ink/50">
                  {selectedOccasion} için seçtiklerimiz
                </p>

                <div className="animate-fade-in">
                  <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
                    {suggestionItems.map((item) => (
                      <ClothingCard key={item.id} item={item} />
                    ))}
                  </div>

                  {suggestionItems.length < OUTFIT_CATEGORIES.length && (
                    <p className="mt-4 text-sm text-ink/50">
                      Bazı kategorilerde parçan olmadığı için kombin eksik olabilir.
                    </p>
                  )}

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button variant="outline" onClick={showAnother}>
                      Başka Öneri Göster
                    </Button>
                    <Button variant="rose" onClick={handleSave} disabled={isSaving || isSaved}>
                      {saveButtonLabel}
                    </Button>
                  </div>

                  {saveError && <p className="mt-3 text-sm text-burgundy">{saveError}</p>}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default OutfitSuggestion
