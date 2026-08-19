import Button from '../ui/Button'

function WelcomeStep({ name, onFinish, isSaving, errorMessage }) {
  return (
    <div className="mx-auto w-full max-w-md animate-fade-in text-center">
      <span className="mx-auto block h-px w-16 bg-dusty-rose" />
      <h1 className="mt-6 font-display text-4xl font-normal italic text-ink sm:text-5xl">
        {name ? `${name}, Seni Tanımaya Başladık!` : 'Seni Tanımaya Başladık!'}
      </h1>
      <p className="mt-4 text-sm text-ink/60">Tarzına uygun kombinler hazırlamaya hazırız.</p>

      <Button
        variant="primary"
        size="lg"
        onClick={onFinish}
        disabled={isSaving}
        className="mt-10 w-full"
      >
        {isSaving ? 'Kaydediliyor...' : 'Gardırobuma Git'}
      </Button>

      {errorMessage && <p className="mt-5 text-sm text-burgundy">{errorMessage}</p>}
    </div>
  )
}

export default WelcomeStep
