import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import Button from '../components/ui/Button'
import { resetPassword } from '../lib/api'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

// Backend `bcrypt` 72 bayt sınırlıyor ve minimum 8 karakter istiyor
// (bkz. AuthService.#validatePassword) — burada aynı alt sınır tekrarlanır
// ki kullanıcı isteği göndermeden ÖNCE anlamlı bir uyarı görsün.
const MIN_PASSWORD_LENGTH = 8

function ResetPassword() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Bağlantıda token yoksa (elle silinmiş/bozuk bir URL) form hiç
  // gösterilmez — boş bir token'la sunucuya gitmenin bir anlamı yok.
  if (!token) {
    return (
      <AuthLayout
        title="Bağlantı Geçersiz"
        subtitle="Bu sıfırlama bağlantısı eksik veya bozuk görünüyor."
        footer={
          <Link to="/sifremi-unuttum" className="text-burgundy underline transition-colors hover:text-accent-ink">
            Yeni bir bağlantı iste
          </Link>
        }
      />
    )
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`)
      return
    }
    if (newPassword !== confirmPassword) {
      setErrorMessage('Şifreler birbiriyle eşleşmiyor.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      await resetPassword(token, newPassword)
      // Login ekranı `location.state?.passwordReset` ile bunu okuyup
      // kısa bir onay mesajı gösteriyor (bkz. Login.jsx).
      navigate('/giris', { replace: true, state: { passwordReset: true } })
    } catch (error) {
      console.error('Şifre sıfırlama başarısız:', error)
      setErrorMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout title="Yeni Şifre Belirle" subtitle="Hesabın için yeni bir şifre oluştur.">
      <form onSubmit={handleSubmit} className="mt-10 space-y-5 text-left">
        <div>
          <label className={fieldLabel}>Yeni Şifre</label>
          <input
            type="password"
            value={newPassword}
            onChange={(event) => {
              setNewPassword(event.target.value)
              setErrorMessage('')
            }}
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
            onChange={(event) => {
              setConfirmPassword(event.target.value)
              setErrorMessage('')
            }}
            autoComplete="new-password"
            placeholder="Şifreni tekrar yaz"
            className={fieldInput}
          />
        </div>

        {errorMessage && (
          <div>
            <p className="text-sm text-burgundy">{errorMessage}</p>
            {errorMessage.toLowerCase().includes('geçersiz') || errorMessage.toLowerCase().includes('süresi') ? (
              <Link
                to="/sifremi-unuttum"
                className="mt-1 inline-block text-sm text-burgundy underline transition-colors hover:text-accent-ink"
              >
                Yeni bir bağlantı iste
              </Link>
            ) : null}
          </div>
        )}

        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Kaydediliyor...' : 'Şifreyi Güncelle'}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default ResetPassword
