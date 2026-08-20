import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuthLayout from '../components/auth/AuthLayout'
import Button from '../components/ui/Button'
import { register } from '../lib/api'
import { setToken } from '../lib/auth'
import { setUserProfile } from '../lib/onboarding'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

const MIN_PASSWORD_LENGTH = 8

function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', age: '', password: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const update = (field) => (event) => {
    setForm((previous) => ({ ...previous, [field]: event.target.value }))
    setErrorMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (isSubmitting) return

    if (!form.email.trim()) {
      setErrorMessage('E-posta zorunludur.')
      return
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`)
      return
    }

    setIsSubmitting(true)
    setErrorMessage('')

    try {
      const { user, token } = await register({
        name: form.name.trim(),
        email: form.email.trim(),
        age: form.age === '' ? null : Number(form.age),
        password: form.password,
      })

      // Token hemen saklanır: sıradaki adım (tarz anketi) korumalı bir uçtur.
      setToken(token)
      setUserProfile({ name: user.name, email: user.email, age: user.age ?? '' })
      navigate('/tarz-anketi', { replace: true })
    } catch (error) {
      console.error('Kayıt başarısız:', error)
      setErrorMessage(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="Aramıza Hoş Geldin"
      subtitle="Sana özel bir gardırop deneyimi için birkaç bilgiye ihtiyacımız var."
      footer={
        <>
          Zaten hesabın var mı?{' '}
          <Link to="/giris" className="text-burgundy underline transition-colors hover:text-accent-ink">
            Giriş yap
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="mt-10 space-y-5 text-left">
        <div>
          <label className={fieldLabel}>İsim</label>
          <input
            type="text"
            value={form.name}
            onChange={update('name')}
            maxLength={100}
            autoComplete="name"
            placeholder="Adın"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>E-posta</label>
          <input
            type="email"
            value={form.email}
            onChange={update('email')}
            maxLength={255}
            autoComplete="email"
            placeholder="ornek@mail.com"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Yaş</label>
          <input
            type="number"
            value={form.age}
            onChange={update('age')}
            placeholder="25"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Şifre</label>
          <input
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete="new-password"
            placeholder="En az 8 karakter"
            className={fieldInput}
          />
        </div>

        {errorMessage && <p className="text-sm text-burgundy">{errorMessage}</p>}

        <Button type="submit" variant="primary" size="lg" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Hesap oluşturuluyor...' : 'Devam Et'}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default Register
