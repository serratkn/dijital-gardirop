import { useEffect, useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import ColorPicker from './ui/ColorPicker'
import PhotoPicker from './ui/PhotoPicker'
import { createClothingItem, fetchCategories, uploadClothingItemImage } from '../lib/api'
import { DEFAULT_COLOR } from '../lib/colors'
import { DEFAULT_SEASON, SEASONS } from '../lib/seasons'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-white px-4 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

// clothing_items.name kolonu VARCHAR(200)
const NAME_MAX_LENGTH = 200

function QuickAddModal({ isOpen, onClose, onCreated }) {
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [photoFile, setPhotoFile] = useState(null)
  // Varsayılan temiz: yeni eklenen parça kombin önerisine hemen katılabilsin.
  const [isClean, setIsClean] = useState(true)
  const [season, setSeason] = useState(DEFAULT_SEASON)
  const [isSaving, setIsSaving] = useState(false)
  const [savingLabel, setSavingLabel] = useState('')
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
    setColor(DEFAULT_COLOR)
    setPhotoFile(null)
    setIsClean(true)
    setSeason(DEFAULT_SEASON)
    setErrorMessage('')
    setSavingLabel('')
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
    setSavingLabel('Kaydediliyor...')

    let created
    try {
      created = await createClothingItem({
        categoryId: Number(categoryId),
        name: name.trim(),
        color,
        season,
        isClean,
      })
    } catch (error) {
      console.error('Parça kaydedilemedi:', error)
      setErrorMessage(error.message)
      setIsSaving(false)
      setSavingLabel('')
      return
    }

    // Kıyafet oluşturuldu. Fotoğraf ayrı bir adımdır ve BAŞARISIZ OLSA BİLE
    // kıyafet kaydı geri alınmaz — kullanıcıya durum açıkça bildirilir.
    if (photoFile) {
      setSavingLabel('Fotoğraf yükleniyor...')
      try {
        await uploadClothingItemImage(created.id, photoFile)
      } catch (error) {
        console.error('Fotoğraf yüklenemedi:', error)
        await onCreated?.()
        setIsSaving(false)
        setSavingLabel('')
        setPhotoFile(null)
        setErrorMessage(
          `Kıyafet eklendi ama fotoğraf yüklenemedi: ${error.message} — fotoğrafı detay sayfasından ekleyebilirsin.`,
        )
        return
      }
    }

    resetForm()
    // Listeyi tazeleme sorumluluğu üst bileşene ait.
    await onCreated?.()
    onClose()
    setIsSaving(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <h2 className="font-display text-3xl italic text-ink">Yeni Parça</h2>

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <PhotoPicker
          file={photoFile}
          onSelect={setPhotoFile}
          onClear={() => setPhotoFile(null)}
          disabled={isSaving}
        />

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
          <label className={fieldLabel}>Sezon</label>
          <select
            value={season}
            onChange={(event) => setSeason(event.target.value)}
            className={fieldInput}
          >
            {SEASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <p className="mt-2 text-xs text-ink/45">
            Hava durumuna göre öneri için kullanılır. "Tüm Sezon" her havada uygun sayılır.
          </p>
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label className={fieldLabel}>Renk</label>
            <span className="text-sm text-ink/60">{color}</span>
          </div>
          <div className="mt-3">
            <ColorPicker value={color} onChange={setColor} />
          </div>
        </div>

        <div>
          <label className={fieldLabel}>Şu an temiz mi?</label>
          <div className="mt-3 flex gap-2.5">
            {[
              { value: true, label: 'Temiz' },
              { value: false, label: 'Kirli' },
            ].map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setIsClean(option.value)}
                aria-pressed={isClean === option.value}
                className={`rounded-full px-5 py-2 text-sm font-medium transition-colors duration-200 ${
                  isClean === option.value
                    ? 'bg-burgundy text-ivory'
                    : 'border border-ink/15 text-ink/60 hover:border-dusty-rose hover:text-dusty-rose'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {!isClean && (
            <p className="mt-2 text-xs text-ink/45">
              Kirli parçalar gardırobunda görünür ama kombin önerisine katılmaz.
            </p>
          )}
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
            {isSaving ? savingLabel || 'Kaydediliyor...' : 'Kaydet'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default QuickAddModal
