import Button from '../ui/Button'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

function RegistrationStep({ formData, onChange, onNext }) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onNext()
  }

  return (
    <div className="mx-auto w-full max-w-md animate-fade-in text-center">
      <h1 className="font-display text-4xl font-normal italic text-ink sm:text-5xl">
        Aramıza Hoş Geldin
      </h1>
      <span className="mx-auto mt-4 block h-px w-16 bg-dusty-rose" />
      <p className="mt-4 text-sm text-ink/60">
        Sana özel bir gardırop deneyimi için birkaç bilgiye ihtiyacımız var.
      </p>

      <form onSubmit={handleSubmit} className="mt-10 space-y-5 text-left">
        <div>
          <label className={fieldLabel}>İsim</label>
          <input
            type="text"
            value={formData.name}
            onChange={(event) => onChange('name', event.target.value)}
            placeholder="Adın"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>E-posta</label>
          <input
            type="email"
            value={formData.email}
            onChange={(event) => onChange('email', event.target.value)}
            placeholder="ornek@mail.com"
            className={fieldInput}
          />
        </div>
        <div>
          <label className={fieldLabel}>Yaş</label>
          <input
            type="number"
            value={formData.age}
            onChange={(event) => onChange('age', event.target.value)}
            placeholder="25"
            className={fieldInput}
          />
        </div>

        <Button type="submit" variant="primary" size="lg" className="mt-4 w-full">
          Devam Et
        </Button>
      </form>
    </div>
  )
}

export default RegistrationStep
