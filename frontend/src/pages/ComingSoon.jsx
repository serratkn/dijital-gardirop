import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'

function ComingSoon({ title }) {
  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-md px-6 pt-14 sm:px-8">
        <Link
          to="/profil"
          className="inline-flex items-center gap-1 text-sm text-ink/50 transition-colors hover:text-accent-ink"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Profile Dön
        </Link>
        <h1 className="mt-6 font-display text-3xl italic text-ink sm:text-4xl">{title}</h1>

        <EmptyState title="Bu özellik yakında burada olacak." />
      </div>
    </div>
  )
}

export default ComingSoon
