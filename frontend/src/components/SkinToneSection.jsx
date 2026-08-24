import { useEffect, useState } from 'react'
import { Palette, RefreshCw, Trash2 } from 'lucide-react'
import Button from './ui/Button'
import PhotoPicker from './ui/PhotoPicker'
import SkinTonePanel from './SkinTonePanel'
import {
  deleteSkinToneAnalysis,
  fetchSkinToneAnalysis,
  fetchSkinTonePhoto,
  uploadSkinToneSelfie,
} from '../lib/api'

// Profil sayfasındaki "Ten Tonu Analizim" bölümü.
//
// TAMAMEN İSTEĞE BAĞLI: kullanıcı hiç selfie yüklemezse davet ekranı görünür
// ve başka hiçbir şey olmaz. Bu bölümün hiçbir hatası profilin geri kalanını
// etkilemez (WardrobeStats ile aynı ilke: bölüm kendi yükleme/hata durumunu
// sürer, sayfa ayakta kalır).
//
// GİZLİLİK: selfie yalnızca burada, sahibine gösterilir. Paylaşım görseline,
// kombin kartlarına ya da başka bir listeye ASLA girmez.

function SkinToneSection() {
  const [analiz, setAnaliz] = useState(null)
  // Backend'in foto_url'i artık DOĞRUDAN <img src> olarak kullanılmaz —
  // yalnızca "bir selfie var mı" bilgisini taşır ve aşağıdaki efekti tetikler.
  // Gerçek görsel selfieBlobUrl'dedir (token'lı /photo ucundan blob olarak çekilir).
  const [fotoUrl, setFotoUrl] = useState(null)
  const [selfieBlobUrl, setSelfieBlobUrl] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasLoadError, setHasLoadError] = useState(false)

  const [secilenDosya, setSecilenDosya] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)
  const [hata, setHata] = useState('')
  // Analizi olan kullanıcı "Yeniden Analiz Et" derse fotoğraf seçici açılır.
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  useEffect(() => {
    let isStale = false

    async function yukle() {
      setIsLoading(true)
      setHasLoadError(false)
      try {
        const sonuc = await fetchSkinToneAnalysis()
        if (isStale) return
        setAnaliz(sonuc?.analiz ?? null)
        setFotoUrl(sonuc?.foto_url ?? null)
      } catch (error) {
        if (isStale) return
        console.error('Ten tonu analizi alınamadı:', error)
        setHasLoadError(true)
      } finally {
        if (!isStale) setIsLoading(false)
      }
    }

    yukle()
    return () => {
      isStale = true
    }
  }, [])

  // Selfie GÖRSELİ artık /uploads'tan değil, token'lı /photo ucundan blob
  // olarak çekilir. fotoUrl değiştiğinde (ilk yükleme, yeniden analiz, silme)
  // eski blob URL serbest bırakılır ve gerekiyorsa yenisi çekilir —
  // PhotoPicker'daki createObjectURL/revokeObjectURL deseniyle aynı yaşam döngüsü.
  useEffect(() => {
    if (!fotoUrl) {
      setSelfieBlobUrl(null)
      return undefined
    }

    let isStale = false
    let objectUrl = null

    async function selfieBlobunuYukle() {
      try {
        const blob = await fetchSkinTonePhoto()
        if (isStale || !blob) return
        objectUrl = URL.createObjectURL(blob)
        setSelfieBlobUrl(objectUrl)
      } catch (error) {
        if (isStale) return
        console.error('Selfie görseli alınamadı:', error)
      }
    }

    selfieBlobunuYukle()

    return () => {
      isStale = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [fotoUrl])

  // Analiz sırasında düğme kilitli; backend'de de kullanıcı başına in-flight
  // muhafızı var (ikinci istek 409 döner), yani çift tıklama iki Gemini
  // çağrısına dönüşmez.
  const analizeGonder = async (dosya) => {
    if (!dosya || isAnalyzing) return

    setIsAnalyzing(true)
    setHata('')

    try {
      const sonuc = await uploadSkinToneSelfie(dosya)
      setAnaliz(sonuc?.analiz ?? null)
      setFotoUrl(sonuc?.foto_url ?? null)
      setSecilenDosya(null)
      setIsPickerOpen(false)
    } catch (error) {
      console.error('Ten tonu analizi başarısız:', error)
      // Backend zaten Türkçe ve yönlendirici mesaj döndürüyor
      // ("Yüz görünmüyor. … tekrar deneyin." gibi).
      setHata(error.message)
      // MEVCUT ANALİZ KORUNUR: state'e dokunmuyoruz. Backend de hata
      // durumunda kolona yazmıyor, ikisi aynı sözleşmeyi paylaşıyor.
      //
      // Seçilen dosya TEMİZLENİR: aksi hâlde PhotoPicker başarısız fotoğrafın
      // önizlemesinde takılı kalır ve kullanıcı yeni bir tane seçemez —
      // oysa hata mesajı tam da "başka bir fotoğrafla tekrar dene" diyor.
      setSecilenDosya(null)
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Fotoğraf seçilir seçilmez analiz başlar: ayrı bir "Analiz Et" düğmesi
  // fazladan bir adım olurdu, kullanıcı zaten bunun için seçti.
  const handleSelect = (dosya) => {
    setSecilenDosya(dosya)
    analizeGonder(dosya)
  }

  const handleRemove = async () => {
    if (isRemoving) return
    setIsRemoving(true)
    setHata('')
    try {
      await deleteSkinToneAnalysis()
      setAnaliz(null)
      setFotoUrl(null)
      setSecilenDosya(null)
      setIsPickerOpen(false)
    } catch (error) {
      console.error('Ten tonu analizi silinemedi:', error)
      setHata(error.message)
    } finally {
      setIsRemoving(false)
    }
  }

  // Analiz sürerken gösterilen bilgi kutusu (senkron çağrı, birkaç saniye).
  const analizEdiliyorKutusu = (
    <div className="rounded-2xl border border-ink/10 bg-warm-gray px-5 py-8 text-center">
      <RefreshCw
        size={20}
        strokeWidth={1.75}
        className="mx-auto animate-spin text-accent-ink"
      />
      <p className="mt-3 font-body text-sm text-ink/70">Ten tonun analiz ediliyor...</p>
      <p className="mt-1 text-xs text-ink/45">Bu birkaç saniye sürebilir.</p>
    </div>
  )

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-6" data-testid="ten-tonu-bolumu">
      <h2 className="font-display text-xl italic text-ink">Ten Tonu Analizim</h2>
      <div className="mt-3 h-px w-16 bg-dusty-rose" />

      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-ink/10" />
            <div className="h-3 w-40 animate-pulse rounded-full bg-ink/10" />
          </div>
        ) : hasLoadError ? (
          <p className="text-sm text-ink/50">Ten tonu bilgisine şu an ulaşılamıyor.</p>
        ) : isAnalyzing ? (
          analizEdiliyorKutusu
        ) : analiz ? (
          <>
            <div className="flex items-start gap-4">
              {/* Selfie küçük bir önizleme olarak yalnızca burada görünür. */}
              {selfieBlobUrl && (
                <img
                  src={selfieBlobUrl}
                  alt="Ten tonu analizi için yüklediğin fotoğraf"
                  className="h-20 w-20 shrink-0 rounded-2xl border border-ink/10 object-cover"
                  data-testid="ten-tonu-selfie"
                />
              )}
              <p className="flex-1 pt-1 text-sm text-ink/55">
                Bu analiz yalnızca sana görünür. Fotoğrafın kombin paylaşımlarında
                veya başka hiçbir yerde kullanılmaz.
              </p>
            </div>

            <div className="mt-5">
              <SkinTonePanel analysis={analiz} />
            </div>

            {isPickerOpen ? (
              <div className="mt-5">
                <PhotoPicker
                  file={secilenDosya}
                  onSelect={handleSelect}
                  onClear={() => setSecilenDosya(null)}
                  disabled={isAnalyzing}
                />
                <button
                  type="button"
                  onClick={() => setIsPickerOpen(false)}
                  className="mt-3 text-xs text-ink/45 transition-colors hover:text-ink/70"
                >
                  Vazgeç
                </button>
              </div>
            ) : (
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsPickerOpen(true)}
                  className="inline-flex items-center gap-2 text-xs"
                  data-testid="ten-tonu-yeniden"
                >
                  <RefreshCw size={13} strokeWidth={1.75} />
                  Yeniden Analiz Et
                </Button>
                <button
                  type="button"
                  onClick={handleRemove}
                  disabled={isRemoving}
                  className="inline-flex items-center gap-1.5 text-xs text-burgundy/60 transition-colors hover:text-burgundy disabled:opacity-60"
                  data-testid="ten-tonu-sil"
                >
                  <Trash2 size={12} strokeWidth={1.75} />
                  {isRemoving ? 'Siliniyor...' : 'Analizi Sil'}
                </button>
              </div>
            )}
          </>
        ) : (
          // DAVET: henüz analiz yok.
          <div className="rounded-2xl border border-dusty-rose/40 bg-dusty-rose/10 px-5 py-6 text-center">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-dusty-rose/20">
              <Palette size={18} strokeWidth={1.75} className="text-accent-ink" />
            </span>
            <p className="mt-3 font-display text-lg italic text-ink">
              Selfie yükle, sana uygun renkleri keşfet
            </p>
            <p className="mt-1.5 text-sm text-ink/55">
              Yüzünün net göründüğü bir fotoğraf yeter. Ten tonunu belirleyip sana
              yakışan renkleri öneririz.
            </p>

            <div className="mt-5 text-left">
              <PhotoPicker
                file={secilenDosya}
                onSelect={handleSelect}
                onClear={() => setSecilenDosya(null)}
                disabled={isAnalyzing}
              />
            </div>

            <p className="mt-3 text-xs text-ink/40">
              İsteğe bağlıdır — yüklemesen de uygulamanın tamamını kullanabilirsin.
            </p>
          </div>
        )}

        {hata && !isAnalyzing && (
          <p className="mt-4 text-sm text-burgundy" data-testid="ten-tonu-hatasi">
            {hata}
          </p>
        )}
      </div>
    </section>
  )
}

export default SkinToneSection
