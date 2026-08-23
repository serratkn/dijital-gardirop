// Ten tonu analizi testleri (Gemini).
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-skin-tone.js
//   node test-scripts/test-skin-tone.js --birim     (yalnızca birim; sunucu/anahtar GEREKMEZ)
//   node test-scripts/test-skin-tone.js --kotasiz   (gerçek Gemini bölümünü atlar)
//
// BÖLÜM 1 (birim) SUNUCU VE ANAHTAR GEREKTİRMEZ: sahte Gemini ile çalışır ve
// asıl güvence buradadır — yüz tespit edilemediğinde/hata olduğunda hiçbir şey
// KAYDEDİLMEMESİ ve öksüz selfie kalmaması.
// BÖLÜM 2 çalışan sunucu ister. BÖLÜM 3 ayrıca geçerli GEMINI_API_KEY ister.

const path = require('node:path')
const fs = require('node:fs')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const { UPLOAD_DIR } = require('../src/config/upload')

const BASE_URL = `http://localhost:${process.env.PORT || 3001}/api`
const ONLY_UNIT = process.argv.includes('--birim')
const NO_QUOTA = process.argv.includes('--kotasiz')

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`   ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`   ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function call(method, endpoint, { body, token } = {}) {
  const headers = {}
  if (body) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(BASE_URL + endpoint, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let data = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }
  return { status: response.status, data }
}

async function upload(endpoint, filePath, token, { mimetype = 'image/png', name = 'selfie.png' } = {}) {
  const form = new FormData()
  form.append('image', new Blob([fs.readFileSync(filePath)], { type: mimetype }), name)
  const response = await fetch(BASE_URL + endpoint, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  })
  const text = await response.text()
  return { status: response.status, data: text ? JSON.parse(text) : null }
}

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0
const uploadsSayisi = () => fs.readdirSync(UPLOAD_DIR).length

// ============================================================
// BÖLÜM 1 — birim (sunucu ve anahtar GEREKTİRMEZ)
// ============================================================

// Gerçek bir dosya yazıyoruz: servis dosyayı okuyup siliyor, sahte yol
// kullanmak bu davranışı test dışında bırakırdı.
function geciciSelfie(ad) {
  const dosyaAdi = `test-selfie-${ad}-${Date.now()}.png`
  const tamYol = path.join(UPLOAD_DIR, dosyaAdi)
  fs.writeFileSync(tamYol, Buffer.from('sahte-png-icerigi'))
  return { filename: dosyaAdi, path: tamYol, mimetype: 'image/png' }
}

function sahteUserRepo(satir) {
  return {
    satir,
    yazmaSayisi: 0,
    async findSkinTone() {
      return this.satir
    },
    async updateSkinTone(userId, { analysis, photoUrl }) {
      this.yazmaSayisi += 1
      this.satir = { ...this.satir, skin_tone_analysis: analysis, skin_tone_photo_url: photoUrl }
      return this.satir
    },
  }
}

const BASARILI_SONUC = {
  model: 'sahte-model',
  yuz_tespit_edildi: true,
  sorun: null,
  analiz_tarihi: '2026-08-23T00:00:00.000Z',
  veri: {
    ten_tonu: 'Sıcak',
    ten_rengi_tanimi: 'Açık buğday teni',
    uyumlu_renkler: ['Mercan', 'Şeftali', 'Zeytin Yeşili'],
    uyumsuz_renkler: ['Buz Mavisi'],
    uyumlu_metal_tonlari: ['Altın'],
    genel_tavsiye: 'Toprak tonlarını tercih edin.',
  },
}

function sahteGemini(davranis) {
  return {
    cagriSayisi: 0,
    async analyzeSkinTone(file) {
      this.cagriSayisi += 1
      this.sonDosya = file
      if (davranis) return davranis(this.cagriSayisi)
      return BASARILI_SONUC
    },
  }
}

