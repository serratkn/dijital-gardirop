const VARIANTS = {
  primary: 'bg-burgundy text-on-primary hover:opacity-90',
  outline: 'border border-ink/15 text-ink hover:border-dusty-rose hover:text-accent-ink',
  // Hover dolgusu `dusty-rose` DEĞİL `accent-ink`: açık rose zemin üzerinde
  // on-primary metin açık modda 2.11:1 kalıyordu (okunmuyordu). Koyu tonla ~4.97:1.
  rose: 'border border-dusty-rose text-accent-ink hover:bg-accent-ink hover:text-on-primary',
}

const SIZES = {
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
}

function Button({ variant = 'primary', size = 'md', className = '', children, ...props }) {
  return (
    <button
      type="button"
      className={`rounded-full font-medium transition-colors duration-200 disabled:pointer-events-none disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}

export default Button
