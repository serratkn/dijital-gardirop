import { useRef, useState } from 'react'
import { Shirt, Sparkles, Layers } from 'lucide-react'
import Button from '../components/ui/Button'
import { markIntroSeen } from '../lib/intro'

// İkonlar bilerek uygulamanın KENDİ sözlüğünden seçildi, yeni bir görsel dil
// icat edilmedi: Shirt (kategori ikonu), Sparkles (AiAnalysisPanel/WardrobeStats
// zaten "yapay zekâ"yı bununla temsil ediyor), Layers (BottomNav'daki
// "Kombinler" sekmesinin ikonu).
const SLIDES = [
  {
    Icon: Shirt,
    title: 'Gardırobunu Dijitalleştir',
    description: 'Kıyafetlerini fotoğrafla, hepsini tek bir yerde topla — dolabın artık her an cebinde.',
  },
  {
    Icon: Sparkles,
    title: 'Yapay Zekâ Senin İçin Analiz Etsin',
    description: 'Gemini yapay zekâsı kıyafetlerini otomatik analiz etsin, ten tonuna en yakışan renkleri bulsun.',
  },
  {
    Icon: Layers,
    title: 'Akıllı Kombin Önerileri Al',
    description: 'Hava durumuna ve o günkü ruh haline göre sana özel, kişiselleştirilmiş kombinler öner.',
  },
]

const LAST_STEP = SLIDES.length - 1
const SWIPE_THRESHOLD_PX = 50

// İlk açılışta, Login'den ÖNCE gösterilen tanıtım ekranı. Rota TAŞIMAZ —
// App.jsx bunu `showOnboarding`'in eski deseniyle AYNI şekilde, koşul
// doğruyken router ağacının yerine döndürür (bkz. App.jsx > showIntro).
// `onFinish` çağrıldığında (Atla ya da son ekranda Başla) App yalnızca
// gösterimi durdurur; nereye düşüleceğine mevcut routing karar verir —
// oturum yoksa ProtectedRoute zaten `/giris`'e yönlendirir.
function Intro({ onFinish }) {
  const [step, setStep] = useState(0)
  const touchStartX = useRef(null)
  const isLastStep = step === LAST_STEP

  const goNext = () => setStep((current) => Math.min(current + 1, LAST_STEP))
  const goBack = () => setStep((current) => Math.max(current - 1, 0))

  const handleFinish = () => {
    markIntroSeen()
    onFinish()
  }

  const handleTouchStart = (event) => {
    touchStartX.current = event.touches[0].clientX
  }

  const handleTouchEnd = (event) => {
    if (touchStartX.current === null) return
    const deltaX = event.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null

    if (deltaX <= -SWIPE_THRESHOLD_PX) goNext()
    else if (deltaX >= SWIPE_THRESHOLD_PX) goBack()
  }

  const { Icon, title, description } = SLIDES[step]

  return (
    <div
      data-testid="intro-screen"
      className="relative flex min-h-screen flex-col items-center justify-center bg-ivory px-6 py-16"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <button
        type="button"
        onClick={handleFinish}
        className="absolute right-6 top-6 text-sm text-ink/50 transition-colors hover:text-accent-ink"
      >
        Atla
      </button>

      <div key={step} className="mx-auto w-full max-w-md animate-fade-in text-center">
        <span className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-dusty-rose/15">
          <Icon size={40} strokeWidth={1.5} className="text-accent-ink" />
        </span>

        <span className="mx-auto mt-8 block h-px w-16 bg-dusty-rose" />

        <h1 className="mt-6 font-display text-4xl font-normal italic text-ink sm:text-5xl">{title}</h1>
        <p className="mt-4 text-sm text-ink/60">{description}</p>
      </div>

      <div className="mt-10 flex items-center gap-2">
        {SLIDES.map((slide, index) => (
          <button
            key={slide.title}
            type="button"
            aria-label={`${index + 1}. ekrana git`}
            aria-current={index === step}
            onClick={() => setStep(index)}
            className={`h-2 rounded-full transition-all duration-200 ${
              index === step ? 'w-6 bg-burgundy' : 'w-2 bg-ink/15'
            }`}
          />
        ))}
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={isLastStep ? handleFinish : goNext}
        className="mt-10 w-full max-w-md"
      >
        {isLastStep ? 'Başla' : 'İleri'}
      </Button>
    </div>
  )
}

export default Intro
