import Button from './Button'

function EmptyState({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {subtitle && <p className="max-w-sm text-sm text-ink/60">{subtitle}</p>}
      {actionLabel && (
        <Button variant="primary" size="lg" onClick={onAction} className="mt-2">
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export default EmptyState
