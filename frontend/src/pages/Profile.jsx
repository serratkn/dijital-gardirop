import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { UserCog, KeyRound, Crown, Palette, Bell, HelpCircle, ChevronRight, LogOut } from 'lucide-react'
import Button from '../components/ui/Button'
import WardrobeStats from '../components/WardrobeStats'
import { fetchMe } from '../lib/api'
import { clearToken } from '../lib/auth'
import { getUserProfile, setUserProfile, clearOnboardingState } from '../lib/onboarding'

const listItemClass =
  'flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-warm-gray/50'

function ProfileListItem({ icon: Icon, label, to, onClick }) {
  const content = (
    <>
      <Icon size={18} strokeWidth={1.5} className="text-ink/40" />
      <span className="flex-1 text-sm font-medium text-ink">{label}</span>
      <ChevronRight size={16} strokeWidth={1.75} className="text-ink/25" />
    </>
  )

  if (to) {
    return (
      <Link to={to} className={listItemClass}>
        {content}
      </Link>
    )
  }

  return (
    <button type="button" onClick={onClick} className={listItemClass}>
      {content}
    </button>
  )
}

function Profile({ onLoggedOut }) {
  const navigate = useNavigate()
  // Önbellek ilk boyamayı hızlandırır; ardından sunucudaki güncel hâlle tazelenir.
  const [profile, setProfile] = useState(() => getUserProfile())

  useEffect(() => {
    let isStale = false

    fetchMe()
      .then((user) => {
        if (isStale) return
        const fresh = { name: user.name ?? '', email: user.email ?? '', age: user.age ?? '' }
        setProfile(fresh)
        setUserProfile(fresh)
      })
      .catch((error) => console.error('Profil bilgisi alınamadı:', error))

    return () => {
      isStale = true
    }
  }, [])

  const handleLogout = () => {
    clearToken()
    // Bir sonraki kullanıcının verisi görünmesin diye önbellek de temizlenir.
    clearOnboardingState()
    onLoggedOut?.()
    navigate('/giris', { replace: true })
  }

  const { name, email } = profile
  const initial = name ? name.trim().charAt(0).toUpperCase() : '?'

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-2xl px-6 py-14 sm:px-8">
        <div className="flex items-center gap-5">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-burgundy font-display text-2xl italic text-ivory">
            {initial}
          </span>
          <div>
            <h1 className="font-display text-3xl italic text-ink sm:text-4xl">
              {name || 'İsimsiz Kullanıcı'}
            </h1>
            <p className="mt-1 text-sm text-ink/50">{email || 'E-posta eklenmedi'}</p>
          </div>
        </div>

        <div className="mt-12 space-y-6">
          <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white divide-y divide-ink/10">
            <ProfileListItem icon={UserCog} label="Hesap Bilgilerim" to="/profil/hesap-bilgilerim" />
            <ProfileListItem icon={KeyRound} label="Şifre Değiştir" to="/profil/sifre-degistir" />
          </div>

          <WardrobeStats />

          <div className="rounded-2xl border border-dusty-rose/40 bg-dusty-rose/10 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.15em] text-dusty-rose">
                  Premium Abonelik
                </p>
                <p className="mt-1.5 text-sm text-ink/60">Ücretsiz Plan</p>
              </div>
              <Crown size={22} strokeWidth={1.5} className="text-dusty-rose" />
            </div>
            <Button variant="primary" className="mt-5 w-full">
              Premium'a Geç
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white divide-y divide-ink/10">
            <ProfileListItem icon={Palette} label="Tarz Tercihlerim" to="/profil/tarz-tercihlerim" />
            <ProfileListItem icon={Bell} label="Bildirimler" to="/profil/bildirimler" />
            <ProfileListItem icon={HelpCircle} label="Yardım & Destek" to="/profil/yardim-destek" />
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 text-sm text-burgundy/60 transition-colors hover:text-burgundy"
          >
            <LogOut size={15} strokeWidth={1.75} />
            Çıkış Yap
          </button>
        </div>
      </div>
    </div>
  )
}

export default Profile