async function birimTestleri() {
  const SkinToneService = require('../src/services/SkinToneService')
  const GeminiService = require('../src/services/GeminiService')
  const { ValidationError, ConflictError, NotFoundError } = require('../src/utils/errors')

  console.log('1) GeminiService — ten tonu şeması ve normalizasyon')

  const gemini = new GeminiService()
  check('analyzeSkinTone metodu var', typeof gemini.analyzeSkinTone === 'function')
  check(
    'Prompt üç geçerli ten tonunu da adlandırıyor',
    ['Sıcak', 'Soğuk', 'Nötr'].every((t) => GeminiService.SKIN_TONE_PROMPT.includes(t)),
  )
  check(
    'Prompt yüz tespit edilemezse bildirmeyi İSTİYOR (hata yerine)',
    /yuz_tespit_edildi/.test(GeminiService.SKIN_TONE_PROMPT) &&
      /tahmin yürütme/i.test(GeminiService.SKIN_TONE_PROMPT),
  )
  check(
    'Uyumlu renk sınırı kıyafet şemasınınkinden GENİŞ (6-8 renk isteniyor)',
    GeminiService.MAX_TEN_RENK_SAYISI >= 8,
    `${GeminiService.MAX_TEN_RENK_SAYISI}`,
  )

  console.log('\n2) SkinToneService — mevcut analizi okuma')

  {
    const service = new SkinToneService(
      sahteUserRepo({ id: 'u1', skin_tone_analysis: null, skin_tone_photo_url: null }),
      sahteGemini(),
    )
    const sonuc = await service.getAnalysis('u1')
    check('Analiz yoksa null döner (HATA DEĞİL)', sonuc.analiz === null && sonuc.foto_url === null)

    const bos = new SkinToneService(sahteUserRepo(null), sahteGemini())
    let hata = null
    try {
      await bos.getAnalysis('yok')
    } catch (error) {
      hata = error
    }
    check('Olmayan kullanıcı için 404', hata instanceof NotFoundError)
  }

  console.log('\n3) SkinToneService — başarılı analiz')

  {
    const repo = sahteUserRepo({ id: 'u1', skin_tone_analysis: null, skin_tone_photo_url: null })
    const g = sahteGemini()
    const service = new SkinToneService(repo, g)
    const file = geciciSelfie('basarili')

    const sonuc = await service.analyze('u1', file)
    check('Gemini bir kez çağrıldı', g.cagriSayisi === 1)
    check('Analiz kaydedildi', repo.yazmaSayisi === 1)
    check('Ten tonu dönüyor', sonuc.analiz?.veri?.ten_tonu === 'Sıcak')
    check('Model ve tarih saklanıyor', isNonEmptyString(sonuc.analiz?.model) && isNonEmptyString(sonuc.analiz?.analiz_tarihi))
    check('Fotoğraf GÖRELİ yol olarak saklanıyor', sonuc.foto_url === `/uploads/${file.filename}`)
    check('Selfie diskte duruyor', fs.existsSync(file.path))
    check('Gemini tampon aldı (dosya yolu değil)', Buffer.isBuffer(g.sonDosya?.buffer))

    fs.rmSync(file.path, { force: true })
  }

  console.log('\n4) KRİTİK — yüz tespit edilemezse HİÇBİR ŞEY kaydedilmez')

  {
    const repo = sahteUserRepo({ id: 'u1', skin_tone_analysis: null, skin_tone_photo_url: null })
    const g = sahteGemini(() => ({
      model: 'sahte',
      yuz_tespit_edildi: false,
      sorun: 'Fotoğraf bulanık',
      veri: null,
    }))
    const service = new SkinToneService(repo, g)
    const file = geciciSelfie('yuzsuz')

    let hata = null
    try {
      await service.analyze('u1', file)
    } catch (error) {
      hata = error
    }

    check('400 (sistem hatası DEĞİL, kullanıcı yönlendirmesi)', hata instanceof ValidationError)
    check('Mesaj sebebi ve ne yapılacağını söylüyor', /bulanık/i.test(hata.message) && /tekrar deneyin/i.test(hata.message), hata.message)
    check('Veritabanına HİÇ YAZILMADI', repo.yazmaSayisi === 0)
    check('Yüklenen selfie GERİ ALINDI (öksüz dosya yok)', !fs.existsSync(file.path))
  }

  console.log('\n5) KRİTİK — Gemini hatasında eski analiz korunur, dosya geri alınır')

  {
    const eski = { model: 'onceki', analiz_tarihi: '2020-01-01T00:00:00.000Z', veri: { ten_tonu: 'Soğuk' } }
    const repo = sahteUserRepo({
      id: 'u1',
      skin_tone_analysis: eski,
      skin_tone_photo_url: '/uploads/eski-selfie.png',
    })
    // Eski selfie'nin gerçekten silinmediğini görebilmek için dosyayı yaz.
    const eskiYol = path.join(UPLOAD_DIR, 'eski-selfie.png')
    fs.writeFileSync(eskiYol, Buffer.from('eski'))

    const g = sahteGemini(() => {
      throw Object.assign(new Error('Gemini kullanım kotası doldu.'), {
        isRateLimited: true,
        statusCode: 503,
      })
    })
    const service = new SkinToneService(repo, g)
    const file = geciciSelfie('hatali')

    let hata = null
    try {
      await service.analyze('u1', file)
    } catch (error) {
      hata = error
    }

    check('Hata çağırana FIRLATILIYOR (sessizce yutulmuyor)', hata !== null)
    check('Kota hatası yeniden DENENMEDİ (tek çağrı)', g.cagriSayisi === 1, `${g.cagriSayisi} çağrı`)
    check('Veritabanına yazılmadı', repo.yazmaSayisi === 0)
    check('ESKİ ANALİZ YERİNDE', repo.satir.skin_tone_analysis?.model === 'onceki')
    check('ESKİ SELFIE SİLİNMEDİ', fs.existsSync(eskiYol))
    check('Yeni (başarısız) selfie geri alındı', !fs.existsSync(file.path))

    fs.rmSync(eskiYol, { force: true })
  }

  console.log('\n6) Geçici hata yeniden denenir, kalıcı hata denenmez')

  {
    const repo = sahteUserRepo({ id: 'u1', skin_tone_analysis: null, skin_tone_photo_url: null })
    const g = sahteGemini((n) => {
      if (n === 1) throw Object.assign(new Error('zaman aşımı'), { isRetryable: true })
      return BASARILI_SONUC
    })
    const service = new SkinToneService(repo, g)
    const file = geciciSelfie('yeniden')

    const sonuc = await service.analyze('u1', file)
    check('GEÇİCİ hata sonrası ikinci deneme yapıldı ve başarılı', g.cagriSayisi === 2 && sonuc.analiz !== null)
    fs.rmSync(file.path, { force: true })

    const kaliciRepo = sahteUserRepo({ id: 'u1', skin_tone_analysis: null, skin_tone_photo_url: null })
    const kalici = sahteGemini(() => {
      throw Object.assign(new Error('Gemini API anahtarı geçersiz.'), { isRetryable: false })
    })
    const kaliciService = new SkinToneService(kaliciRepo, kalici)
    const file2 = geciciSelfie('kalici')
    try {
      await kaliciService.analyze('u1', file2)
    } catch {
      // beklenen
    }
    check('KALICI hata yeniden DENENMEDİ (kota boşa harcanmaz)', kalici.cagriSayisi === 1)
    fs.rmSync(file2.path, { force: true })
  }

  console.log('\n7) MALİYET — eşzamanlı ikinci istek Gemini çağrısı yapmaz')

  {
    let cozumle
    const bekleyen = new Promise((resolve) => { cozumle = resolve })
    const repo = sahteUserRepo({ id: 'u1', skin_tone_analysis: null, skin_tone_photo_url: null })
    const g = sahteGemini(async () => { await bekleyen; return BASARILI_SONUC })
    const service = new SkinToneService(repo, g)

    const file1 = geciciSelfie('es1')
    const file2 = geciciSelfie('es2')

    const birinci = service.analyze('u1', file1)
    let hata = null
    try {
      await service.analyze('u1', file2)
    } catch (error) {
      hata = error
    }
    check('İkinci eşzamanlı istek 409', hata instanceof ConflictError, hata?.message)
    check('İkinci isteğin dosyası geri alındı', !fs.existsSync(file2.path))

    cozumle()
    await birinci
    check('Yalnızca TEK Gemini çağrısı yapıldı', g.cagriSayisi === 1, `${g.cagriSayisi}`)
    fs.rmSync(file1.path, { force: true })
  }

  console.log('\n8) Eski selfie yalnızca BAŞARILI yazmadan sonra silinir')

  {
    const eskiYol = path.join(UPLOAD_DIR, 'eski-selfie-2.png')
    fs.writeFileSync(eskiYol, Buffer.from('eski'))
    const repo = sahteUserRepo({
      id: 'u1',
      skin_tone_analysis: { model: 'onceki' },
      skin_tone_photo_url: '/uploads/eski-selfie-2.png',
    })
    const service = new SkinToneService(repo, sahteGemini())
    const file = geciciSelfie('degistir')

    await service.analyze('u1', file)
    check('Yazma başarılı olunca eski selfie silindi', !fs.existsSync(eskiYol))
    check('Yeni selfie duruyor', fs.existsSync(file.path))
    fs.rmSync(file.path, { force: true })
  }

  console.log('\n9) Silme — analiz ve selfie birlikte kalkar')

  {
    const eskiYol = path.join(UPLOAD_DIR, 'eski-selfie-3.png')
    fs.writeFileSync(eskiYol, Buffer.from('eski'))
    const repo = sahteUserRepo({
      id: 'u1',
      skin_tone_analysis: { model: 'onceki' },
      skin_tone_photo_url: '/uploads/eski-selfie-3.png',
    })
    const service = new SkinToneService(repo, sahteGemini())

    const sonuc = await service.remove('u1')
    check('Analiz temizlendi', sonuc.analiz === null && sonuc.foto_url === null)
    check('Selfie diskten silindi', !fs.existsSync(eskiYol))
  }

  console.log('\n10) Dosyasız istek')

  {
    const service = new SkinToneService(
      sahteUserRepo({ id: 'u1', skin_tone_analysis: null, skin_tone_photo_url: null }),
      sahteGemini(),
    )
    let hata = null
    try {
      await service.analyze('u1', null)
    } catch (error) {
      hata = error
    }
    check('Dosya gönderilmezse 400', hata instanceof ValidationError)
  }
}

