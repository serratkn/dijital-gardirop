// Kombin Öner — serbest metin (mood) yorumlama testleri.
//
// Kullanım (backend/ klasöründen):
//   node test-scripts/test-outfit-interpret.js
//   node test-scripts/test-outfit-interpret.js --birim     (yalnızca birim; sunucu/anahtar GEREKMEZ)
//   node test-scripts/test-outfit-interpret.js --kotasiz   (gerçek örnek metinler bölümünü atlar)
//
// BÖLÜM 1 (birim) SUNUCU VE ANAHTAR GEREKTİRMEZ: doğrulama hataları ve
// GeminiService.OUTFIT_REQUEST_PROMPT/OUTFIT_REQUEST_CATEGORIES üzerinden
// şema kontrolleri.
// BÖLÜM 2 çalışan sunucu ister (HTTP: yetkilendirme, doğrulama, rate limit).
// BÖLÜM 3 GEÇERLİ GEMINI_API_KEY ister — birkaç farklı serbest metinle
// GERÇEK bir çağrı yapıp mantıklı bir occasion/özet üretildiğini doğrular.

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

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

const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0

// ============================================================
// BÖLÜM 1 — birim (sunucu ve anahtar GEREKTİRMEZ)
// ============================================================

async function birimTestleri() {
  const GeminiService = require('../src/services/GeminiService')
  const { ValidationError, ServiceUnavailableError } = require('../src/utils/errors')

  console.log('1) Prompt ve kategori şeması')

  check(
    'Altı standart kategori de prompt\'ta adlandırılıyor',
    ['Üniversite', 'İş', 'Akşam Yemeği', 'Buluşma', 'Spor', 'Özel Davet'].every((k) =>
      GeminiService.OUTFIT_REQUEST_PROMPT.includes(k),
    ),
  )
  check(
    '"Diğer" seçeneği prompt\'ta açıkça var (zorla kategori uydurmasın diye)',
    /Diğer/.test(GeminiService.OUTFIT_REQUEST_PROMPT),
  )
  check(
    'Şema arama_metni, stil_tercihi, kacinilmasi_gerekenler, onem_verilen_ozellikler alanlarını taşıyor',
    ['arama_metni', 'stil_tercihi', 'kacinilmasi_gerekenler', 'onem_verilen_ozellikler'].every((alan) =>
      GeminiService.OUTFIT_REQUEST_PROMPT.includes(alan),
    ),
  )
  check(
    'Frontend occasions.js ile BİREBİR AYNI 6 kategori (elle senkron tutulan liste)',
    JSON.stringify(GeminiService.OUTFIT_REQUEST_CATEGORIES) ===
      JSON.stringify(['Üniversite', 'İş', 'Akşam Yemeği', 'Buluşma', 'Spor', 'Özel Davet']),
  )
  check('Metin uzunluk sınırı makul (500)', GeminiService.MAX_INTERPRETATION_TEXT_LENGTH === 500)

  console.log('\n2) Doğrulama hataları (Gemini\'ye HİÇ gidilmez)')

  const service = new GeminiService()

  {
    let hata = null
    try {
      await service.interpretOutfitRequest('')
    } catch (error) {
      hata = error
    }
    check('Boş metin → ValidationError (400)', hata instanceof ValidationError, hata?.message)
  }
  {
    let hata = null
    try {
      await service.interpretOutfitRequest('   ')
    } catch (error) {
      hata = error
    }
    check('Yalnızca boşluk → ValidationError (400)', hata instanceof ValidationError)
  }
  {
    let hata = null
    try {
      await service.interpretOutfitRequest('a'.repeat(501))
    } catch (error) {
      hata = error
    }
    check(
      '501 karakter → ValidationError (Gemini\'ye gidilmeden reddedilir)',
      hata instanceof ValidationError,
      hata?.message,
    )
  }

  console.log('\n3) Anahtar yolları (GeminiService\'in paylaşılan #callGemini çekirdeği)')

  const realKey = process.env.GEMINI_API_KEY

  delete process.env.GEMINI_API_KEY
  {
    let hata = null
    try {
      await service.interpretOutfitRequest('Bir yere gidiyorum')
    } catch (error) {
      hata = error
    }
    check('Anahtar yokken → 503 (500 değil)', hata instanceof ServiceUnavailableError && hata.statusCode === 503)
    check('Mesaj anahtarın eksik olduğunu söylüyor', /GEMINI_API_KEY/.test(hata?.message ?? ''), hata?.message)
  }

  if (realKey) process.env.GEMINI_API_KEY = realKey
  else delete process.env.GEMINI_API_KEY
}

// ============================================================
// BÖLÜM 2 — uçtan uca HTTP (sunucu ister, gerçek Gemini GEREKMEZ)
// ============================================================

