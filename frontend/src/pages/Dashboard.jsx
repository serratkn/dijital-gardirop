import { Link } from 'react-router-dom'
import { GraduationCap, Utensils } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import StatCard from '../components/ui/StatCard'
import QuickActionCard from '../components/ui/QuickActionCard'
import ClothingCard from '../components/ClothingCard'
import { CLOTHES } from '../data/clothing'
import { getUserProfile } from '../lib/onboarding'

const RECENT_IDS = [1, 5, 13, 17]
const recentItems = CLOTHES.filter((item) => RECENT_IDS.includes(item.id))

function Dashboard() {
  const { name: currentUserName } = getUserProfile()
  const greeting = currentUserName ? `Hoş Geldin, ${currentUserName}` : 'Hoş Geldin'

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-6xl px-6 py-14 sm:px-8">
        <PageHeader
          title={greeting}
          tagline="Tarzın, senin kuralların."
          subtitle="Bugün ne giyeceğine karar verelim."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard value={CLOTHES.length} label="Toplam Parça" />
          <StatCard value={8} label="Kombin" />
          <StatCard value={5} label="Favori" />
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
          <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
            {recentItems.map((item) => (
              <ClothingCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}

export default Dashboard
