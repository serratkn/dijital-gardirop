import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import Button from '../components/ui/Button'
import { login } from '../lib/api'
import { setSession } from '../lib/auth'
import { setUserProfile } from '../lib/onboarding'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  // ResetPassword başarılı olunca buraya `state: { passwordReset: true }` ile
  // yönlendiriyor — ayrı bir toast sistemi yok, en basit yol bu bayrağı
  // okuyup kısa bir onay satırı göstermek.
  const showPasswordResetNotice = Boolean(location.state?.passwordReset)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return

    if (!email.trim() || !password) {
      setErrorMessage('E-posta ve şifre zorunludur.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const { user, token, refreshToken } = await login({ email: email.trim(), password })
      setSession({ token, refreshToken })
      // Ana Sayfa karşılaması ilk boyamada buradan okuyor.
      setUserProfile({ name: user.name, email: user.email, age: user.age ?? '' })
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Giriş başarısız:', error)
      setErrorMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Tekrar Hoş Geldin"
      subtitle="Gardırobun seni bekliyor."
      footer={
        <>
          Hesabın yok mu?{' '}
          <Link to="/kayit" className="text-burgundy underline transition-colors hover:text-accent-ink">
            Kayıt ol
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-10 space-y-5 text-left">
        {showPasswordResetNotice && (
          <p className="rounded-xl border border-dusty-rose/40 bg-dusty-rose/10 px-4 py-3 text-sm text-ink/70">
            Şifren güncellendi. Yeni şifrenle giriş yapabilirsin.
          </p>
        )}

        <div>
          <label className={fieldLabel}>E-posta</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="ornek@mail.com"
            className={fieldInput}
          />
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <label className={fieldLabel}>Şifre</label>
            <Link
              to="/sifremi-unuttum"
              state={{ email }}
              className="text-xs text-ink/50 underline transition-colors hover:text-accent-ink"
            >
              Şifremi Unuttum?
            </Link>
          </div>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="••••••••"
            className={fieldInput}
          />
        </div>

        {errorMessage && <p className="text-sm text-burgundy">{errorMessage}</p>}

        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default Login