// ============================================================
// BÖLÜM 2 — uçtan uca HTTP (sunucu ister, Gemini GEREKMEZ)
// ============================================================

async function ucTestleri() {
  console.log('\n11) HTTP — yetkilendirme, yol çakışması ve veri izolasyonu')

  const email = `tenTonu-${Date.now()}@example.com`
  const { data: auth } = await call('POST', '/auth/register', {
    body: { name: 'Ten Tonu Test', email, password: 'test1234', age: 27 },
  })
  if (!auth?.token) {
    check('Test kullanıcısı oluşturuldu', false)
    return null
  }

  const { status: tokensiz } = await call('GET', '/users/skin-tone-analysis')
  check('Token olmadan 401', tokensiz === 401)

  const { status: bosStatus, data: bos } = await call('GET', '/users/skin-tone-analysis', {
    token: auth.token,
  })
  check(
    'Analizi olmayan kullanıcıda 200 + null (özellik isteğe bağlı)',
    bosStatus === 200 && bos?.analiz === null && bos?.foto_url === null,
    JSON.stringify(bos),
  )
  check(
    'Yol /users/:id ile ÇAKIŞMIYOR (route sırası doğru)',
    bosStatus === 200 && 'analiz' in (bos ?? {}),
  )

  const { status: dosyasiz, data: dosyasizData } = await call('POST', '/users/skin-tone-analysis', {
    token: auth.token,
  })
  check('Dosyasız POST 400', dosyasiz === 400 && isNonEmptyString(dosyasizData?.error))

  // Görsel olmayan dosya reddedilir (mevcut fotoğraf kuralları).
  const metinYolu = path.join(UPLOAD_DIR, `test-metin-${Date.now()}.txt`)
  fs.writeFileSync(metinYolu, 'merhaba')
  const { status: metinStatus } = await upload('/users/skin-tone-analysis', metinYolu, auth.token, {
    mimetype: 'text/plain',
    name: 'a.txt',
  })
  check('Görsel olmayan dosya 400', metinStatus === 400)
  fs.rmSync(metinYolu, { force: true })

  // HASSAS VERİ: diğer kullanıcı yanıtlarında sızmamalı.
  const { data: me } = await call('GET', '/auth/me', { token: auth.token })
  check(
    '/auth/me yanıtında skin_tone alanları YOK (SAFE_COLUMNS dışı)',
    !('skin_tone_analysis' in (me ?? {})) && !('skin_tone_photo_url' in (me ?? {})),
    Object.keys(me ?? {}).join(', '),
  )
  const { data: kullanici } = await call('GET', `/users/${auth.user.id}`, { token: auth.token })
  check(
    '/users/:id yanıtında da YOK',
    !('skin_tone_analysis' in (kullanici ?? {})) && !('skin_tone_photo_url' in (kullanici ?? {})),
  )

  return { userId: auth.user.id, token: auth.token }
}

