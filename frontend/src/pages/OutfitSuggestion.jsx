import { useEffect, useRef, useState } from 'react'
import PageHeader from '../components/ui/PageHeader'
import FilterPills from '../components/ui/FilterPills'
import Button from '../components/ui/Button'
import ClothingCard from '../components/ClothingCard'
import { CLOTHES, OUTFITS } from '../data/clothing'

const OCCASIONS = ['Üniversite', 'İş', 'Akşam Yemeği', 'Buluşma', 'Spor', 'Özel Davet']
const LOADING_DURATION = 900

function OutfitSuggestion() {
  const [selectedOccasion, setSelectedOccasion] = useState('')
  const [customText, setCustomText] = useState('')
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [isSaved, setIsSaved] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const loadingTimeoutRef = useRef(null)

  useEffect(() => {
    return () => clearTimeout(loadingTimeoutRef.current)
  }, [])

  const selectOccasion = (occasion) => {
    setSelectedOccasion(occasion)
    setSuggestionIndex(0)
    setIsSaved(false)
    setIsLoading(true)

    clearTimeout(loadingTimeoutRef.current)
    loadingTimeoutRef.current = setTimeout(() => {
      setIsLoading(false)
    }, LOADING_DURATION)
  }

  const handleCustomSubmit = (event) => {
    event.preventDefault()
    if (!customText.trim()) return
    selectOccasion(customText.trim())
  }

  const showAnother = () => {
    setSuggestionIndex((prev) => (prev + 1) % OUTFITS.length)
    setIsSaved(false)
  }

  const suggestionItems = OUTFITS[suggestionIndex].itemIds
    .map((id) => CLOTHES.find((item) => item.id === id))
    .filter(Boolean)

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
        <PageHeader
          title="Kombin Öner"
          subtitle="Bugün nereye gidiyorsun? Sana uygun kombini bulalım."
        />

        <div className="mt-12 rounded-3xl border border-ink/10 bg-warm-gray p-8 sm:p-10">
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink/50">
            Hazır Durumlar
          </p>
          <div className="mt-4">
            <FilterPills options={OCCASIONS} active={selectedOccasion} onChange={selectOccasion} />
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
            <p className="mt-2 text-sm text-ink/50">{selectedOccasion} için seçtiklerimiz</p>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-burgundy/25 border-t-burgundy" />
                <p className="text-sm text-ink/50">Kombinin hazırlanıyor...</p>
              </div>
            ) : (
              <div className="animate-fade-in">
                <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
                  {suggestionItems.map((item) => (
                    <ClothingCard key={item.id} item={item} />
                  ))}
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Button variant="outline" onClick={showAnother}>
                    Başka Öneri Göster
                  </Button>
                  <Button variant="rose" onClick={() => setIsSaved((prev) => !prev)}>
                    {isSaved ? 'Kaydedildi' : 'Bu Kombini Kaydet'}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  )
}

export default OutfitSuggestion
