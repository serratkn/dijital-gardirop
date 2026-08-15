function ProgressBar({ current, total }) {
  return (
    <div className="mx-auto w-full max-w-xs">
      <p className="text-center text-xs uppercase tracking-[0.15em] text-ink/40">
        {current}/{total}
      </p>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-warm-gray">
        <div
          className="h-full rounded-full bg-burgundy transition-all duration-300 ease-out"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  )
}

export default ProgressBar
