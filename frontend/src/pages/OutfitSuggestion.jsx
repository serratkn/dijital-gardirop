import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { CloudSun } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import FilterPills from '../components/ui/FilterPills'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import ShareButton from '../components/ui/ShareButton'
import ClothingCard from '../components/ClothingCard'
import { createOutfit, fetchCategories, fetchClothingItems, fetchMe, fetchWeather } from '../lib/api'
import { toCategoryNameMap, toClothingItems } from '../lib/transformers'
import { OCCASIONS, OCCASION_STATE_KEY } from '../lib/occasions'
import { matchesSeason, seasonsForWeather } from '../lib/seasons'
import { cityLocative } from '../lib/cities'

const OUTFIT_CATEGORIES = ['Üst', 'Alt', 'Ayakkabı', 'Çanta']

// outfits.occasion kolonu VARCHAR(50); daha uzun metin veritabanı
// hatasına düşeceği için girişte sınırlanıyor.
const OCCASION_MAX_LENGTH = 50

const pickRandom = (list) => list[Math.floor(Math.random() * list.length)]

// Her kategoriden rastgele bir parça seçer; o kategoride seçilebilir parça
// yoksa slot atlanır (kombin eksik parçayla da oluşabilir).
// Kendisine YALNIZCA temiz parçalar verilir — filtreleme çağıranda yapılır ki
// sayfa "hiç parça yok" ile "temiz parça yok" durumlarını ayırt edebilsin.
//
// `seasons` verilirse hava durumuna uyan parçalar ÖNCELİKLİDİR ama ZORUNLU DEĞİL:
// o kategoride uygun sezonda parça yoksa tüm havuza düşülür. Sert filtre olsaydı
// hava durumu yüzünden kombin slotları boş kalırdı — istenen davranış
// "önceliklendir", "ele" değil.
const buildRandomOutfit = (items, seasons) =>
  OUTFIT_CATEGORIES.map((category) => {
    const pool = items.filter((item) => item.category === category)
    if (pool.length === 0) return null

    const preferred = pool.filter((item) => matchesSeason(item, seasons))
    return pickRandom(preferred.length > 0 ? preferred : pool)
  }).filter(Boolean)

const isSameOutfit = (a, b) =>
  a.length === b.length && a.every((item, index) => item.id === b[index]?.id)

