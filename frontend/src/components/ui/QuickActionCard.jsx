import { Link } from 'react-router-dom'

// `state` verilirse Link'in router state'i olarak taşınır; hedef sayfa bunu
// okuyup kendini hazırlayabilir (örn. Kombin Öner'in doğrudan öneri üretmesi).
function QuickActionCard({ to, state, eyebrow, title, subtitle, icon: Icon }) {
  return (
    <Link
      to={to}
      state={state}
      className="group block overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[0_8px_24px_-14px_rgba(28,26,23,0.18)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_36px_-14px_rgba(28,26,23,0.22)]"
    >
      <div className="flex h-40 items-center justify-center bg-warm-gray">
        {Icon && <Icon size={28} strokeWidth={1.5} className="text-ink/40" />}
      </div>
      <div className="space-y-2 p-6">
        {eyebrow && (
          <p className="text-[12px] font-medium uppercase tracking-[0.15em] text-dusty-rose">
            {eyebrow}
          </p>
        )}
        <p className="font-body text-xl font-medium text-ink">{title}</p>
        {subtitle && <p className="text-sm text-ink/60">{subtitle}</p>}
      </div>
    </Link>
  )
}

export default QuickActionCard
