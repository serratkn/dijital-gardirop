import { Plus } from 'lucide-react'
import Button from './Button'

function EmptyState({ title, subtitle, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-32 text-center">
      <h2 className="font-display text-2xl text-ink">{title}</h2>
      {subtitle && <p className="max-w-sm text-sm text-ink/60">{subtitle}</p>}
      {actionLabel && (
        <Button
          variant="primary"
          size="lg"
          onClick={onAction}
          className="mt-2 inline-flex items-center gap-1.5"
        >
          <Plus size={16} strokeWidth={1.75} />
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export default EmptyState
