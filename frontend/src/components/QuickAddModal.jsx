import { useEffect, useLayoutEffect, useState } from 'react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import ColorPicker from './ui/ColorPicker'
import PhotoPicker from './ui/PhotoPicker'
import {
  createClothingItem,
  fetchCategories,
  updateClothingItem,
  uploadClothingItemImage,
} from '../lib/api'
import { DEFAULT_COLOR } from '../lib/colors'
import { DEFAULT_SEASON, SEASONS } from '../lib/seasons'
import { BRANDS } from '../data/brands'

const fieldLabel = 'text-xs font-medium uppercase tracking-[0.15em] text-ink/50'
const fieldInput =
  'mt-2 w-full rounded-xl border border-ink/15 bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-dusty-rose focus:outline-none'

// clothing_items.name kolonu VARCHAR(200)
const NAME_MAX_LENGTH = 200
// clothing_items.brand kolonu VARCHAR(100) — backend/src/utils/validators.js
// > FIELD_LIMITS.clothingItems.brand ile AYNI tutulmalı.
const BRAND_MAX_LENGTH = 100
// Native <datalist>'in id'si; birden fazla QuickAddModal örneği (teorik
// olarak) aynı anda DOM'da olsa bile input kendi id'sini taşıdığı için
// çakışma yaratmaz.
const BRAND_DATALIST_ID = 'marka-onerileri'

// `item` verilirse DÜZENLEME MODU: mevcut değerlerle dolu açılır, kaydetme
// PUT'a gider ve FOTOĞRAF SEÇİCİ HİÇ RENDER EDİLMEZ — fotoğraf yönetimi ayrı,
// adanmış bir akıştır (Kıyafet Detay'daki "Fotoğrafı Değiştir"). Bu modal
// düzenleme modunda ne fotoğraf yükler ne de image_url'e dokunur; backend
// zaten PUT'ta image_url'i asla değiştirmiyor (bkz. ClothingItemService), ama
// aynı disiplin burada da korunuyor — modal iki farklı fotoğraf mekanizmasını
// karıştırmıyor.
function QuickAddModal({ isOpen, onClose, onSaved, item = null }) {
  const isEditMode = Boolean(item)

  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [brand, setBrand] = useState('')
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

  // Form her AÇILIŞTA yeniden tohumlanır (Modal kapalıyken de bileşen
  // mount'ta kalır — Modal içeriği koşullu render eder, QuickAddModal'ın
  // kendisi değil; bu yüzden state, bir sonraki açılışa kadar olduğu gibi
  // durur ve BURADA elle sıfırlanmalı). `item` varsa onun değerleriyle,
  // yoksa boş/varsayılan create-mode değerleriyle doldurulur.
  //
  // useLAYOUTEffect BİLEREK: normal useEffect boyamadan SONRA çalışır, yani
  // düzenleme modunda kirli bir parça açıldığında bir kare boyunca "Temiz"
  // basılıymış gibi GÖRÜNÜR (isClean'in ilk değeri useState(true)'dur), sonra
  // "Kirli"ye döner — kısa ama gerçek bir görsel çakma (flash of wrong
  // content). useLayoutEffect DOM güncellemesinden hemen sonra, tarayıcı
  // boyamadan ÖNCE çalışır; kullanıcı yanlış durumu hiç görmez.
  useLayoutEffect(() => {
    if (!isOpen) return

    if (item) {
      setName(item.name ?? '')
      setBrand(item.brand ?? '')
      setCategoryId(item.categoryId ? String(item.categoryId) : '')
      setColor(item.color || DEFAULT_COLOR)
      setSeason(item.season || DEFAULT_SEASON)
      setIsClean(item.isClean ?? true)
    } else {
      setName('')
      setBrand('')
      setColor(DEFAULT_COLOR)
      setPhotoFile(null)
      setIsClean(true)
      setSeason(DEFAULT_SEASON)
    }
    setErrorMessage('')
    setSavingLabel('')
  }, [isOpen, item])

  const handleClose = () => {
    if (isSaving) return
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

    if (isEditMode) {
      setSavingLabel('Güncelleniyor...')
      try {
        // imageUrl BİLEREK gönderilmiyor: backend yalnızca gönderilen
        // alanları günceller değil, TAM bu alan kümesini bekler ama
        // image_url'e her koşulda dokunmaz (mevcut fotoğrafı korur).
        await updateClothingItem(item.id, {
          categoryId: Number(categoryId),
          name: name.trim(),
          brand: brand.trim(),
          color,
          season,
          isClean,
        })
      } catch (error) {
        console.error('Parça güncellenemedi:', error)
        setErrorMessage(error.message)
        setIsSaving(false)
        setSavingLabel('')
        return
      }

      await onSaved?.()
      onClose()
      setIsSaving(false)
      setSavingLabel('')
      return
    }

    setSavingLabel('Kaydediliyor...')

    let created
    try {
      created = await createClothingItem({
        categoryId: Number(categoryId),
        name: name.trim(),
        brand: brand.trim(),
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
        await onSaved?.()
        setIsSaving(false)
        setSavingLabel('')
        setPhotoFile(null)
        setErrorMessage(
          `Kıyafet eklendi ama fotoğraf yüklenemedi: ${error.message} — fotoğrafı detay sayfasından ekleyebilirsin.`,
        )
        return
      }
    }

    // Listeyi tazeleme sorumluluğu üst bileşene ait.
    await onSaved?.()
    onClose()
    setIsSaving(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <h2 className="font-display text-3xl italic text-ink">
        {isEditMode ? 'Parçayı Düzenle' : 'Yeni Parça'}
      </h2>

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        {!isEditMode && (
          <PhotoPicker
            file={photoFile}
            onSelect={setPhotoFile}
            onClear={() => setPhotoFile(null)}
            disabled={isSaving}
          />
        )}

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
          <label className={fieldLabel}>Marka</label>
          {/* Native <input list> + <datalist>: 500'ün üzerinde markayı bir
              <select>'e sığdırmak kullanılamaz olurdu; datalist hem yazarken
              öneri gösterir hem de SERBEST METNİ engellemez — kullanıcının
              markası listede yoksa (niş/yerel bir marka) doğrudan kendi
              markasını yazabilir. Yeni bir kütüphane eklenmedi. */}
          <input
            type="text"
            list={BRAND_DATALIST_ID}
            value={brand}
            onChange={(event) => setBrand(event.target.value)}
            maxLength={BRAND_MAX_LENGTH}
            placeholder="örn. Zara (opsiyonel)"
            autoComplete="off"
            className={fieldInput}
          />
          <datalist id={BRAND_DATALIST_ID}>
            {BRANDS.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
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
                    ? 'bg-burgundy text-on-primary'
                    : 'border border-ink/15 text-ink/60 hover:border-dusty-rose hover:text-accent-ink'
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
            {isSaving
              ? savingLabel || (isEditMode ? 'Güncelleniyor...' : 'Kaydediliyor...')
              : isEditMode
                ? 'Güncelle'
                : 'Kaydet'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default QuickAddModal
