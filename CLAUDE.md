# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Bu dosya projenin kalıcı hafızasıdır.** Her önemli değişiklikten sonra güncellenir:
> yeni özellikler, düzeltilen hatalar, alınan mimari kararlar. En sonda tarihli bir
> **Değişiklik Günlüğü** bulunur — her yeni çalışma oraya işlenir.

---

## 1. Proje Özeti

**Dijital Gardırop**, kullanıcının kendi kıyafetlerini dijital ortama taşıyıp bunlardan
kombin önerileri üreten bir stil platformudur.

- **Hedef kitle:** Kadın kullanıcılar; konumlandırma "premium stil platformu" — editöryal,
  sakin ve moda dergisi estetiğinde bir arayüz hedeflenir. Tasarım kararlarında bu ton belirleyicidir.
- **Dil:** Tüm kullanıcı arayüzü metinleri, kod yorumları ve commit mesajları **Türkçe**.
  Rota adresleri de Türkçe slug kullanır (`/gardirop`, `/kombin-oner`, `/profil/hesap-bilgilerim`).
- **Commit formatı:** conventional-commit öneki + Türkçe açıklama —
  `feat(profil): profil sayfası ve hesap yönetimi ekranı eklendi`

### Temel özellikler

| Özellik | Durum |
|---|---|
| Gardırop yönetimi (kategori filtresi, arama) | Gerçek API'ye bağlı |
| Kombin önerisi (duruma göre rastgele kombin) | Gerçek API'ye bağlı |
| Ana sayfa istatistikleri ve son eklenenler | Gerçek API'ye bağlı |
| İlk açılış onboarding akışı + tarz anketi | localStorage |
| Profil / hesap yönetimi ekranları | localStorage |
| Mobil uygulama (Android, Capacitor) | Kurulu |

---

## 2. Teknoloji Yığını

### Depo yapısı

Kökte üç bağımsız parça var; **monorepo aracı yok** — her biri kendi klasöründen çalıştırılır.

| Yol | Ne |
|---|---|
| `frontend/` | Vite + React 19 SPA |
| `backend/` | Express + `pg` REST API |
| `docker-compose.yml` | PostgreSQL 16 (yerel geliştirme) |

Kökteki `package.json` yalnızca artık Capacitor bağımlılıkları içerir, script'i yoktur —
**yok sayın**. Gerçek Capacitor yapılandırması `frontend/capacitor.config.json` içindedir
(`appId: com.serra.digitalgardirop`).

### Frontend

React 19, Vite 8, Tailwind v4, react-router-dom 7, lucide-react (ikonlar),
Capacitor 8 (Android paketleme). Lint: **oxlint** (depodaki tek otomatik kontrol).

### Backend

Express 4, `pg` (PostgreSQL sürücüsü), `cors`, `dotenv`. CommonJS (`require`).

### Veritabanı

PostgreSQL 16, Docker Compose ile ayağa kalkar. Container adı: `dijitalgardirop-db-1`.
Kalıcılık `postgres_data` adlı named volume ile sağlanır.

### Mimari desenler

- **Layered architecture (katmanlı mimari)** — `routes → controllers → services → repositories → pg Pool`
- **Repository pattern** — SQL yalnızca repository katmanında
- **Dependency Injection** — her katman bir üstünü constructor'da alır; bağlama route dosyasında yapılır
- **Class-based OOP** — tüm controller/service/repository'ler sınıftır
- **Template Method benzeri hata yönetimi** — `BaseController.handleError` ortak hata çevirisini üstlenir

---

## 3. Gelişim Geçmişi (kronolojik)

### Aşama 1 — Frontend tasarım sistemi (11–13 Ağustos 2026)

Vite + React iskeleti üzerine premium tasarım sistemi kuruldu: renk paleti, tipografi,
kategori filtreleri. Ardından Ana Sayfa, Kombin Öner, Gardırop ve Kıyafet Detay sayfaları
tasarlandı. Bu dönemde eklenenler: quick add modal, empty state, editöryal ifadeler,
kategori ikonları, sticky navigasyon, sayfa geçiş animasyonları, skeleton loading,
scroll-to-top butonu, breadcrumb ve arama çubuğu.

Tüm ekranlar bu aşamada `src/data/clothing.js` içindeki **mock veriyle** çalışıyordu.

**Karar:** Tailwind v4'ün CSS-first yapılandırması benimsendi — `tailwind.config.js` **yok**,
tasarım token'ları `src/index.css` içindeki `@theme` bloğunda tanımlı.

### Aşama 2 — Mobil dönüşüm (Capacitor / Android)

Capacitor eklendi, `webDir: dist` olarak ayarlandı, Android platformu kuruldu
(`frontend/android/`). Mobil için ayrı bir alt navigasyon (bottom tab bar) gereksinimi
bu aşamada ortaya çıktı ve Aşama 4'te eklendi.

### Aşama 3 — Onboarding akışı (15 Ağustos 2026)

İlk açılışta gösterilen, navigasyonsuz (chrome-free) bir tanışma akışı eklendi:
kayıt ekranı → 5 soruluk tarz anketi → karşılama ekranı. Tamamlanma durumu ve kullanıcı
bilgileri localStorage'da `dg_` önekli anahtarlarda tutulur.

**Karar:** `App.jsx` içinde `showOnboarding` true iken router/nav ağacı yerine doğrudan
`<Onboarding>` döndürülür — böylece akış tamamen chrome-free kalır.

Ardından Ana Sayfa'daki karşılama mesajı bu isimle kişiselleştirildi
("Hoş Geldin, Serra") ve profil sayfası + hesap yönetimi ekranları eklendi.

### Aşama 4 — Profil, alt navigasyon ve routing düzeltmeleri (15–17 Ağustos 2026)

Profil sayfası, mobil bottom tab bar ve profil alt sayfaları (Hesap Bilgilerim,
Şifre Değiştir, Tarz Tercihlerim, Bildirimler, Yardım & Destek) eklendi.

**Karşılaşılan sorun — eksik routing.** Profil listesindeki maddeler yalnızca görsel
`<button>` olarak bırakılmıştı; tıklanınca hiçbir şey olmuyordu. Ayrıca "Tarz Tercihlerim"
tüm onboarding'i (kayıt formu dahil) baştan başlatıyordu — oysa yalnızca 5 soruyu
düzenlenebilir biçimde göstermesi gerekiyordu.

**Çözüm:** Anket soruları (`src/data/styleQuestions.js`) ve seçenek render mantığı
(`components/onboarding/QuestionOptions.jsx`) ortak modüllere çıkarıldı; hem ilk kurulum
sihirbazı hem de düzenleme sayfası aynı kodu kullanır. Eksik sayfalar oluşturulup
rotalara bağlandı.

### Aşama 5 — Altyapı: Docker + Backend + Şema (17 Ağustos 2026)

PostgreSQL 16 `docker-compose.yml` ile eklendi. Ardından Express backend katmanlı mimariyle
kuruldu (`health` uç noktası referans uygulama olarak), sonra veritabanı şeması yazılıp
uygulandı.

**Karşılaşılan sorun — `pg.Pool` süreç çökertmesi.** Postgres yeniden başladığında `pg`,
boştaki bağlantılar için `'error'` olayı yayar. Dinleyici olmadığında Node bunu
yakalanmamış hata sayıp **tüm API sürecini öldürür**. Testte container durdurulduğunda
sunucu tamamen çöktü.

**Çözüm:** `config/database.js` içinde `pool.on('error', ...)` dinleyicisi eklendi.
Artık veritabanı gidip geldiğinde sunucu ayakta kalır, `/api/health` `503` döner ve
bağlantı geri geldiğinde kendiliğinden `200`'e döner. **Bu dinleyici silinmemelidir.**

