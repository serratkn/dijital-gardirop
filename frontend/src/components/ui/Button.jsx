const VARIANTS = {
  primary: 'bg-burgundy text-ivory hover:opacity-90',
  outline: 'border border-ink/15 text-ink hover:border-dusty-rose hover:text-dusty-rose',
  rose: 'border border-dusty-rose text-dusty-rose hover:bg-dusty-rose hover:text-ivory',
}

const SIZES = {
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`rounded-full font-medium transition-colors duration-200 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
