import { ChevronLeft } from 'lucide-react'
import ProgressBar from './ProgressBar'

function QuizStep({ step, total, question, type, options, selected, onSelect, onNext, onBack }) {
  return (
    <div className="mx-auto w-full max-w-lg animate-fade-in">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-ink/40 transition-colors hover:text-dusty-rose"
      >
        <ChevronLeft size={16} strokeWidth={1.75} />
        Geri
      </button>

      <div className="mt-6">
        <ProgressBar current={step} total={total} />
      </div>

      <h2 className="mt-10 text-center font-display text-3xl font-normal italic text-ink sm:text-4xl">
        {question}
      </h2>

      {type === 'buttons' && (
        <div className="mt-10 flex flex-col gap-3">
          {options.map((option) => {
            const isSelected = selected === option
            return (
              <button
                key={option}
                type="button"
                onClick={() => onSelect(option)}
                className={`rounded-2xl border px-6 py-4 text-left text-sm font-medium transition-all duration-200 ${
                  isSelected
                    ? 'border-burgundy bg-burgundy/5 text-burgundy'
                    : 'border-ink/10 text-ink hover:border-dusty-rose'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
      )}

      {type === 'cards' && (
        <div className="mt-10 grid grid-cols-2 gap-4">
          {options.map((option) => {
            const isSelected = selected === option.label
            const Icon = option.icon
            return (
              <button
                key={option.label}
                type="button"
                onClick={() => onSelect(option.label)}
                className={`overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
                  isSelected ? 'border-burgundy ring-2 ring-burgundy/20' : 'border-ink/10 hover:border-dusty-rose'
                }`}
              >
                {option.swatches ? (
                  <div className="flex h-20 w-full">
                    {option.swatches.map((color, index) => (
                      <span key={index} className="flex-1" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                ) : (
                  <div className="flex h-20 w-full items-center justify-center bg-warm-gray">
                    <Icon size={26} strokeWidth={1.5} className={isSelected ? 'text-burgundy' : 'text-ink/40'} />
                  </div>
                )}
                <p className={`px-4 py-3 text-sm font-medium ${isSelected ? 'text-burgundy' : 'text-ink'}`}>
                  {option.label}
                </p>
              </button>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={onNext}
        disabled={!selected}
        className="mt-10 w-full rounded-full bg-burgundy px-8 py-3.5 text-base font-medium text-ivory transition-opacity duration-200 hover:opacity-90 disabled:opacity-40"
      >
        İleri
      </button>
    </div>
  )
}

export default QuizStep
