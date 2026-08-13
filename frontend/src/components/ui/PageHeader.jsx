import { Plus } from 'lucide-react'
import Button from './Button'

function PageHeader({ title, tagline, subtitle, stats = [], actionLabel, onAction }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div>
        <h1 className="font-display text-5xl font-normal italic text-ink sm:text-6xl">{title}</h1>
        {tagline && (
          <p className="mt-2 font-display text-sm font-light italic text-ink/45">{tagline}</p>
        )}
        <span className="mt-4 block h-px w-16 bg-dusty-rose" />
        {subtitle && <p className="mt-4 text-sm text-ink/60">{subtitle}</p>}
        {stats.length > 0 && (
          <p className="mt-4 text-xs text-ink/45">{stats.join(' · ')}</p>
        )}
      </div>
      {actionLabel && (
        <Button variant="primary" onClick={onAction} className="inline-flex items-center gap-1.5">
          <Plus size={16} strokeWidth={1.75} />
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export default PageHeader
