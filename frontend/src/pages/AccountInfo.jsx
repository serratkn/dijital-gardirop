import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Button from '../components/ui/Button'
import { getUserProfile, setUserProfile } from '../lib/onboarding'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

function AccountInfo() {
  const profile = getUserProfile()
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [age, setAge] = useState(profile.age)
  const [isSaved, setIsSaved] = useState(false)

  const handleChange = (setter) => (event) => {
    setter(event.target.value)
    setIsSaved(false)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setUserProfile({ name: name.trim(), email: email.trim(), age })
    setIsSaved(true)
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

        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <div>
            <label className={fieldLabel}>İsim</label>
            <input
              type="text"
              value={name}
              onChange={handleChange(setName)}
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

          <Button type="submit" variant="primary" size="lg" className="w-full">
            {isSaved ? 'Kaydedildi' : 'Kaydet'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default AccountInfo
