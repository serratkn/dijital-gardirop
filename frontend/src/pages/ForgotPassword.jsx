import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import Button from '../components/ui/Button'
import { forgotPassword } from '../lib/api'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

// Login'deki "Şifremi Unuttum?" linki girilen e-postayı state ile taşır —
// kullanıcı tekrar yazmak zorunda kalmasın diye (ProtectedRoute'un
// `state.from` deseniyle aynı fikir).
function ForgotPassword() {
  const location = useLocation()
  const [email, setEmail] = useState(location.state?.email ?? '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  // GÜVENLİK: backend e-posta kayıtlı olsun olmasın AYNI (204) yanıtı döner
  // (bkz. AuthService.forgotPassword) — hangi e-postaların kayıtlı olduğu
  // sızmasın diye. Frontend de bu ayrımı YAPMAZ: istek başarıyla gittiyse
  // (400/429 gibi gerçek bir hata almadıysa) her zaman AYNI "gönderildiyse
  // ulaşacak" mesajını gösterir.
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return

    if (!email.trim()) {
      setErrorMessage('E-posta zorunludur.')
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      await forgotPassword(email.trim())
      setIsSent(true)
    } catch (error) {
      console.error('Şifre sıfırlama isteği başarısız:', error)
      setErrorMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isSent) {
    return (
      <AuthLayout
        title="E-postanı Kontrol Et"
        subtitle={`${email.trim()} kayıtlıysa, birkaç dakika içinde bir sıfırlama bağlantısı alacaksın.`}
        footer={
          <Link to="/giris" className="text-burgundy underline transition-colors hover:text-accent-ink">
            Giriş ekranına dön
          </Link>
        }
      >
        <p className="mt-8 text-sm text-ink/50">
          E-postayı bulamıyorsan gereksiz/spam klasörünü kontrol et. Bağlantı 1 saat
          boyunca geçerlidir.
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Şifreni mi Unuttun?"
      subtitle="E-posta adresini yaz, sana bir sıfırlama bağlantısı gönderelim."
      footer={
        <>
          Şifreni hatırladın mı?{' '}
          <Link to="/giris" className="text-burgundy underline transition-colors hover:text-accent-ink">
            Giriş yap
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-10 space-y-5 text-left">
        <div>
          <label className={fieldLabel}>E-posta</label>
          <input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setErrorMessage('')
            }}
            autoComplete="email"
            placeholder="ornek@mail.com"
            className={fieldInput}
          />
        </div>

        {errorMessage && <p className="text-sm text-burgundy">{errorMessage}</p>}

        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder'}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default ForgotPassword
