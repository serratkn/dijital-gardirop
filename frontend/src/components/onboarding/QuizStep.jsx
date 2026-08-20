import { ChevronLeft } from 'lucide-react'
import ProgressBar from './ProgressBar'
import QuestionOptions from './QuestionOptions'

function QuizStep({
  step,
  total,
  question,
  type,
  options,
  selected,
  onSelect,
  onNext,
  onBack,
  canGoBack = true,
}) {
  return (
    <div className="mx-auto w-full max-w-lg animate-fade-in">
      {/* İlk soruda geri gidilecek bir adım yok; yer tutucu düzeni korur. */}
      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-sm text-ink/40 transition-colors hover:text-dusty-rose"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Geri
        </button>
      ) : (
        <span className="block h-5" />
      )}

      <div className="mt-6">
        <ProgressBar current={step} total={total} />
      </div>

      <h2 className="mt-10 text-center font-display text-3xl font-normal italic text-ink sm:text-4xl">
        {question}
      </h2>

      <div className="mt-10">
        <QuestionOptions type={type} options={options} selected={selected} onSelect={onSelect} />
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!selected}
        className="mt-10 w-full rounded-full bg-burgundy px-8 py-3.5 text-base font-medium text-on-primary transition-opacity duration-200 hover:opacity-90 disabled:opacity-40"
      >
        İleri
      </button>
    </div>
  )
}

export default QuizStep