### Aşama 6 — CRUD API'leri ve kritik düzeltmeler (17 Ağustos 2026)

`clothing-items` için tam CRUD yazıldı, ardından kalan kaynaklar eklendi:
`categories` (salt okunur), `users`, `style-preferences`, `outfits`.

Bu aşamada üç önemli sorun çıktı:

**a) Türkçe karakter bozulması (UTF-8).** `001_initial_schema.sql` Windows kabuğu üzerinden
`psql`e aktarılırken Türkçe karakterler bozuldu: `Üst` veritabanına `??st` olarak yazıldı
(`3f3f7374` — iki literal soru işareti; doğrusu `c39c7374`). Bu yalnızca kozmetik değildi:
frontend'in ikon eşlemesi `Üst`/`Ayakkabı`/`Çanta` adlarıyla yapıldığı için bozuk isimlerle
**hiçbir kategori ikonu görünmezdi**.
**Çözüm:** Kayıtlar Node + `pg` üzerinden (kabuk katmanı atlanarak) düzeltildi ve byte
seviyesinde doğrulandı. Migration uygulama yöntemi `docker cp` + `psql -f` olarak değiştirildi.

**b) `password_hash` sızıntısı riski.** Diğer repository'lerdeki `RETURNING *` deseni
`users` tablosunda parola özetini API yanıtına koyardı.
**Çözüm:** `UserRepository` açık kolon listesi (`SAFE_COLUMNS`) kullanır. Bu liste
korunmalıdır — yeni kolon eklenirken `password_hash` dışarıda bırakılmalıdır.

