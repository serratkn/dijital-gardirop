import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

function ScrollToTopButton() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 400)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  if (!isVisible) return null

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Sayfanın başına dön"
      className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-warm-gray text-ink shadow-[0_4px_14px_-4px_rgba(28,26,23,0.25)] transition-colors duration-200 hover:bg-burgundy hover:text-ivory"
    >
      <ArrowUp size={18} strokeWidth={1.75} />
    </button>
  )
}

export default ScrollToTopButton
