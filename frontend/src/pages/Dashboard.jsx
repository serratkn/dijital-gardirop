import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { GraduationCap, Utensils } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import QuickActionCard from '../components/ui/QuickActionCard'
import ClothingCard from '../components/ClothingCard'
import SkeletonCard from '../components/SkeletonCard'
import { getUserProfile } from '../lib/onboarding'
import { fetchCategories, fetchClothingItems, fetchOutfits } from '../lib/api'
import { toCategoryNameMap, toClothingItems } from '../lib/transformers'

const RECENT_COUNT = 4
const SKELETON_HEIGHTS = ['h-64', 'h-48', 'h-60', 'h-52']

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-ink/10 bg-warm-gray px-6 py-8 text-center">
      <div className="mx-auto h-9 w-12 animate-pulse rounded-lg bg-ink/10" />
      <div className="mx-auto mt-3 h-3 w-24 animate-pulse rounded-full bg-ink/10" />
    </div>
  )
}

function Dashboard() {
  const location = useLocation()
  const navigate = useNavigate()
  const { name: currentUserName } = getUserProfile()

  // Tarz anketi biterken StyleQuiz bu işareti taşır — yani kullanıcı yeni kayıt
  // olmuş ve Ana Sayfa'yı ilk kez görüyor demektir. Başka her geliş (giriş yapma,
  // uygulamayı yeniden açma, sekmeler arası gezinme) "tekrar" sayılır.
  // Lazy initializer şart: aşağıdaki effect işareti geçmişten silse de
  // karşılama bu ekran açık kaldığı sürece değişmemeli.
  const [isFirstVisit] = useState(() => Boolean(location.state?.justOnboarded))

  const welcome = isFirstVisit ? 'Hoş Geldin' : 'Tekrar Hoş Geldin'
  const greeting = currentUserName ? `${welcome}, ${currentUserName}` : welcome

  // History state sayfa yenilendiğinde geri gelir; işaret temizlenmezse
  // kullanıcı her yenilemede yeniden "yeni kayıt" sanılırdı.
  useEffect(() => {
    if (!location.state?.justOnboarded) return
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const [items, setItems] = useState([])
  const [outfitCount, setOutfitCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isStale = false

    async function loadDashboard() {
      setIsLoading(true)
      setHasError(false)

      try {
        // Kategoriler kart etiketleri ve ikonları için gerekli:
        // parçalar yalnızca category_id taşır, ikon eşlemesi ada göre yapılır.
        const [categoryRows, itemRows, outfitRows] = await Promise.all([
          fetchCategories(),
          fetchClothingItems(),
          fetchOutfits(),
        ])

        if (isStale) return

        setItems(toClothingItems(itemRows, toCategoryNameMap(categoryRows)))
        setOutfitCount(outfitRows.length)
      } catch (error) {
        if (isStale) return
        console.error('Ana sayfa verisi alınamadı:', error)
        setHasError(true)
        setItems([])
        setOutfitCount(0)
      } finally {
        if (!isStale) setIsLoading(false)
      }
    }

    loadDashboard()

    return () => {
      isStale = true
    }
  }, [])

  // Favori değişimi "Favori" istatistiğine anında yansımalı.
  const handleFavoriteChange = useCallback((itemId, isFavorite) => {
    setItems((previous) =>
      previous.map((item) => (item.id === itemId ? { ...item, isFavorite } : item)),
    )
  }, [])

  // Backend listeyi created_at DESC sıralı döndürür, baştan 4 parça
  // "son eklenenler" demektir.
  const recentItems = items.slice(0, RECENT_COUNT)
  const favoriteCount = items.filter((item) => item.isFavorite).length

  // Hata halinde 0 göstermek yanıltıcı olur: sayı bilinmiyor demek için "–".
  const statValue = (value) => (hasError ? '–' : value)

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
        <PageHeader
          title={greeting}
          tagline="Tarzın, senin kuralların."
          subtitle="Bugün ne giyeceğine karar verelim."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {isLoading ? (
            <>
              <StatCardSkeleton />
              <StatCardSkeleton />
              <StatCardSkeleton />
            </>
          ) : (
            <>
              <StatCard value={statValue(items.length)} label="Toplam Parça" to="/gardirop" />
              <StatCard value={statValue(outfitCount)} label="Kombin" to="/kombinlerim" />
              {/* Gardırop'ta henüz favori filtresi yok; kart şimdilik listenin
                  tamamına götürür. Filtre eklenirse burası ona bağlanmalı. */}
              <StatCard value={statValue(favoriteCount)} label="Favori" to="/gardirop" />
            </>
          )}
        </div>

        <section className="mt-16">
          <h2 className="font-display text-2xl italic text-ink">Hızlı Kombin Öner</h2>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <QuickActionCard
              to="/kombin-oner"
              eyebrow="Kombin Önerisi"
              title="Üniversite Kombini"
              subtitle="Rahat ve şık, gün boyu kampüste."
              icon={GraduationCap}
            />
            <QuickActionCard
              to="/kombin-oner"
              eyebrow="Kombin Önerisi"
              title="Akşam Yemeği Kombini"
              subtitle="Zarif bir buluşma için özel bir seçim."
              icon={Utensils}
            />
          </div>
        </section>

        <section className="mt-16">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-2xl italic text-ink">Son Eklenenler</h2>
            <Link
              to="/gardirop"
              className="text-sm text-ink/50 transition-colors hover:text-dusty-rose"
            >
              Tümünü Gör
            </Link>
          </div>

          {isLoading ? (
            <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {SKELETON_HEIGHTS.map((height, index) => (
                <SkeletonCard key={index} imgHeight={height} />
              ))}
            </div>
          ) : hasError ? (
            <p className="mt-6 text-sm text-ink/50">
              Gardırobuna şu an ulaşılamıyor. Bağlantını kontrol edip sayfayı yenilemeyi dene.
            </p>
          ) : recentItems.length === 0 ? (
            <div className="mt-6 flex flex-col items-start gap-3">
              <p className="text-sm text-ink/50">Gardırobunda henüz parça yok.</p>
              <Link
                to="/gardirop"
                className="text-sm text-burgundy transition-colors hover:text-dusty-rose"
              >
                İlk parçanı ekle
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4 animate-fade-in">
              {recentItems.map((item) => (
                <ClothingCard key={item.id} item={item} onFavoriteChange={handleFavoriteChange} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

export default Dashboard
