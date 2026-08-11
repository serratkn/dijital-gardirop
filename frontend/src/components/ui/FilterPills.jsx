function FilterPills({ options, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const isActive = option === active
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 ${
              isActive
                ? 'bg-burgundy text-ivory'
                : 'border border-ink/15 text-ink/60 hover:border-dusty-rose hover:text-dusty-rose'
            }`}
          >
            {option}
          </button>
        )
      })}
    </div>
  )
}

export default FilterPills
