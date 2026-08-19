// Giriş ve Kayıt ekranlarının ortak kabuğu: navigasyonsuz (chrome-free),
// ortalanmış, onboarding akışıyla aynı editöryal ton.
function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-6 py-16">
      <div className="mx-auto w-full max-w-md animate-fade-in">
        <div className="text-center">
          <h1 className="font-display text-4xl font-normal italic text-ink sm:text-5xl">{title}</h1>
          <span className="mx-auto mt-4 block h-px w-16 bg-dusty-rose" />
          {subtitle && <p className="mt-4 text-sm text-ink/60">{subtitle}</p>}
        </div>

        {children}

        {footer && <div className="mt-8 text-center text-sm text-ink/60">{footer}</div>}
      </div>
    </div>
  )
}

export default AuthLayout
