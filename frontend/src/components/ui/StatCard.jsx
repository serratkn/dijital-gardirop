import { Link } from 'react-router-dom'

// `to` verilirse kart tıklanabilir bir Link'e döner; verilmezse düz div kalır
// (bileşen başka bir yerde salt gösterim amacıyla da kullanılabilsin diye).
const CARD = 'rounded-2xl border border-ink/10 bg-warm-gray px-6 py-8 text-center'

// Hover geri bildirimi kasıtlı olarak sade tutuldu: kenarlık dusty-rose'a döner,
// etiket biraz koyulaşır. QuickActionCard'daki yükselme (-translate-y) efekti
// büyük eylem kartlarına ait bir idiom; küçük istatistik kartlarında abartı olurdu.
// Odak stili depodaki kalıbı izler (ring değil, dusty-rose kenarlık).
const INTERACTIVE =
  'group block transition-colors duration-200 hover:border-dusty-rose ' +
  'focus-visible:border-dusty-rose focus-visible:outline-none'

function StatCard({ value, label, to }) {
  const valueNode = <p className="font-display text-4xl italic text-ink">{value}</p>

  if (!to) {
    return (
      <div className={CARD}>
        {valueNode}
        <p className="mt-2 text-xs uppercase tracking-[0.15em] text-ink/50">{label}</p>
      </div>
    )
  }

  return (
    <Link to={to} className={`${CARD} ${INTERACTIVE}`}>
      {valueNode}
      <p className="mt-2 text-xs uppercase tracking-[0.15em] text-ink/50 transition-colors group-hover:text-ink/70">
        {label}
      </p>
    </Link>
  )
}

export default StatCard
