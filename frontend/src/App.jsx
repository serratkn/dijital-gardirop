import { useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import ScrollToTopButton from './components/ScrollToTopButton'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Wardrobe from './pages/Wardrobe'
import OutfitSuggestion from './pages/OutfitSuggestion'
import OutfitHistory from './pages/OutfitHistory'
import ClothingDetail from './pages/ClothingDetail'
import Profile from './pages/Profile'
import AccountInfo from './pages/AccountInfo'
import ChangePassword from './pages/ChangePassword'
import StylePreferences from './pages/StylePreferences'
import ComingSoon from './pages/ComingSoon'
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
      <div key={location.pathname} className="animate-page-fade pb-24 sm:pb-0">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/gardirop" element={<Wardrobe />} />
          <Route path="/kombin-oner" element={<OutfitSuggestion />} />
          <Route path="/kombinlerim" element={<OutfitHistory />} />
          <Route path="/kiyafet/:id" element={<ClothingDetail />} />
          <Route path="/profil" element={<Profile />} />
          <Route path="/profil/hesap-bilgilerim" element={<AccountInfo />} />
          <Route path="/profil/sifre-degistir" element={<ChangePassword />} />
          <Route path="/profil/tarz-tercihlerim" element={<StylePreferences />} />
          <Route path="/profil/bildirimler" element={<ComingSoon title="Bildirimler" />} />
          <Route path="/profil/yardim-destek" element={<ComingSoon title="Yardım & Destek" />} />
        </Routes>
      </div>
      <ScrollToTopButton />
      <BottomNav />
    </div>
  )
}

export default App
