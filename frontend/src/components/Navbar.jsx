import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Ana Sayfa' },
  { to: '/gardirop', label: 'Gardırop' },
  { to: '/kombin-oner', label: 'Kombin Öner' },
]

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 8)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`sticky top-0 z-40 border-b bg-ivory transition-shadow duration-200 ${
        isScrolled ? 'border-ink/10 shadow-[0_1px_3px_rgba(28,26,23,0.06)]' : 'border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <span className="font-display text-lg text-ink">Dijital Gardırop</span>
        <ul className="flex items-center gap-8">
          {links.map((link) => (
            <li key={link.to}>
              <NavLink
                to={link.to}
                end={link.to === '/'}
                className={({ isActive }) =>
                  `relative inline-block pb-1.5 text-sm font-medium transition-colors ${
                    isActive ? 'text-ink' : 'text-ink/50 hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {link.label}
                    {isActive && (
                      <span className="absolute inset-x-0 -bottom-0.5 h-px bg-burgundy" />
                    )}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export default Navbar
