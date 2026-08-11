import { Link } from 'react-router-dom'

function QuickActionCard({ to, eyebrow, title, subtitle }) {
  return (
    <Link
      to={to}
      className="group block overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-[0_8px_24px_-14px_rgba(28,26,23,0.18)] transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_18px_36px_-14px_rgba(28,26,23,0.22)]"
    >
      <div className="h-40 bg-warm-gray" />
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
