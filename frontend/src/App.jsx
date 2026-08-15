import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import ScrollToTopButton from './components/ScrollToTopButton'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Wardrobe from './pages/Wardrobe'
import OutfitSuggestion from './pages/OutfitSuggestion'
import ClothingDetail from './pages/ClothingDetail'
import { isOnboardingCompleted, setOnboardingCompleted } from './lib/onboarding'

function App() {
  const location = useLocation()
  const [showOnboarding, setShowOnboarding] = useState(() => !isOnboardingCompleted())

  if (showOnboarding) {
    return (
      <Onboarding
        onFinish={() => {
          setOnboardingCompleted()
          setShowOnboarding(false)
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-ivory">
      <Navbar onReplayOnboarding={() => setShowOnboarding(true)} />
      <div key={location.pathname} className="animate-page-fade">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/gardirop" element={<Wardrobe />} />
          <Route path="/kombin-oner" element={<OutfitSuggestion />} />
          <Route path="/kiyafet/:id" element={<ClothingDetail />} />
        </Routes>
      </div>
      <ScrollToTopButton />
    </div>
  )
}

export default App
