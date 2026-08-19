import { Capacitor } from '@capacitor/core'

// Native platformda Capacitor Camera, web'de normal dosya seçici kullanılır.
// Bu modül ikisini tek bir arayüz altında toplar: her iki yol da File döndürür,
// böylece yükleme kodu platformdan habersiz kalır.

export function isNativePlatform() {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return typeof window !== 'undefined' && Boolean(window.androidBridge)
  }
}

// Capacitor Camera base64 döndürür; backend multipart/form-data beklediği için
// File nesnesine çeviriyoruz.
function base64ToFile(base64, format) {
  const mimeType = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg'
  const extension = format === 'png' ? 'png' : format === 'webp' ? 'webp' : 'jpg'

  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return new File([bytes], `foto.${extension}`, { type: mimeType })
}

// source: 'camera' | 'gallery'
export async function pickNativePhoto(source) {
  // Dinamik import: web derlemesinde kamera modülü gereksiz yere yüklenmesin.
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')

  try {
    const photo = await Camera.getPhoto({
      quality: 80,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source: source === 'camera' ? CameraSource.Camera : CameraSource.Photos,
      // Yüklemeden önce boyutu makul tut: 5 MB sınırına takılmayı azaltır.
      width: 1600,
      correctOrientation: true,
    })

    if (!photo?.base64String) {
      throw new Error('Fotoğraf alınamadı')
    }

    return base64ToFile(photo.base64String, photo.format)
  } catch (error) {
    const message = String(error?.message ?? error)

    // Kullanıcı seçiciyi kapattı — bu bir hata değil.
    if (/cancel/i.test(message)) return null

    // İzin reddi uygulamayı çökertmemeli; anlaşılır mesaja çevriliyor.
    if (/denied|permission/i.test(message)) {
      throw new Error(
        source === 'camera'
          ? 'Kamera izni verilmedi. Ayarlar > Uygulamalar üzerinden izin verebilirsin.'
          : 'Galeri izni verilmedi. Ayarlar > Uygulamalar üzerinden izin verebilirsin.',
      )
    }

    throw new Error(`Fotoğraf alınamadı: ${message}`)
  }
}
