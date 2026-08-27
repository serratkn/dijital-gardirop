import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Crown } from 'lucide-react'
import Button from './ui/Button'
import { fetchWardrobeStats, getCurrentUserId } from '../lib/api'
import { FREE_LIMITS } from '../lib/plans'

// Profile.jsx'in kendi `fetchMe()` çağrısından gelen `subscription_tier`'ı
// prop olarak alır — burada AYRICA bir kullanıcı isteği atılmaz, yalnızca
// kullanım sayıları (parça/kombin) için kendi bağımsız isteğini atar
// (WardrobeStats/SkinToneSection'ın bu sayfadaki AYNI "her bölüm kendi
// verisini çeker" deseni).
function PremiumCard({ subscriptionTier }) {
  const navigate = useNavigate()
  const [usage, setUsage] = useState(null)
  const isPremium = subscriptionTier === 'premium'

  useEffect(() => {
    // Premium kullanıcıda sınır zaten yok — kullanım sayısı göstermenin bir
    // anlamı olmadığı için gereksiz bir istek hiç atılmaz.
    if (isPremium) return

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
  }, [isPremium])

  return (
    <div className="rounded-2xl border border-dusty-rose/40 bg-dusty-rose/10 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.15em] text-accent-ink">
            Premium Abonelik
          </p>
          <p className="mt-1.5 text-sm text-ink/60">{isPremium ? 'Premium Plan' : 'Ücretsiz Plan'}</p>
        </div>
        <Crown size={22} strokeWidth={1.5} className="text-accent-ink" />
      </div>

      {!isPremium && usage && (
        <div className="mt-4 flex gap-4 text-xs text-ink/50">
          <span>
            <span className="font-medium text-ink/70">{usage.items}</span> / {FREE_LIMITS.clothingItems} parça
          </span>
          <span>
            <span className="font-medium text-ink/70">{usage.outfits}</span> / {FREE_LIMITS.outfits} kombin
          </span>
        </div>
      )}

      {!isPremium && (
        <Button variant="primary" className="mt-5 w-full" onClick={() => navigate('/profil/premium')}>
          Premium'a Geç
        </Button>
      )}
    </div>
  )
}

export default PremiumCard