**c) `style_preferences` şema eksiği.** Tablo mantıksal olarak kullanıcı başına tek satır
tutar ama `user_id` üzerinde UNIQUE kısıtı yoktu; bu hem çift kayda izin veriyor hem de
atomik upsert yazmayı imkânsız kılıyordu.
**Çözüm:** `002` migration'ı ile `UNIQUE (user_id)` eklendi; `ON CONFLICT (user_id) DO UPDATE`
ile tek sorgulu upsert mümkün oldu. Aynı migration `outfit_items` için eksik FK index'lerini
de ekledi (PostgreSQL foreign key'ler için otomatik index oluşturmaz).

**Yapısal düzenleme:** Beş controller'da tekrarlanacak hata çevirisi `BaseController`'a
çıkarıldı; `utils/errors.js` `AppError` tabanı + `ConflictError` (409) ile genişletildi.

### Aşama 7 — Gardırop sayfası API'ye bağlandı (17 Ağustos 2026)

`Wardrobe.jsx` mock veriden gerçek API'ye geçirildi. Ortak altyapı kuruldu:
`src/lib/api.js` (fetch katmanı) ve `src/lib/transformers.js` (dönüştürücü).

**Karşılaşılan sorun — camelCase/snake_case asimetrisi.** Backend `category_id` (sayı)
döndürür ama frontend kategori **adıyla** filtreler ve ikonları adla eşler.
**Çözüm:** `GET /api/categories` paralel çekilip id→ad haritası kuruldu; dönüştürücü
`category` alanını doldurur.

**Karşılaşılan sorun — masonry düzeni.** Mock veride kartlara `imgHeight` alanı vardı,
backend'de yok; tüm kartlar aynı yükseklikte kalıp ızgara düzleşecekti.
**Çözüm:** Yükseklik, id'den deterministik hash ile türetilir. **Index kullanılmaz** —
filtreleme/arama sırasında kartlar yeniden sıralandığında yükseklikler zıplardı.

**Karşılaşılan sorun — kırık detay sayfası.** Gardırop artık gerçek UUID'lerle link
veriyordu ama `ClothingDetail` mock veride `Number(id)` ile arıyordu; `Number(uuid)` = `NaN`
olduğu için **her karta tıklamak "Kıyafet bulunamadı" sayfasına gidiyordu**.
**Çözüm:** `ClothingDetail` de aynı API katmanına bağlandı.

### Aşama 8 — Ana Sayfa API'ye bağlandı (18 Ağustos 2026)

`Dashboard.jsx` gerçek veriye geçti: istatistikler (Toplam Parça / Kombin / Favori) ve
"Son Eklenenler" bölümü. Kombin sayısı için `fetchOutfits` eklendi.

"Son Eklenenler" için ek parametre gerekmedi: `ClothingItemRepository.findAll` zaten
`ORDER BY created_at DESC` yapar, baştan 4 kayıt almak yeterlidir.

**Karar:** Hata durumunda istatistiklerde `0` yerine **`–`** gösterilir; sıfır göstermek
"gardırobun boş" gibi yanlış bir mesaj verirdi. Ayrıca Gardırop'tan farklı olarak tüm sayfa
boş duruma çevrilmez — karşılama ve hızlı eylem kartları veri olmadan da anlamlıdır.

**Not:** Mock'ta sabit duran `8 Kombin` istatistiği bu aşamada gerçek veriye bağlandı.

### Aşama 9 — Kombin Öner sayfası API'ye bağlandı (18 Ağustos 2026)

`OutfitSuggestion.jsx` gerçek gardıroptan kombin üretir hale getirildi; "Bu Kombini Kaydet"
artık gerçek `POST /api/outfits` isteği atar. `api.js` POST desteği ve backend'in Türkçe
hata mesajlarını yakalama yeteneği kazandı.

**Karşılaşılan sorun — devre dışı butonda hover hatası.** Kaydetme sonrası "Kaydedildi"
metni okunmuyordu: fare butonun üzerinde kaldığı için `variant="rose"` içindeki
`hover:bg-dusty-rose hover:text-ivory` kuralı devrede kalıyor, pembe zeminde açık renk
metin kayboluyordu.
**Çözüm:** Paylaşılan `Button` bileşenine `disabled:pointer-events-none disabled:opacity-60`
eklendi — bu tüm devre dışı butonları düzeltir.

**Karşılaşılan sorun — `occasion` uzunluğu.** Kolon `VARCHAR(50)`; serbest metin girişinde
daha uzun bir değer Postgres `22001` hatasıyla 500'e düşerdi.
**Çözüm:** Girişe `maxLength={50}` eklendi. (Backend tarafında uzunluk doğrulaması hâlâ yok.)

**Karar:** Yapay `LOADING_DURATION` gecikmesi kaldırıldı; gerçek bekleme ilk veri çekmede
olduğu için iskelet oraya taşındı, kombin üretimi istemci tarafında anlıktır.

---

## 4. Mevcut Durum

### Çalışanlar

**Uygulamanın tamamı gerçek API üzerinde çalışır; mock veri kalmamıştır.**

- **Gardırop** — listeleme, kategori filtresi, arama, parça ekleme (QuickAddModal), favori
- **Ana Sayfa** — gerçek istatistikler (parça/kombin/favori) ve son eklenen 4 parça
- **Kombin Öner** — gerçek gardıroptan kombin üretimi ve kalıcı kaydetme
- **Kombinlerim** — kayıtlı kombinler; parçaları, tarihi, favori ve silme işlemleriyle
- **Kıyafet Detay** — görüntüleme, favori, onaylı silme
- **Onboarding** — kullanıcıyı `POST /api/users` ile oluşturur, tarz anketini
  `PUT /api/style-preferences` ile kaydeder; e-posta çakışmasında (409) anlamlı mesaj gösterir
- **Profil > Hesap Bilgilerim / Tarz Tercihlerim** — veritabanından okur ve günceller
- **Backend** — 6 kaynak için tam CRUD, transaction'lı kombin yazımı, tipli hata yönetimi,
  alan uzunluğu ve foreign key doğrulamaları

### Eksikler ve bilinen sınırlamalar

| Konu | Durum |
|---|---|
| **Token localStorage'da** | XSS durumunda okunabilir. httpOnly cookie daha güvenli olurdu ama Capacitor WebView'de oturum yönetimini karmaşıklaştırır; bilinçli ödünleşme. |
| **Şifre sıfırlama yok** | "Şifremi unuttum" akışı (e-posta ile sıfırlama bağlantısı) yoktur; kullanıcı şifresini yalnızca giriş yapmışken değiştirebilir. |
| **E-posta doğrulama yok** | `email_verified` kolonu var ama hep `false`; doğrulama akışı kurulmadı. |
| **Token yenileme yok** | Tek bir access token (varsayılan 7 gün) kullanılır; refresh token yoktur, süre dolunca yeniden giriş gerekir. |
| **Fotoğraf yükleme yok** | `image_url` kolonu var ama dosya yükleme akışı yok; tüm kartlar `warm-gray` placeholder gösterir. QuickAddModal'daki "Fotoğraf Yükle" butonu bilinçli olarak devre dışıdır. |
| **Kıyafet düzenleme yok** | `PUT /api/clothing-items/:id` ucu hazır ama arayüzde düzenleme akışı yok. |
| **Kombin "giyildi" sayacı** | `PATCH /outfits/:id/worn` ucu hazır; Kombinlerim sayfası `times_worn` değerini gösterir ama artırma butonu yoktur. |
| **Bildirimler / Yardım & Destek** | "Yakında" sayfalarıdır, işlevleri yoktur. |
| **Ana Sayfa hızlı kombin kartları** | "Üniversite Kombini" / "Akşam Yemeği Kombini" kartları statik metindir, gerçek kombinlere bağlı değildir (bilinçli tercih). |
| **Test altyapısı yok** | Test framework'ü yoktur. Doğrulama: `npm run lint` + `backend/test-scripts/` + elle deneme. |

---

## 5. Veritabanı Şeması

`backend/src/db/migrations/` altında tanımlı. UUID birincil anahtarlar `pgcrypto` /
`gen_random_uuid()` ile üretilir; yalnızca `categories.id` `SERIAL`'dir.

### `users`
| Kolon | Tip | Not |
|---|---|---|
| `id` | UUID PK | `gen_random_uuid()` |
| `name` | VARCHAR(100) | |
| `email` | VARCHAR(255) | **UNIQUE, NOT NULL** |
| `email_verified` | BOOLEAN | `false` |
| `age` | INTEGER | |
| `password_hash` | VARCHAR(255) | **API yanıtlarında asla dönmez** |
| `subscription_tier` | VARCHAR(20) | `'free'` — `free` \| `premium` |
| `created_at` / `updated_at` | TIMESTAMP | `NOW()` |

### `style_preferences` — kullanıcı başına tek satır
| Kolon | Tip | Not |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID → `users(id)` | **UNIQUE**, ON DELETE CASCADE |
| `daily_style`, `color_preference`, `priority`, `style_icon`, `frequency` | VARCHAR(50) | anketin 5 sorusu |
| `updated_at` | TIMESTAMP | |

### `categories` — salt okunur, seed veriyle gelir
| Kolon | Tip | Not |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(50) | `Üst`, `Alt`, `Elbise`, `Ayakkabı`, `Çanta`, `Makyaj` |
| `icon` | VARCHAR(50) | lucide adları: `shirt`, `panel-bottom`, `triangle`, `footprints`, `handbag`, `sparkles` |
| `is_active` | BOOLEAN | `true` — okumalar bunu filtreler |

### `clothing_items`
| Kolon | Tip | Not |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID → `users(id)` | ON DELETE CASCADE, **index'li** |
| `category_id` | INTEGER → `categories(id)` | |
| `name`, `color`, `brand`, `season`, `image_url` | VARCHAR | |
| `is_favorite` | BOOLEAN | `false` |
| `is_deleted` | BOOLEAN | `false` — **soft delete**, her okuma filtreler |
| `created_at` / `updated_at` | TIMESTAMP | |

### `outfits`
| Kolon | Tip | Not |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID → `users(id)` | ON DELETE CASCADE, **index'li** |
| `occasion` | VARCHAR(50) | uzunluk sınırı önemli |
| `is_favorite` | BOOLEAN | `false` |
| `times_worn` | INTEGER | `0` |
| `created_at` | TIMESTAMP | |

### `outfit_items` — kombin ↔ parça bağlantı tablosu
| Kolon | Tip | Not |
|---|---|---|
| `id` | UUID PK | |
| `outfit_id` | UUID → `outfits(id)` | ON DELETE CASCADE, index'li |
| `clothing_item_id` | UUID → `clothing_items(id)` | ON DELETE CASCADE, index'li |

### İlişkiler

```
users ─┬─< style_preferences   (1:1, UNIQUE user_id)
       ├─< clothing_items      (1:N)
       └─< outfits             (1:N)

outfits >─── outfit_items ───< clothing_items   (N:M)
categories ──< clothing_items                   (1:N)
```

`users` ve `outfits` **hard delete** edilir ve `ON DELETE CASCADE`'e güvenir;
yalnızca `clothing_items` soft delete kullanır.

---

## 6. API Referansı

Taban adres: `http://localhost:3001/api`

> **İstek gövdeleri camelCase, yanıtlar snake_case.** Servisler `userId`, `categoryId`,
> `imageUrl` bekler; yanıtlar `RETURNING *`'dan geldiği için `user_id`, `category_id`,
> `is_favorite` döner. Arada serileştirme katmanı yoktur — frontend'de
> `src/lib/transformers.js` bu çeviriyi yapar.

### Kimlik doğrulama

**`/health`, `/auth/register` ve `/auth/login` dışındaki TÜM uçlar token ister.**
İstekler `Authorization: Bearer <token>` başlığıyla gelir; `authenticate` middleware
token'ı doğrulayıp `req.userId`'yi doldurur.

> **Kullanıcı kimliği asla istekten okunmaz.** Controller'lar `req.query.userId` /
> `req.body.userId` değil **yalnızca `req.userId`** kullanır — aksi hâlde bir kullanıcı
> başkasının id'sini göndererek onun verisine erişebilirdi. Servisler ayrıca kayıt
> sahipliğini doğrular ve başkasının kaydı için **404** döner (403 kaydın var olduğunu
> ele verirdi).

| Metod | Yol | Açıklama |
|---|---|---|
| `POST` | `/auth/register` | `{ name, email*, age, password* }` → `201 { user, token }` |
| `POST` | `/auth/login` | `{ email*, password* }` → `200 { user, token }` |
| `GET` | `/auth/me` | Token sahibinin kaydı |
| `POST` | `/auth/change-password` | `{ currentPassword*, newPassword* }` → `204` |

Parola en az 8 karakter, en fazla 72 bayt (bcrypt sınırı) olmalıdır; `bcrypt` ile
10 tur hash'lenir. Giriş hatalarında "kullanıcı yok" ile "şifre yanlış" **aynı** mesajı
döner (`E-posta veya şifre hatalı`) — hangi e-postaların kayıtlı olduğu sızmasın diye.

### Hata biçimi

Tüm hatalar `{ "error": "Türkçe mesaj" }` döner.

| Kod | Anlam |
|---|---|
| `400` | `ValidationError` — eksik/geçersiz alan, FK ihlali (`23503`) |
| `401` | `UnauthorizedError` — token yok/geçersiz/süresi dolmuş, ya da şifre hatalı |
| `404` | `NotFoundError` — kayıt yok **veya** başkasına ait |
| `409` | `ConflictError` — benzersizlik ihlali (`23505`), örn. tekrarlı e-posta |
| `500` | Beklenmeyen hata → `{ "error": "Sunucu hatası" }` |

### Health

| Metod | Yol | Açıklama |
|---|---|---|
| `GET` | `/health` | Sunucu + veritabanı durumu. DB kapalıysa `503` ve `status: "degraded"`. |

```json
{"status":"ok","uptime":99.14,"timestamp":"2026-08-18T07:29:16.208Z",
 "database":{"connected":true,"time":"2026-08-18T07:29:16.210Z"}}
```

### Categories (salt okunur)

| Metod | Yol | Açıklama |
|---|---|---|
| `GET` | `/categories` | Aktif kategoriler, `id` sırasına göre |
| `GET` | `/categories/:id` | Tek kategori. Sayı olmayan id → `400`, bulunamazsa `404` |

```json
{"id":1,"name":"Üst","icon":"shirt","is_active":true}
```

### Users

| Metod | Yol | Gövde / Parametre |
|---|---|---|
| `GET` | `/users/:id` | — |
| `POST` | `/users` | `{ name, email*, age }` |
| `PUT` | `/users/:id` | `{ name, email*, age, subscriptionTier }` |
| `DELETE` | `/users/:id` | → `204`; tercih/kıyafet/kombinleri CASCADE ile siler |

`email` zorunlu, küçük harfe çevrilir ve biçimi doğrulanır; tekrarı `409` döner.
`age` verilirse 0–120 arası tam sayı olmalıdır. `subscriptionTier` yalnızca
`free` veya `premium`. **Yanıtta `password_hash` bulunmaz.**

### Style Preferences

| Metod | Yol | Gövde / Parametre |
|---|---|---|
| `GET` | `/style-preferences?userId=` | Kayıt yoksa `404` |
| `PUT` | `/style-preferences` | `{ userId*, dailyStyle, colorPreference, priority, styleIcon, frequency }` |

`PUT` hem oluşturur hem günceller (upsert). Olmayan `userId` → `400`.

### Clothing Items

| Metod | Yol | Gövde / Parametre |
|---|---|---|
| `GET` | `/clothing-items?userId=*&categoryId=` | `categoryId` opsiyonel filtre; `created_at DESC` sıralı |
| `GET` | `/clothing-items/:id` | Silinmişse `404` |
| `POST` | `/clothing-items` | `{ userId*, categoryId*, name*, color, brand, season, imageUrl }` → `201` |
| `PUT` | `/clothing-items/:id` | `{ categoryId*, name*, color, brand, season, imageUrl }` |
| `DELETE` | `/clothing-items/:id` | **Soft delete** → `204` |
| `PATCH` | `/clothing-items/:id/favorite` | Favori durumunu tersine çevirir (atomik) |

```json
{"id":"58b9f6da-…","user_id":"e4553e3e-…","category_id":5,"name":"Küçük Omuz Çantası",
 "color":"Kahverengi","brand":"Mango","season":null,"image_url":null,
 "is_favorite":false,"is_deleted":false,"created_at":"…","updated_at":"…"}
```

### Outfits

| Metod | Yol | Gövde / Parametre |
|---|---|---|
| `GET` | `/outfits?userId=*` | Parçalarıyla birlikte, `created_at DESC` |
| `GET` | `/outfits/:id` | |
| `POST` | `/outfits` | `{ userId*, occasion, clothingItemIds*[] }` → `201` |
| `PUT` | `/outfits/:id` | `{ occasion, clothingItemIds }` — `clothingItemIds` verilmezse parçalara dokunulmaz |
| `DELETE` | `/outfits/:id` | Hard delete → `204` |
| `PATCH` | `/outfits/:id/favorite` | Favori toggle |
| `PATCH` | `/outfits/:id/worn` | `times_worn` +1 |

`clothingItemIds` en az bir parça içermeli, tekrar barındıramaz ve **yalnızca o kullanıcıya
ait, silinmemiş** parçalar olabilir — aksi hâlde `400`.

Yanıt, parçaları gömülü `items` dizisiyle döner. Silinmiş parçalar `JOIN` koşulunda
filtrelendiği için, tüm parçaları silinmiş bir kombin kaybolmaz — `items: []` ile döner:

```json
{"id":"c5c0e303-…","user_id":"e4553e3e-…","occasion":"Üniversite","is_favorite":false,
 "times_worn":0,"created_at":"…",
 "items":[{"id":"8bb81410-…","name":"Zara Oversize Beyaz Gömlek","category_id":1,
           "color":"Beyaz","image_url":null}]}
```

---

## 7. Geliştirme Rehberi

### Çalıştırma

```bash
# 1) Veritabanı (depo kökünden)
docker compose up -d                 # postgres 16, :5432
docker compose down                  # durdur (postgres_data volume korunur)

# 2) Backend (backend/ klasöründen)
cp .env.example .env                 # zorunlu; .env olmadan hiçbir şey çalışmaz
npm install
npm run dev                          # node --watch server.js, :3001

# 3) Frontend (frontend/ klasöründen)
npm install
npm run dev                          # vite dev sunucusu
npm run lint                         # oxlint — depodaki tek otomatik kontrol
npm run build
```

### Migration uygulama

**Migration runner yoktur, elle uygulanır.** Şema değişiklikleri `backend/src/db/migrations/`
altında **yeni** numaralı bir `.sql` dosyasına yazılır; uygulanmış bir migration düzenlenmez.

```bash
# Dosyayı önce container'a KOPYALAYIN. SQL'i Windows kabuğundan psql'e
# pipe etmek Türkçe karakterleri bozar ('Üst' bir kez '??st' oldu).
docker cp backend/src/db/migrations/002_style_preferences_unique_and_indexes.sql \
  dijitalgardirop-db-1:/tmp/m.sql
docker exec dijitalgardirop-db-1 psql -U postgres -d dijital_gardirop \
  -v ON_ERROR_STOP=1 -f /tmp/m.sql
```

### Android emülatöründe test etme

```bash
# frontend/ klasöründen
npm run build
npx cap sync android          # dist/ → android/app/src/main/assets/public
npx cap open android          # Android Studio'da aç, oradan emülatörde çalıştır
# veya doğrudan:
npx cap run android
```

**Backend'in host makinede çalışıyor olması gerekir** (`backend/` içinde `npm run dev`)
ve veritabanı ayakta olmalıdır (`docker compose up -d`).

**En sık düşülen tuzak — `localhost` emülatörde çalışmaz.** Android emülatörü kendi sanal
cihazıdır; `localhost` host makineyi değil **emülatörün kendisini** işaret eder. Host
makineye `10.0.2.2` özel alias'ı ile erişilir. Bu yüzden `src/lib/api.js` adresi platforma
göre seçer:

| Ortam | Adres |
|---|---|
| Web tarayıcı, iOS simülatörü | `http://localhost:3001` |
| Android emülatörü | `http://10.0.2.2:3001` |
| `VITE_API_BASE_URL` tanımlıysa | o değer (her ortamda önceliklidir) |

**Gerçek cihazda** (emülatör değil) `10.0.2.2` de çalışmaz; host makinenin yerel ağ IP'sini
`frontend/.env` içinde vermek gerekir:

```bash
# frontend/.env
VITE_API_BASE_URL=http://192.168.1.20:3001
```

Vite ortam değişkenlerini **build sırasında** gömer — değeri değiştirdikten sonra
`npm run build` + `npx cap sync android` tekrar çalıştırılmalıdır.

**HTTP'ye izin vermek için İKİ ayrı katman gerekir — biri eksikse istek sessizce
"Failed to fetch" döner:**

1. **İşletim sistemi (cleartext).** Android 9+ şifrelenmemiş HTTP'yi engeller (bu projede
   `targetSdk 36`). `android/app/src/main/res/xml/network_security_config.xml` yalnızca
   `10.0.2.2`, `localhost` ve `127.0.0.1` için istisna tanımlar; manifest'ten
   `android:networkSecurityConfig` ile bağlanır. Tüm HTTP'yi açan
   `usesCleartextTraffic="true"` bilinçli olarak tercih edilmedi.

