// Cloudflare R2 depolama katmanı — yapılandırma ve zarif geri düşüş
// (graceful degradation) davranışı. GERÇEK bir R2 hesabı/bucket'ı GEREKTİRMEZ:
// yalnızca "anahtarlar eksikken hiçbir şeye dokunmadan devre dışı kalıyor mu"
// sorusuna cevap arar — WeatherService/GeminiService'in `--birim` bölümleriyle
// AYNI kalıp (sahte/gerçek olmayan yapılandırmayla saf mantık test edilir).
//
// Gerçek bir yükleme/silme (network'e giden PutObject/DeleteObject) BURADA
// TEST EDİLMEZ — R2 kimlik bilgileri elde olduğunda `POST
// /clothing-items/:id/image` gerçek bir kullanıcı akışıyla (Playwright ya da
// elle) doğrulanmalı; bu script yalnızca "yapılandırılmamışken zarar
// vermiyor" garantisini kapsar.

const path = require('node:path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

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

const R2_ENV_KEYS = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_URL',
]

function clearR2Env() {
  for (const key of R2_ENV_KEYS) delete process.env[key]
}

function setFakeR2Env() {
  process.env.R2_ACCOUNT_ID = 'test-account'
  process.env.R2_ACCESS_KEY_ID = 'test-access-key'
  process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key'
  process.env.R2_BUCKET_NAME = 'test-bucket'
  process.env.R2_PUBLIC_URL = 'https://pub-test.r2.dev/'
}

async function main() {
  console.log('\n=== FOTOĞRAF DEPOLAMA (Cloudflare R2) — BİRİM TESTLERİ ===\n')

  // Gerçek .env'de R2 anahtarları tanımlıysa testin kendi senaryosunu
  // bozmasın diye önce temizleniyor; sonda GERİ YÜKLENİYOR.
  const originalEnv = {}
  for (const key of R2_ENV_KEYS) originalEnv[key] = process.env[key]
  clearR2Env()

  console.log('1) Hiç yapılandırılmamış (temiz .env)')
  {
    const r2 = require('../src/config/r2')
    check('isConfigured() false', r2.isConfigured() === false)
    check('getClient() null döner', r2.getClient() === null)

    const StorageRepository = require('../src/repositories/StorageRepository')
    const repo = new StorageRepository()
    check('StorageRepository.isConfigured false', repo.isConfigured === false)

    let threw = false
    try {
      await repo.upload('x', Buffer.from('x'), 'image/png')
    } catch {
      threw = true
    }
    check('upload() yapılandırılmamışken FIRLATIR (network denemeden)', threw)

    let threwRemove = false
    try {
      await repo.remove('x')
    } catch {
      threwRemove = true
    }
    check('remove() yapılandırılmamışken FIRLATIR (network denemeden)', threwRemove)
  }

  console.log('\n2) Eksik yapılandırma (yalnızca 4/5 alan dolu)')
  {
    setFakeR2Env()
    delete process.env.R2_PUBLIC_URL
    const r2 = require('../src/config/r2')
    r2.resetClient()
    check('Tek eksik alan bile isConfigured() false yapıyor', r2.isConfigured() === false)
    check('getClient() yine null (yarım yapılandırmayla istemci kurulmuyor)', r2.getClient() === null)
  }

  console.log('\n3) Tam yapılandırma (5/5 alan dolu, sahte değerlerle)')
  {
    setFakeR2Env()
    const r2 = require('../src/config/r2')
    r2.resetClient()
    check('isConfigured() true', r2.isConfigured() === true)
    const client = r2.getClient()
    check('getClient() gerçek bir S3Client döner (network çağrısı yapılmaz)', client !== null)
    check(
      'Bucket ve public URL doğru okunuyor',
      r2.getBucketName() === 'test-bucket' && r2.getPublicUrl() === 'https://pub-test.r2.dev',
    )
    check('getPublicUrl() sondaki "/" temizleniyor', !r2.getPublicUrl().endsWith('/'))

    const StorageRepository = require('../src/repositories/StorageRepository')
    const repo = new StorageRepository()
    check('StorageRepository.isConfigured true', repo.isConfigured === true)
  }

  console.log('\n4) İstemci önbelleği anahtar değişimini takip ediyor')
  {
    const r2 = require('../src/config/r2')
    setFakeR2Env()
    r2.resetClient()
    const first = r2.getClient()
    const second = r2.getClient()
    check('Aynı anahtarlarla İKİNCİ çağrı AYNI istemciyi döner (önbellek)', first === second)

    process.env.R2_ACCESS_KEY_ID = 'degisen-anahtar'
    const third = r2.getClient()
    check('Anahtar değişince YENİ bir istemci kuruluyor', third !== first)
  }

  console.log('\n5) ClothingItemService — storageRepository OPSİYONEL (geriye dönük uyumluluk)')
  {
    // Gerçek bir Postgres bağlantısı gerektirmeden yalnızca constructor
    // imzasının kırılmadığını doğruluyoruz — storageRepository verilmeden
    // eski iki-parametreli çağrı hâlâ çalışmalı.
    const ClothingItemService = require('../src/services/ClothingItemService')
    let threw = false
    try {
      // eslint-disable-next-line no-new
      new ClothingItemService({}, {})
    } catch {
      threw = true
    }
    check('storageRepository verilmeden constructor patlamıyor', threw === false)
  }

  // .env'deki gerçek değerler (varsa) geri yükleniyor.
  clearR2Env()
  for (const key of R2_ENV_KEYS) {
    if (originalEnv[key] !== undefined) process.env[key] = originalEnv[key]
  }
  require('../src/config/r2').resetClient()

  console.log(`\n${'='.repeat(46)}`)
  console.log(`SONUÇ: ${passed} başarılı, ${failed} başarısız`)
  console.log('='.repeat(46))
  process.exit(failed > 0 ? 1 : 0)
}

main().catch((error) => {
  console.error('\nÇalıştırılamadı:', error)
  process.exit(1)
})
