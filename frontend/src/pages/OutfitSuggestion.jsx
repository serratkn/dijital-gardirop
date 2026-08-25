import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Brush, Check, CloudSun, Loader2, Sparkles } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import FilterPills from '../components/ui/FilterPills'
import EmptyState from '../components/ui/EmptyState'
import Button from '../components/ui/Button'
import ShareButton from '../components/ui/ShareButton'
import ClothingCard from '../components/ClothingCard'
import {
  createOutfit,
  fetchCategories,
  fetchClothingItems,
  fetchCompanions,
  fetchMe,
  fetchSkinToneAnalysis,
  fetchWeather,
  interpretOutfitRequest,
} from '../lib/api'
import { toCategoryIdMap, toCategoryNameMap, toClothingItems } from '../lib/transformers'
import { OCCASIONS, OCCASION_STATE_KEY } from '../lib/occasions'
import { seasonsForWeather } from '../lib/seasons'
import { cityLocative } from '../lib/cities'
import { matchesSkinTone } from '../lib/skinTone'
import {
  CANDIDATE_CATEGORIES,
  OUTFIT_CATEGORIES,
  buildOutfitFromCandidates,
  buildRandomOutfit,
  isSameOutfit,
  pickMakeupItem,
  pickSeedItem,
  variantDepth,
} from '../lib/outfitBuilder'

// outfits.occasion kolonu VARCHAR(50); daha uzun metin veritabanı
// hatasına düşeceği için girişte sınırlanıyor. Bu sınır artık yalnızca
// GERİ DÜŞÜŞ yoluna uygulanır (Gemini yorumlaması başarısız olursa) —
// normal akışta occasion Gemini'nin döndürdüğü kısa bir kategoridir.
const OCCASION_MAX_LENGTH = 50

// Serbest metin kutusunun kendi sınırı: artık tek kelimelik bir occasion
// değil, tam bir cümle/paragraf yazılabiliyor. Backend'deki
// GeminiService.MAX_INTERPRETATION_TEXT_LENGTH ile AYNI tutulmalıdır —
// istemci sınırı sunucununkinden büyük olsaydı kullanıcı "gönder"e bastıktan
// SONRA 400 alırdı, küçük olsaydı gereksiz yere kısıtlardı.
const CUSTOM_TEXT_MAX_LENGTH = 500

// Kategori başına kaç aday istenecek. 1 değil N: "Başka Öneri Göster" aynı
// başlangıç parçasıyla bu havuzda ilerliyor (en yakın, ikinci en yakın…).
// Havuz kirli parçalarla incelebileceği için istenen sayı biraz cömert.
const COMPANION_LIMIT = 8

