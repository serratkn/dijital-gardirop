import { useEffect, useState } from 'react'
import { Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import BottomNav from './components/BottomNav'
import ScrollToTopButton from './components/ScrollToTopButton'
import ProtectedRoute from './components/auth/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import StyleQuiz from './pages/StyleQuiz'
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
import Premium from './pages/Premium'
import Intro from './pages/Intro'
import { onUnauthorized } from './lib/api'
import { hasValidSession } from './lib/auth'
import { hasSeenIntro, markIntroSeen } from './lib/intro'
import { watchSystemTheme } from './lib/theme'

// Navigasyon ve alt menü yalnızca oturum açmış ekranlarda görünür;
// giriş/kayıt/anket akışı bilinçli olarak chrome-free kalır.
function AppShell({ children }) {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-ivory">
      <Navbar />
      <div key={location.pathname} className="animate-page-fade pb-24 sm:pb-0">
        {children}
      </div>
      <ScrollToTopButton />
      <BottomNav />
    </div>
  )
}

function App() {
  const navigate = useNavigate()

  // Oturum durumu STATE DEĞİL, her render'da token'dan türetilir. State olsaydı
  // kayıt sonrası şu yarış durumu oluşurdu: setState → /kayit rotası
  // <Navigate to="/"> render eder → navigate('/tarz-anketi') ezilir.
  const [authTick, setAuthTick] = useState(0)
  const isAuthenticated = hasValidSession()

  // AYNI desen: `hasSeenIntro()` de localStorage'dan okunur, state değildir.
  // `introTick` yalnızca yeniden render tetiklemek için var — `markIntroSeen()`
  // localStorage'ı günceller ama React bunu kendiliğinden fark etmez.
  const [introTick, setIntroTick] = useState(0)
  void introTick
  // Zaten oturumu olan bir kullanıcı (ör. token varken uygulama yeniden
  // açıldığında) tanıtımı ASLA görmemeli — bu ekran yalnızca "hiç kullanmamış"
  // kişiler içindir, `isAuthenticated` kontrolü bu yüzden `hasSeenIntro()`'dan
  // ÖNCE gelir.
  const showIntro = !isAuthenticated && !hasSeenIntro()

  // Sunucu 401 döndüğünde (token süresi doldu / iptal edildi) oturum düşer
  // ve kullanıcı giriş ekranına alınır. authTick yalnızca yeniden render tetikler.
  useEffect(() => {
    return onUnauthorized(() => {
      setAuthTick((tick) => tick + 1)
      navigate('/giris', { replace: true })
    })
  }, [navigate])

  // Kullanıcı henüz elle tema seçmediyse sistem tercihi canlı takip edilir
  // (işletim sistemi gece moduna geçince uygulama da geçer). Seçim yapılmışsa
  // dinleyici hiçbir şey yapmaz — kullanıcının tercihi sistemi ezer.
  useEffect(() => watchSystemTheme(), [])

  // authTick okunmazsa lint kullanılmıyor sayar; oturum düşüşünde
  // yeniden hesaplamayı garanti eder.
  void authTick

  // `showOnboarding`'in eski deseniyle AYNI: koşul doğruyken router/nav ağacı
  // yerine DOĞRUDAN tanıtım ekranı döner (chrome-free, hiçbir rotaya bağlı
  // değil). `onFinish` yalnızca bayrağı yazıp yeniden render tetikler; bir
  // sonraki adımın nereye düşeceğine (Login mi, zaten oturum açıksa Ana
  // Sayfa mı) mevcut routing karar verir.
  if (showIntro) {
    return (
      <Intro
        onFinish={() => {
          markIntroSeen()
          setIntroTick((tick) => tick + 1)
        }}
      />
    )
  }

  const protectedShell = (page) => (
    <ProtectedRoute>
      <AppShell>{page}</AppShell>
    </ProtectedRoute>
  )

  return (
    <Routes>
      {/* Korumasız */}
      <Route
        path="/giris"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Login />
        }
      />
      <Route
        path="/kayit"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <Register />
        }
      />
      {/* Şifremi unuttum / sıfırlama — GİRİŞ GEREKTİRMEZ, tam tersine amaçları
          oturumu olmayan birinin şifresini kurtarmak. Oturumu olan biri
          yanlışlıkla buraya gelirse Ana Sayfa'ya yönlendirilir (Login/Register
          ile AYNI kural). */}
      <Route
        path="/sifremi-unuttum"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />
        }
      />
      <Route
        path="/sifre-sifirla"
        element={
          isAuthenticated ? <Navigate to="/" replace /> : <ResetPassword />
        }
      />

      {/* Korumalı ama chrome-free: kayıt sonrası tarz anketi */}
      <Route
        path="/tarz-anketi"
        element={
          <ProtectedRoute>
            <StyleQuiz />
          </ProtectedRoute>
        }
      />

      {/* Korumalı uygulama */}
      <Route path="/" element={protectedShell(<Dashboard />)} />
      <Route path="/gardirop" element={protectedShell(<Wardrobe />)} />
      <Route path="/kombin-oner" element={protectedShell(<OutfitSuggestion />)} />
      <Route path="/kombinlerim" element={protectedShell(<OutfitHistory />)} />
      <Route path="/kiyafet/:id" element={protectedShell(<ClothingDetail />)} />
      <Route path="/profil" element={protectedShell(<Profile onLoggedOut={() => setAuthTick((t) => t + 1)} />)} />
      <Route path="/profil/premium" element={protectedShell(<Premium />)} />
      <Route path="/profil/hesap-bilgilerim" element={protectedShell(<AccountInfo />)} />
      <Route path="/profil/sifre-degistir" element={protectedShell(<ChangePassword />)} />
      <Route path="/profil/tarz-tercihlerim" element={protectedShell(<StylePreferences />)} />
      <Route path="/profil/bildirimler" element={protectedShell(<ComingSoon title="Bildirimler" />)} />
      <Route
        path="/profil/yardim-destek"
        element={protectedShell(<ComingSoon title="Yardım & Destek" />)}
      />
    </Routes>
  )
}

export default App
