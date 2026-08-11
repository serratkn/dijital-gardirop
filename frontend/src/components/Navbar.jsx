import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Ana Sayfa' },
  { to: '/gardirop', label: 'Gardırop' },
  { to: '/kombin-oner', label: 'Kombin Öner' },
]

function Navbar() {
  return (
    <nav className="border-b border-ink/10 bg-ivory">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <span className="font-display text-lg text-ink">Dijital Gardırop</span>
        <ul className="flex items-center gap-8">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `text-sm font-medium transition-colors ${
                    isActive ? 'text-ink' : 'text-ink/50 hover:text-ink'
                  }`
                }
              >
                {link.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export default Navbar