function OutfitSuggestion() {
  const location = useLocation()
  // Ana Sayfa'daki "Hızlı Kombin Öner" kartı bu durumu router state ile taşır.
  const requestedOccasion = location.state?.[OCCASION_STATE_KEY]

  const [items, setItems] = useState([])
  const [categoryIds, setCategoryIds] = useState(() => new Map())
  const [weather, setWeather] = useState(null)
  // Kullanıcının ten tonu (varsa). YALNIZCA BİLGİLENDİRİCİ bir işaret için
  // kullanılır; kombin mantığına hiç karışmaz.
  const [skinTone, setSkinTone] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  const [selectedOccasion, setSelectedOccasion] = useState('')
  const [customText, setCustomText] = useState('')
  // Gemini'nin serbest metni yorumlaması sürerken kısa bir "Anlıyorum..."
  // durumu gösterilir (birkaç saniye, senkron bir çağrı — reanalyze/ten tonu
  // analizindeki aynı desen). interpretation dolarsa "Anladığım kadarıyla"
  // özeti render edilir; başarısızlıkta null kalır ve hiçbir özet gösterilmez
  // (SESSİZ geri düşüş — bkz. handleCustomSubmit).
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [interpretation, setInterpretation] = useState(null)
  const [suggestionItems, setSuggestionItems] = useState([])
  // Kombinde vektör aramasının getirdiği en az bir parça var mı? Rozet
  // yalnızca bu doğruyken görünür — rastgele seçime düşülmüşse kullanıcıya
  // "tarzına göre seçildi" demek yanıltıcı olurdu.
  const [isSmart, setIsSmart] = useState(false)
  const [isSuggesting, setIsSuggesting] = useState(false)
  // Makyaj önerisi PARÇA NESNESİ olarak değil id olarak tutulur: kullanıcı
  // ürünü kirli işaretlerse bölüm anında kaybolmalı (aşağıdaki memo).
  const [makeupItemId, setMakeupItemId] = useState(null)
  // Bölüm KAPALI başlar; kullanıcı istemeden makyaj önerisi dayatılmaz.
  const [isMakeupOpen, setIsMakeupOpen] = useState(false)

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
        // Ters eşleme vektör sorgusu için gerekli: Chroma metadata'sında
        // kategori adı değil id var.
        setCategoryIds(toCategoryIdMap(categoryRows))

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
        // Ten tonu da İSTEĞE BAĞLI bir zenginleştirmedir (hava durumuyla aynı
        // ilke): kendi try/catch'i var ve hatası hasError'a DÖNÜŞMEZ. Analizi
        // olmayan kullanıcıda null döner ve hiçbir işaret gösterilmez.
        try {
          const tenTonu = await fetchSkinToneAnalysis()
          if (isStale) return
          setSkinTone(tenTonu?.analiz?.veri?.ten_tonu ?? null)
        } catch (error) {
          if (isStale) return
          console.error('Ten tonu alınamadı:', error)
          setSkinTone(null)
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

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])

  // Öneri id'den GÜNCEL kayda çözülür ve temiz/kirli KONTROLÜ BURADA tekrarlanır:
  // kullanıcı karttan ürünü kirli işaretlerse bölüm anında kaybolmalı, bir
  // sonraki öneriye kadar ortada durmamalı. Ürün silinmişse de null'a düşer.
  const makeupItem = useMemo(() => {
    const item = makeupItemId ? itemsById.get(makeupItemId) : null
    return item && item.isClean !== false ? item : null
  }, [makeupItemId, itemsById])

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
  // "Başka Öneri Göster" artık kirli olan parçayı seçmesin. Vektör adayları
  // id olarak saklandığı ve her kombin kurulumunda yeniden çözüldüğü için
  // bu güncelleme onlara da yansır.
  const handleCleanChange = useCallback((itemId, isClean) => {
    setItems((previous) =>
      previous.map((item) => (item.id === itemId ? { ...item, isClean } : item)),
    )
  }, [])

  // Hava bilinmiyorsa null kalır ve sezon önceliği uygulanmaz — yani şehri
  // olmayan ya da hava durumu alınamayan kullanıcı için davranış önceki
  // hâliyle birebir aynı kalır.
  const preferredSeasons = useMemo(
    () => (weather ? seasonsForWeather(weather.status) : null),
    [weather],
  )

  // Aktif vektör havuzu: { seedItem, candidateIds }. Rastgele seçime
  // düşüldüyse null olur ve "Başka Öneri Göster" eski davranışa döner.
  const poolRef = useRef(null)
  const variantRef = useRef(0)
  // Kullanıcı yanıt beklerken başka bir duruma tıklarsa, geç gelen yanıt
  // yeni öneriyi ezmemeli.
  const requestIdRef = useRef(0)

  // ---- Vektör aday havuzu ----

  // Başlangıç parçasına en yakın adayları DİĞER kategorilerden çeker.
  // Başarısızlık (Chroma kapalı, zaman aşımı, indekslenmemiş parça) burada
  // hata olarak DEĞİL, null olarak temsil edilir; çağıran sessizce rastgeleye düşer.
  const loadCandidateIds = useCallback(
    async (seedItem) => {
      // Makyaj da SORGULANIR ama kombin ızgarasına girmez: yalnızca isteğe
      // bağlı öneri bölümünü besler. Başlangıç parçası hiçbir zaman Makyaj
      // olamaz (pickSeedItem yalnızca kombin kategorilerinden seçer).
      const targetIds = CANDIDATE_CATEGORIES.filter((category) => category !== seedItem.category)
        .map((category) => categoryIds.get(category))
        .filter((id) => typeof id === 'number')

      if (targetIds.length === 0) return null

      const result = await fetchCompanions(seedItem.id, {
        categoryIds: targetIds,
        limit: COMPANION_LIMIT,
      })

      // Başlangıç parçasının henüz vektörü yok (analizi bitmemiş ya da hiç
      // fotoğrafı yok): hata değil, yalnızca akıllı yol kullanılamaz.
      if (!result?.indekslendi) return null

      const byCategory = new Map()
      for (const category of CANDIDATE_CATEGORIES) {
        const rows = result.adaylar?.[categoryIds.get(category)] ?? []
        if (rows.length > 0) byCategory.set(category, rows.map((row) => row.id))
      }
      return byCategory.size > 0 ? byCategory : null
    },
    [categoryIds],
  )

  // Saklanan kimlikleri GÜNCEL gardırop kayıtlarına çevirir. Kimlik saklamanın
  // sebebi: aradaki temiz/kirli değişikliklerini (iyimser güncelleme) yakalamak.
  const resolveCandidates = useCallback(
    (candidateIds) => {
      if (!candidateIds) return null

      const resolved = new Map()
      for (const [category, ids] of candidateIds) {
        const parcalar = ids.map((id) => itemsById.get(id)).filter(Boolean)
        if (parcalar.length > 0) resolved.set(category, parcalar)
      }
      return resolved.size > 0 ? resolved : null
    },
    [itemsById],
  )

  const applyVariant = useCallback(
    (pool, variant) => {
      // Havuz yoksa MEVCUT rastgele mantık aynen çalışır. Makyaj için geri
      // düşüş YOKTUR: vektör konuşamıyorsa bölüm hiç gösterilmez.
      if (!pool) {
        setSuggestionItems(buildRandomOutfit(cleanItems, preferredSeasons))
        setIsSmart(false)
        setMakeupItemId(null)
        return
      }

      const candidatesByCategory = resolveCandidates(pool.candidateIds)

      const { items: next, vectorCount } = buildOutfitFromCandidates({
        seedItem: pool.seedItem,
        candidatesByCategory,
        cleanItems,
        seasons: preferredSeasons,
        variant,
      })

      setSuggestionItems(next)
      setIsSmart(vectorCount > 0)
      setMakeupItemId(pickMakeupItem(candidatesByCategory, variant)?.id ?? null)
    },
    [cleanItems, preferredSeasons, resolveCandidates],
  )

  const runSuggestion = useCallback(
    async (occasion, { excludeSeedId = null } = {}) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId

      setSelectedOccasion(occasion)
      setIsSaved(false)
      setSaveError('')

      const seedItem = pickSeedItem(cleanItems, preferredSeasons, { excludeId: excludeSeedId })

      // Hiç temiz parça yok: mevcut "Şu an temiz parçan yok" ekranı devreye girer.
      if (!seedItem) {
        poolRef.current = null
        variantRef.current = 0
        setIsSuggesting(false)
        setSuggestionItems([])
        setIsSmart(false)
        setMakeupItemId(null)
        return
      }

      setIsSuggesting(true)

      let candidateIds = null
      try {
        candidateIds = await loadCandidateIds(seedItem)
      } catch (error) {
        // SESSİZ GERİ DÜŞÜŞ. ChromaDB kapalı, zaman aşımı, ağ hatası — hiçbiri
        // kullanıcıya gösterilmez; kombin yine üretilir, yalnızca rozet çıkmaz.
        console.warn('Akıllı eşleştirme kullanılamadı, rastgele seçime düşülüyor:', error.message)
      }

      // Kullanıcı bu arada başka bir duruma tıkladıysa bu yanıt bayattır.
      if (requestId !== requestIdRef.current) return

      const pool = candidateIds ? { seedItem, candidateIds } : null
      poolRef.current = pool
      variantRef.current = 0
      applyVariant(pool, 0)
      setIsSuggesting(false)
    },
    [cleanItems, preferredSeasons, loadCandidateIds, applyVariant],
  )

  // Ana Sayfa kartından gelindiyse kullanıcı tekrar tıklamak zorunda kalmadan
  // öneri üretilir. Gardırop yüklenmeden çalışamaz: seçilecek parça olmalı.
  //
  // Ref ile YALNIZCA BİR KEZ çalışır. cleanItems, karttaki temiz/kirli toggle'ıyla
  // değişiyor; guard olmasaydı efekt yeniden tetiklenip kullanıcının o sırada seçtiği
  // durumu ezer ve öneriyi habersizce yeniden üretirdi.
  const hasAppliedRequest = useRef(false)

  useEffect(() => {
    if (hasAppliedRequest.current) return
    if (isLoading || hasError || !requestedOccasion) return

    hasAppliedRequest.current = true
    runSuggestion(requestedOccasion)
  }, [isLoading, hasError, requestedOccasion, runSuggestion])

  // Hazır durum pill'i seçildiğinde önceki serbest metin yorumunun özeti
  // ekranda kalmamalı — başka bir durumun sonuçlarıyla birlikte gösterilirse
  // yanlış eşleşmiş görünürdü.
  const handlePillSelect = (occasion) => {
    setInterpretation(null)
    runSuggestion(occasion)
  }

  const handleCustomSubmit = async (event) => {
    event.preventDefault()
    const trimmed = customText.trim()
    if (!trimmed || isInterpreting) return

    setIsInterpreting(true)
    setInterpretation(null)

    // Gemini yorumlayamazsa HAM METİN occasion olarak kullanılır — bu
    // özellikten ÖNCEKİ davranışın birebir aynısı. VARCHAR(50) sınırını
    // aşmasın diye kırpılır (normal akışta occasion zaten Gemini'nin kısa
    // kategorisidir, bu kırpma yalnızca geri düşüş yolunda devreye girer).
    let occasionToUse = trimmed.slice(0, OCCASION_MAX_LENGTH)

    try {
      const result = await interpretOutfitRequest(trimmed)
      occasionToUse = result.occasion
      setInterpretation(result)
    } catch (error) {
      // SESSİZ GERİ DÜŞÜŞ: anahtar yok, kota doldu, zaman aşımı, ağ hatası —
      // hiçbiri kullanıcıya gösterilmez. Yorumlama sonucu yok sayılır,
      // mevcut occasion-pill akışı (ham metin) aynen çalışmaya devam eder.
      console.warn('Serbest metin yorumlanamadı, ham metin occasion olarak kullanılıyor:', error.message)
    } finally {
      setIsInterpreting(false)
    }

    runSuggestion(occasionToUse)
  }

  const showAnother = () => {
    const pool = poolRef.current

    // Rastgele mod (vektör kullanılamadı): eski davranış birebir korunur.
    if (!pool) {
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
      setIsSmart(false)
      setMakeupItemId(null)
      setIsSaved(false)
      setSaveError('')
      return
    }

    // Akıllı mod: aynı başlangıç parçasıyla havuzda BİR SIRA İLERLE
    // (en yakın, sonra ikinci en yakın...).
    const depth = variantDepth(resolveCandidates(pool.candidateIds))
    const next = variantRef.current + 1

    // Havuz tükendi: aynı başlangıç parçasından yeni bir kombin çıkmaz,
    // BAŞKA bir başlangıç parçasıyla baştan aranır.
    if (next >= depth) {
      runSuggestion(selectedOccasion, { excludeSeedId: pool.seedItem.id })
      return
    }

    variantRef.current = next
    applyVariant(pool, next)
    setIsSaved(false)
    setSaveError('')
  }

  // Kaydedilen kombin: dört parça + (BÖLÜM AÇIKSA) makyaj önerisi.
  // Bölümü hiç açmayan kullanıcı için davranış eskisiyle birebir aynı —
  // makyaj sessizce kombine eklenmez, kullanıcı onu görmemiştir bile.
  const outfitItems = useMemo(
    () => (isMakeupOpen && makeupItem ? [...suggestionItems, makeupItem] : suggestionItems),
    [isMakeupOpen, makeupItem, suggestionItems],
  )

  const handleSave = async () => {
    if (suggestionItems.length === 0 || isSaving || isSaved) return

    setIsSaving(true)
    setSaveError('')

    try {
      await createOutfit({
        occasion: selectedOccasion,
        clothingItemIds: outfitItems.map((item) => item.id),
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
                  onChange={handlePillSelect}
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
                  maxLength={CUSTOM_TEXT_MAX_LENGTH}
                  disabled={isInterpreting}
                  placeholder="Ya da durumunu kendi cümlelerinle anlat..."
                  className="flex-1 rounded-full border border-ink/15 bg-surface px-5 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none disabled:opacity-60"
                />
                <Button type="submit" variant="primary" disabled={isInterpreting}>
                  {isInterpreting ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={15} strokeWidth={1.75} className="animate-spin" />
                      Anlıyorum...
                    </span>
                  ) : (
                    'Kombin Öner'
                  )}
                </Button>
              </form>

              {/* Gemini'nin serbest metni ANLADIĞINI gösteren özet. Yalnızca
                  yorumlama BAŞARILI olduysa render edilir — başarısızlıkta
                  interpretation null kalır ve kullanıcı hiçbir şey görmez
                  (sessiz geri düşüş, hata YOK). kacinilmasi_gerekenler ve
                  onem_verilen_ozellikler şimdilik SADECE gösterim amaçlıdır;
                  kombin mantığına hiç karışmazlar (bkz. CLAUDE.md). */}
              {interpretation && (
                <div
                  className="mt-6 rounded-2xl border border-dusty-rose/30 bg-dusty-rose/5 p-5"
                  data-testid="yorumlama-ozeti"
                >
                  <p className="flex items-start gap-2.5 text-sm text-ink/70">
                    <Sparkles size={15} strokeWidth={1.75} className="mt-0.5 shrink-0 text-accent-ink" />
                    <span>
                      <span className="font-medium text-ink">Anladığım kadarıyla:</span>{' '}
                      {interpretation.arama_metni}
                    </span>
                  </p>
                  {(interpretation.kacinilmasi_gerekenler?.length > 0 ||
                    interpretation.onem_verilen_ozellikler?.length > 0) && (
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 pl-[26px] text-xs text-ink/50">
                      {interpretation.kacinilmasi_gerekenler?.length > 0 && (
                        <p>
                          Kaçınılacaklar: {interpretation.kacinilmasi_gerekenler.join(', ')}
                        </p>
                      )}
                      {interpretation.onem_verilen_ozellikler?.length > 0 && (
                        <p>
                          Öncelikler: {interpretation.onem_verilen_ozellikler.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
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

                {isSuggesting ? (
                  <div
                    className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4"
                    data-testid="oneri-iskeleti"
                  >
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="animate-pulse">
                        <div className="h-56 rounded-2xl bg-ink/10" />
                        <div className="mt-3 h-3 w-2/3 rounded-full bg-ink/10" />
                      </div>
                    ))}
                  </div>
                ) : (
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
                      <>
                        {/* Rozet YALNIZCA vektör eşleştirmesi gerçekten çalıştıysa
                          görünür. Rastgele seçime düşüldüyse hiç çıkmaz —
                          kullanıcıya olmayan bir zekâyı satmayalım. */}
                        {isSmart && (
                          <p
                            className="mt-5 flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.15em] text-accent-ink"
                            data-testid="akilli-rozet"
                          >
                            <Sparkles size={13} strokeWidth={1.75} />
                            Tarzına göre seçildi
                          </p>
                        )}

                        <div className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
                          {suggestionItems.map((item) => (
                            <div key={item.id}>
                              <ClothingCard item={item} onCleanChange={handleCleanChange} />
                              {/* SADECE BİLGİ. Bu işaret hiçbir parçayı elemez,
                                  sıralamayı değiştirmez; kullanıcının ten tonu
                                  analizi yoksa hiç görünmez. Kartın kendisine
                                  değil ALTINA konuyor: ClothingCard paylaşılan
                                  bir bileşen ve Gardırop'ta bu bilgi anlamsız. */}
                              {matchesSkinTone(item, skinTone) && (
                                <p
                                  className="mt-2 flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.1em] text-accent-ink"
                                  data-testid="ten-tonu-isareti"
                                >
                                  <Check size={11} strokeWidth={2.25} />
                                  Ten tonuna uygun
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        {/* İSTEĞE BAĞLI MAKYAJ ÖNERİSİ.
                            Bölümün KENDİSİ yalnızca vektör araması temiz bir
                            makyaj ürünü döndürdüyse render edilir: makyajı
                            olmayan (ya da Chroma'ya ulaşılamayan) kullanıcı
                            boş bir çağrı da, ölü bir düğme de görmez. */}
                        {makeupItem && (
                          <div
                            className="mt-6 rounded-2xl border border-dusty-rose/40 bg-surface/60 p-5"
                            data-testid="makyaj-bolumu"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-dusty-rose/15">
                                  <Brush size={16} strokeWidth={1.75} className="text-accent-ink" />
                                </span>
                                <p className="text-sm text-ink/70">
                                  Bu kombine uygun makyaj önerisi ister misin?
                                </p>
                              </div>
                              <Button
                                variant="outline"
                                onClick={() => setIsMakeupOpen((previous) => !previous)}
                                aria-expanded={isMakeupOpen}
                                aria-controls="makyaj-onerisi"
                                data-testid="makyaj-dugmesi"
                              >
                                {isMakeupOpen ? 'Gizle' : 'Göster'}
                              </Button>
                            </div>

                            {/* Yumuşak açılma: grid-rows 0fr -> 1fr geçişi
                                yüksekliği GERÇEKTEN animasyonlar (max-height
                                tahmini gerektirmez). İçerik kapalıyken de
                                DOM'da durur, bu yüzden `inert` ile klavye ve
                                ekran okuyucudan gizleniyor. */}
                            <div
                              id="makyaj-onerisi"
                              className={`grid transition-all duration-300 ease-out ${
                                isMakeupOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                              }`}
                              inert={!isMakeupOpen}
                            >
                              <div className="overflow-hidden">
                                <div className="grid grid-cols-2 gap-6 pt-5 sm:grid-cols-4">
                                  <ClothingCard
                                    item={makeupItem}
                                    onCleanChange={handleCleanChange}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
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
                      {/* Paylaşım görseli kaydedilenle aynı kümeyi gösterir;
                          ShareOutfitCard'ın CATEGORY_ORDER'ı Makyaj'ı zaten
                          tanıyor ve en sona diziyor. */}
                      <ShareButton occasion={selectedOccasion} items={outfitItems} />
                    </div>

                    {saveError && <p className="mt-3 text-sm text-burgundy">{saveError}</p>}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default OutfitSuggestion
