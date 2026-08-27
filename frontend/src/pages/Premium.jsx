import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Crown, Check } from 'lucide-react'
import { fetchWardrobeStats, getCurrentUserId } from '../lib/api'
import { FREE_LIMITS } from '../lib/plans'

const BENEFITS = [
  'Sınırsız parça ve kombin sakla',
  'Ücretsiz plandaki 30 parça / 10 kombin sınırı kalkar',
  'Yeni AI özellikleri önce Premium kullanıcılara açılır',
]

// Ödeme altyapısı henüz kurulmadı — Profil'deki "Premium'a Geç" butonu
// ÖNCEDEN hiçbir yere gitmiyordu (dead button); bu sayfa onu GERÇEK bir
// hedefe bağlıyor ama gerçek bir ödeme akışı SUNMUYOR. Diğer "yakında"
// sayfalarıyla (Bildirimler, Yardım & Destek) aynı dürüstlük ilkesi: var
// olmayan bir işlevi varmış gibi göstermek yerine ne olduğunu ve ne
// zaman geleceğini açıkça söylüyor.
function Premium() {
  const [usage, setUsage] = useState(null)

  useEffect(() => {
    let isStale = false
    const userId = getCurrentUserId()
    if (!userId) return

    fetchWardrobeStats(userId)
      .then((data) => {
        if (isStale) return
        setUsage({ items: data?.items?.total ?? 0, outfits: data?.outfits?.total ?? 0 })
      })
      .catch((error) => console.error('Kullanım bilgisi alınamadı:', error))

    return () => {
      isStale = true
    }
  }, [])

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-md px-6 pt-14 pb-16 sm:px-8">
        <Link
          to="/profil"
          className="inline-flex items-center gap-1 text-sm text-ink/50 transition-colors hover:text-accent-ink"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Profile Dön
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-dusty-rose/15">
            <Crown size={22} strokeWidth={1.5} className="text-accent-ink" />
          </span>
          <h1 className="font-display text-3xl italic text-ink sm:text-4xl">Premium</h1>
        </div>

        {usage && (
          <div className="mt-6 rounded-2xl border border-ink/10 bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-[0.15em] text-ink/40">
              Şu anki kullanımın
            </p>
            <div className="mt-3 flex gap-6 text-sm text-ink">
              <span>
                <span className="font-display text-xl italic">{usage.items}</span>
                <span className="text-ink/50"> / {FREE_LIMITS.clothingItems} parça</span>
              </span>
              <span>
                <span className="font-display text-xl italic">{usage.outfits}</span>
                <span className="text-ink/50"> / {FREE_LIMITS.outfits} kombin</span>
              </span>
            </div>
          </div>
        )}

        <ul className="mt-8 space-y-3">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-start gap-3 text-sm text-ink/80">
              <Check size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-accent-ink" />
              {benefit}
            </li>
          ))}
        </ul>

        <div className="mt-10 rounded-2xl border border-dusty-rose/40 bg-dusty-rose/10 p-5 text-sm text-ink/70">
          Ödeme altyapısı yakında burada olacak. Premium'a geçmek istediğinde
          seni haberdar edeceğiz.
        </div>
      </div>
    </div>
  )
}

export default Premium