async function ucTestleri() {
  console.log('\n4) HTTP — /outfits/interpret yetkilendirme ve doğrulama')

  const email = `outfit-interpret-${Date.now()}@example.com`
  const { data: auth } = await call('POST', '/auth/register', {
    body: { name: 'Interpret Test', email, password: 'test1234', age: 26 },
  })
  if (!auth?.token) {
    check('Test kullanıcısı oluşturuldu', false)
    return null
  }

  const { status: tokensiz } = await call('POST', '/outfits/interpret', {
    body: { text: 'bir şeyler' },
  })
  check('Token olmadan 401', tokensiz === 401)

  const { status: bosMetin, data: bosMetinData } = await call('POST', '/outfits/interpret', {
    token: auth.token,
    body: { text: '' },
  })
  check('Boş metin → 400', bosMetin === 400 && isNonEmptyString(bosMetinData?.error))

  const { status: metinYok } = await call('POST', '/outfits/interpret', {
    token: auth.token,
    body: {},
  })
  check('text alanı hiç yokken → 400 (500 değil)', metinYok === 400)

  const { status: cokUzun } = await call('POST', '/outfits/interpret', {
    token: auth.token,
    body: { text: 'a'.repeat(501) },
  })
  check('501 karakter → 400', cokUzun === 400)

  // /outfits/:id ile YOL ÇAKIŞMASI yok mu? "interpret" bir UUID DEĞİL, ama
  // POST /outfits/:id diye bir rota da yok (yalnızca GET/PUT/DELETE) — yine
  // de bu isteğin CREATE (POST /outfits) ile karışıp yanlışlıkla bir kombin
  // KAYDETMEDİĞİNİ doğruluyoruz.
  const oncekiOutfits = await call('GET', '/outfits', { token: auth.token })
  const oncekiSayi = oncekiOutfits.data?.length ?? 0
  await call('POST', '/outfits/interpret', { token: auth.token, body: { text: 'test metni burada' } })
  const sonrakiOutfits = await call('GET', '/outfits', { token: auth.token })
  check(
    '/outfits/interpret yanlışlıkla bir kombin KAYDETMEDİ (/outfits POST ile karışmadı)',
    (sonrakiOutfits.data?.length ?? 0) === oncekiSayi,
  )

  return { userId: auth.user.id, token: auth.token }
}

// ============================================================
// BÖLÜM 3 — gerçek Gemini (anahtar ve kota ister)
// ============================================================

async function gercekTestleri(hesap) {
  console.log('\n5) Gerçek Gemini — birkaç farklı serbest metin')

  const ornekler = [
    {
      metin:
        'Akşam yemeğine gidiyorum ama overdress ya da underdress olmak istemiyorum, sade bir şıklık istiyorum.',
      beklenenOccasion: 'Akşam Yemeği',
    },
    {
      metin: 'Yarın sabah spor salonuna gidicem, rahat bir şeyler lazım.',
      beklenenOccasion: 'Spor',
    },
    {
      metin: 'Bugün üniversitede sunum yapıcam, ciddi ama fazla resmi olmasın.',
      beklenenOccasion: 'Üniversite',
    },
  ]

  const OUTFIT_REQUEST_CATEGORIES = [
    'Üniversite', 'İş', 'Akşam Yemeği', 'Buluşma', 'Spor', 'Özel Davet', 'Diğer',
  ]

  for (const { metin, beklenenOccasion } of ornekler) {
    const { status, data } = await call('POST', '/outfits/interpret', {
      token: hesap.token,
      body: { text: metin },
    })

    if (status === 503) {
      console.log(`   ! Gemini kotası dolu görünüyor, bu örnek atlandı: "${metin.slice(0, 40)}..."`)
      continue
    }

    check(`"${metin.slice(0, 30)}..." → 200`, status === 200, `${status}`)
    check(
      `  occasion geçerli bir kategori — beklenen "${beklenenOccasion}"`,
      OUTFIT_REQUEST_CATEGORIES.includes(data?.occasion),
      data?.occasion,
    )
    check(
      `  occasion mantıklı ("${beklenenOccasion}" bekleniyordu)`,
      data?.occasion === beklenenOccasion,
      `alınan: ${data?.occasion}`,
    )
    check('  arama_metni dolu bir cümle', isNonEmptyString(data?.arama_metni), data?.arama_metni)
    check('  stil_tercihi dolu', isNonEmptyString(data?.stil_tercihi), data?.stil_tercihi)
    check(
      '  kacinilmasi_gerekenler ve onem_verilen_ozellikler birer dizi',
      Array.isArray(data?.kacinilmasi_gerekenler) && Array.isArray(data?.onem_verilen_ozellikler),
    )
  }
}

async function main() {
  console.log('\n=== KOMBİN ÖNER — SERBEST METİN YORUMLAMA ===\n')

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
    if (hesap && !NO_QUOTA) await gercekTestleri(hesap)
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
