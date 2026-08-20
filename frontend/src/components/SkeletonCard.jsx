function SkeletonCard({ imgHeight }) {
  return (
    <div className="mb-6 block break-inside-avoid overflow-hidden rounded-2xl border border-ink/10 bg-surface">
      <div className={`animate-pulse bg-warm-gray ${imgHeight}`} />
      <div className="space-y-2 p-5">
        <div className="h-3 w-16 animate-pulse rounded-full bg-warm-gray" />
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-warm-gray" />
      </div>
    </div>
  )
}

export default SkeletonCard
