function FilterPills({ options, active, onChange, icons, counts }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((option) => {
        const isActive = option === active
        const Icon = icons?.[option]
        const count = counts?.[option]
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 ${
              isActive
                ? 'bg-burgundy text-on-primary'
                : 'border border-ink/15 text-ink/60 hover:border-dusty-rose hover:text-dusty-rose'
            }`}
          >
            {Icon && <Icon size={16} strokeWidth={1.75} />}
            {option}
            {typeof count === 'number' && (
              <span className={`text-xs font-normal ${isActive ? 'text-on-primary/70' : 'text-ink/40'}`}>
                ({count})
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default FilterPills
