import { useEffect, useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import { getCurrentUserId, createClothingItem, fetchCategories } from '../lib/api'

const COLORS = ['Beyaz', 'Siyah', 'Bej', 'Lacivert', 'Kahverengi', 'Pudra']

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

// clothing_items.name kolonu VARCHAR(200)
const NAME_MAX_LENGTH = 200

function QuickAddModal({ isOpen, onClose, onCreated }) {
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  // Kategoriler modal her açıldığında tazelenir; kapalıyken istek atılmaz.
  useEffect(() => {
    if (!isOpen) return

    let isStale = false

    async function loadCategories() {
      try {
        const rows = await fetchCategories()
        if (isStale) return
        setCategories(rows)
        setCategoryId((current) => current || String(rows[0]?.id ?? ''))
      } catch (error) {
        if (isStale) return
        console.error('Kategoriler alınamadı:', error)
        setErrorMessage('Kategoriler yüklenemedi. Bağlantını kontrol et.')
      }
    }

    loadCategories()

    return () => {
      isStale = true
    }
  }, [isOpen])

  const resetForm = () => {
    setName('')
    setColor(COLORS[0])
    setErrorMessage('')
  }

  const handleClose = () => {
    if (isSaving) return
    resetForm()
    onClose()
  }

  const handleSave = async (event) => {
    event.preventDefault()

    if (!name.trim()) {
      setErrorMessage('Parça adı zorunludur.')
      return
    }
    if (!categoryId) {
      setErrorMessage('Kategori seçmelisin.')
      return
    }

    setIsSaving(true)
    setErrorMessage('')

    try {
      await createClothingItem({
        userId: getCurrentUserId(),
        categoryId: Number(categoryId),
        name: name.trim(),
        color,
      })

      resetForm()
      // Listeyi tazeleme sorumluluğu üst bileşene ait.
      await onCreated?.()
      onClose()
    } catch (error) {
      console.error('Parça kaydedilemedi:', error)
      setErrorMessage(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <h2 className="font-display text-3xl italic text-ink">Yeni Parça</h2>

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <button
          type="button"
          disabled
          title="Fotoğraf yükleme henüz eklenmedi"
          className="flex h-36 w-full cursor-not-allowed flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 bg-warm-gray text-sm text-ink/40"
        >
          <span className="text-2xl">📷</span>
          Fotoğraf Yükle (yakında)
        </button>

        <div>
          <label className={fieldLabel}>Parça Adı</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={NAME_MAX_LENGTH}
            placeholder="örn. Zara Oversize Beyaz Gömlek"
            className={fieldInput}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={fieldLabel}>Kategori</label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className={fieldInput}
            >
              {categories.length === 0 && <option value="">Yükleniyor...</option>}
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
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

        {errorMessage && <p className="text-sm text-burgundy">{errorMessage}</p>}

        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isSaving}
            className="flex-1"
          >
            İptal
          </Button>
          <Button type="submit" variant="primary" disabled={isSaving} className="flex-1">
            {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default QuickAddModal
