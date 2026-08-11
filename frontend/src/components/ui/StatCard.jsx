function StatCard({ value, label }) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-warm-gray px-6 py-8 text-center">
      <p className="font-display text-4xl italic text-ink">{value}</p>
      <p className="mt-2 text-xs uppercase tracking-[0.15em] text-ink/50">{label}</p>
    </div>
  )
}

export default StatCard
