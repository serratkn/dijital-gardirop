import { NavLink } from 'react-router-dom'
import { Home, Shirt, Sparkles, User } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Ana Sayfa', icon: Home, end: true },
  { to: '/gardirop', label: 'Gardırop', icon: Shirt },
  { to: '/kombin-oner', label: 'Kombin Öner', icon: Sparkles },
  { to: '/profil', label: 'Profil', icon: User },
]

function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink/10 bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      <ul className="flex items-stretch justify-around">
        {tabs.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                  isActive ? 'text-burgundy' : 'text-ink/45'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <tab.icon size={20} strokeWidth={isActive ? 2 : 1.5} />
                  {tab.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default BottomNav
