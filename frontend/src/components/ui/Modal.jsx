function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-ink/10 bg-ivory p-8 shadow-[0_24px_60px_-20px_rgba(28,26,23,0.35)] sm:p-10"
      >
        {children}
      </div>
    </div>
  )
}

export default Modal
