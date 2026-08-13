import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import ScrollToTopButton from './components/ScrollToTopButton'
import Dashboard from './pages/Dashboard'
import Wardrobe from './pages/Wardrobe'
import OutfitSuggestion from './pages/OutfitSuggestion'
import ClothingDetail from './pages/ClothingDetail'

function App() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-ivory">
      <Navbar />
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
