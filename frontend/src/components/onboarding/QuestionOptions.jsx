function QuestionOptions({ type, options, selected, onSelect }) {
  if (type === 'buttons') {
    return (
      <div className="flex flex-col gap-3">
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
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
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
  )
}

export default QuestionOptions
