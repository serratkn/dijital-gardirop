import { useEffect, useRef, useState } from 'react'
import { Camera, Image as ImageIcon, X } from 'lucide-react'
import { isNativePlatform, pickNativePhoto } from '../../lib/photoPicker'

// Seçilen dosyayı önizlemeli gösterir. Web'de gizli <input type="file">,
// native'de Capacitor Camera (Fotoğraf Çek / Galeriden Seç) kullanılır.
function PhotoPicker({ file, previewUrl, onSelect, onClear, disabled }) {
  const inputRef = useRef(null)
  const [localPreview, setLocalPreview] = useState(null)
  const [pickerError, setPickerError] = useState('')
  const native = isNativePlatform()

  // Seçilen File için geçici bir blob URL üretilir ve bileşen değişince
  // serbest bırakılır (aksi hâlde bellek sızar).
  useEffect(() => {
    if (!file) {
      setLocalPreview(null)
      return undefined
    }

    const objectUrl = URL.createObjectURL(file)
    setLocalPreview(objectUrl)
    return () => URL.revokeObjectURL(objectUrl)
  }, [file])

  const shownPreview = localPreview || previewUrl

  const handleNativePick = async (source) => {
    setPickerError('')
    try {
      const picked = await pickNativePhoto(source)
      if (picked) onSelect(picked)
    } catch (error) {
      setPickerError(error.message)
    }
  }

  const handleFileInput = (event) => {
    const selected = event.target.files?.[0]
    if (selected) {
      setPickerError('')
      onSelect(selected)
    }
    // Aynı dosyanın arka arkaya seçilebilmesi için input sıfırlanır.
    event.target.value = ''
  }

  if (shownPreview) {
    return (
      <div className="space-y-3">
        <div className="relative overflow-hidden rounded-2xl border border-ink/10">
          <img
            src={shownPreview}
            alt="Seçilen fotoğraf"
            className="h-40 w-full object-cover"
            onError={() => setLocalPreview(null)}
          />
          {!disabled && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Fotoğrafı kaldır"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-ivory/85 text-ink/60 backdrop-blur-sm transition-colors hover:text-burgundy"
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          )}
        </div>
        {pickerError && <p className="text-sm text-burgundy">{pickerError}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {native ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleNativePick('camera')}
            className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 bg-warm-gray text-sm text-ink/60 transition-colors hover:border-dusty-rose hover:text-accent-ink disabled:opacity-50"
          >
            <Camera size={22} strokeWidth={1.5} />
            Fotoğraf Çek
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => handleNativePick('gallery')}
            className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 bg-warm-gray text-sm text-ink/60 transition-colors hover:border-dusty-rose hover:text-accent-ink disabled:opacity-50"
          >
            <ImageIcon size={22} strokeWidth={1.5} />
            Galeriden Seç
          </button>
        </div>
      ) : (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileInput}
            className="hidden"
          />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-ink/20 bg-warm-gray text-sm text-ink/60 transition-colors hover:border-dusty-rose hover:text-accent-ink disabled:opacity-50"
          >
            <ImageIcon size={24} strokeWidth={1.5} />
            Fotoğraf Yükle
            <span className="text-xs text-ink/40">jpg, png veya webp · en fazla 5 MB</span>
          </button>
        </>
      )}

      {pickerError && <p className="text-sm text-burgundy">{pickerError}</p>}
    </div>
  )
}

export default PhotoPicker
