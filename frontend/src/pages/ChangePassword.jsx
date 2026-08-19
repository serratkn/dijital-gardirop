import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Button from '../components/ui/Button'
import { changePassword } from '../lib/api'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

const MIN_PASSWORD_LENGTH = 8

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleChange = (setter) => (event) => {
    setter(event.target.value)
    setIsSaved(false)
    setErrorMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSaving) return

    if (!currentPassword) {
      setErrorMessage('Mevcut şifreni girmelisin.')
      return
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`)
      return
    }
    // Bu kontrol yalnızca istemcide var: sunucu iki alanı ayrı ayrı değil,
    // tek bir yeni şifre olarak alır.
    if (newPassword !== confirmPassword) {
      setErrorMessage('Yeni şifreler eşleşmiyor.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      await changePassword({ currentPassword, newPassword })
      setIsSaved(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (error) {
      console.error('Şifre değiştirilemedi:', error)
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
              autoComplete="current-password"
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
              autoComplete="new-password"
              placeholder="En az 8 karakter"
              className={fieldInput}
            />
          </div>
          <div>
            <label className={fieldLabel}>Yeni Şifre (Tekrar)</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={handleChange(setConfirmPassword)}
              autoComplete="new-password"
              placeholder="••••••••"
              className={fieldInput}
            />
          </div>

          {errorMessage && <p className="text-sm text-burgundy">{errorMessage}</p>}
          {isSaved && <p className="text-sm text-ink/60">Şifren güncellendi.</p>}

          <Button type="submit" variant="primary" size="lg" disabled={isSaving} className="w-full">
            {isSaving ? 'Güncelleniyor...' : 'Şifreyi Güncelle'}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default ChangePassword
