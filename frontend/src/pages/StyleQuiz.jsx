import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QuizStep from '../components/onboarding/QuizStep'
import WelcomeStep from '../components/onboarding/WelcomeStep'
import { STYLE_QUESTIONS } from '../data/styleQuestions'
import { saveStylePreferences } from '../lib/api'
import { toStylePreferencePayload } from '../lib/transformers'
import { getUserProfile, setStyleAnswers, setOnboardingCompleted } from '../lib/onboarding'

const WELCOME_STEP = STYLE_QUESTIONS.length

// Kayıttan sonraki adım: 5 soruluk tarz anketi. Kullanıcı bu noktada zaten
// oturum açmıştır (Register token'ı sakladı), bu yüzden korumalı bir rotadır.
function StyleQuiz() {
  const navigate = useNavigate()
  const { name } = getUserProfile()

  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const goNext = () => setStep((current) => Math.min(current + 1, WELCOME_STEP))
  const goBack = () => setStep((current) => Math.max(current - 1, 0))

  const activeQuestion = step < STYLE_QUESTIONS.length ? STYLE_QUESTIONS[step] : null

  const handleSelect = (key, value) => {
    setAnswers((previous) => ({ ...previous, [key]: value }))
  }

  const handleFinish = async () => {
    if (isSaving) return

    setIsSaving(true)
    setSaveError('')

    try {
      await saveStylePreferences(toStylePreferencePayload(answers))
      setStyleAnswers(answers)
      setOnboardingCompleted()
      navigate('/', { replace: true })
    } catch (error) {
      console.error('Tarz tercihleri kaydedilemedi:', error)
      setSaveError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-6 py-16">
      {activeQuestion && (
        <QuizStep
          key={step}
          step={step + 1}
          total={STYLE_QUESTIONS.length}
          question={activeQuestion.question}
          type={activeQuestion.type}
          options={activeQuestion.options}
          selected={answers[activeQuestion.key]}
          onSelect={(value) => handleSelect(activeQuestion.key, value)}
          onNext={goNext}
          onBack={goBack}
          // İlk soruda geri gidilecek bir adım yok; kayıt tamamlandı.
          canGoBack={step > 0}
        />
      )}

      {step === WELCOME_STEP && (
        <WelcomeStep
          name={name}
          isSaving={isSaving}
          errorMessage={saveError}
          onFinish={handleFinish}
        />
      )}
    </div>
  )
}

export default StyleQuiz
