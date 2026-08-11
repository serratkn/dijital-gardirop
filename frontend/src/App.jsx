import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Wardrobe from './pages/Wardrobe'
import OutfitSuggestion from './pages/OutfitSuggestion'
import ClothingDetail from './pages/ClothingDetail'

function App() {
  return (
    <div className="min-h-screen bg-ivory">
      <Navbar />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/gardirop" element={<Wardrobe />} />
        <Route path="/kombin-oner" element={<OutfitSuggestion />} />
        <Route path="/kiyafet/:id" element={<ClothingDetail />} />
      </Routes>
    </div>
  )
}

export default App
