import { useState } from 'react'
import RegistrationStep from '../components/onboarding/RegistrationStep'
import QuizStep from '../components/onboarding/QuizStep'
import WelcomeStep from '../components/onboarding/WelcomeStep'
import { setUserProfile, setStyleAnswers, setUserId } from '../lib/onboarding'
import { createUser, saveStylePreferences } from '../lib/api'
import { toStylePreferencePayload } from '../lib/transformers'
import { STYLE_QUESTIONS } from '../data/styleQuestions'

const WELCOME_STEP = STYLE_QUESTIONS.length + 1

function Onboarding({ onFinish }) {
  const [step, setStep] = useState(0)
  const [formData, setFormData] = useState({ name: '', email: '', age: '' })
  const [answers, setAnswers] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSelect = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
  }

  const goNext = () => setStep((current) => Math.min(current + 1, WELCOME_STEP))
  const goBack = () => setStep((current) => Math.max(current - 1, 0))

  const activeQuestion = step >= 1 && step <= STYLE_QUESTIONS.length ? STYLE_QUESTIONS[step - 1] : null

  const handleFinish = async () => {
    if (isSaving) return

    const profile = {
      name: formData.name.trim(),
      email: formData.email.trim(),
      age: formData.age,
    }

    setIsSaving(true)
    setSaveError('')

    try {
      // Kullanıcı önce oluşturulur; dönen gerçek id bundan sonraki tüm
      // API çağrılarının sahibi olur (auth gelene kadar geçici çözüm).
      const createdUser = await createUser({
        name: profile.name,
        email: profile.email,
        age: profile.age === '' ? null : Number(profile.age),
      })

      setUserId(createdUser.id)

      await saveStylePreferences({
        userId: createdUser.id,
        ...toStylePreferencePayload(answers),
      })

      // localStorage artık tek doğru kaynak değil; hızlı erişim için önbellek.
      setUserProfile(profile)
      setStyleAnswers(answers)
      onFinish()
    } catch (error) {
      console.error('Onboarding kaydedilemedi:', error)
      setSaveError(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ivory px-6 py-16">
      {step === 0 && <RegistrationStep formData={formData} onChange={handleFormChange} onNext={goNext} />}

      {activeQuestion && (
        <QuizStep
          key={step}
          step={step}
          total={STYLE_QUESTIONS.length}
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
          isSaving={isSaving}
          errorMessage={saveError}
          onEditDetails={() => {
            setSaveError('')
            setStep(0)
          }}
          onFinish={handleFinish}
        />
      )}
    </div>
  )
}

export default Onboarding
