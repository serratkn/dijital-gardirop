import { useState } from 'react'
import { Square, Crown, Sparkles, Heart } from 'lucide-react'
import RegistrationStep from '../components/onboarding/RegistrationStep'
import QuizStep from '../components/onboarding/QuizStep'
import WelcomeStep from '../components/onboarding/WelcomeStep'
import { setUserName } from '../lib/onboarding'

const QUESTIONS = [
  {
    key: 'style',
    question: 'Günlük hayatta nasıl giyinirsin?',
    type: 'buttons',
    options: ['Rahat & Casual', 'Şık & Zarif', 'Sportif & Enerjik', 'Bohem & Özgür'],
  },
  {
    key: 'colors',
    question: 'Hangi renk tonlarına yakınsın?',
    type: 'cards',
    options: [
      { label: 'Nötr & Toprak Tonları', swatches: ['#e4d3b8', '#b08d57', '#6b4a34'] },
      { label: 'Canlı & Cesur Renkler', swatches: ['#c0392b', '#e0a41a', '#1f7a5c'] },
      { label: 'Pastel & Yumuşak Tonlar', swatches: ['#f4d9d9', '#e3ddf0', '#d9e8e0'] },
      { label: 'Siyah-Beyaz & Monokrom', swatches: ['#1c1a17', '#8a8a86', '#f7f3ed'] },
    ],
  },
  {
    key: 'priority',
    question: 'Kombin yaparken en çok neye önem verirsin?',
    type: 'buttons',
    options: ['Rahatlık', 'Şıklık', 'Trend Takibi', 'Fonksiyonellik'],
  },
  {
    key: 'icon',
    question: 'Hangi tarz ikonuna daha yakınsın?',
    type: 'cards',
    options: [
      { label: 'Minimalist', icon: Square },
      { label: 'Klasik & Zamansız', icon: Crown },
      { label: 'Trendy & Cesur', icon: Sparkles },
      { label: 'Romantik & Feminen', icon: Heart },
    ],
  },
  {
    key: 'frequency',
    question: 'Ne sıklıkla yeni kombinler denersin?',
    type: 'buttons',
    options: ['Her Gün Farklı', 'Favorilerim Var', 'Duruma Göre Değişir'],
  },
]

const WELCOME_STEP = QUESTIONS.length + 1

function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState({ name: '', email: '', age: '' })
  const [answers, setAnswers] = useState({})

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSelect = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  const goNext = () => setStep((current) => Math.min(current + 1, WELCOME_STEP))
  const goBack = () => setStep((current) => Math.max(current - 1, 0))

  const activeQuestion = step >= 1 && step <= QUESTIONS.length ? QUESTIONS[step - 1] : null

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-6 py-16">
      {step === 0 && <RegistrationStep formData={formData} onChange={handleFormChange} onNext={goNext} />}

      {activeQuestion && (
        <QuizStep
          key={step}
          step={step}
          total={QUESTIONS.length}
          question={activeQuestion.question}
          type={activeQuestion.type}
          options={activeQuestion.options}
          selected={answers[activeQuestion.key]}
          onSelect={(value) => handleSelect(activeQuestion.key, value)}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {step === WELCOME_STEP && (
        <WelcomeStep
          name={formData.name.trim()}
          onFinish={() => {
            setUserName(formData.name.trim())
            onFinish()
          }}
        />
      )}
    </div>
  )
}

export default Onboarding
