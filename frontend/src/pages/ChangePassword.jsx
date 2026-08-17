import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Button from '../components/ui/Button'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaved, setIsSaved] = useState(false)

  const handleChange = (setter) => (event) => {
    setter(event.target.value)
    setIsSaved(false)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    setIsSaved(true)
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
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

        <h1 className="mt-6 font-display text-3xl italic text-ink sm:text-4xl">Şifre Değiştir</h1>
        <p className="mt-2 text-sm text-ink/50">
          Hesabının güvenliği için şifreni düzenli aralıklarla yenile.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <div>
            <label className={fieldLabel}>Mevcut Şifre</label>
            <input
              type="password"
              value={currentPassword}
              onChange={handleChange(setCurrentPassword)}
              placeholder="••••••••"
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel}>Yeni Şifre</label>
            <input
              type="password"
              value={newPassword}
              onChange={handleChange(setNewPassword)}
              placeholder="••••••••"
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel}>Yeni Şifre (Tekrar)</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={handleChange(setConfirmPassword)}
              placeholder="••••••••"
              className={fieldInput}
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full">
            {isSaved ? 'Şifre Güncellendi' : 'Şifreyi Güncelle'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default ChangePassword