function OutfitSuggestion() {
  const location = useLocation()
  // Ana Sayfa'daki "Hızlı Kombin Öner" kartı bu durumu router state ile taşır.
  const requestedOccasion = location.state?.[OCCASION_STATE_KEY]

  const [items, setItems] = useState([])
  const [weather, setWeather] = useState(null)
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
        // Kullanıcı kaydı hava durumu için gereken şehri taşır.
        const [categoryRows, itemRows, me] = await Promise.all([
          fetchCategories(),
          fetchClothingItems(),
          fetchMe(),
        ])

        if (isStale) return

        setItems(toClothingItems(itemRows, toCategoryNameMap(categoryRows)))

        // Hava durumu İSTEĞE BAĞLI bir zenginleştirmedir. Başarısız olursa
        // (anahtar yok, servis düşmüş, şehir tanınmıyor) sayfa hiçbir şey
        // olmamış gibi çalışır; bu yüzden kendi try/catch'i var ve hatası
        // hasError'a DÖNÜŞMEZ.
        if (me?.city) {
          try {
            const result = await fetchWeather(me.city)
            if (isStale) return
            // Kayıtlı şehir DEĞERİ saklanır (OpenWeatherMap'in döndürdüğü ad değil):
            // şehir listesindeki etiket ve bulunma hâli bu anahtarla bulunuyor.
            setWeather(
              result?.status === 'bilinmiyor' ? null : { ...result, cityValue: me.city },
            )
          } catch (error) {
            if (isStale) return
            console.error('Hava durumu alınamadı:', error)
            setWeather(null)
          }
        }
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

  // Kombin önerisi yalnızca temiz parçalardan kurulur. Kirli parçalar
  // gardıropta görünür, sadece bu seçimin dışında kalır.
  const cleanItems = useMemo(() => items.filter((item) => item.isClean !== false), [items])

  // "Hiç parçan yok" ile "temiz parçan yok" ayrı mesajları hak eder:
  // ilki gardırobu doldurmayı, ikincisi çamaşır yıkamayı gerektirir.
  const dirtyOnlyCategories = useMemo(
    () =>
      OUTFIT_CATEGORIES.filter(
        (category) =>
          items.some((item) => item.category === category) &&
          !cleanItems.some((item) => item.category === category),
      ),
    [items, cleanItems],
  )

  const emptyCategories = useMemo(
    () => OUTFIT_CATEGORIES.filter((category) => !items.some((item) => item.category === category)),
    [items],
  )

  // Karttan temizlik durumu değiştirilirse havuz da güncellenmeli ki
  // "Başka Öneri Göster" artık kirli olan parçayı seçmesin.
  const handleCleanChange = useCallback((itemId, isClean) => {
    setItems((previous) =>
      previous.map((item) => (item.id === itemId ? { ...item, isClean } : item)),
    )
  }, [])

  // Hava bilinmiyorsa null kalır ve buildRandomOutfit sezon önceliği uygulamaz —
  // yani şehri olmayan ya da hava durumu alınamayan kullanıcı için davranış
  // önceki hâliyle birebir aynı kalır.
  const preferredSeasons = useMemo(
    () => (weather ? seasonsForWeather(weather.status) : null),
    [weather],
  )

  const startSuggestion = useCallback(
    (occasion) => {
      setSelectedOccasion(occasion)
      setSuggestionItems(buildRandomOutfit(cleanItems, preferredSeasons))
      setIsSaved(false)
      setSaveError('')
    },
    [cleanItems, preferredSeasons],
  )

  // Ana Sayfa kartından gelindiyse kullanıcı tekrar tıklamak zorunda kalmadan
  // öneri üretilir. Gardırop yüklenmeden çalışamaz: buildRandomOutfit'in seçecek
  // parçası olmalı.
  //
  // Ref ile YALNIZCA BİR KEZ çalışır. cleanItems, karttaki temiz/kirli toggle'ıyla
  // değişiyor; guard olmasaydı efekt yeniden tetiklenip kullanıcının o sırada seçtiği
  // durumu ezer ve öneriyi habersizce yeniden üretirdi.
  const hasAppliedRequest = useRef(false)

  useEffect(() => {
    if (hasAppliedRequest.current) return
    if (isLoading || hasError || !requestedOccasion) return

    hasAppliedRequest.current = true
    startSuggestion(requestedOccasion)
  }, [isLoading, hasError, requestedOccasion, startSuggestion])

  const handleCustomSubmit = (event) => {
    event.preventDefault()
    if (!customText.trim()) return
    startSuggestion(customText.trim())
  }

  const showAnother = () => {
    setSuggestionItems((previous) => {
      let next = buildRandomOutfit(cleanItems, preferredSeasons)
      let attempts = 0
      // Aynı kombinin üst üste gelmemesi için birkaç kez yeniden dener.
      while (attempts < 5 && isSameOutfit(next, previous)) {
        next = buildRandomOutfit(cleanItems, preferredSeasons)
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
                  className="flex-1 rounded-full border border-ink/15 bg-surface px-5 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none"
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
                  {suggestionItems.length === 0 ? (
                    <div className="mt-6 rounded-2xl border border-ink/10 bg-warm-gray px-6 py-10 text-center">
                      <p className="font-display text-xl italic text-ink">
                        Şu an temiz parçan yok.
                      </p>
                      <p className="mt-2 text-sm text-ink/50">
                        Gardırobundaki parçaları yıkadıkça "Temiz" olarak işaretle,
                        kombin önerisi onları hemen kullansın.
                      </p>
                    </div>
                  ) : (
                    <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
                      {suggestionItems.map((item) => (
                        <ClothingCard key={item.id} item={item} onCleanChange={handleCleanChange} />
                      ))}
                    </div>
                  )}

                    {/* Hava durumu notu yalnızca gerçekten dikkate alındıysa görünür;
                      şehri olmayan ya da havası alınamayan kullanıcı hiçbir ek metin görmez. */}
                  {weather && suggestionItems.length > 0 && (
                    <p className="mt-4 flex items-center gap-1.5 text-sm text-ink/50">
                      <CloudSun size={15} strokeWidth={1.75} className="text-accent-ink" />
                      {cityLocative(weather.cityValue)} {weather.temperature}°C,{' '}
                      {weather.status} hava için önerildi.
                    </p>
                  )}

                {dirtyOnlyCategories.length > 0 && (
                    <ul className="mt-4 space-y-1">
                      {dirtyOnlyCategories.map((category) => (
                        <li key={category} className="text-sm text-ink/50">
                          Temiz {category} parçan yok — o kategori boş kaldı.
                        </li>
                      ))}
                    </ul>
                  )}

                  {emptyCategories.length > 0 && (
                    <p className="mt-4 text-sm text-ink/50">
                      Bazı kategorilerde parçan olmadığı için kombin eksik olabilir.
                    </p>
                  )}

                  <div className="mt-8 flex flex-wrap items-center gap-3">
                    <Button variant="outline" onClick={showAnother}>
                      Başka Öneri Göster
                    </Button>
                    <Button
                      variant="rose"
                      onClick={handleSave}
                      disabled={isSaving || isSaved || suggestionItems.length === 0}
                    >
                      {saveButtonLabel}
                    </Button>
                    {/* Öneri kaydedilmemiş olsa bile paylaşılabilir:
                        görsel tamamen istemcide üretilir, kayda bağlı değil. */}
                    <ShareButton occasion={selectedOccasion} items={suggestionItems} />
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