// ============================================================
// BÖLÜM 3 — gerçek Gemini (anahtar ve kota ister)
// ============================================================

async function gercekTest(hesap) {
  console.log('\n12) Gerçek Gemini — sentetik portre ve yüzsüz fotoğraf')

  // Yüz İÇERMEYEN gerçek bir fotoğraf: "tekrar dene" yolunu gerçek modelle sınar.
  const yuzsuz = fs
    .readdirSync(UPLOAD_DIR)
    .filter((f) => f.endsWith('.png') && !f.startsWith('test-'))
    .map((f) => path.join(UPLOAD_DIR, f))
    .sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0]

  if (!yuzsuz) {
    console.log('   (uploads/ boş — gerçek fotoğraf bölümü atlandı)')
    return
  }

  const oncekiSayi = uploadsSayisi()
  const { status, data } = await upload('/users/skin-tone-analysis', yuzsuz, hesap.token)
  check(
    'Yüz içermeyen fotoğrafta 400 + yönlendirici mesaj (500 DEĞİL)',
    status === 400 && /tekrar deneyin/i.test(data?.error ?? ''),
    `${status} ${data?.error ?? ''}`,
  )
  check('Başarısız denemeden sonra ÖKSÜZ DOSYA kalmadı', uploadsSayisi() === oncekiSayi)

  const { data: hala } = await call('GET', '/users/skin-tone-analysis', { token: hesap.token })
  check('Başarısız analiz kaydı bozmadı', hala?.analiz === null)
}

