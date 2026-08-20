import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Button from '../components/ui/Button'
import { getCurrentUserId, fetchUser, updateUser } from '../lib/api'
import { toUserProfile } from '../lib/transformers'
import { setUserProfile } from '../lib/onboarding'
import { TURKISH_CITIES } from '../lib/cities'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

function AccountInfo() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [age, setAge] = useState('')
  const [city, setCity] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState('free')

  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Tek doğru kaynak veritabanıdır; localStorage yalnızca önbellektir.
  useEffect(() => {
    let isStale = false

    async function loadUser() {
      setIsLoading(true)
      setHasError(false)

      try {
        const row = await fetchUser(getCurrentUserId())
        if (isStale) return

        const profile = toUserProfile(row)
        setName(profile.name)
        setEmail(profile.email)
        setAge(profile.age)
        setCity(profile.city)
        setSubscriptionTier(profile.subscriptionTier)
      } catch (error) {
        if (isStale) return
        console.error('Hesap bilgileri alınamadı:', error)
        setHasError(true)
      } finally {
        if (!isStale) setIsLoading(false)
      }
    }

    loadUser()

    return () => {
      isStale = true
    }
  }, [])

  const handleChange = (setter) => (event) => {
    setter(event.target.value)
    setIsSaved(false)
    setErrorMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSaving) return

    setIsSaving(true)
    setErrorMessage('')

    try {
      const updated = await updateUser(getCurrentUserId(), {
        name: name.trim(),
        email: email.trim(),
        age: age === '' ? null : Number(age),
        city: city || null,
        subscriptionTier,
      })

      const profile = toUserProfile(updated)
      // Önbelleği tazele: Ana Sayfa karşılaması buradan okuyor.
      setUserProfile({ name: profile.name, email: profile.email, age: profile.age })
      setIsSaved(true)
    } catch (error) {
      console.error('Hesap bilgileri kaydedilemedi:', error)
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-md px-6 py-14 sm:px-8">
        <Link
          to="/profil"
          className="inline-flex items-center gap-1 text-sm text-ink/50 transition-colors hover:text-dusty-rose"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Profile Dön
        </Link>

        <h1 className="mt-6 font-display text-3xl italic text-ink sm:text-4xl">Hesap Bilgilerim</h1>
        <p className="mt-2 text-sm text-ink/50">
          Bilgilerini güncel tut, sana daha iyi öneriler sunalım.
        </p>

        {isLoading ? (
          <div className="mt-10 space-y-6">
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <div className="h-3 w-20 animate-pulse rounded-full bg-warm-gray" />
                <div className="mt-2 h-12 w-full animate-pulse rounded-xl bg-warm-gray" />
              </div>
            ))}
          </div>
        ) : hasError ? (
          <p className="mt-10 text-sm text-ink/60">
            Hesap bilgilerine şu an ulaşılamıyor. Bağlantını kontrol edip sayfayı yenilemeyi dene.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            <div>
              <label className={fieldLabel}>İsim</label>
              <input
                type="text"
                value={name}
                onChange={handleChange(setName)}
                maxLength={100}
                placeholder="Adın"
                className={fieldInput}
              />
            </div>
            <div>
              <label className={fieldLabel}>E-posta</label>
              <input
                type="email"
                value={email}
                onChange={handleChange(setEmail)}
                maxLength={255}
                placeholder="ornek@mail.com"
                className={fieldInput}
              />
            </div>
            <div>
              <label className={fieldLabel}>Yaş</label>
              <input
                type="number"
                value={age}
                onChange={handleChange(setAge)}
                placeholder="25"
                className={fieldInput}
              />
            </div>

            <div>
              <label className={fieldLabel}>Şehir</label>
              <select value={city} onChange={handleChange(setCity)} className={fieldInput}>
                <option value="">Seçilmedi</option>
                {TURKISH_CITIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-ink/45">
                Kombin önerisi hava durumunu bu şehre göre dikkate alır. Boş bırakabilirsin.
              </p>
            </div>

            {errorMessage && <p className="text-sm text-burgundy">{errorMessage}</p>}

            <Button type="submit" variant="primary" size="lg" disabled={isSaving} className="w-full">
              {isSaving ? 'Kaydediliyor...' : isSaved ? 'Kaydedildi' : 'Kaydet'}
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}

export default AccountInfo
