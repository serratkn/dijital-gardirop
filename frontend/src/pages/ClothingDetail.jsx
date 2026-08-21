import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Sparkles, WashingMachine } from 'lucide-react'
import AiAnalysisPanel from '../components/AiAnalysisPanel'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import PhotoPicker from '../components/ui/PhotoPicker'
import {
  deleteClothingItem,
  deleteClothingItemImage,
  fetchCategories,
  fetchClothingItem,
  fetchOutfits,
  logImageOutcome,
  resolveImageUrl,
  toggleClothingItemCleanStatus,
  toggleClothingItemFavorite,
  uploadClothingItemImage,
} from '../lib/api'
import { toCategoryNameMap, toClothingItem } from '../lib/transformers'

// Otomatik AI analizi arka planda çalışır; sayfa bunu yoklayarak bekler.
// Pencere backend'in EN KÖTÜ senaryosunu kapsar: 2 deneme x 30 sn Gemini
// zaman aşımı + aradaki bekleme ≈ 62 sn (14 x 5 sn = 70 sn).
// Süre dolduğunda yoklama SESSİZCE durur: analiz zorunlu bir adım değil,
// kullanıcıya "başarısız oldu" demek gereksiz bir endişe yaratırdı.
const ANALYSIS_POLL_INTERVAL_MS = 5000
const ANALYSIS_POLL_ATTEMPTS = 14

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function ClothingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [item, setItem] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFavorite, setIsFavorite] = useState(false)
  const [isFavoritePending, setIsFavoritePending] = useState(false)
  const [isClean, setIsClean] = useState(true)
  const [isCleanPending, setIsCleanPending] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState('')
  const [isPhotoEditing, setIsPhotoEditing] = useState(false)
  const [isPhotoBusy, setIsPhotoBusy] = useState(false)
  const [imageFailed, setImageFailed] = useState(false)
  const [outfits, setOutfits] = useState([])
  const [isOutfitsLoading, setIsOutfitsLoading] = useState(true)
  const [hasOutfitsError, setHasOutfitsError] = useState(false)
  const [isAnalysisPending, setIsAnalysisPending] = useState(false)

  useEffect(() => {
    let isStale = false

    async function loadItem() {
      setIsLoading(true)

      try {
        const [categoryRows, itemRow] = await Promise.all([
          fetchCategories(),
          fetchClothingItem(id),
        ])

        if (isStale) return

        const loadedItem = toClothingItem(itemRow, toCategoryNameMap(categoryRows))
        setItem(loadedItem)
        setIsFavorite(loadedItem.isFavorite)
        setIsClean(loadedItem.isClean ?? true)
      } catch (error) {
        if (isStale) return
        console.error('Kıyafet bilgisi alınamadı:', error)
        setItem(null)
      } finally {
        if (!isStale) setIsLoading(false)
      }
    }

    loadItem()

    return () => {
      isStale = true
    }
  }, [id])

  // Fotoğrafı olan ama henüz analizi gelmemiş parça için arka plandaki
  // Gemini analizini yoklar. Analiz yüklemeden SONRA, ayrı bir istekte
  // tamamlandığı için sayfanın ilk çekimi onu göremeyebilir.
  //
  // Analizi olan parçada efekt hemen çıkar: backend zaten dolu bir
  // ai_analysis'i TEKRAR ANALİZ ETMEZ (maliyet koruması), beklenecek
  // bir şey yoktur.
  useEffect(() => {
    if (!item?.imageUrl || item.aiAnalysis) {
      setIsAnalysisPending(false)
      return
    }

    let isStale = false
    let timeoutId
    let attempt = 0

    setIsAnalysisPending(true)

    async function poll() {
      attempt += 1

      try {
        const row = await fetchClothingItem(id)
        if (isStale) return

        if (row.ai_analysis) {
          setItem((previous) => (previous ? { ...previous, aiAnalysis: row.ai_analysis } : previous))
          setIsAnalysisPending(false)
          return
        }
      } catch (error) {
        // Yoklama hatası kullanıcıya GÖSTERİLMEZ: sayfanın asıl içeriği
        // çoktan yüklendi, bu yalnızca bir zenginleştirme.
        console.error('AI analizi yoklanamadı:', error)
      }

      if (isStale) return

      if (attempt >= ANALYSIS_POLL_ATTEMPTS) {
        setIsAnalysisPending(false)
        return
      }

      timeoutId = setTimeout(poll, ANALYSIS_POLL_INTERVAL_MS)
    }

    timeoutId = setTimeout(poll, ANALYSIS_POLL_INTERVAL_MS)

    return () => {
      isStale = true
      clearTimeout(timeoutId)
    }
  }, [id, item?.imageUrl, item?.aiAnalysis])

  // Kombinler ayrı bir efektte çekilir: bu istek başarısız olursa sayfanın
  // tamamı değil yalnızca bu bölüm hata durumuna düşer.
  useEffect(() => {
    let isStale = false

    async function loadOutfits() {
      setIsOutfitsLoading(true)
      setHasOutfitsError(false)

      try {
        const outfitRows = await fetchOutfits(id)
        if (isStale) return
        setOutfits(outfitRows)
      } catch (error) {
        if (isStale) return
        console.error('Bu kıyafetin kombinleri alınamadı:', error)
        setHasOutfitsError(true)
        setOutfits([])
      } finally {
        if (!isStale) setIsOutfitsLoading(false)
      }
    }

    loadOutfits()

    return () => {
      isStale = true
    }
  }, [id])

  const handleToggleFavorite = async () => {
    if (isFavoritePending) return

    const previous = isFavorite

    // İyimser güncelleme: arayüz anında tepki verir, hata olursa geri alınır.
    setIsFavorite(!previous)
    setIsFavoritePending(true)
    setActionError('')

    try {
      const updated = await toggleClothingItemFavorite(id)
      setIsFavorite(updated.is_favorite)
    } catch (error) {
      console.error('Favori durumu güncellenemedi:', error)
      setIsFavorite(previous)
      setActionError(error.message)
    } finally {
      setIsFavoritePending(false)
    }
  }

  const handleToggleClean = async () => {
    if (isCleanPending) return

    const previous = isClean

    setIsClean(!previous)
    setIsCleanPending(true)
    setActionError('')

    try {
      const updated = await toggleClothingItemCleanStatus(id)
      setIsClean(updated.is_clean)
    } catch (error) {
      console.error('Temizlik durumu güncellenemedi:', error)
      setIsClean(previous)
      setActionError(error.message)
    } finally {
      setIsCleanPending(false)
    }
  }

  const handlePhotoSelected = async (file) => {
    setIsPhotoBusy(true)
    setActionError('')

    try {
      const updated = await uploadClothingItemImage(id, file)
      // ai_analysis da yanıttan alınır: yeni fotoğrafın analizi arka planda
      // başlar ve yukarıdaki yoklama efekti bu değişiklikle tetiklenir.
      setItem((previous) => ({
        ...previous,
        imageUrl: updated.image_url,
        aiAnalysis: updated.ai_analysis ?? null,
      }))
      setImageFailed(false)
      setIsPhotoEditing(false)
    } catch (error) {
      console.error('Fotoğraf yüklenemedi:', error)
      setActionError(error.message)
    } finally {
      setIsPhotoBusy(false)
    }
  }

  const handlePhotoRemove = async () => {
    setIsPhotoBusy(true)
    setActionError('')

    try {
      const updated = await deleteClothingItemImage(id)
      setItem((previous) => ({ ...previous, imageUrl: updated.image_url }))
      setIsPhotoEditing(false)
    } catch (error) {
      console.error('Fotoğraf kaldırılamadı:', error)
      setActionError(error.message)
    } finally {
      setIsPhotoBusy(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setActionError('')

    try {
      await deleteClothingItem(id)
      setIsConfirmOpen(false)
      navigate('/gardirop')
    } catch (error) {
      console.error('Kıyafet silinemedi:', error)
      setActionError(error.message)
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-ivory">
        <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
          <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-14">
            <div className="min-h-[24rem] animate-pulse rounded-3xl border border-ink/10 bg-warm-gray md:min-h-[32rem]" />
            <div className="space-y-4">
              <div className="h-3 w-20 animate-pulse rounded-full bg-warm-gray" />
              <div className="h-10 w-3/4 animate-pulse rounded-lg bg-warm-gray" />
              <div className="h-3 w-24 animate-pulse rounded-full bg-warm-gray" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-ivory">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center sm:px-8">
          <p className="font-display text-2xl italic text-ink">Kıyafet bulunamadı.</p>
          <Link
            to="/gardirop"
            className="mt-6 inline-block text-sm text-ink/50 transition-colors hover:text-accent-ink"
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
            className="inline-flex items-center gap-2 text-sm text-ink/60 transition-colors hover:text-accent-ink"
          >
            <svg viewBox="0 0 24 24" strokeWidth="1.5" className="h-4 w-4 fill-none stroke-current">
              <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Gardıroba Geri Dön
          </Link>

          <nav className="flex items-center gap-1.5 text-xs text-ink/40">
            <Link to="/gardirop" className="transition-colors hover:text-accent-ink">
              Gardırop
            </Link>
            <span className="text-ink/25">/</span>
            <Link
              to={`/gardirop?kategori=${encodeURIComponent(item.category)}`}
              className="transition-colors hover:text-accent-ink"
            >
              {item.category}
            </Link>
            <span className="text-ink/25">/</span>
            <span className="text-ink/50">{item.name}</span>
          </nav>
        </div>

        <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-14">
          <div>
            <div className="min-h-[24rem] overflow-hidden rounded-3xl border border-ink/10 bg-warm-gray shadow-[var(--dg-shadow-card)] md:min-h-[32rem]">
              {!imageFailed && item.imageUrl && !isPhotoEditing && (
                <img
                  src={resolveImageUrl(item.imageUrl)}
                  alt={item.name}
                  onLoad={() =>
                    logImageOutcome(item.name, resolveImageUrl(item.imageUrl), 'YUKLENDI')
                  }
                  onError={() => {
                    logImageOutcome(item.name, resolveImageUrl(item.imageUrl), 'HATA')
                    setImageFailed(true)
                  }}
                  className="h-full min-h-[24rem] w-full object-cover md:min-h-[32rem]"
                />
              )}

              {isPhotoEditing && (
                <div className="p-6">
                  <PhotoPicker
                    file={null}
                    onSelect={handlePhotoSelected}
                    onClear={() => setIsPhotoEditing(false)}
                    disabled={isPhotoBusy}
                  />
                  {isPhotoBusy && (
                    <p className="mt-3 text-sm text-ink/50">Fotoğraf yükleniyor...</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPhotoEditing(false)}
                    disabled={isPhotoBusy}
                    className="mt-3 text-sm text-ink/50 underline transition-colors hover:text-accent-ink disabled:opacity-50"
                  >
                    Vazgeç
                  </button>
                </div>
              )}
            </div>

            {!isPhotoEditing && (
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setIsPhotoEditing(true)}
                  disabled={isPhotoBusy}
                  className="text-sm text-ink/60 underline transition-colors hover:text-accent-ink disabled:opacity-50"
                >
                  {item.imageUrl ? 'Fotoğrafı Değiştir' : 'Fotoğraf Ekle'}
                </button>
                {item.imageUrl && (
                  <button
                    type="button"
                    onClick={handlePhotoRemove}
                    disabled={isPhotoBusy}
                    className="text-sm text-burgundy/60 underline transition-colors hover:text-burgundy disabled:opacity-50"
                  >
                    {isPhotoBusy ? 'İşleniyor...' : 'Fotoğrafı Kaldır'}
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-[12px] font-medium uppercase tracking-[0.15em] text-accent-ink">
                {item.category}
              </p>
              {!isClean && (
                <span className="inline-flex items-center gap-1 rounded-full border border-dusty-rose/40 bg-surface px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-burgundy/80">
                  <WashingMachine size={11} strokeWidth={1.75} />
                  Kirli
                </span>
              )}
              {isAnalysisPending && (
                <span className="inline-flex animate-pulse items-center gap-1.5 rounded-full border border-dusty-rose/40 bg-surface px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-accent-ink">
                  <Sparkles size={11} strokeWidth={1.75} />
                  Yapay zekâ inceliyor
                </span>
              )}
            </div>
            <h1 className="mt-3 font-display text-4xl italic text-ink sm:text-5xl">{item.name}</h1>

            {item.color && (
              <div className="mt-6">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink/50">Renk</p>
                <p className="mt-1 font-body text-base text-ink">{item.color}</p>
              </div>
            )}

            {item.brand && (
              <div className="mt-6">
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink/50">Marka</p>
                <p className="mt-1 font-body text-base text-ink">{item.brand}</p>
              </div>
            )}

            <div className="mt-10">
              <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink/50">
                Bu Kıyafetle Yapılan Kombinler
              </p>

              {isOutfitsLoading ? (
                <div className="mt-3 space-y-2">
                  {[0, 1].map((index) => (
                    <div
                      key={index}
                      className="h-16 animate-pulse rounded-xl border border-ink/10 bg-warm-gray"
                    />
                  ))}
                </div>
              ) : hasOutfitsError ? (
                <p className="mt-2 text-sm text-ink/50">
                  Kombin bilgisine şu an ulaşılamıyor.
                </p>
              ) : outfits.length === 0 ? (
                <p className="mt-2 text-sm text-ink/50">Henüz bir kombinde kullanılmadı.</p>
              ) : (
                <div className="mt-3 space-y-2 animate-fade-in">
                  {outfits.map((outfit) => (
                    <Link
                      key={outfit.id}
                      to="/kombinlerim"
                      className="flex items-center justify-between gap-4 rounded-xl border border-ink/10 bg-surface px-4 py-3 transition-colors hover:border-dusty-rose"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-body text-sm text-ink">
                          {outfit.occasion || 'Kombin'}
                        </span>
                        <span className="mt-0.5 block text-xs text-ink/45">
                          {dateFormatter.format(new Date(outfit.created_at))}
                          {outfit.items.length > 0 && ` · ${outfit.items.length} parça`}
                        </span>
                      </span>
                      <svg
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        className="h-4 w-4 shrink-0 fill-none stroke-ink/30"
                      >
                        <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-10">
              <Button
                variant="outline"
                onClick={handleToggleFavorite}
                disabled={isFavoritePending}
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

              <Button
                variant="outline"
                onClick={handleToggleClean}
                disabled={isCleanPending}
                className="ml-3 inline-flex items-center gap-2"
              >
                <WashingMachine
                  size={16}
                  strokeWidth={1.75}
                  className={isClean ? 'text-accent-ink' : 'text-burgundy'}
                />
                {isClean ? 'Kirliye Taşı' : 'Temiz Olarak İşaretle'}
              </Button>
            </div>

            {actionError && <p className="mt-4 text-sm text-burgundy">{actionError}</p>}

            <button
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              className="mt-10 text-xs text-burgundy/60 transition-colors hover:text-burgundy"
            >
              Sil
            </button>
          </div>
        </div>

        {/* Analiz bölümü ızgaranın ALTINDA, tam genişlikte: sağ sütun md
            altında yarım genişliktir ve iki sütunlu bilgi kartları oraya
            sıkışırdı. ai_analysis boşsa bileşen null döner, hiçbir boşluk
            bırakmaz. */}
        <AiAnalysisPanel analysis={item.aiAnalysis} />
      </div>

      <Modal isOpen={isConfirmOpen} onClose={() => !isDeleting && setIsConfirmOpen(false)}>
        <h2 className="font-display text-2xl italic text-ink">Bu parçayı sil</h2>
        <p className="mt-3 text-sm text-ink/60">
          <span className="font-medium text-ink">{item.name}</span> gardırobundan kaldırılacak.
          Bu parçayı içeren kombinler kalır ama parça artık görünmez.
        </p>

        {actionError && <p className="mt-4 text-sm text-burgundy">{actionError}</p>}

        <div className="mt-8 flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsConfirmOpen(false)}
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

export default ClothingDetail