async function main() {
  console.log('\n=== TEN TONU ANALİZİ ===\n')

  await birimTestleri()

  let hesap = null
  if (!ONLY_UNIT) {
    try {
      const { status } = await call('GET', '/health')
      if (status !== 200 && status !== 503) throw new Error('sunucu yok')
    } catch {
      console.log('\n⚠ Sunucu çalışmıyor. Uçtan uca bölümler atlanıyor.')
      console.log('  backend/ klasöründe `npm run dev` çalıştırın.\n')
      ozet()
      process.exit(failed > 0 ? 1 : 0)
    }

    hesap = await ucTestleri()
    if (hesap && !NO_QUOTA) await gercekTest(hesap)
    else if (hesap) console.log('\n(--kotasiz: gerçek Gemini bölümü atlandı)')

    if (hesap) await call('DELETE', `/users/${hesap.userId}`, { token: hesap.token })
  } else {
    console.log('\n(--birim: uçtan uca bölümler atlandı)')
  }

  ozet()
  process.exit(failed > 0 ? 1 : 0)
}

function ozet() {
  console.log(`\n${'='.repeat(46)}`)
  console.log(`SONUÇ: ${passed} başarılı, ${failed} başarısız`)
  console.log('='.repeat(46))
}

main().catch((error) => {
  console.error('\nBeklenmeyen hata:', error)
  process.exit(1)
})
