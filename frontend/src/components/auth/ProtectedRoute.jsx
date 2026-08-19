import { Navigate, useLocation } from 'react-router-dom'
import { hasValidSession } from '../../lib/auth'

// Geçerli oturum yoksa Login'e yönlendirir. Kullanıcının gitmek istediği
// adres `state.from` ile taşınır, giriş sonrası oraya dönülebilsin diye.
function ProtectedRoute({ children }) {
  const location = useLocation()

  if (!hasValidSession()) {
    return <Navigate to="/giris" replace state={{ from: location.pathname }} />
  }

  return children
}

export default ProtectedRoute
