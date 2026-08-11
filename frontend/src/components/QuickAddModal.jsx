import { useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { CATEGORIES } from '../data/clothing'

const COLORS = ['Beyaz', 'Siyah', 'Bej', 'Lacivert', 'Kahverengi', 'Pudra']

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

function QuickAddModal({ isOpen, onClose }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState(CATEGORIES[0])
  const [color, setColor] = useState(COLORS[0])

  const handleSave = (event) => {
    event.preventDefault()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <h2 className="font-display text-3xl italic text-ink">Yeni Parça</h2>

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <button
          type="button"
          className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 bg-warm-gray text-sm text-ink/50 transition-colors hover:border-dusty-rose hover:text-dusty-rose"
        >
          <span className="text-2xl">📷</span>
          Fotoğraf Yükle
        </button>

        <div>
          <label className={fieldLabel}>Parça Adı</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="örn. Zara Oversize Beyaz Gömlek"
            className={fieldInput}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>Kategori</label>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={fieldInput}
            >
              {CATEGORIES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={fieldLabel}>Renk</label>
            <select
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className={fieldInput}
            >
              {COLORS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">
            İptal
          </Button>
          <Button type="submit" variant="primary" className="flex-1">
            Kaydet
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default QuickAddModal