2. **WebView (mixed content).** Capacitor'ün Android varsayılan şeması **`https`**'tir
   (`androidScheme`), yani uygulama sayfası `https://localhost` üzerinden servis edilir.
   HTTPS bir sayfadan HTTP adrese istek atmak *mixed content* sayılır ve WebView bunu
   varsayılan olarak reddeder. `capacitor.config.json` içindeki
   `android.allowMixedContent: true` bunu açar (Capacitor bunu
   `WebSettings.MIXED_CONTENT_ALWAYS_ALLOW`'a çevirir).

> **Chrome'da çalışıp uygulamada çalışmaması normaldir.** Emülatördeki Chrome ayrı bir
> uygulamadır ve adres çubuğuna `http://…` yazıldığında sayfa zaten HTTP origin'indedir —
> ne cleartext kısıtı ne de mixed content devreye girer. Yani `10.0.2.2:3001/api/health`
> adresinin Chrome'da açılması, uygulamanın da erişebileceği anlamına gelmez.

**Production'da** backend HTTPS ile sunulmalı; hem `allowMixedContent` hem de cleartext
istisnası kaldırılmalıdır.

Hangi adresin kullanıldığı açılışta konsola basılır; emülatörde
`adb logcat | grep "\[api\]"` veya Chrome'da `chrome://inspect` ile görülebilir:

```
[api] platform=android native=true base=http://10.0.2.2:3001/api
```

`npx cap sync` `AndroidManifest.xml` ve `res/xml/` altındaki dosyaları **ezmez**;
yalnızca `assets/public` içeriğini ve plugin listesini günceller.

### Test scriptleri

```bash
cd backend

# Kimlik doğrulama + yetkilendirme (48 kontrol). En kritik bölüm: bir kullanıcının
# BAŞKASININ verisine erişememesi.
node test-scripts/test-auth.js

# Tüm uçları uçtan uca doğrular (72 kontrol); kendi hesabını açıp sonunda siler.
node test-scripts/test-all-endpoints.js

# Auth öncesinden kalan, şifresi olmayan hesapları yönetir (varsayılan: salt okunur liste)
node test-scripts/migrate-passwordless-users.js
node test-scripts/migrate-passwordless-users.js --set-password <email> <sifre>
node test-scripts/migrate-passwordless-users.js --delete-empty

# Tek uca odaklı: POST + snake_case + GET doğrulaması
node test-scripts/test-clothing-items.js
node test-scripts/test-clothing-items.js --cleanup   # oluşturduğu kaydı sonda siler

# Test artıklarını temizler
node test-scripts/cleanup.js --dry-run               # önce neyin silineceğini göster
node test-scripts/cleanup.js                         # test parçaları + @example.com kullanıcıları
node test-scripts/cleanup.js --all --user <uuid>     # bir kullanıcının TÜM verisi
```

`test-all-endpoints.js` mutlu yolun yanı sıra doğrulama hatalarını (400), bulunamayan
kayıtları (404), benzersizlik ihlalini (409), soft delete davranışını ve `ON DELETE CASCADE`
zincirini kontrol eder. `cleanup.js` API üzerinden değil doğrudan veritabanına bağlanır;
test kullanıcıları `@example.com` deseniyle tanınır. Sunucu kapalıysa scriptler yığın izi
yerine anlaşılır bir mesaj basıp `1` ile çıkar.

**Not:** `backend/test-data.json` bir çalışma dosyasıdır; alan adları **camelCase** olmalıdır
(`userId`, `categoryId`). Bir kez snake_case yazıldığı için istek `400` dönmüştü.

### Windows tuzakları

Git Bash UTF-8'i her iki yönde de bozabilir:

- `curl -d '{"name":"Gömlek"}'` bozuk byte gönderir — kayıt veritabanına hatalı düşer.
- `.sql` dosyasını `psql`e pipe etmek seed verisini bozar (`Üst` → `??st` böyle oldu).
- Konsol **çıktısı** da güvenilir değildir; ekranda bozuk görünen `ö` tek başına hata kanıtı değildir.

Kodlama önemliyse kabuğu atlayın: API'yi Node `fetch` script'iyle sürün, migration'ları
`docker cp` ile kopyalayın. Görüntü hatasını gerçek bozulmadan ayırmak için byte karşılaştırın:

```sql
SELECT encode(name::bytea,'hex') FROM categories;
-- doğru UTF-8 'Ü' = c39c ; '3f3f' ise iki literal '?' saklanmış demektir
```

Ayrıca dosya yazarken PowerShell'e dikkat: `Out-File`/`>` genelde **BOM'lu** UTF-8 üretir,
`Set-Content` ise sistem ANSI kod sayfasını kullanır. Depoda şu an BOM'lu dosya yoktur;
öyle kalması için dosyaları düzenleme araçlarıyla veya Node ile yazın. Bir kaynak dosyada
`EF BF BD` (replacement karakteri) görürseniz bu gerçek bozulmadır — bir kez
`OutfitSuggestion.jsx` içinde oluşup elle düzeltildi.

### Doğrulama

Otomatik test yoktur. Doğrulama = `npm run lint` + uygulamayı/API'yi elle sürmek
(tarayıcı, `curl` veya tek kullanımlık Node `fetch` script'i). **Test komutu uydurmayın.**

---

## 8. Mimari Notlar ve Sözleşmeler

### Backend

```
routes/ → controllers/ → services/ → repositories/ → config/database.js (pg Pool)
```

**Route dosyası DI container'ıdır.** Nesneleri yalnızca orası kurar:

```js
const repository = new ClothingItemRepository(pool)
const service = new ClothingItemService(repository)
const controller = new ClothingItemController(service)
router.get('/clothing-items', (req, res) => controller.getAll(req, res))
```

Handler'lar ok fonksiyonuyla sarılmalıdır — `controller.getAll` doğrudan geçilirse `this` kaybolur.
Her yeni kaynak bu şekli izler; `Health*` ve `ClothingItem*` referans uygulamalardır.

Katman sorumlulukları:

- **Repository** — yalnızca SQL, her zaman parametreli. Hatayı loglayıp yeniden fırlatır.
  Satır yoksa `null` döner (fırlatmaz). Çok tablolu yazımlar (`OutfitRepository.create`)
  havuzdan client alıp `BEGIN`/`COMMIT`/`ROLLBACK` sarar ve `finally` içinde bırakır.
- **Service** — doğrulama ve iş kuralları. `ValidationError` / `NotFoundError` / `ConflictError`
  fırlatır. Update/delete öncesi varlık kontrolü yapar ki controller gerçek `404` alsın.
  Postgres hata kodları burada anlamlı HTTP sonuçlarına çevrilir: `23505` → 409, `23503` → 400.
  Alan uzunlukları `utils/validators.js` içindeki `FIELD_LIMITS` tablosuna göre denetlenir —
  aksi hâlde sınırı aşan değer `22001` ile 500'e düşer. Yeni bir VARCHAR kolonu eklerken
  limitini bu tabloya da yazın.
- **Controller** — ince HTTP adaptörü. Her metod servis çağrısını `try/catch`'e alır ve
  `this.handleError(error, res)`'e devreder.

Tüm controller'lar `BaseController`'dan türer; `handleError` fırlatılan `AppError` alt sınıfını
kendi `statusCode`'una, diğer her şeyi `500`'e çevirir. Alt sınıf constructor'ları `this`'e
dokunmadan önce `super()` çağırmalıdır.

**Auth katmanı.** `server.js` tek bir `AuthService` ve ondan türetilen tek bir
`authenticate` middleware kurar (token'ı imzalayan ve doğrulayan aynı örnek olmalı).
`authRoutes` bu yüzden diğerlerinden farklı olarak bir **fabrikadır**
(`createAuthRoutes(authService, authenticate)`). Yeni korumalı bir kaynak eklerken
`app.use('/api', authenticate, yeniRoutes)` deyip controller'da `req.userId` kullanın.

**Silinmemesi gerekenler:** `config/database.js` içindeki `pool.on('error')` dinleyicisi
(bkz. Aşama 5), `UserRepository` içindeki açık kolon listesi (bkz. Aşama 6b) ve
`UserRepository.findByEmailForAuth` / `findByIdForAuth`'un **yalnızca** AuthService
tarafından kullanılması — bunlar `password_hash` döndüren tek metodlardır, dönen nesne
asla doğrudan API yanıtına verilmemelidir.

Backend ayrı `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` değişkenleri okur.
**Kökteki** `.env.example` içindeki `DATABASE_URL` satırı mevcut kod tarafından kullanılmaz.

### Frontend

**API katmanı:** `src/lib/api.js` tek fetch noktasıdır. `request` yanıt `ok` değilse
gövdedeki `{ error }` mesajını okuyup fırlatır, böylece backend'in Türkçe hataları
kullanıcıya gösterilebilir. `204` için `null` döner.

**Kullanıcı kimliği:** `getCurrentUserId()` localStorage'daki `dg_user_id` değerini okur
(onboarding'de `POST /api/users` ile oluşturulan gerçek kullanıcı), yoksa sabit bir yedek
id'ye düşer. **Sabit değil fonksiyondur** — onboarding sonrası id değişir, bu yüzden her
çağrıda güncel değer okunmalıdır. Auth geldiğinde ikisi de kaldırılacak.

**Dönüştürücü:** `src/lib/transformers.js` snake_case → camelCase çevirisini ve
`category_id` → kategori **adı** eşlemesini yapar (ikon eşlemesi ada göre çalışır).
Masonry yüksekliği id'den deterministik türetilir.

**Veri çekme deseni:** Sayfalar `useEffect` içinde `Promise.all` ile paralel çeker;
`isStale` bayrağı geç gelen yanıtın state'i ezmesini önler; `isLoading` / `hasError`
durumları iskelet ve boş/hata ekranlarını sürer.

**Kalıcı durum:** `src/lib/onboarding.js` `dg_` önekli tüm localStorage anahtarlarının
tek sahibidir (onboarding bayrağı, `dg_user_id`, kullanıcı profili, anket cevapları).
`localStorage`'a doğrudan dokunmayın. **Tek doğru kaynak veritabanıdır**; localStorage
yalnızca hızlı erişim önbelleğidir (örn. Ana Sayfa karşılamasının ismi ilk boyamada
buradan gelir, sonra API yanıtıyla tazelenir).

**Onboarding kapısı:** `App.jsx` `showOnboarding` durumunu `isOnboardingCompleted()` ile
başlatır; true iken router/nav ağacı yerine `<Onboarding>` döner.

**İki navigasyon senkron tutulmalı:** `Navbar` (masaüstü, liste `sm:` altında gizli) ve
`BottomNav` (mobil, `sm:hidden`) ayrı bileşenlerdir, ayrı sekme dizileri vardır.
**Yeni üst seviye rota eklemek ikisini de düzenlemek demektir.** İçerik sarmalayıcısı
`pb-24 sm:pb-0` taşır; `ScrollToTopButton` aynı sebeple `bottom-24 sm:bottom-6` konumundadır.

Mobil sekme sayısı 5'e çıktığı için `BottomNav` kısa etiketler kullanır
("Kombin Öner" → "Öner", "Kombinlerim" → "Kombinler"); masaüstü `Navbar` tam adları gösterir.
Yeni sekme eklerken dar ekranda taşma olup olmadığını kontrol edin.

Üst seviye rotalar: `/`, `/gardirop`, `/kombin-oner`, `/kombinlerim`, `/profil`
(ayrıca `/kiyafet/:id` ve `/profil/*` alt sayfaları).

### Tasarım sistemi

Token'lar `src/index.css` içinde Tailwind v4'ün `@theme` bloğunda tanımlıdır —
**`tailwind.config.js` yoktur.**

- Renkler: `ivory` (sayfa zemini), `ink` (metin), `warm-gray` (yer tutucu yüzeyler),
  `dusty-rose` (vurgu), `burgundy` (birincil/aktif)
- Fontlar: `font-display` (Playfair Display — başlıklar, **daima italik**),
  `font-body` (Lora), `font-sans` (Inter — arayüz metni)
- Animasyonlar: `animate-fade-in`, `animate-page-fade`

Yeniden icat etmek yerine eşleşilmesi gereken kalıplar: `components/ui/Button.jsx` ile
tam genişlikte hap butonlar (`rounded-full`), `rounded-2xl border border-ink/10` kartlar,
sayfa başlıkları altında `h-px w-16 bg-dusty-rose` çizgi, büyük harf `tracking-[0.15em]`
mikro etiketler, seçili durum için `border-burgundy bg-burgundy/5 text-burgundy`.
Paylaşılan primitifler `components/ui/` altındadır.

Kategori → lucide ikon eşlemesi `src/lib/categoryIcons.js` içinde merkezidir ve
`001_initial_schema.sql` seed verisindeki kebab-case ikon adlarıyla hizalı tutulmalıdır.

### Geliştirici kaçış kapıları

`pages/Wardrobe.jsx` içinde boş durumları önizlemek için `DEV_FORCE_EMPTY` ve
`DEV_FORCE_EMPTY_CATEGORY` sabitleri bulunuyordu; API'ye geçişte kaldırıldılar
(boş durum artık gerçek veriyle veya ağ mock'uyla test edilir).
`Navbar`'daki `RotateCcw` butonu onboarding'i yeniden tetikler — **geçicidir**.

---

## 9. Değişiklik Günlüğü

> Bundan sonraki her çalışma buraya tarihiyle işlenir: eklenen özellikler, düzeltilen
> hatalar, alınan mimari kararlar. En yeni kayıt en üstte.

### 2026-08-19 — Kimlik doğrulama sistemi kuruldu (JWT + bcrypt)
- **Backend:** `bcrypt` (10 tur) ile parola hashleme, `jsonwebtoken` ile JWT.
  Yeni uçlar: `POST /auth/register`, `POST /auth/login`, `GET /auth/me`,
  `POST /auth/change-password`. `JWT_SECRET` ve `JWT_EXPIRES_IN` `.env`'den okunur;
  secret yoksa sunucu açılışta **bilinçli olarak patlar** (sessizce güvensiz çalışmasın).
- **`authenticate` middleware:** `Authorization: Bearer <token>` doğrulanır ve
  `req.userId` doldurulur. `/health` ve `/auth/register|login` dışındaki **tüm** uçlar
  (`categories`, `users`, `style-preferences`, `clothing-items`, `outfits`) bunun arkasında.
- **Kritik güvenlik kararı — kimlik artık istekten okunmuyor.** Controller'lar
  `req.query.userId` / `req.body.userId` yerine yalnızca `req.userId` kullanır. Ayrıca
  servisler kayıt sahipliğini doğrular; başkasının kaydı için **404** döner (403 kaydın
  var olduğunu ele verirdi). Bu, 15 ayrı kontrolle test edildi (`test-auth.js`).
- **Giriş hataları ayırt edilmiyor:** "kullanıcı yok" ve "şifre yanlış" aynı mesajı döner,
  böylece hangi e-postaların kayıtlı olduğu dışarıdan öğrenilemez.
- **Frontend:** `Login` (`/giris`) ve `Register` (`/kayit`) sayfaları, `ProtectedRoute`,
  `AuthLayout`. Akış yeniden düzenlendi: **Kayıt → 5 soruluk tarz anketi (`/tarz-anketi`)
  → Ana Sayfa**. Eski `Onboarding.jsx` ve `RegistrationStep.jsx` kaldırıldı.
- Token `dg_token` anahtarında; `api.js` tüm isteklere `Authorization` başlığını **tek
  yerden** ekler. `getCurrentUserId()` artık localStorage değil **token payload'ından** okur.
- Çıkış Yap gerçekten çalışıyor (token + profil önbelleği temizlenir → `/giris`),
  Şifre Değiştir gerçek uca bağlandı, `Navbar`'daki geçici `RotateCcw` butonu **kaldırıldı**.
- **Düzeltme (yarış durumu):** `isAuthenticated` bir state'ti; `setState` sonrası `/kayit`
  rotası `<Navigate to="/">` render edip `navigate('/tarz-anketi')`'yi eziyordu — kullanıcı
  kayıttan sonra ankete değil ana sayfaya düşüyordu. Oturum durumu artık **state değil,
  her render'da token'dan türetilen** bir değer.
- **Düzeltme (401 semantiği):** Şifre değiştirmede "mevcut şifre hatalı" 401 döner ve
  `api.js` bunu oturum düşmesi sanıp kullanıcıyı Login'e atıyordu. `keepSessionOn401`
  seçeneği eklendi: bu uçta 401 form hatasıdır, oturum sonlandırılmaz.
- **Migrasyon:** `test-scripts/migrate-passwordless-users.js` — `password_hash`'i NULL olan
  (auth öncesi) hesapları listeler; `--set-password` ile veriyi koruyarak şifre atar,
  `--delete-empty` ile yalnızca verisi olmayanları siler, `--delete-all --force` ile hepsini.
  Varsayılan davranış **salt okunurdur** (bu hesapların gerçek verisi olabilir).
- `test-all-endpoints.js` auth'a uyarlandı (72 kontrol), yeni `test-auth.js` eklendi
  (48 kontrol, ağırlıklı olarak veri izolasyonu).

### 2026-08-19 — Android'de "Failed to fetch": mixed content engeli kaldırıldı
- **Belirti:** Emülatörde Chrome'dan `http://10.0.2.2:3001/api/health` sorunsuz açılıyordu
  ama uygulama "Gardırobuna şu an ulaşılamıyor" veriyordu. Yani ağ, backend ve adres
  seçimi doğruydu; engel WebView katmanındaydı.
- **Kök sebep:** Capacitor'ün Android varsayılan şeması `https`. Uygulama sayfası
  `https://localhost` üzerinden servis edildiği için `http://10.0.2.2:3001` isteği
  **mixed content** sayılıyor ve WebView bunu varsayılan olarak reddediyor
  (`allowMixedContent` varsayılanı `false`; Capacitor bunu
  `WebSettings.MIXED_CONTENT_ALWAYS_ALLOW`'a çevirir).
- **Çözüm:** `capacitor.config.json`'a `android.allowMixedContent: true` eklendi.
  Cleartext izni (`network_security_config.xml`) tek başına yetmiyordu — **iki katman da
  gerekli**: OS seviyesinde cleartext, WebView seviyesinde mixed content.
- **Öğrenilen:** Chrome'da çalışması uygulamanın da erişeceği anlamına gelmez; Chrome ayrı
  bir uygulamadır ve orada sayfa zaten HTTP origin'indedir.
- Platform tespiti dayanıklılaştırıldı: `Capacitor.getPlatform()` birincil kaynak,
  çağrı hata verirse `window.androidBridge` köprüsüne düşer (try/catch ile sarılı).
- Açılış logu `DG_API` etiketiyle güçlendirildi; artık seçilen adresin yanında
  `platform`, `native`, `androidBridge`, `origin`, `protocol` ve env değeri de basılıyor
  (`adb logcat | grep DG_API`).
- **Not:** `capacitor.config.json` değişikliği APK'ya ancak **yeniden derlemeyle** girer;
  `npx cap sync` tek başına yetmez, Android Studio'da Run/Rebuild gerekir.

### 2026-08-19 — API adresi ortama duyarlı hale getirildi (Android emülatörü düzeltmesi)
- **Sorun:** `API_BASE_URL` `http://localhost:3001` olarak sabit kodlanmıştı. Android
  emülatöründe `localhost` emülatörün kendisidir, host makine değil — uygulama backend'e
  ulaşamayıp "Gardırobuna şu an ulaşılamıyor" gösteriyordu.
- `src/lib/api.js` içine `resolveApiOrigin()` eklendi; sıra: **`VITE_API_BASE_URL` →
  Android'de `10.0.2.2` → diğer her yerde `localhost`**. Adres tek yerde belirlenir,
  `API_ORIGIN` olarak dışa aktarılır. Platform tespiti `Capacitor.getPlatform()` ile yapılır.
- Açılışta `[api] platform=… native=… base=…` satırı konsola basılır — emülatör hata
  ayıklamasında hangi adresin kullanıldığını görmek için.
- **Ortam değişkeni desteği:** `frontend/.env.example` eklendi. Değişken **sunucu köküdür**
  (`/api` kod tarafından eklenir) ve sondaki `/` temizlenir. Gerçek cihazda test için
  host makinenin yerel IP'si buraya yazılır.
- **Android cleartext izni:** `network_security_config.xml` oluşturuldu ve manifest'e
  `android:networkSecurityConfig` ile bağlandı. Tüm HTTP'yi açan `usesCleartextTraffic`
  yerine yalnızca `10.0.2.2` / `localhost` / `127.0.0.1` için istisna tanımlandı;
  production'da HTTPS'e geçilip kaldırılacağı dosya içinde not edildi.
- **Doğrulama:** `npm run build` + `npx cap sync android` çalıştırıldı; web'de regresyon
  yok (gardırop gerçek veriyle yükleniyor, konsol temiz), Android yolu `window.androidBridge`
  enjekte edilerek sürülüp `base=http://10.0.2.2:3001/api` seçtiği doğrulandı.
  `cap sync`'in manifest ve `res/xml/` dosyalarını ezmediği teyit edildi.
- **Not:** Capacitor platformu `window.Capacitor` global'inden değil, native köprünün
  (`window.androidBridge`) varlığından tespit eder — emülatör davranışını taklit eden
  testler bunu bilmelidir.

### 2026-08-18 — Renk paleti genişletildi ve görsel seçiciye dönüştürüldü
- Renk listesi 6'dan **22'ye** çıkarıldı ve `src/lib/colors.js` modülüne taşındı
  (`CLOTHING_COLORS`, `DEFAULT_COLOR`, `getColorSwatch`). Her renk `name` + `hex` tutar;
  **veritabanına yazılan değer `name`'dir**, `hex` yalnızca arayüzde daireyi boyar.
  "Çok Renkli" tek renkle temsil edilemediği için `gradient` alanı kullanır.
- **Karar: dropdown yerine renk daireleri.** Bir moda uygulamasında "Pudra" ile "Pembe"
  farkı isimden değil renkten anlaşılır. 22 dairenin altına isim yazmak modalı aşırı
  uzatacağı için isimler `title`/`aria-label`'da tutuldu ve **seçili rengin adı** etiketin
  yanında gösterildi. Seçili daire burgundy çerçeve + halka ve onay ikonu alır.
- Yeni bileşen `components/ui/ColorPicker.jsx` — ileride kıyafet düzenleme ekranında
  da kullanılabilsin diye QuickAddModal'dan bağımsız yazıldı.
- Kategori alanı tam genişliğe alındı (renk artık kendi bölümünde).
- **Düzeltme (taşma):** `Modal` bileşeninde yükseklik sınırı yoktu; uzun içerik ekran
  dışına taşıyordu. `max-h-[90vh] overflow-y-auto` eklendi.
- **Düzeltme (kritik — modal ekran dışında konumlanıyordu):** Renk seçici sonrası yapılan
  ölçümde modalın `top` değerinin viewport'un tamamen dışında (640px ekranda `top: 817`)
  olduğu görüldü. Sebep: `App.jsx`'teki sayfa sarmalayıcısı `animate-page-fade` taşır ve
  animasyonun son karesi `transform: translateY(0)` bırakır; **transform'lu bir ata,
  `position: fixed` için yeni bir containing block yaratır**, dolayısıyla modal viewport
  yerine sayfa div'ine göre konumlanıyordu. Sayfa ne kadar kaydırılmışsa modal o kadar
  aşağıda kalıyordu. `Modal` artık `createPortal` ile `document.body`'ye render ediliyor.
  Bu hata renk seçiciyle gelmedi — daha önce de vardı, modal kısa olduğu için fark
  edilmemişti ve **tüm modalları** (silme onayları dahil) etkiliyordu.

### 2026-08-18 — Onboarding/profil veritabanına bağlandı, Kombinlerim sayfası eklendi
- **Onboarding artık veritabanına yazıyor:** "Gardırobuma Git" `POST /api/users` ile kullanıcıyı
  oluşturur, dönen id `dg_user_id` anahtarına yazılır, ardından `PUT /api/style-preferences`
  ile anket cevapları kaydedilir. E-posta çakışmasında (409) akış onboarding'de kalır,
  Türkçe hata mesajı ve "Bilgilerimi düzenle" bağlantısı gösterilir.
- **`CURRENT_USER_ID` sabiti kaldırıldı**, yerine `getCurrentUserId()` geldi: localStorage'daki
  gerçek kullanıcıyı okur, yoksa yedek id'ye düşer. Tüm sayfalar bunu kullanır.
- **Profil > Hesap Bilgilerim ve Tarz Tercihlerim** veritabanından okuyup yazıyor;
  localStorage yalnızca önbellek. `StylePreferences` henüz kayıt yoksa gelen 404'ü
  hata saymaz, önbellekle devam eder.
- **Yeni sayfa: Kombinlerim** (`/kombinlerim`) — kayıtlı kombinler, parçaları, tarihi
  (`Intl.DateTimeFormat('tr-TR')`), iyimser güncellemeli favori ve onaylı silme.
  Hem `Navbar` hem `BottomNav`'a eklendi; mobilde 5 sekme sığsın diye kısa etiketler kullanıldı.
- **Backend doğrulamaları:** `utils/validators.js` eklendi; tüm servislerde alan uzunluğu
  denetimi (`occasion` 50, `name` 200, `brand` 100, `season` 20, `imageUrl` 500 vb.) —
  daha önce sınırı aşan değer Postgres `22001` ile **500** dönüyordu, artık **400**.
- **Düzeltme:** `ClothingItemService` foreign key ihlalini (`23503`) yakalamıyordu; olmayan
  kategori/kullanıcı ile parça eklemek **500** dönüyordu, artık anlamlı **400**.
  (`OutfitService` ve `StylePreferenceService` bunu zaten yapıyordu.)
- **Yeni test scriptleri:** `test-all-endpoints.js` (77 kontrol, tüm uçlar + ilişkisel
  davranış + CASCADE) ve `cleanup.js` (`--dry-run` / `--all --user <uuid>`).

### 2026-08-18 — QuickAdd, favori ve silme gerçek API'ye bağlandı
- QuickAddModal kategorileri `GET /api/categories`'den çeker, `POST /api/clothing-items`
  ile kaydeder; kayıt sonrası Gardırop listesi iskelete dönmeden tazelenir.
- `ClothingCard` artık `item.isFavorite` değerini okuyor (önceden `useState(false)` ile
  başlıyordu, favori parçanın kalbi boş görünüyordu) ve `PATCH .../favorite` çağırıyor.
  İyimser güncelleme + hata halinde geri alma.
- Kıyafet Detay'a onaylı silme (`DELETE`) eklendi, silince Gardırop'a yönlendirir.
- **`src/data/clothing.js` silindi** — mock veri tamamen kalktı.

### 2026-08-18 — Kombin Öner sayfası API'ye bağlandı
- `OutfitSuggestion.jsx` gerçek gardıroptan kombin üretir; "Bu Kombini Kaydet" gerçek
  `POST /api/outfits` atar, kaydedilen kombin kalıcıdır.
- `api.js`'e POST desteği ve backend hata mesajını yakalama eklendi.
- **Düzeltme:** `Button` bileşenine `disabled:pointer-events-none disabled:opacity-60`
  eklendi — devre dışı butonda hover kuralı metni okunamaz hâle getiriyordu.
- **Karar:** Yapay `LOADING_DURATION` gecikmesi kaldırıldı.
- `occasion` girişi `maxLength={50}` ile sınırlandı (`VARCHAR(50)`).

### 2026-08-18 — Ana Sayfa API'ye bağlandı
- İstatistikler (Toplam Parça / Kombin / Favori) ve "Son Eklenenler" gerçek veriden.
- `fetchOutfits` eklendi; sabit `8 Kombin` değeri gerçek sayıyla değiştirildi.
- **Karar:** Hata durumunda istatistikler `0` yerine `–` gösterir.

### 2026-08-17 — Gardırop ve Kıyafet Detay API'ye bağlandı
- `src/lib/api.js` ve `src/lib/transformers.js` ortak altyapısı kuruldu.
- **Düzeltme:** `ClothingDetail` mock `Number(id)` araması yüzünden UUID'lerle kırılıyordu.
- **Karar:** Masonry yüksekliği id hash'inden türetilir (index'ten değil).

### 2026-08-17 — Kalan CRUD API'leri
- `categories`, `users`, `style-preferences`, `outfits` uçları eklendi.
- `BaseController` ve `AppError` / `ConflictError` altyapısı.
- **Düzeltme:** Kategori adlarındaki UTF-8 bozulması (`??st` → `Üst`) giderildi.
- **Güvenlik:** `UserRepository` `password_hash` sızdırmamak için açık kolon listesi kullanır.
- **Şema:** `002` migration — `style_preferences.user_id` UNIQUE + `outfit_items` FK index'leri.

### 2026-08-17 — Backend iskeleti, şema ve clothing-items CRUD
- Express + `pg` katmanlı mimari, `health` referans uygulaması.
- `001_initial_schema.sql` — 6 tablo, index'ler, kategori seed verisi.
- **Düzeltme:** `pool.on('error')` dinleyicisi — Postgres yeniden başladığında süreç çöküyordu.

### 2026-08-17 — Docker ve profil routing düzeltmeleri
- PostgreSQL 16 `docker-compose.yml`, `.env.example`, kök `.gitignore`.
- Profil alt sayfaları oluşturulup rotalara bağlandı; anket soruları ortak modüle çıkarıldı.

### 2026-08-15 — Onboarding, profil ve mobil navigasyon
- İlk açılış akışı (kayıt + 5 soruluk tarz anketi + karşılama), localStorage kalıcılığı.
- Profil sayfası, hesap yönetimi ekranları ve mobil bottom tab bar.

### 2026-08-11–13 — Frontend tasarım sistemi
- Tailwind v4 CSS-first token'ları, tipografi, renk paleti.
- Gardırop, Ana Sayfa, Kombin Öner, Kıyafet Detay sayfaları (mock veriyle).
- Skeleton loading, empty state, animasyonlar, kategori ikonları, arama, breadcrumb.
