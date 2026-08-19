import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import Button from '../components/ui/Button'
import QuestionOptions from '../components/onboarding/QuestionOptions'
import { STYLE_QUESTIONS } from '../data/styleQuestions'
import { fetchStylePreferences, saveStylePreferences } from '../lib/api'
import { toStyleAnswers, toStylePreferencePayload } from '../lib/transformers'
import { getStyleAnswers, setStyleAnswers } from '../lib/onboarding'

function StylePreferences() {
  // localStorage önbelleği ilk değeri verir; veritabanı yanıtı gelince üzerine yazılır.
  const [answers, setAnswers] = useState(() => getStyleAnswers())
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isStale = false

    async function loadPreferences() {
      setIsLoading(true)
      setHasError(false)

      try {
        const row = await fetchStylePreferences()
        if (isStale) return

        const loaded = toStyleAnswers(row)
        setAnswers(loaded)
        setStyleAnswers(loaded)
      } catch (error) {
        if (isStale) return

        // Henüz tercih kaydedilmemişse 404 beklenen durumdur:
        // önbellekteki cevaplarla devam edilir, hata gösterilmez.
        if (error.message.includes('bulunamadı')) {
          setIsLoading(false)
          return
        }

        console.error('Tarz tercihleri alınamadı:', error)
        setHasError(true)
      } finally {
        if (!isStale) setIsLoading(false)
      }
    }

    loadPreferences()

    return () => {
      isStale = true
    }
  }, [])

  const handleSelect = (key, value) => {
    setAnswers((prev) => ({ ...prev, [key]: value }))
    setIsSaved(false)
    setErrorMessage('')
  }

  const handleSave = async () => {
    if (isSaving) return

    setIsSaving(true)
    setErrorMessage('')

    try {
      await saveStylePreferences({
        ...toStylePreferencePayload(answers),
      })

      setStyleAnswers(answers)
      setIsSaved(true)
    } catch (error) {
      console.error('Tarz tercihleri kaydedilemedi:', error)
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
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

        {isLoading ? (
          <div className="mt-10 space-y-12">
            {[0, 1].map((index) => (
              <div key={index}>
                <div className="h-6 w-3/4 animate-pulse rounded-lg bg-warm-gray" />
                <div className="mt-5 space-y-3">
                  {[0, 1, 2, 3].map((row) => (
                    <div key={row} className="h-14 w-full animate-pulse rounded-2xl bg-warm-gray" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : hasError ? (
          <p className="mt-10 text-sm text-ink/60">
            Tarz tercihlerine şu an ulaşılamıyor. Bağlantını kontrol edip sayfayı yenilemeyi dene.
          </p>
        ) : (
          <>
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

            {errorMessage && <p className="mt-6 text-sm text-burgundy">{errorMessage}</p>}

            <Button
              variant="primary"
              size="lg"
              onClick={handleSave}
              disabled={isSaving}
              className="mt-12 w-full"
            >
              {isSaving ? 'Kaydediliyor...' : isSaved ? 'Kaydedildi' : 'Kaydet'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

export default StylePreferences
