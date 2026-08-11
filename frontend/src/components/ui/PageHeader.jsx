import Button from './Button'

function PageHeader({ title, subtitle, stats = [], actionLabel, onAction }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-6">
      <div>
        <h1 className="font-display text-5xl font-normal italic text-ink sm:text-6xl">{title}</h1>
        <span className="mt-4 block h-px w-16 bg-dusty-rose" />
        {subtitle && <p className="mt-4 text-sm text-ink/60">{subtitle}</p>}
        {stats.length > 0 && (
          <p className="mt-4 text-xs text-ink/45">{stats.join(' · ')}</p>
        )}
      </div>
      {actionLabel && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

export default PageHeader
