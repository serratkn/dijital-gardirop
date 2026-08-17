import { useState } from 'react'
import RegistrationStep from '../components/onboarding/RegistrationStep'
import QuizStep from '../components/onboarding/QuizStep'
import WelcomeStep from '../components/onboarding/WelcomeStep'
import { setUserProfile, setStyleAnswers } from '../lib/onboarding'
import { STYLE_QUESTIONS } from '../data/styleQuestions'

const WELCOME_STEP = STYLE_QUESTIONS.length + 1

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

  const activeQuestion = step >= 1 && step <= STYLE_QUESTIONS.length ? STYLE_QUESTIONS[step - 1] : null

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
          onFinish={() => {
            setUserProfile({
              name: formData.name.trim(),
              email: formData.email.trim(),
              age: formData.age,
            })
            setStyleAnswers(answers)
            onFinish()
          }}
        />
      )}
    </div>
  )
}

export default Onboarding
