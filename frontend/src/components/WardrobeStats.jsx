import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Palette, Sparkles, WashingMachine } from 'lucide-react'
import StatCard from './ui/StatCard'
import { fetchWardrobeStats, getCurrentUserId } from '../lib/api'
import { CATEGORY_ICONS } from '../lib/categoryIcons'
import { getColorSwatch } from '../lib/colors'

// Sunucudan hazır özet gelir; burada yalnızca sunum yapılır.
// Yeni bir istatistik bölümü eklenirken (örn. premium analiz raporu)
// aşağıdaki satır bileşenleri yeniden kullanılabilir.

function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-ink/10 bg-warm-gray px-6 py-8 text-center">
      <div className="mx-auto h-9 w-10 animate-pulse rounded-lg bg-ink/10" />
      <div className="mx-auto mt-3 h-3 w-16 animate-pulse rounded-full bg-ink/10" />
    </div>
  )
}

function StatsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex items-center gap-3">
            <div className="h-8 w-8 animate-pulse rounded-full bg-ink/10" />
            <div className="h-3 w-40 animate-pulse rounded-full bg-ink/10" />
          </div>
        ))}
      </div>
    </>
  )
}

// Sol tarafta yuvarlak bir ikon/gösterge, sağda küçük etiket + editöryal cümle.
function DetailRow({ icon: Icon, swatch, label, children }) {
  return (
    <div className="flex items-center gap-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-ink/10 bg-warm-gray">
        {swatch ?? <Icon size={15} strokeWidth={1.5} className="text-accent-ink" />}
      </span>
      <div className="min-w-0">
        <p className="text-[0.65rem] uppercase tracking-[0.15em] text-ink/40">{label}</p>
        <p className="mt-0.5 text-sm text-ink">{children}</p>
      </div>
    </div>
  )
}

// Renk adı tek başına soyut kalır; paletteki gerçek rengi göstermek
// gardırobun tonunu bir bakışta anlatır. Palette olmayan bir renk
// (elle girilmiş eski kayıt) sessizce ikona düşer.
function ColorSwatch({ name }) {
  const color = getColorSwatch(name)
  if (!color) return null

  return (
    <span
      className="h-4 w-4 rounded-full border border-ink/15"
      style={{ background: color.gradient ?? color.hex }}
      aria-hidden="true"
    />
  )
}

// İkon eşlemesi kategori ADIna göre yapılır (depodaki merkezi kalıp);
// backend'in döndürdüğü kebab-case `icon` alanı burada kullanılmaz.
function CategoryChip({ name, count }) {
  const Icon = CATEGORY_ICONS[name]

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-warm-gray px-3 py-1.5">
      {Icon && <Icon size={13} strokeWidth={1.5} className="text-ink/40" />}
      <span className="font-display text-sm italic text-ink">{count}</span>
      <span className="text-xs text-ink/60">{name}</span>
    </span>
  )
}

function WardrobeStats() {
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let isStale = false
    const userId = getCurrentUserId()

    // Token okunamadıysa istek atmanın anlamı yok; 404 dönerdi.
    if (!userId) {
      setIsLoading(false)
      setHasError(true)
      return
    }

    fetchWardrobeStats(userId)
      .then((data) => {
        if (isStale) return
        setStats(data)
      })
      .catch((error) => {
        if (isStale) return
        console.error('Gardırop istatistikleri alınamadı:', error)
        setHasError(true)
      })
      .finally(() => {
        if (!isStale) setIsLoading(false)
      })

    return () => {
      isStale = true
    }
  }, [])

  const categories = stats?.items?.by_category ?? []
  const topColor = stats?.colors?.top
  const topOccasion = stats?.outfits?.top_occasion

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-6">
      <h2 className="font-display text-xl italic text-ink">Gardırop İstatistiklerim</h2>
      <div className="mt-3 h-px w-16 bg-dusty-rose" />

      <div className="mt-6">
        {isLoading ? (
          <StatsSkeleton />
        ) : hasError ? (
          <p className="text-sm text-ink/50">
            İstatistiklerine şu an ulaşılamıyor. Bağlantını kontrol edip sayfayı yenilemeyi dene.
          </p>
        ) : !stats.has_data ? (
          // Yeni kullanıcı: sayıları sıfırlarla doldurmak yerine yol gösteriyoruz.
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-ink/60">
              Henüz yeterli veri yok. Gardırobunu doldurmaya başla, tarzının hikâyesini
              birlikte çıkaralım.
            </p>
            <Link
              to="/gardirop"
              className="text-sm text-burgundy transition-colors hover:text-accent-ink"
            >
              İlk parçanı ekle
            </Link>
          </div>
        ) : (
          <div className="animate-fade-in">
            <div className="grid grid-cols-3 gap-3 sm:gap-4">
              <StatCard value={stats.items.total} label="Parça" to="/gardirop" />
              <StatCard value={stats.outfits.total} label="Kombin" to="/kombinlerim" />
              <StatCard value={stats.items.favorite} label="Favori" to="/gardirop" />
            </div>

            {categories.length > 0 && (
              <div className="mt-6">
                <p className="text-[0.65rem] uppercase tracking-[0.15em] text-ink/40">
                  Kategori Dağılımı
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <CategoryChip
                      key={category.category_id}
                      name={category.name}
                      count={category.count}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="mt-7 space-y-5 border-t border-ink/10 pt-6">
              {topColor && (
                <DetailRow
                  icon={Palette}
                  swatch={<ColorSwatch name={topColor.name} />}
                  label="En Çok Kullandığın Renk"
                >
                  <span className="font-medium">{topColor.name}</span>{' '}
                  <span className="text-ink/50">— {topColor.count} parça</span>
                </DetailRow>
              )}

              {topOccasion && (
                <DetailRow icon={Sparkles} label="En Sevdiğin Durum">
                  En çok{' '}
                  <span className="font-medium">{topOccasion.name}</span> kombini oluşturdun{' '}
                  <span className="text-ink/50">({topOccasion.count} kez)</span>
                </DetailRow>
              )}

              {stats.items.total > 0 && (
                <DetailRow icon={WashingMachine} label="Temiz / Kirli">
                  <span className="font-medium">{stats.items.clean} temiz</span>,{' '}
                  <span className="font-medium">{stats.items.dirty} kirli</span> parçan var
                  {stats.items.dirty === 0 && (
                    <span className="text-ink/50"> — gardırobun tertemiz.</span>
                  )}
                </DetailRow>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default WardrobeStats
