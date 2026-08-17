import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Button from '../components/ui/Button'
import QuestionOptions from '../components/onboarding/QuestionOptions'
import { STYLE_QUESTIONS } from '../data/styleQuestions'
import { getStyleAnswers, setStyleAnswers } from '../lib/onboarding'

function StylePreferences() {
  const [answers, setAnswers] = useState(() => getStyleAnswers())
  const [isSaved, setIsSaved] = useState(false)

  const handleSelect = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    setIsSaved(false)
  }

  const handleSave = () => {
    setStyleAnswers(answers)
    setIsSaved(true)
  }

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-lg px-6 py-14 sm:px-8">
        <Link
          to="/profil"
          className="inline-flex items-center gap-1 text-sm text-ink/50 transition-colors hover:text-dusty-rose"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Profile Dön
        </Link>

        <h1 className="mt-6 font-display text-3xl italic text-ink sm:text-4xl">Tarz Tercihlerim</h1>
        <p className="mt-2 text-sm text-ink/50">Cevaplarını istediğin zaman güncelleyebilirsin.</p>

        <div className="mt-10 space-y-12">
          {STYLE_QUESTIONS.map((item) => (
            <div key={item.key}>
              <h2 className="font-display text-xl italic text-ink">{item.question}</h2>
              <div className="mt-5">
                <QuestionOptions
                  type={item.type}
                  options={item.options}
                  selected={answers[item.key]}
                  onSelect={(value) => handleSelect(item.key, value)}
                />
              </div>
            </div>
          ))}
        </div>

        <Button variant="primary" size="lg" onClick={handleSave} className="mt-12 w-full">
          {isSaved ? 'Kaydedildi' : 'Kaydet'}
        </Button>
      </div>
    </div>
  )
}

export default StylePreferences
