import { createPortal } from 'react-dom'

// max-h + overflow-y: içerik ekrandan uzun olursa (örn. renk seçicili form)
// modal taşıp erişilemez hale gelmesin diye kendi içinde kayar.
// Karanlık modda panel `surface` tonuna geçer: `ivory` orada sayfa zemininin
// ta kendisidir ve modal, arkasındaki karartılmış sayfadan yeterince ayrılmazdı.
// Açık modda ivory korunur — beyaz kartlardan bilinçli olarak farklıdır.
const panelClass =
  'max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-ink/10 bg-ivory dark:bg-surface p-8 shadow-[var(--dg-shadow-modal)] sm:p-10'

function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null

  // Portal şart: App.jsx'teki sayfa sarmalayıcısı `animate-page-fade` taşır ve
  // animasyonun son karesi transform bırakır. Transform'lu bir ata, position:fixed
  // için yeni bir containing block yaratır — modal viewport yerine sayfaya göre
  // konumlanıp ekran dışında kalırdı. body'ye taşıyarak bundan kurtuluyoruz.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--dg-scrim)] px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <div onClick={(event) => event.stopPropagation()} className={panelClass}>
        {children}
      </div>
    </div>,
    document.body,
  )
}

export default Modal
