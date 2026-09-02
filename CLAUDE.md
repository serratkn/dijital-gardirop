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
| Kombin önerisi (vektör benzerliğiyle akıllı eşleştirme) | Gerçek API'ye bağlı |
| Ana sayfa istatistikleri ve son eklenenler | Gerçek API'ye bağlı |
| İlk açılış tanıtım (intro carousel) ekranı | localStorage |
| İlk açılış onboarding akışı + tarz anketi | localStorage |
| Profil / hesap yönetimi ekranları | localStorage |
| Ten tonu analizi (selfie → uyumlu renkler) | Gerçek API'ye bağlı, **isteğe bağlı** |
| Mobil uygulama (Android, Capacitor) | Kurulu |

---

## 2. Teknoloji Yığını

### Depo yapısı

Kökte üç bağımsız parça var; **monorepo aracı yok** — her biri kendi klasöründen çalıştırılır.

| Yol | Ne |
|---|---|
| `frontend/` | Vite + React 19 SPA |
| `backend/` | Express + `pg` REST API |
| `docker-compose.yml` | pgvector/pgvector:pg16 (Postgres 16 + pgvector uzantısı, yerel geliştirme) |

Kökteki `package.json` yalnızca artık Capacitor bağımlılıkları içerir, script'i yoktur —
**yok sayın**. Gerçek Capacitor yapılandırması `frontend/capacitor.config.json` içindedir
(`appId: com.serra.digitalgardirop`).

### Frontend

React 19, Vite 8, Tailwind v4, react-router-dom 7, lucide-react (ikonlar),
html-to-image (kombin paylaşım görseli), Capacitor 8 (Android paketleme),
`@capacitor/camera` (fotoğraf çekme), `@capacitor/filesystem` + `@capacitor/share`
(Android'de kombin paylaşım görselini native paylaşım menüsüyle paylaşma).
Lint: **oxlint** (depodaki tek otomatik kontrol).

### Backend

Express 4, `pg` (PostgreSQL sürücüsü), `cors` (sınırlı origin listesiyle),
`helmet` (güvenlik başlıkları), `express-rate-limit` (auth + Gemini uçları için
hız sınırlama), `dotenv`, `@google/genai` (Gemini: görsel analizi + embedding),
`@aws-sdk/client-s3` (Cloudflare R2 — kıyafet fotoğrafları), `bcrypt`,
`jsonwebtoken`, `multer`. CommonJS (`require`).

### Veritabanı

**Yerel geliştirme:** PostgreSQL 16 + **pgvector uzantısı**, Docker Compose ile
ayağa kalkar (imaj: `pgvector/pgvector:pg16`, resmi `postgres:16`'nın üzerine
pgvector ekleyen bir varyant). Container adı: `dijitalgardirop-db-1`. Kalıcılık
`postgres_data` adlı named volume ile sağlanır.

**Production: Neon** (bkz. §9, 2026-08-28 "Render'dan Neon'a geçiş" kaydı).
Render'ın ücretsiz Postgres'i 30 gün sonra otomatik siliniyordu — bu risk
kapatıldı, veritabanı artık Neon'un kalıcı ücretsiz katmanında. Bağlantı
`DB_SSL=true` ile TLS üzerinden kurulur; sertifika doğrulaması **açıktır**
(`rejectUnauthorized` kapatılmadı) — bkz. `backend/src/config/database.js` ve
`backend/certs/neon-ca-bundle.pem`. Vektör deposu (pgvector) AYNI veritabanının
içinde olduğu için ayrıca taşınmasına gerek kalmadı.

**Vektör depolama AYRI BİR SERVİS DEĞİLDİR** — `clothing_item_embeddings`
tablosu bu VERİTABANININ İÇİNDE durur (bkz. §9, 2026-08-27 "ChromaDB'den
pgvector'a geçiş" kaydı). Daha önce ayrı bir ChromaDB container'ı vardı ama bu
hiçbir zaman production'a (Render) taşınmamıştı — yalnızca yerel Docker'da
çalışıyordu; canlı sitede "akıllı" kombin eşleştirmesi bu yüzden hep sessizce
rastgele seçime düşüyordu. Taşıma bunu kapattı ve ayrıca ikinci bir servisi
ayakta tutma/kalıcı disk sağlama yükünü ortadan kaldırdı. Embedding'ler yine
TÜRETİLMİŞ veridir (`ai_analysis`'ten üretilir) ve her zaman yeniden
üretilebilir (`test-scripts/create-embeddings.js`) — bu ilke değişmedi,
yalnızca depolandığı yer değişti.

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

- **Gardırop** — listeleme, kategori filtresi, arama, **favori filtresi** (kategori pilleriyle
  birlikte çalışan bağımsız bir anahtar; Ana Sayfa'daki "Favori" kartı artık doğrudan
  `?favori=1` ile buraya açılır), parça ekleme (QuickAddModal), favori,
  temiz/kirli işaretleme (kirli parçalar listede kalır, yalnızca kombin önerisi dışında tutulur)
- **Ana Sayfa** — gerçek istatistikler (parça/kombin/favori) ve son eklenen 4 parça;
  istatistik kartları tıklanabilir (Gardırop / Kombinlerim)
- **Kombin Öner (RAG)** — rastgele bir "başlangıç parçası" seçilir, pgvector'dan o
  parçaya en yakın adaylar DİĞER kategorilerden çekilir ve kombin bunlardan kurulur.
  Temiz/kirli ve hava durumu filtreleri adaylara da uygulanır; bir kategoride vektör
  adayı yoksa **yalnızca o slot** sessizce rastgele seçime düşer. Vektör yolu
  kullanılabildiyse kartların üstünde **"Tarzına göre seçildi"** rozeti çıkar,
  rastgeleye düşüldüyse çıkmaz. Kalıcı kaydetme ve Ana Sayfa'daki hızlı kombin
  kartlarından doğrudan açılma aynen çalışır
- **İsteğe bağlı makyaj önerisi** — dört kombin kartının altında, **kapalı başlayan**
  bir bölüm başlangıç parçasına vektör uzayında en yakın TEMİZ makyaj ürününü önerir.
  Bölüm yalnızca böyle bir ürün gerçekten bulunduğunda render edilir; makyajı olmayan
  ya da vektör deposuna ulaşılamayan kullanıcı düğmeyi bile görmez. **Bu kategoride rastgele
  geri düşüş YOKTUR.** Bölüm açıkken kaydedilen kombine makyaj da dahil edilir,
  kapalıyken dört parça kaydedilir
- **Katmanlama — koşullu 5. slot (Dış Giyim)** — hava **gerçekten soğukken**
  (<10°C) başlangıç parçasına vektör uzayında en yakın TEMİZ bir mont/kaban
  bulunursa, doğrudan (açılır bir bölüm olmadan) **5. kart** olarak ana
  ızgaraya eklenir ve kaydedilen/paylaşılan kombine otomatik dahil olur. Hava
  sıcak/ılıksa ya da bilinmiyorsa slot hiç denenmez; uygun dış giyim yoksa
  sessizce atlanır — **rastgele geri düşüş yoktur** (Makyaj'la aynı ilke)
- **Kombinlerim** — kayıtlı kombinler; parçaları, tarihi, favori, **"Bugün Giydim"**
  (`times_worn` sayacını atomik artırır) ve silme işlemleriyle
- **Kıyafet Detay** — görüntüleme, favori, onaylı silme, fotoğraf yönetimi,
  **düzenleme** (isim/kategori/renk/sezon/temiz-kirli; fotoğraf bu akışın DIŞINDA,
  ayrı bir mekanizma), **o parçanın geçtiği kombinlerin listesi** ve
  **"Buna Benzer Diğer Parçalar"** (aynı kategoriden en yakın 4 komşu; benzer
  parça yoksa bölüm hiç görünmez)
- **Otomatik AI analizi** — bir parçaya fotoğraf yüklendiğinde Gemini, **arka planda**
  (kullanıcı beklemeden) kategoriye özgü bir şemayla analiz eder; sonuç
  `clothing_items.ai_analysis` (JSONB) kolonuna yazılır ve Kıyafet Detay'daki
  **"Bu Parça Hakkında"** bölümünde gösterilir. Analiz başarısız olursa kolon NULL
  kalır, kıyafet ekleme akışı **hiç etkilenmez**. Panelin altındaki
  **"Yeniden Analiz Et"** düğmesi analizi elle tazeler (fotoğraf değiştirildiyse
  hatırlatma da çıkar); hata hâlinde eski analiz olduğu gibi korunur
- **Vektör veritabanı (pgvector)** — analiz tamamlanınca parçanın özeti Gemini
  embedding'ine çevrilip `clothing_item_embeddings` tablosuna yazılır (aynı
  Postgres, ayrı bir servis değil). İki okuma ucu da artık ÜRÜN AKIŞINDA:
  `GET /clothing-items/:id/companions` Kombin Öner'i besler (kategoriler arası),
  `GET /clothing-items/:id/similar` Kıyafet Detay'daki "Buna Benzer Diğer
  Parçalar" bölümünü besler (aynı kategori içinde)
- **Kombin paylaşımı** — Kombin Öner'deki öneri ve Kombinlerim'deki her kombin,
  Instagram Story oranında (1080×1920) bir PNG olarak indirilebilir; görsel
  **daima açık mod** renklerindedir
- **Karanlık mod** — Profil > Görünüm'den açılır/kapanır; tercih `dg_theme`'de saklanır,
  ilk açılışta sistem tercihi (`prefers-color-scheme`) varsayılan olur
- **Onboarding** — kullanıcıyı `POST /api/users` ile oluşturur, tarz anketini
  `PUT /api/style-preferences` ile kaydeder; e-posta çakışmasında (409) anlamlı mesaj gösterir
- **Profil > Hesap Bilgilerim / Tarz Tercihlerim** — veritabanından okur ve günceller
- **Ten tonu analizi (isteğe bağlı)** — Profil > "Ten Tonu Analizim". Kullanıcı bir
  selfie yükler, Gemini ten tonunu (Sıcak/Soğuk/Nötr), yakışan 6-8 rengi, kaçınılacak
  renkleri ve metal tonunu döndürür; sonuç renk daireleriyle gösterilir. Yeniden
  analiz ve silme mümkün. **Yüz tespit edilemezse hiçbir şey kaydedilmez**, kullanıcı
  "daha net bir fotoğrafla tekrar dene" yönlendirmesi alır. Analiz varsa Kombin
  Öner'de uyumlu parçaların altında küçük bir **"✓ Ten tonuna uygun"** işareti çıkar
  (yalnızca bilgi; kombin mantığına karışmaz)
- **Profil > Gardırop İstatistiklerim** — kategori dağılımı, en çok kullanılan renk,
  en çok oluşturulan kombin durumu, favori sayısı ve temiz/kirli oranı; tamamı
  `GET /users/:id/stats` ile veritabanında hesaplanır
- **Premium sınırları** — ücretsiz planda 30 parça / 10 kombin sınırı GERÇEKTEN
  uygulanır (`402`); Profil > Premium kartı gerçek plan + kullanım sayısını gösterir,
  "Premium'a Geç" gerçek bir sayfaya (`/profil/premium`) gider (ödeme akışı henüz yok)
- **Şifre sıfırlama** — Login'deki "Şifremi Unuttum?" ile e-posta üzerinden (Resend)
  tek kullanımlık, süreli bir bağlantı gönderilir; başarılı sıfırlamada tüm oturumlar düşer
- **Bildirimler** — Profil > Bildirimler artık gerçek: kirli işaretli parçaları listeler
  ve (kullanıcının şehri varsa) hava gerçekten soğukken bir uyarı gösterir; ikisi de
  yoksa "her şey yolunda" der. **Push/anlık bildirim DEĞİLDİR** — yalnızca sayfa
  açıldığında var olan veriden hesaplanan bir özet
- **Yardım & Destek** — Profil > Yardım & Destek artık gerçek: beş soruluk bir SSS
  (native `<details>`/`<summary>` ile açılır-kapanır, ek state/kütüphane yok) ve
  bir "Bize Ulaş" mailto kartı. Uygulamadaki son `ComingSoon` yer tutucusuydu;
  kaldırıldı
- **Kullanım başına maliyet** — parçaya isteğe bağlı bir satın alma fiyatı eklenir;
  Kıyafet Detay'da "kullanım başına X ₺" (fiyat / o parçanın geçtiği TÜM kombinlerin
  toplam giyilme sayısı) gösterilir. Fiyat yoksa ya da parça hiç giyilmediyse bölüm
  hiç görünmez ya da nazik bir yönlendirme çıkar
- **Backend** — 6 kaynak için tam CRUD, transaction'lı kombin yazımı, tipli hata yönetimi,
  alan uzunluğu ve foreign key doğrulamaları

### Eksikler ve bilinen sınırlamalar

| Konu | Durum |
|---|---|
| **Token'lar localStorage'da** | Access VE refresh token ikisi de `localStorage`'da (`dg_token`/`dg_refresh_token`). XSS durumunda okunabilir. httpOnly cookie daha güvenli olurdu ama Capacitor WebView'de oturum yönetimini karmaşıklaştırır (Android'de ayrı origin/scheme, native isteklerle cookie paylaşılmaması); bilinçli ödünleşme. Access token artık KISA ömürlü (15dk-1sa) olduğu için XSS'in okuyabileceği pencere daha dar; refresh token çalınırsa da rotasyon (bkz. §8) meşru sahibinin bir sonraki sessiz yenilemesinde çalıntı kopyayı geçersiz kılar. |
| **Şifre sıfırlama e-postası GERÇEK bir kullanıcıya denenmedi** | Akış uçtan uca kuruldu (bkz. §8 "Şifre sıfırlama sistemi") ama Resend sandbox kısıtı (`onboarding@resend.dev` yalnızca hesap sahibine gönderebilir) yüzünden gerçek gönderim özel bir alan adı doğrulanana kadar test edilemedi; token üretimi/doğrulama/sıfırlamanın kendisi gerçek ve doğrulandı. |
| **E-posta doğrulama yok** | `email_verified` kolonu var ama hep `false`; doğrulama akışı kurulmadı. |
| **Ödeme sağlayıcısı entegrasyonu yok** | `subscription_tier` artık GERÇEKTEN uygulanıyor (bkz. §8 "Premium sınırları") ama kullanıcıyı `free`'den `premium`'a geçiren bir ödeme akışı (Stripe vb.) yok — "Premium'a Geç" düğmesi şu an dürüstçe "yakında" diyen bir sayfaya gider. |
| **Çoklu cihaz oturum yönetimi yok** | Kullanıcı başına TEK bir aktif refresh token vardır (`users` tablosunun kendi satırında, ayrı bir "sessions" tablosu değil). Yeni bir cihaz/tarayıcıda giriş yapmak ÖNCEKİ refresh token'ı geçersiz kılar (üzerine yazar) — o cihazdaki oturum, access token'ı süresi dolana kadar (15dk-1sa) çalışmaya devam eder ama sonraki sessiz yenilemesi başarısız olur ve Login'e düşer. Bilinçli bir sınırlama (bkz. §8, migration `007`). |
| **Kıyafet fotoğrafları KISMEN kalıcı hale getirildi (Cloudflare R2)** | `R2_*` env değişkenleri tanımlıysa yeni yüklenen fotoğraflar R2'ye de yansıtılır ve `image_url` R2'nin genel adresini taşır — Render'ın ephemeral diskine bağımlılık ortadan kalkar (bkz. §8 "Fotoğraf depolama"). Tanımlı DEĞİLSE (yerel geliştirme, ya da R2 henüz kurulmadıysa) davranış eskisi gibidir: yalnızca `backend/uploads/` altına yazılır, token'sız `/uploads` yolundan servis edilir. **Selfie'ler bu kapsamda DEĞİL** — hâlâ yalnızca yerel diskte, bilinçli bir sınır (bkz. §8). Var olan yerel fotoğraflar `migrate-photos-to-r2.js` ile geriye dönük taşınabilir. |
| **Fotoğraf boyutlandırma yok** | Yüklenen görsel olduğu gibi saklanır; küçük resim (thumbnail) üretilmez. Native tarafta Capacitor `width: 1600` ile ön küçültme yapar, web'de böyle bir sınır yoktur. |
| **Selfie'ler R2'ye taşınmadı, hâlâ yalnızca yerel diskte** | Kıyafet fotoğrafları R2'ye yansıtılıyor (bkz. §8) ama selfie'ler BİLEREK bu kapsamın dışında bırakıldı: kıyafet fotoğrafları herkese açık/token'sız servis ediliyor (R2'nin genel URL modeliyle bire bir örtüşüyor), selfie'ler ise özel/token'lı bir uçtan servis ediliyor — R2'nin genel bucket'ını selfie için kullanmak bu güvenlik modelini kırardı. Doğru çözüm (özel bucket + imzalı URL ya da backend proxy) ayrı bir iştir. |
| **Cloudflare R2 gerçek bir hesapla uçtan uca denenmedi** | Kod tarafı "yapılandırılmamış" durumda tam regresyonla doğrulandı (bkz. §8 "Fotoğraf depolama", `test-storage.js`) ama gerçek bir R2 hesabı/bucket/API token'ı henüz oluşturulmadı — asıl akış (yükle → R2'de gerçekten var mı → sil → gerçekten kalkıyor mu) ve bucket'ın CORS ayarı (paylaşım görseli akışının `fetch` ile fotoğrafı `data:` URI'ye çevirmesi için gerekli) henüz gözlemlenmedi. |
| **Android paylaşım akışı gerçek cihaz/emülatörde henüz DENENMEDİ** | Kod tarafı tamamlandı: `downloadBlob` artık `Capacitor.isNativePlatform()` ile dallanıyor, Android'de Filesystem + Share ile native paylaşım menüsünü açıyor (bkz. §8). Bu makinede yerel `./gradlew` çağrısı, ortamdaki JDK sürümleriyle (26 ve Android Studio JBR 25) Gradle 8.14.3 uyumsuzluğu yüzünden çalışmıyor (`Unsupported class file major version`) — bu, koddan bağımsız bir ortam sorunu. Doğrulama şu ana kadar yalnızca **kaynak kod seviyesinde** yapıldı (Capacitor'ın `SharePlugin`/`FilesystemPlugin` Android kaynağı okunarak `Directory.Cache` + mevcut `FileProvider` yapılandırmasının doğru çalışacağı doğrulandı) ve **web regresyonuyla** (`<a download>` yolunun bozulmadığı kanıtlandı). Gerçek bir Android Studio/emülatör çalıştırması hâlâ gerekiyor. |
| **Gemini ücretsiz kotası günde 20 istek** | Ölçüldü (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit 20, `gemini-3.6-flash`). Kota dolduğunda analiz sessizce atlanır ve parça analizsiz kalır; **kendiliğinden yeniden deneyen bir mekanizma yoktur** — `analyze-existing-items.js --uygula` ertesi gün elle çalıştırılır. Gerçek kullanım ücretli plan ister. |
| **Fotoğraf değişince analiz KENDİLİĞİNDEN güncellenmez** | Maliyet koruması "dolu `ai_analysis` varsa tekrar analiz etme" der. Artık **elle tetiklenebiliyor**: Kıyafet Detay'daki "Yeniden Analiz Et" düğmesi (`POST /clothing-items/:id/analyze`) ve fotoğraf değiştirildiğinde çıkan hatırlatma. Otomatik yapılmıyor çünkü her çağrı gerçek para harcıyor. |
| **Öneri kalitesi indekslenmiş parça sayısına bağlı** | Vektör eşleştirmesi yalnızca `ai_analysis` (dolayısıyla fotoğrafı) olan parçalar için çalışır. Analizsiz bir gardıropta Kombin Öner sessizce eskisi gibi rastgele seçim yapar ve rozet hiç görünmez — hatalı değil ama "akıllı" da değildir. Toplu doldurma `analyze-existing-items.js` + `create-embeddings.js` ile elle yapılır. |
| **Durum (occasion) vektör aramasına GİRMİYOR** | "Üniversite" ile "Özel Davet" aynı adayları getirir; durum yalnızca kaydedilen kombinin etiketidir. Başlangıç parçası rastgele seçildiği için sonuç yine de her seferinde değişir. Durumu prompt'a/sorguya katmak ayrı bir aşamanın işi. |
| **`variantDepth` moodContext'i saymaz** | "Başka Öneri Göster" derinliği hâlâ HAM aday sayısına bakar; `preferAvoidingKeywords`/`preferFormalShoes` bir kategoriyi daralttığında (elemeden, yalnızca önceliklendirerek) gerçek "yeni ve anlamlı" varyant sayısı bu tahminden az olabilir. Zararsız (modulo indeksleme sınır içinde kalır) ama "Başka Öneri Göster" bazen bir varyantı bir kez tekrarlayıp SONRA yeni bir başlangıç parçasına geçebilir. `variantDepth`'i mood-farkında yapmak eklenen karmaşıklığa değmedi, bilinçli olarak dokunulmadı. |
| **Embedding silme kıyafet silmeyle AYNI transaction'da DEĞİL** | Aynı veritabanında olsalar da (pgvector geçişinden sonra) `ClothingItemController.delete` vektörü AYRI, await edilmeyen bir çağrıyla siler (bkz. §8) — bu çağrı başarısız olursa öksüz bir embedding kalabilir (soft delete `ON DELETE CASCADE`'i tetiklemez). `/similar` bunu okurken Postgres'ten doğrular (silinmiş parça yanıta düşmez) ve `cleanup.js` öksüzleri toplu siler. |
| **Embedding modeli değişirse tablo geçersiz olur** | Farklı modellerin vektörleri aynı uzayda değildir (ayrıca 3072'den farklı bir boyut, migration'daki `vector(3072)` tanımının güncellenmesini de gerektirir). Model değiştirildiğinde `create-embeddings.js --sifirla --uygula` çalıştırılmalıdır; bunu hatırlatan otomatik bir kontrol yok. |
| **Makyaj önerisi durumdan (occasion) bağımsız** | Öneri yalnızca başlangıç parçasına olan vektör yakınlığına bakar; "Spor" ile "Özel Davet" aynı ürünü getirebilir. Aynı sınırlama kombinin kendisinde de var. |
| **Makyaj önerisi tek ürün** | Bölüm en yakın TEK ürünü gösterir (havuz derinliği "Başka Öneri Göster" ile ilerler). Birden fazla ürünü aynı anda öneren bir "makyaj seti" akışı yok. |
| **Benzer parçalar durumdan ve renk/stil ağırlığından bağımsız** | Sıralama yalnızca embedding yakınlığına bakar; "aynı renk olsun" ya da "farklı stil öner" gibi bir ağırlıklandırma yok. |
| **Benzer parçalar yalnızca indekslenmiş parçalar arasında** | Analizi olmayan parça ne kaynak ne sonuç olabilir; o parçada bölüm hiç görünmez. Toplu doldurma `analyze-existing-items.js` + `create-embeddings.js` ile elle yapılır. |
| **Ten tonu analizi GERÇEK selfie ile denenmedi** | Elde gerçek bir selfie olmadığı için doğrulama sentetik bir portre çizimiyle yapıldı (Gemini bunu kabul etti ve çizilen sıcak paleti doğru okudu: "Sıcak / Açık buğday teni"). Gerçek bir fotoğrafta sonucun kalitesi ölçülmedi. |
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
| `city` | VARCHAR(100) | Hava durumu için; **opsiyonel**, boşsa hava durumu hiç sorgulanmaz |
| `password_hash` | VARCHAR(255) | **API yanıtlarında asla dönmez** |
| `refresh_token_hash` | VARCHAR(500) | bcrypt(refresh token) — `password_hash` ile AYNI kural, ham token asla saklanmaz. **NULL = aktif oturum yok** (çıkış yapılmış/hiç giriş yapılmamış). `SAFE_COLUMNS` DIŞINDA |
| `refresh_token_expires_at` | TIMESTAMP | Bu tarihten sonra reddedilir. Her başarılı `/auth/refresh` bunu `NOW() + REFRESH_TOKEN_EXPIRES_IN` olarak YENİLER (kayan pencere). `SAFE_COLUMNS` DIŞINDA |
| `skin_tone_analysis` | JSONB | Gemini ten tonu analizi. **NULL = kullanıcı selfie yüklemedi** (özellik isteğe bağlı). `SAFE_COLUMNS` DIŞINDA |
| `skin_tone_photo_url` | VARCHAR(500) | Selfie yolu (göreli). **HASSAS** — yalnızca sahibine, yalnızca kendi ucundan döner. `SAFE_COLUMNS` DIŞINDA |
| `subscription_tier` | VARCHAR(20) | `'free'` — `free` \| `premium`. Artık GERÇEKTEN uygulanır (bkz. §8 "Premium sınırları", migration yok — kolon Aşama 1'den beri vardı, yalnızca hiç okunmuyordu) |
| `reset_token_hash` | VARCHAR(255) | bcrypt(şifre sıfırlama token'ı) — `refresh_token_hash` ile AYNI kural, ham token asla saklanmaz. **NULL = bekleyen bir sıfırlama isteği yok**. Migration `009`. `SAFE_COLUMNS` DIŞINDA |
| `reset_token_expires_at` | TIMESTAMP | Bu tarihten sonra reddedilir (varsayılan 1 saat, `PASSWORD_RESET_EXPIRES_IN`). Migration `009`. `SAFE_COLUMNS` DIŞINDA |
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
| `name` | VARCHAR(50) | `Üst`, `Alt`, `Elbise`, `Ayakkabı`, `Çanta`, `Makyaj`, `Dış Giyim` (migration `008`) |
| `icon` | VARCHAR(50) | lucide adları: `shirt`, `panel-bottom`, `triangle`, `footprints`, `handbag`, `sparkles`, `snowflake` — **frontend'de programatik olarak OKUNMAZ**, yalnızca belgeleyici (ikon eşlemesi `categoryIcons.js`'te isme göre elle tanımlı) |
| `is_active` | BOOLEAN | `true` — okumalar bunu filtreler |

### `clothing_items`
| Kolon | Tip | Not |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID → `users(id)` | ON DELETE CASCADE, **index'li** |
| `category_id` | INTEGER → `categories(id)` | |
| `name`, `color`, `brand`, `image_url` | VARCHAR | |
| `season` | VARCHAR(20) | `Yaz` \| `Kış` \| `İlkbahar-Sonbahar` \| `Tüm Sezon`. **NULL = her mevsim uygun** |
| `is_favorite` | BOOLEAN | `false` |
| `is_clean` | BOOLEAN | **NOT NULL**, `true` — kombin önerisi yalnızca `true` olanlardan seçer |
| `is_deleted` | BOOLEAN | `false` — **soft delete**, her okuma filtreler |
| `ai_analysis` | JSONB | Gemini otomatik analizi. **NULL = henüz analiz edilmedi veya analiz başarısız oldu** — kıyafet akışı buna hiç bağlı değildir |
| `purchase_price` | NUMERIC(10,2) | Kullanım başına maliyet (cost-per-wear) için. **NULL = fiyat girilmedi**. Migration `010`. `PUT`'ta gönderilmezse mevcut değer korunur (`isClean` ile AYNI ilke); `null` göndermek BİLEREK temizler |
| `created_at` / `updated_at` | TIMESTAMP | |

`ai_analysis` biçimi (bkz. `GeminiService.analyzeClothingItem`):

```json
{"sema":"canta","model":"gemini-3.6-flash","analiz_tarihi":"2026-08-21T…Z",
 "gardirop_kategorisi":"Çanta",
 "veri":{"alt_kategori":"El Çantası","renk":"Siyah","boyut":"Orta",
         "uyumluluk":{"ten_tonu":["…"]},"genel_aciklama":"…"}}
```

> **JSONB anahtar SIRASINI KORUMAZ** (uzunluk + bayt sırasına göre yeniden dizer).
> Bu yüzden arayüzdeki gösterim sırası ayrı tanımlıdır:
> `AiAnalysisPanel.jsx > ALAN_ETIKETLERI`. Yeni alan eklenirken oraya da yazılmalıdır.

Migration `005` ayrıca **kısmi bir index** ekler
(`ai_analysis IS NULL AND image_url IS NOT NULL AND is_deleted = false`):
"analiz bekleyenler" sorgusu tablo taramasına düşmesin diye. Analiz edilmiş
satırlar index'e hiç girmez, index küçük kalır.

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

### `clothing_item_embeddings` — vektör deposu (pgvector, migration `011`)
| Kolon | Tip | Not |
|---|---|---|
| `clothing_item_id` | UUID PK → `clothing_items(id)` | ON DELETE CASCADE (yalnızca HARD DELETE'te tetiklenir; parçalar normalde soft delete olduğu için gerçek temizlik `ClothingItemController.delete`'in `vectorService.removeItem` çağrısına bağlıdır) |
| `user_id` | UUID | **DENORMALİZE** — ChromaDB'nin metadata deseninin aynısı, her sorguda `clothing_items`'a JOIN atmamak için |
| `category_id` | INTEGER | **DENORMALİZE**, aynı gerekçe. Parça yeniden kategorilendirilirse bu kolon YENİDEN İNDEKSLEMEYE kadar bayatlar — bilinen, ChromaDB döneminden kalan bir sınır |
| `embedding` | vector(3072) | `gemini-embedding-001`e sabit boyut. Embedding modeli değişirse bu boyut da (ve migration'daki tanım) değişmeli |
| `document` | TEXT | Embedding'in üretildiği cümle (`VectorService.buildSummaryText`) — neyin embed edildiğini sonradan okumak için |
| `embedding_model` / `sema` | VARCHAR | Teşhis amaçlı, sorgularda filtre olarak kullanılmaz |

**Bilinçli olarak YOK: bir ANN index'i (ivfflat/hnsw).** Kişisel bir gardırop
kullanıcı başına onlarca/yüzlerce parça taşır; `user_id` ile daraltılmış birkaç
yüz satır üzerinde sıralı kosinüs taraması (`<=>` operatörü) milisaniyeler
sürer — bu ölçekte bir ANN index'i gereksiz karmaşıklık olurdu (ayrıca
pgvector'ın HNSW index'i varsayılan olarak 2000 boyutla sınırlıdır, 3072
boyutlu bu embedding'ler ek yapılandırma isterdi). İndeksler yalnızca
`(user_id)` ve `(user_id, category_id)` üzerinde, filtreleme için.

### İlişkiler

```
users ─┬─< style_preferences   (1:1, UNIQUE user_id)
       ├─< clothing_items      (1:N)
       └─< outfits             (1:N)

outfits >─── outfit_items ───< clothing_items   (N:M)
categories ──< clothing_items                   (1:N)
clothing_items ──< clothing_item_embeddings     (1:1, opsiyonel — yalnızca analizi olan parçalarda)
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

**`/health`, `/auth/register`, `/auth/login` ve `/auth/refresh` dışındaki TÜM uçlar
token ister.** İstekler `Authorization: Bearer <token>` başlığıyla gelir; `authenticate`
middleware token'ı doğrulayıp `req.userId`'yi doldurur.

> **Kullanıcı kimliği asla istekten okunmaz.** Controller'lar `req.query.userId` /
> `req.body.userId` değil **yalnızca `req.userId`** kullanır — aksi hâlde bir kullanıcı
> başkasının id'sini göndererek onun verisine erişebilirdi. Servisler ayrıca kayıt
> sahipliğini doğrular ve başkasının kaydı için **404** döner (403 kaydın var olduğunu
> ele verirdi).

| Metod | Yol | Açıklama |
|---|---|---|
| `POST` | `/auth/register` | `{ name, email*, age, password* }` → `201 { user, token, refreshToken }` |
| `POST` | `/auth/login` | `{ email*, password* }` → `200 { user, token, refreshToken }` |
| `POST` | `/auth/refresh` | `{ refreshToken* }` → `200 { token, refreshToken }` |
| `POST` | `/auth/logout` | Korumalı — `204`, refresh token'ı veritabanından SİLER |
| `GET` | `/auth/me` | Token sahibinin kaydı |
| `POST` | `/auth/change-password` | `{ currentPassword*, newPassword* }` → `204` |
| `POST` | `/auth/forgot-password` | `{ email* }` → **her zaman** `204` |
| `POST` | `/auth/reset-password` | `{ token*, newPassword* }` → `204` |

Parola en az 8 karakter, en fazla 72 bayt (bcrypt sınırı) olmalıdır; `bcrypt` ile
10 tur hash'lenir. Giriş hatalarında "kullanıcı yok" ile "şifre yanlış" **aynı** mesajı
döner (`E-posta veya şifre hatalı`) — hangi e-postaların kayıtlı olduğu sızmasın diye.

**İki token, iki farklı ömür (bkz. §8 "Refresh token sistemi" için tam mimari).**
`token` (access) **KISA ömürlüdür** (`JWT_EXPIRES_IN`, varsayılan **15 dakika**) — bir
JWT'dir, `authenticate` bunu doğrular. `refreshToken` **UZUN ömürlüdür**
(`REFRESH_TOKEN_EXPIRES_IN`, varsayılan **30 gün**, kayan pencere) — JWT DEĞİLDİR, opak
rastgele bir dizedir (`<userId>:<48 baytlık hex>`) ve veritabanında yalnızca bcrypt
özeti olarak durur. Access token süresi dolduğunda korumalı uçlar **401** döner (davranış
değişmedi); frontend bunu **otomatik ve sessizce** `/auth/refresh` ile yeniler ve
orijinal isteği yeniden gönderir (bkz. §8, `lib/api.js > tryRefreshSession`) —
kullanıcı hiçbir şey fark etmez, yalnızca refresh token da geçersizse (süresi dolmuş,
iptal edilmiş, hiç yoksa) Login'e yönlendirilir.

**`POST /auth/refresh` yanıtında `user` alanı YOKTUR** — çağıran zaten oturum açık bir
sayfada, kullanıcı nesnesine ihtiyacı yok. **ROTASYON:** her başarılı yenilemede HEM
yeni bir access token HEM de yeni bir refresh token döner ve **eski refresh token anında
geçersiz kılınır** (veritabanındaki hash üzerine yazılır) — çalınmış bir refresh token'ın
kullanım penceresi meşru sahibinin bir sonraki sessiz yenilemesine kadardır. Geçersiz/
süresi dolmuş/eksik bir `refreshToken` her durumda **aynı** `401` + Türkçe mesajı döner
(login'deki "kullanıcı yok/şifre yanlış" ayrımsızlığıyla aynı ilke — hangi doğrulamanın
başarısız olduğu dışarı sızmaz).

**`POST /auth/logout` GERÇEK bir çıkıştır** — `req.userId`'nin refresh token'ını
veritabanından siler (body'de ayrıca bir token istemez). Yalnızca frontend'de
localStorage'ı temizlemek yeterli değildir: sunucu tarafında refresh token hâlâ
dursaydı çalınmış (ya da unutulmuş bir cihazdaki) bir kopya oturumu canlı tutmaya
devam ederdi.

**Şifre sıfırlama (`forgot-password` / `reset-password`, bkz. §8 "Şifre sıfırlama
sistemi" için tam mimari).** `POST /auth/forgot-password` kayıtlı e-posta olsun
olmasın **her zaman** `204` döner — hangi e-postaların kayıtlı olduğu sızmasın
diye (login'deki "kullanıcı yok/şifre yanlış" ayrımsızlığıyla AYNI ilke). Kayıtlıysa
arka planda opak bir sıfırlama token'ı (`<userId>:<32 baytlık hex>`, refresh token'la
AYNI desen) üretilip bcrypt özeti veritabanına yazılır ve `RESEND_API_KEY` tanımlıysa
Resend üzerinden bir e-posta gönderilir; **anahtar yoksa e-posta sessizce
GÖNDERİLMEZ** ama yanıt yine `204`'tür (WeatherService/GeminiService ile AYNI
"anahtar yoksa dış servise hiç gidilmez" ilkesi). `POST /auth/reset-password` token'ı
doğrulayıp (süre + bcrypt karşılaştırması) yeni şifreyi yazar; başarıda kullanıcının
**mevcut refresh token'ı da geçersiz kılınır** (şifre değiştiyse tüm oturumlar
sonlanmalı) ve sıfırlama token'ı **tek kullanımlıktır** (kullanılınca temizlenir).
Geçersiz/süresi dolmuş/eksik bir `token` her durumda **aynı** `401` döner — hangi
kontrolün başarısız olduğu dışarı sızmaz. İkisi de `authLimiter`'ın arkasındadır.

**`/auth/register`, `/auth/login` ve `/auth/refresh` hız sınırlıdır**
(`middleware/rateLimiters.js` > `authLimiter`): aynı IP'den **15 dakikada en fazla 5
deneme**, aşılırsa `429` + `{ "error": "Çok fazla deneme yapıldı..." }`. Brute-force ve
otomatik kayıt denemelerine karşı; `Retry-After` yerine standart `RateLimit-*` başlıkları
döner (`standardHeaders: true`). **LOOPBACK (127.0.0.1/::1) muaftır** — bir saldırgan
bağlantısının kaynağını uzaktan bu adres gibi gösteremeyeceği için bu güvenliği
zayıflatmaz, yalnızca aynı makineden art arda hesap oluşturan test scriptlerinin
(`test-all-endpoints.js` tek başına 6 kayıt atıyor) birbirinin kotasını
tüketmesini önler. `/auth/refresh`'in bu limite pratikte hiç yaklaşmaması beklenir:
tek sekmede eşzamanlı 401'ler TEK bir çağrıda birleşir (bkz. §8).

### Hata biçimi

Tüm hatalar `{ "error": "Türkçe mesaj" }` döner.

| Kod | Anlam |
|---|---|
| `400` | `ValidationError` — eksik/geçersiz alan, FK ihlali (`23503`) |
| `401` | `UnauthorizedError` — token yok/geçersiz/süresi dolmuş, ya da şifre hatalı |
| `404` | `NotFoundError` — kayıt yok **veya** başkasına ait |
| `409` | `ConflictError` — benzersizlik ihlali (`23505`), örn. tekrarlı e-posta |
| `402` | `PremiumRequiredError` — ücretsiz plan sınırı aşıldı (bkz. §8 "Premium sınırları") |
| `429` | Hız sınırı aşıldı — `/auth/*` (15 dk'da 5) veya Gemini uçları (saatte 10) |
| `500` | Beklenmeyen hata → `{ "error": "Sunucu hatası" }` |

### Health

| Metod | Yol | Açıklama |
|---|---|---|
| `GET` | `/health` | Sunucu + veritabanı durumu. DB kapalıysa `503` ve `status: "degraded"`. |

```json
{"status":"ok","uptime":99.14,"timestamp":"2026-08-18T07:29:16.208Z",
 "database":{"connected":true,"time":"2026-08-18T07:29:16.210Z"}}
```

### Weather

| Metod | Yol | Açıklama |
|---|---|---|
| `GET` | `/weather?city=Istanbul` | Şehrin güncel sıcaklığı ve kategorisi |

```json
{"city":"Istanbul","temperature":22,"status":"sıcak","reason":null}
```

**Bu uç HER ZAMAN `200` döner** — depodaki `{ error: "..." }` kalıbından **bilinçli
sapma**. Başarısızlık (anahtar yok, servis düşmüş, şehir bulunamadı, zaman aşımı,
bozuk gövde) `status: "bilinmiyor"` olarak döner:

```json
{"city":null,"temperature":null,"status":"bilinmiyor","reason":"api-anahtari-yok"}
```

Sebep: hava durumu kombin önerisi için **isteğe bağlı bir zenginleştirmedir**.
Hata olarak dönseydi frontend'de gereksiz bir kırılma noktası olurdu.
`reason` yalnızca teşhis içindir: `api-anahtari-yok`, `sehir-belirtilmedi`,
`sehir-bulunamadi`, `sicaklik-okunamadi`, `servis-hatasi`.

| Kategori | Sıcaklık | Uygun sezon |
|---|---|---|
| `sıcak` | > 20°C | `Yaz` |
| `ılık` | 10–20°C | `İlkbahar-Sonbahar` |
| `soğuk` | < 10°C | `Kış` |

Uç **korumalıdır** (token ister): aksi hâlde API anahtarımız herkese açık bir hava
durumu vekiline dönüşürdü. `WEATHER_API_KEY` tanımlı değilse dış servise **hiç
gidilmez**; sunucu `JWT_SECRET`'ten farklı olarak **patlamaz** — hava durumu opsiyonel
bir özelliktir, uygulamanın geri kalanı anahtarsız da tam çalışır.

### Yeniden analiz

| Metod | Yol | Açıklama |
|---|---|---|
| `POST` | `/clothing-items/:id/analyze` | Mevcut analizin ÜZERİNE yazar (`force: true`) |

Kıyafet Detay'daki **"Yeniden Analiz Et"** düğmesinin ucudur. Başarıda `200` +
güncel kıyafet kaydı döner.

**Bu uç SENKRONDUR** — deponun "önce cevapla, sonra çalış" kuralından bilinçli
sapma. Fotoğraf yüklemede analiz arka planda çalışır çünkü kullanıcı fotoğrafı
bırakıp işine bakar; burada düğmeye basıp ekrana bakıyor ve sonucu bekliyor.
202 + yoklama yolu, arayüze "yeni analiz geldi mi" sorusunu çözdürmek zorunda
bırakırdı (kolon zaten dolu, null kontrolü işe yaramaz).

- **HATA HÂLİNDE ESKİ ANALİZ KORUNUR.** `ClothingAnalysisService` yalnızca
  başarıda kolona yazar; 503 dönen bir istek mevcut veriye dokunmaz.
- **Sahiplik controller'da doğrulanır** (`getItemById`): `analyzeItem` yalnızca
  id ile çalışır, kullanıcıya bakmaz. Kontrol olmasaydı bir kullanıcı
  başkasının parçası için Gemini çağrısı tetikleyebilirdi. Başkasının kaydı `404`.
- **Çift tıklama Gemini'ye İKİNCİ ÇAĞRI YAPMAZ:** in-flight muhafızı devrede,
  ikinci istek `409` ile döner.
- Servisin `sebep` kodları Türkçe mesajlara çevrilir; **ham kod dışarı sızmaz**:
  `409` zaten analiz ediliyor · `400` fotoğraf yok / okunamıyor ·
  `404` kayıt yok · `503` anahtar yok, kota dolu, Gemini erişilemiyor.
- **Hız sınırlıdır** (`geminiLimiter`): kullanıcı başına **saatte 10 istek**.
  In-flight muhafızı yalnızca AYNI ANDA gelen ikinci isteği engeller; bu limiter
  ardışık/sıralı istekleri de sınırlayıp günlük Gemini kotasının tek bir
  kullanıcı tarafından hızla tüketilmesini önler. Aşılırsa `429`.

**Otomatik analizin AYRI BİR UCU YOKTUR.** Aşama 2'de analiz, mevcut fotoğraf
yükleme ucunun (`POST /clothing-items/:id/image`) **yan etkisi** olarak arka
planda çalışır: yanıt önce gönderilir, analiz sonra yapılır ve tamamlandığında
`ai_analysis` kolonuna yazılır. İstemci sonucu `GET /clothing-items/:id`
yoklayarak öğrenir. Ayrı bir uç, kullanıcıyı bekletmeden aynı işi yapan ikinci
bir çağrı demekti; tetikleyici zaten fotoğrafın kendisidir.

### Kombin adayları (vektör veritabanı — Aşama 4)

| Metod | Yol | Açıklama |
|---|---|---|
| `GET` | `/clothing-items/:id/companions?categoryIds=*&limit=` | Başlangıç parçasına en yakın adaylar, **istenen her kategoriden ayrı ayrı** |

**Kombin Öner sayfasının RETRIEVAL ucu** — Aşama 4'ün ürün akışı budur.
`categoryIds` **ZORUNLUDUR** (virgülle ayrılmış id listesi); `limit` kategori
başına aday sayısıdır (varsayılan 5, en fazla 20).

```json
{"id":"a2e3779d-…","indekslendi":true,
 "adaylar":{"2":[{"id":"b5c4ef01-…","name":"H&M siyah kumaş pantolon","category_id":2,
                  "color":"Siyah","image_url":"/uploads/….png","season":"Tüm Sezon",
                  "is_clean":true,"mesafe":0.0896,"benzerlik":0.9104}],
            "4":[…],"5":[…]}}
```

- **KATEGORİ BAŞINA AYRI SORGU atılır.** Tek bir büyük sorgu (ör. `LIMIT 50`)
  istatistiksel olarak çok parçalı bir kategoriyi öne alır ve az parçalı
  kategoriden hiç sonuç döndürmeyebilirdi; kombin ise her slotu doldurmak zorunda.
- **Başlangıç parçasının KENDİ kategorisi hedeflerden düşer** (kombin slotu başka
  bir kategoriye ait). Geriye hedef kalmazsa `400`.
- **`is_clean` ve `season` yanıtta döner ama BACKEND FİLTRELEMEZ.** Temiz/kirli ve
  hava durumu kuralları istemcide (`lib/outfitBuilder.js`) uygulanır — kombin kurma
  mantığının tek sahibi orası. Değişken durum daima `clothing_items`'tan okunur,
  embedding tablosundan değil.
- **Vektör deposuna erişilemezse `503` döner, boş liste değil.** Uç "dürüst"tür;
  *sessizce rastgeleye düşme* kararı istemcinindir. Uç boş dönseydi arayüz akıllı
  olmayan bir öneriyi akıllı sanar ve rozeti haksız yere gösterirdi.
- **Öneri başına Gemini çağrısı YOKTUR:** başlangıç parçasının vektörü veritabanında
  zaten var, oradan okunur. Her öneri gerçek para harcasaydı özellik kullanılamazdı.
- **Zaman aşımı 3 sn** (`COMPANION_TIMEOUT_MS`) — genel bir güvenlik ağı: kullanıcı
  öneri ekranına bakıp bekliyor, sorgu beklenmedik şekilde asılı kalmamalı.
- Sorgu daima `user_id` ile filtrelenir ve sonuçlar Postgres'ten doğrulanır
  (silinmiş/başkasına ait parça yanıta sızmaz). Bozuk biçimli id `400`.
- Henüz indekslenmemiş başlangıç parçası hata değildir:
  `{"indekslendi": false, "sebep": "analiz-yok", "adaylar": {}}`.

### Serbest metin araması (vektör veritabanı — Aşama 5)

| Metod | Yol | Açıklama |
|---|---|---|
| `POST` | `/clothing-items/search-by-text` | `{ text*, limit? }` — kullanıcının serbest metnini gardırobun TAMAMIYLA karşılaştırır |

**Kombin Öner'in serbest metin (mood) kutusunun seed parça seçimini besleyen
ikinci retrieval ucu.** `/companions`'tan temel farkı: bir başlangıç PARÇASI
almaz, kullanıcının kendi cümlesini (`interpretOutfitRequest`'in ürettiği
`arama_metni`) alır ve bu metni **HER ÇAĞRIDA gerçek bir Gemini embedding
isteğine çevirip** kullanıcının TÜM indekslenmiş gardırobunu bu embedding'e
yakınlığa göre sıralar. `/companions`/`/similar` hiç Gemini çağırmaz (yalnızca
veritabanında zaten duran bir vektörü okur) — bu uç FARKLI, gerçek bir embedding
maliyeti taşır; bu yüzden `geminiLimiter`'ın arkasında mount edilir.

```json
{"indekslendi":true,
 "sonuclar":[{"id":"b25ab24e-…","category_id":5,"mesafe":0.1382,"benzerlik":0.8618}]}
```

- **`/clothing-items/:id/...` desenine UYMAZ, kendi düz yoludur** — bir
  parça id'si değil doğrudan bir cümle alır.
- **Kategoriye göre GRUPLANMAZ** (`/companions`'ın aksine): çağıran (seed
  parça seçimi) "hangi kategoriden" değil "genel olarak en yakın hangi
  parça" sorusuna cevap arar — düz, mesafeye göre sıralı bir liste yeterli.
- **Postgres zenginleştirmesi YOKTUR** (`/similar`'ın aksine): çağıran
  (`OutfitSuggestion.jsx`) gardırobu zaten tamamen belleğinde tutuyor —
  yalnızca `id` + `benzerlik` yeterli, ekstra bir veritabanı turu gereksiz
  olurdu.
- Sorgu daima `user_id` ile filtrelenir (`/similar`/`/companions` ile aynı
  gerekçe: filtresiz bir vektör sorgusu başka kullanıcıların gardıroplarından
  sonuç döndürürdü).
- **FIRLATIR, sessizce boş dönmez** — aynı aile (`/companions`/`/similar`):
  boş metin `400`; vektör deposu kapalıysa/anahtar yoksa `503`. "Sessizce rastgele
  seed seçimine düş" kararı yine İSTEMCİNİNDİR (`OutfitSuggestion.jsx`,
  `handleCustomSubmit` içindeki `try/catch`).
- `limit` opsiyoneldir (varsayılan 30, en fazla 50) — `/companions`'ın
  kategori başına aday sayısından KASITLI olarak daha büyük: bu sorgu tek
  seferde TÜM gardırobu tarar, kategoriye bölünmez.

### Benzer parçalar (vektör veritabanı — Aşama 3)

| Metod | Yol | Açıklama |
|---|---|---|
| `GET` | `/clothing-items/:id/similar` | `limit` (varsayılan 5, en fazla 20) ve `categoryId` opsiyoneldir |

**Kıyafet Detay'daki "Buna Benzer Diğer Parçalar" bölümünün ucudur** —
`categoryId` parçanın KENDİ kategorisi verilerek çağrılır. Aynı zamanda
embedding'leri elle gözden geçirmek için de kullanılıyor (Aşama 3'teki rolü).

**`/companions` ile karıştırmayın; ikisi ZIT işler yapar:** `/companions`
kombin kurmak içindir ve başlangıç parçasının KENDİ kategorisini hedeflerden
bilerek düşürür (kombin slotu başka bir kategoriye ait; hedef kalmazsa `400`).
`/similar` ise aynı kategori içinde komşu arar. Bu yüzden "aynı kategoriden
benzerler" için `/companions`'a `sameCategory` gibi bir parametre eklenmedi —
o değişiklik, başka bir ucun zaten yaptığı iş için bilinçli bir kuralı
tersine çevirmek olurdu.

Yanıt satırları `season`, `is_clean` ve `is_favorite` de taşır (`/companions`
ile aynı gerekçe): bu satırlar arayüzde **paylaşılan kıyafet kartına** besleniyor
ve kart favori kalbini, "Kirli" rozetini bu alanlardan çiziyor.

```json
{"id":"b25ab24e-…","indekslendi":true,
 "benzerler":[{"id":"07604e5b-…","name":"Colins siyah basic tişört","category_id":1,
               "color":"Siyah","image_url":"/uploads/….png",
               "mesafe":0.0896,"benzerlik":0.9104,"ozet":"Colins siyah basic tişört (Tişört). …"}]}
```

- **Henüz indekslenmemiş parça HATA DEĞİLDİR:** `{"indekslendi": false, "sebep": "...", "benzerler": []}`
  döner (`analiz-yok` veya `embedding-henuz-olusturulmadi`). Analizi yeni bitmiş
  ya da hiç fotoğrafı olmayan bir parça için 404 dönmek yanıltıcı olurdu.
- **Vektör deposuna erişilemezse `503` döner**, boş liste değil. Sessizce boş dönmek
  "benzer parçan yok" gibi YANLIŞ bir cevap olurdu. (Yazma yolu tam tersi:
  sessizce atlanır — bkz. §8.)
- **Sorgu daima `user_id` ile filtrelenir.** Filtresiz bir vektör sorgusu başka
  kullanıcıların gardıroplarından sonuç döndürürdü; test bunu ayrıca doğrular.
- Parçanın kendisi sonuçlardan **elenir** (kendine mesafesi daima 0'dır);
  bu yüzden veritabanından bir fazla komşu istenir.
- Sonuçlar **Postgres'ten zenginleştirilir** (ad, kategori, fotoğraf). Bu sırada
  silinmiş parçalar düşer, yani embedding tablosunda bayat bir kayıt kalsa bile
  yanıta sızmaz.
- `mesafe` kosinüs mesafesidir (0 = birebir aynı), `benzerlik` = `1 - mesafe`.
  İkisi de dönüyor çünkü mesafe ham ölçüdür, benzerlik okunabilir olandır.

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
| `POST` | `/users` | `{ name, email*, age, city }` |
| `PUT` | `/users/:id` | `{ name, email*, age, city, subscriptionTier }` |
| `DELETE` | `/users/:id` | → `204`; tercih/kıyafet/kombinleri CASCADE ile siler, **ilişkili fotoğrafları/selfie'yi diskten de siler** |
| `GET` | `/users/:id/stats` | Gardırop istatistik özeti (bkz. aşağısı) |
| `GET` | `/users/skin-tone-analysis` | Ten tonu analizi (yoksa `null`) |
| `POST` | `/users/skin-tone-analysis` | **multipart/form-data**, alan adı `image`. Selfie yükler ve analiz eder (senkron) |
| `DELETE` | `/users/skin-tone-analysis` | Analizi ve selfie'yi kaldırır |

`city` opsiyoneldir; boş/boşluk değer `NULL`'a düşer. **`PUT` tam değiştirmedir** —
gönderilmeyen `city` (`name`, `age` gibi) `NULL` olur. Bu, `clothing-items`'taki
`isClean` davranışından farklıdır ve kasıtlıdır: `isClean`'in ayrı bir toggle ucu var,
`city` ise yalnızca Hesap Bilgilerim formundan düzenlenir.

`email` zorunlu, küçük harfe çevrilir ve biçimi doğrulanır; tekrarı `409` döner.
`age` verilirse 0–120 arası tam sayı olmalıdır. `subscriptionTier` yalnızca
`free` veya `premium`. **Yanıtta `password_hash` bulunmaz.**

### Ten Tonu Analizi

| Metod | Yol | Açıklama |
|---|---|---|
| `GET` | `/users/skin-tone-analysis` | Kullanıcının analizi; yoksa `{ "analiz": null, "foto_url": null }` |
| `POST` | `/users/skin-tone-analysis` | Selfie yükler, Gemini'ye analiz ettirir, kaydeder |
| `DELETE` | `/users/skin-tone-analysis` | Analizi ve selfie'yi siler |
| `GET` | `/users/skin-tone-analysis/photo` | Selfie'nin KENDİSİ — **token'lı**, binary yanıt (`image/*`) |

```json
{"analiz":{"model":"gemini-3.6-flash","analiz_tarihi":"2026-08-23T…Z",
  "veri":{"ten_tonu":"Sıcak","ten_rengi_tanimi":"Açık buğday teni",
          "uyumlu_renkler":["Mercan","Şeftali","Zeytin Yeşili","Kiremit Rengi","Krem","Taba","Sıcak Sarı"],
          "uyumsuz_renkler":["Buz Mavisi","Soğuk Gri","Neon Pembe"],
          "uyumlu_metal_tonlari":["Altın"],
          "genel_tavsiye":"Sıcak ve toprak tonlarını tercih ederek…"}},
 "foto_url":"/uploads/selfies/69ec8377-….png"}
```

- **YOLDA `:id` YOKTUR — kimlik daima `req.userId`'den okunur.** Bilinçli:
  selfie hassas veri ve "başkasının analizine bakma" ihtimalini yol seviyesinde
  tamamen ortadan kaldırmak, her seferinde sahiplik karşılaştırmasından güvenli.
- **`skinToneRoutes`, `userRoutes`'TAN ÖNCE mount edilmelidir** (`server.js`).
  Sonra gelseydi `GET /users/:id` "skin-tone-analysis" metnini bir id sanıp
  o handler'a düşürürdü. Test bunu ayrıca doğruluyor.
- **Analiz yoksa `200` + `null` döner, `404` DEĞİL.** Özellik isteğe bağlıdır;
  "henüz yapmadın" bir hata değildir.
- **YÜZ TESPİT EDİLEMEZSE `400` + YÖNLENDİRİCİ MESAJ** ("Yüz görünmüyor.
  Yüzünüzün net göründüğü, iyi aydınlatılmış bir fotoğrafla tekrar deneyin.").
  Bu bir sistem arızası değil; Gemini'den `yuz_tespit_edildi: false` gelir,
  hiçbir şey kaydedilmez ve yüklenen dosya geri alınır.
- **HATA HÂLİNDE ESKİ ANALİZ VE ESKİ SELFIE KORUNUR.** Eski fotoğraf yalnızca
  YENİ analiz veritabanına başarıyla yazıldıktan SONRA silinir — sıra tersine
  olsaydı yazma patladığında kullanıcı ikisini birden kaybederdi.
- **Çift tıklama ikinci Gemini çağrısı yapmaz:** kullanıcı başına in-flight
  muhafızı var, ikinci istek `409` döner (ve o isteğin dosyası geri alınır).
- **Hız sınırlıdır** (`geminiLimiter`, `/clothing-items/:id/analyze` ile aynı):
  kullanıcı başına saatte 10 istek, aşılırsa `429`.
- Dosya kısıtları fotoğraf yüklemeyle aynı (jpg/png/webp, en fazla 5 MB) ve
  dosya adı rastgele UUID'dir. **Fiziksel olarak `backend/uploads/selfies/`
  altına yazılır** (kıyafet fotoğraflarının aksine `uploads/` kökünde DEĞİL).

**`GET /users/skin-tone-analysis/photo` — selfie'nin KENDİSİ.** Kıyafet
fotoğraflarından **kasıtlı olarak farklı** servis edilir:

- **`express.static` KULLANILMAZ.** `SkinToneController.getPhoto`, dosyayı
  `res.sendFile` ile DOĞRUDAN okuyup gönderir; yol yine `:id` TAŞIMAZ —
  kimlik `req.userId`'den gelir, dolayısıyla "başkasının selfie'sini id ile
  çekmeye çalış" senaryosu yapısal olarak imkânsızdır (sorguya girecek bir
  kullanıcı id'si parametresi hiç yok).
- **`/uploads/selfies/...` STATİK OLARAK ASLA ÇALIŞMAZ** — token'lı olsun
  olmasın. `server.js`, genel `/uploads` static middleware'inden ÖNCE bu alt
  yolu 404'e düşüren bir blok mount eder. Fiziksel konum tek başına yeterli
  bir koruma DEĞİLDİR (bir dizin adı tahmin edilebilir); asıl güvence bu
  engelleme satırıdır. Kıyafet fotoğrafları **buna tabi değildir** ve eskisi
  gibi token'sız `/uploads/...` üzerinden servis edilmeye devam eder — bu
  CLAUDE.md'de zaten belgeli, bilinçli bir ödünleşmedir ve DEĞİŞMEDİ.
- **`Cache-Control: private, max-age=0, no-store`** döner — selfie hassas
  veridir, paylaşılan bir önbellekte (proxy, CDN) iz bırakmamalıdır.
- Analiz/selfie yoksa `404` döner (bu, `GET /users/skin-tone-analysis`'in
  "analiz yoksa 200 + null" sözleşmesinden BİLEREK FARKLIDIR: o uç bir JSON
  gövdesi döndürüyor ve orada `null` doğal bir "henüz yok" ifadesi; burada
  ikili bir dosya isteniyor ve dönecek anlamlı bir "boş dosya" yok).
- Frontend bu ucu `<img src="...">` ile DOĞRUDAN kullanmaz (tarayıcının
  `<img>` etiketi `Authorization` başlığı gönderemez); `fetchSkinTonePhoto()`
  ile blob olarak çekilip `URL.createObjectURL` ile object URL'e çevrilir
  (bkz. §8, `SkinToneSection`).

### Wardrobe Stats

| Metod | Yol | Açıklama |
|---|---|---|
| `GET` | `/users/:id/stats` | Kullanıcının gardırop özeti. Yalnızca kendi verisi; başkasının id'si → `404` |

Profil sayfasındaki "Gardırop İstatistiklerim" kartını besler.

```json
{"has_data":true,
 "items":{"total":11,"favorite":3,"clean":9,"dirty":2,
          "by_category":[{"category_id":1,"name":"Üst","icon":"shirt","count":4}]},
 "colors":{"top":{"name":"Siyah","count":4}},
 "outfits":{"total":5,"favorite":0,"total_worn":0,
            "top_occasion":{"name":"Akşam Yemeği","count":3}},
 "generated_at":"2026-08-20T17:12:04.118Z"}
```

**Hesaplama tamamen SQL'dedir** (`GROUP BY` / `COUNT` / `FILTER`); frontend'e ham kayıt
değil hazır özet gider. Binlerce parçalı bir gardıropta bile yanıt sabit boyutta kalır ve
istemcide hiçbir toplama yapılmaz.

- **`has_data`** sunucuda hesaplanır (`items.total > 0 || outfits.total > 0`) — frontend'in
  "yeni kullanıcı" boş durumunu tek alandan sürebilmesi için. Yalnızca kombini olan
  (parçaları silinmiş) kullanıcı da `true` sayılır.
- **"En çok ..." alanları veri yoksa `null` döner**, uydurma varsayılan değil:
  `{"name":"Beyaz","count":0}` göstermek kullanıcıya yanlış bilgi verirdi.
- **Sayımlar `::int` ile daraltılır.** Postgres `COUNT(*)` bigint döner ve `pg` sürücüsü
  bunu **string**'e çevirir; daraltılmasaydı yanıtta `"11"` (metin) çıkardı.
- **Eşitlikte ikincil sıralama** (`ORDER BY count DESC, color ASC`) zorunludur — olmasaydı
  aynı veri için farklı yanıtlar dönebilir ve test rastgele kırılırdı.
- Kategori dağılımı `INNER JOIN` kullanır: **parçası olmayan kategori listede hiç
  görünmez** ("0 Makyaj" satırı özeti gereksiz uzatırdı).
- Soft delete edilmiş parçalar (`is_deleted = true`) hiçbir sayıma girmez; `occasion`'ı
  boş olan kombinler "en çok durum" yarışına katılmaz ama `outfits.total`'a dahildir.

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
| `POST` | `/clothing-items` | `{ userId*, categoryId*, name*, color, brand, season, imageUrl, isClean, purchasePrice }` → `201`, ücretsiz planda 30. parçadan sonra `402` (bkz. §8 "Premium sınırları") |
| `PUT` | `/clothing-items/:id` | `{ categoryId*, name*, color, brand, season, isClean, purchasePrice }` — **fotoğraf bu ucun işi değildir** |
| `DELETE` | `/clothing-items/:id` | **Soft delete** → `204` |
| `PATCH` | `/clothing-items/:id/favorite` | Favori durumunu tersine çevirir (atomik) |
| `PATCH` | `/clothing-items/:id/clean-status` | Temiz/kirli durumunu tersine çevirir (atomik) |
| `POST` | `/clothing-items/:id/image` | **multipart/form-data**, alan adı `image`. jpg/png/webp, en fazla 5 MB |
| `DELETE` | `/clothing-items/:id/image` | Fotoğrafı kaldırır (`image_url` → `null`, dosya diskten silinir) |
| `POST` | `/clothing-items/:id/analyze` | **Yeniden analiz** — mevcut `ai_analysis` üzerine yazar (senkron) |
| `GET` | `/clothing-items/:id/similar?limit=&categoryId=` | **Aşama 3 doğrulama ucu** — vektör uzayındaki en yakın komşular |
| `GET` | `/clothing-items/:id/companions?categoryIds=*&limit=` | **Aşama 4** — Kombin Öner'i besleyen kategori bazlı aday araması |

**Temiz/kirli (`isClean`).** Boolean dışında bir değer `400` döner; gevşek dönüşüm
yapılmaz (`"false"` metni `true` olurdu). `POST`'ta belirtilmezse parça **temiz** sayılır.
`PUT`'ta belirtilmezse **mevcut değer korunur** — aksi hâlde herhangi bir düzenleme kirli
bir parçayı sessizce temiz yapardı.

**Kullanım başına maliyet (`purchasePrice`, bkz. §8 "Kullanım başına maliyet"
için tam mimari).** İsteğe bağlı, `isClean` ile AYNI "gönderilmezse korunur"
ilkesini izler — farkla ki `null` göndermek fiyatı BİLEREK temizler (isClean'de
böyle bir "temizle" kavramı yok, her zaman `true`/`false`). Negatif ya da sayı
olmayan bir değer `400` döner. **`GET /clothing-items/:id` (tekil) yanıtına
`total_times_worn` ve `cost_per_wear` computed alanları eklenir** — liste
uçları (`GET /clothing-items`, `findByCategory`, `findByIds`) bunları BİLEREK
TAŞIMAZ, yalnızca `purchase_price` (ham kolon) döner. `cost_per_wear`,
`purchase_price` yoksa VEYA parça hiç giyilmediyse (`total_times_worn = 0`)
`null` döner — `0`'a bölme ya da uydurma bir değer asla üretilmez. Bir parçanın
"kaç kez giyildiği" ayrı bir kolon değildir: `outfits.times_worn` yalnızca
KOMBİN bazında tutulur, bu yüzden `total_times_worn` o parçayı İÇEREN TÜM
kombinlerin `times_worn` TOPLAMIdır (bir parça birden fazla kombinde geçebilir).

**`PUT` FOTOĞRAFA ASLA DOKUNMAZ — payload'da `imageUrl` gönderilse bile.**
`ClothingItemService.updateItem` gelen veriden bağımsız olarak `image_url`'i
her zaman `existingItem.image_url` ile YENİDEN YAZAR. Fotoğraf yönetimi tamamen
ayrı, adanmış uçların işidir (`POST`/`DELETE .../image`). **YAKALANAN HATA:**
kıyafet düzenleme özelliği eklenirken bu koruma YOKTU; `repository.update`'in
SQL'i `image_url = $6` ile TAM DEĞİŞTİRME yapıyordu ve frontend'in düzenleme
formu `imageUrl` alanı GÖNDERMEDİĞİ için gerçek bir kıyafetin fotoğrafı bu
yüzden bir kez NULL'a düştü (elle geri yüklendi, veri kaybı olmadı). `isClean`
için zaten var olan "gönderilmezse koru" deseni `imageUrl`'e de uygulandı —
farkla ki `isClean` isteğe bağlı korunur, `imageUrl` KOŞULSUZ korunur (bu uçtan
hiçbir şekilde değiştirilemez, `null` göndermek bile işe yaramaz).

**Fotoğraf yükleme.** Dosyalar `backend/uploads/` altına **rastgele UUID** adıyla yazılır
(orijinal ad kullanılmaz: path traversal ve çakışma riski). `image_url` kolonunda **göreli
yol** saklanır (`/uploads/abc.png`) — web `localhost`, Android `10.0.2.2` üzerinden
eriştiği için tam URL yazmak birini kırardı; host'u istemcide `resolveImageUrl()` ekler.
Dosyalar `/uploads` yolundan `express.static` ile **token'sız** servis edilir (`<img>`
etiketleri `Authorization` başlığı gönderemez; ad tahmin edilemez olduğu için kabul edildi).

Sahiplik ihlalinde bu iki uç **403** döner — diğer uçlardaki 404 kalıbından bilinçli sapma.
Fotoğraf değiştirilirse eski dosya, kıyafet soft delete edilirse fotoğrafı diskten silinir;
yükleme sonrası bir hata olursa yeni yazılan dosya geri alınır (öksüz dosya kalmaz).

```json
{"id":"58b9f6da-…","user_id":"e4553e3e-…","category_id":5,"name":"Küçük Omuz Çantası",
 "color":"Kahverengi","brand":"Mango","season":null,"image_url":null,
 "is_favorite":false,"is_deleted":false,"ai_analysis":null,
 "created_at":"…","updated_at":"…"}
```

**Fotoğraf yükleme otomatik analizi TETİKLER.** `POST /clothing-items/:id/image`
yanıtı geldiğinde `ai_analysis` **henüz null'dur** — analiz arka planda sürer
(tipik 6–10 sn, en kötü ~62 sn). Sonucu görmek için kayıt yeniden okunur;
Kıyafet Detay sayfası bunu 5 sn aralıklarla yoklar. Analiz zaten doluysa
**yeniden analiz yapılmaz** (maliyet koruması), dolayısıyla aynı fotoğrafı
tekrar yüklemek yeni bir Gemini çağrısı doğurmaz.

### Outfits

| Metod | Yol | Gövde / Parametre |
|---|---|---|
| `GET` | `/outfits?clothingItemId=` | Parçalarıyla birlikte, `created_at DESC`. `clothingItemId` opsiyonel filtre |
| `GET` | `/outfits/:id` | |
| `POST` | `/outfits` | `{ userId*, occasion, clothingItemIds*[] }` → `201`, ücretsiz planda 10. kombinden sonra `402` (bkz. §8 "Premium sınırları") |
| `PUT` | `/outfits/:id` | `{ occasion, clothingItemIds }` — `clothingItemIds` verilmezse parçalara dokunulmaz |
| `DELETE` | `/outfits/:id` | Hard delete → `204` |
| `PATCH` | `/outfits/:id/favorite` | Favori toggle |
| `PATCH` | `/outfits/:id/worn` | `times_worn` +1 |
| `POST` | `/outfits/interpret` | `{ text* }` → serbest metni standart bir occasion'a ve özete çevirir |

`clothingItemIds` en az bir parça içermeli, tekrar barındıramaz ve **yalnızca o kullanıcıya
ait, silinmemiş** parçalar olabilir — aksi hâlde `400`.

**`POST /outfits/interpret` — Kombin Öner'deki serbest metin kutusu.** Kullanıcının
kendi cümleleriyle anlattığı durumu Gemini'ye yorumlatır. Hiçbir şey KAYDETMEZ —
sahiplik/kaynak kavramı yoktur, yalnızca metin gidip yorumlanmış hâliyle döner.

```json
{"model":"gemini-3.6-flash","occasion":"Akşam Yemeği","stil_tercihi":"Sade ve Şık",
 "kacinilmasi_gerekenler":["Aşırı gösterişli","Çok rahat/spor"],
 "onem_verilen_ozellikler":["Dengeli görünüm"],
 "arama_metni":"Şık ama abartısız, dengeli bir akşam yemeği kombini"}
```

- **`occasion` MUTLAKA altı standart kategoriden biri (`Üniversite`, `İş`,
  `Akşam Yemeği`, `Buluşma`, `Spor`, `Özel Davet`) ya da `"Diğer"`dir** —
  `GeminiService` modelin döndürdüğü değeri bu kümeyle karşılaştırır, uymayan
  her şeyi `"Diğer"`e indirger. Bu liste frontend'deki `lib/occasions.js >
  OCCASIONS` ile BİREBİR AYNI tutulmalıdır (elle senkron — paylaşılan bir
  paket yok); biri değişirse diğeri de güncellenmelidir.
- **Metin en fazla 500 karakter** (`GeminiService.MAX_INTERPRETATION_TEXT_LENGTH`).
  Bu sınır `outfits.occasion`'ın VARCHAR(50)'siyle KARIŞTIRILMAMALI — bu metin
  veritabanına hiç yazılmaz, yalnızca Gemini'ye gidip atılır.
- **FIRLATIR, sessizce boş dönmez** (`analyzeSkinTone`/`analyzeClothingItem` ile
  aynı ilke): kullanıcı "Anlıyorum..." durumuna bakıp bekliyor. **"Sessizce mevcut
  pill akışına düş" kararı FRONTEND'e aittir** — `OutfitSuggestion.jsx` bu isteği
  başarısız olursa ham metni doğrudan occasion olarak kullanmaya devam eder,
  kullanıcıya hiçbir hata göstermez (bkz. §8).
- **Retry YOK** — bu ailedeki diğer Gemini akışlarının (`ClothingAnalysisService`,
  `SkinToneService`) aksine bilinçli bir sadeleştirme: başarısızlığın zaten
  zararsız bir geri dönüşü var (ham metin occasion olur), "basit başlangıç"
  için tek deneme yeterli.
- **Hız sınırlıdır** (`geminiLimiter`, diğer Gemini uçlarıyla aynı): kullanıcı
  başına saatte 10 istek.
- **`kacinilmasi_gerekenler` ve `stil_tercihi` artık GÖSTERİMİN YANI SIRA
  kombin kurma mantığına da girer** (`outfitBuilder.js > createMoodContext` /
  `applyMoodPreferences`, bkz. §8) — bu uçta hiçbir değişiklik gerekmedi,
  yalnızca frontend'in bu alanları nasıl kullandığı değişti. `arama_metni`
  ayrıca **ikinci bir gerçek Gemini çağrısını** (embedding) tetikler:
  bkz. `POST /clothing-items/search-by-text` aşağıda.

**`clothingItemId` filtresi.** Verilirse yalnızca o parçanın geçtiği kombinler döner
(Kıyafet Detay sayfasını besler). Filtre SQL'de `EXISTS` alt sorgusuyla yazılır; `JOIN`
koşuna eklenseydi dönen `items` dizisi **yalnızca aranan parçaya inerdi**, oysa kartın
kombinin tamamını gösterebilmesi gerekir. Soft delete edilmiş bir parça hiçbir kombinde
geçmiyor sayılır. Geçersiz biçimli bir UUID `400` döner — doğrudan Postgres'e gitseydi
`22P02` ile `500`'e düşerdi (`utils/validators.js` → `assertUuid`).

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
# 1) Veritabanı (depo kökünden) — pgvector uzantılı Postgres, ayrı bir vektör
#    servisi YOKTUR (bkz. §9, 2026-08-27 "ChromaDB'den pgvector'a geçiş")
docker compose up -d                 # postgres 16 + pgvector (:5432)
docker compose ps                    # db "healthy"/"Up" olmalı
docker compose down                  # durdur (postgres_data volume'ü korunur)

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
# MSYS_NO_PATHCONV=1 ZORUNLU: Git Bash "/tmp/m.sql" argümanını Windows yoluna
# çevirir ve psql "No such file or directory" der (005 uygulanırken yaşandı).
MSYS_NO_PATHCONV=1 docker exec dijitalgardirop-db-1 psql -U postgres -d dijital_gardirop \
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

**Bu makinede `./gradlew` DOĞRUDAN çalışmıyor — JDK/Gradle sürüm uyuşmazlığı.**
Proje Gradle 8.14.3'e sabit (`gradle-wrapper.properties`); bu sürüm makinedeki
JDK'ların HİÇBİRİYLE çalışmıyor: sistem `java` (PATH) JDK 26, Android Studio'nun
kendi JBR'si JDK 25 — ikisi de Groovy ayarlar dosyasını derlerken
`Unsupported class file major version 69/70` ile patlıyor. Bu, kod
değişikliğinden bağımsız bir ORTAM sorunu (bu depoda JDK 17/21 kurulu değil).
Android Studio üzerinden build/run yaparken IDE kendi **Gradle JDK** ayarını
kullanabilir (Settings → Build Tools → Gradle → Gradle JDK); komut satırından
`./gradlew` çağırmadan önce oranın da uyumlu bir JDK'ya (17 ya da 21) işaret
ettiğinden emin olun, aksi hâlde Android Studio içinden de aynı hata alınır.

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

2. **WebView şeması (mixed content).** Capacitor'ün Android varsayılan şeması
   **`https`**'tir, yani uygulama sayfası `https://localhost` üzerinden servis edilir ve
   `http://10.0.2.2:3001` isteği *mixed content* sayılır. `capacitor.config.json` içindeki
   `android.allowMixedContent: true` WebView'ün **engelleme** politikasını gevşetir
   (`WebSettings.MIXED_CONTENT_ALWAYS_ALLOW`) ve `fetch` çağrılarını çalıştırır — ama
   **`<img>` için yetmez**, çünkü Chromium pasif alt kaynakları ayrıca `https`'e
   *auto-upgrade* eder (bkz. 2026-08-20 kaydı).

   Bu yüzden proje şemayı tamamen değiştirir: `server.androidScheme: "http"`. Sayfa
   `http://localhost` üzerinden servis edilir, backend isteği aynı şemaya düşer ve mixed
   content koşulu **hiç oluşmaz**. `http://localhost` spec gereği "potentially trustworthy"
   sayıldığı için secure-context API'leri kaybedilmez. `allowMixedContent` bu haliyle
   etkisizdir; şema `https`'e döndürülürse diye bırakıldı.

   > **Şema değiştirmek origin'i değiştirir** → `localStorage` (token, `dg_` önekli
   > profil önbelleği) **bir kereliğine silinir**; uygulamada yeniden giriş yapılır.

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

# Kimlik doğrulama + yetkilendirme + refresh token (71 kontrol). En kritik
# bölümler: bir kullanıcının BAŞKASININ verisine erişememesi VE refresh token
# rotasyonu/süre dolumu/çıkışın gerçekten çalışması.
node test-scripts/test-auth.js

# Tüm uçları uçtan uca doğrular (77 kontrol); kendi hesabını açıp sonunda siler.
# PUT /clothing-items/:id için sahiplik (404) ve image_url KORUMA testleri dahil.
node test-scripts/test-all-endpoints.js

# Auth öncesinden kalan, şifresi olmayan hesapları yönetir (varsayılan: salt okunur liste)
node test-scripts/migrate-passwordless-users.js
node test-scripts/migrate-passwordless-users.js --set-password <email> <sifre>
node test-scripts/migrate-passwordless-users.js --delete-empty

# Kıyafet → kombin filtresi: GET /outfits?clothingItemId= (27 kontrol)
node test-scripts/test-item-outfits.js

# Premium plan sınırları (parça/kombin) + şifre sıfırlama akışı (19 kontrol)
node test-scripts/test-premium-and-reset.js

# Kullanım başına maliyet (cost-per-wear): fiyat + giyilme sayısının birden
# çok kombinde TOPLANMASI + 0'a bölme koruması (22 kontrol)
node test-scripts/test-cost-per-wear.js

# Temiz/kirli davranışı + kirli parçanın önerilmemesi (26 kontrol)
node test-scripts/test-clean-status.js

# Hava durumu + sezon önceliklendirme (62 kontrol). Başındaki birim testleri
# sahte repository ile çalışır — WEATHER_API_KEY OLMADAN da tam çalışır.
node test-scripts/test-weather.js

# Gardırop istatistikleri: boş / az veri / çok veri + yetkilendirme (60 kontrol)
node test-scripts/test-stats.js

# Tek uca odaklı: POST + snake_case + GET doğrulaması
node test-scripts/test-clothing-items.js
node test-scripts/test-clothing-items.js --cleanup   # oluşturduğu kaydı sonda siler

# Fotoğraf yükleme uçları (29 kontrol): tip/boyut doğrulaması, sahiplik (403),
# eski dosyanın silinmesi, kıyafet silinince fotoğrafın da silinmesi.
# uploads/ MUTLAK olarak SAYILMAZ (gerçek kullanıcı fotoğraflarıyla paylaşılan
# bir klasörde bu haksız yere kırılırdı) — script kendi BAŞLANGIÇ anlık
# görüntüsüne göre yalnızca KENDİ oluşturduğu dosyaları sayar.
node test-scripts/test-image-upload.js

# Otomatik kıyafet analizi + yeniden analiz — Gemini Aşama 2 (104 kontrol:
# 48 birim + 19 uçtan uca + 37 gerçek).
# --birim: yalnızca birim bölümü (sunucu, anahtar ve kota GEREKTİRMEZ, saniyeler sürer)
# --kotasiz: günlük Gemini kotası dolduysa gerçek analiz bölümünü atlar
# Test verisi VARSAYILAN OLARAK SİLİNMEZ (DBeaver'da gözle doğrulama için);
# silmek için --cleanup ya da cleanup.js
node test-scripts/test-ai-analysis.js
node test-scripts/test-ai-analysis.js --birim
node test-scripts/test-ai-analysis.js --kotasiz
node test-scripts/test-ai-analysis.js --cleanup

# RAG ile Kombin Öner — Gemini Aşama 4 (69 kontrol: 36 birim + 21 uçtan uca +
# 12 vektör deposu devre dışı). --birim: yalnızca birim bölümü (veritabanı,
# anahtar ve kota GEREKTİRMEZ). Bölüm 3, VECTOR_STORE_ENABLED=false ile
# İKİNCİ BİR SUNUCU açar (:3197) — pgvector aynı Postgres'i paylaştığı için
# "Postgres ayakta, yalnızca vektör deposu erişilemez" senaryosu artık devre
# dışı bırakmayla simüle edilir (bkz. §9).
node test-scripts/test-outfit-rag.js
node test-scripts/test-outfit-rag.js --birim
node test-scripts/test-outfit-rag.js --cleanup

# Kombin Öner'deki serbest metin (mood) yorumlaması (15 kontrol: 13 birim/HTTP
# + 3 gerçek örnek metin, kota izin verirse). --birim: yalnızca birim bölümü
# (sunucu/anahtar GEREKMEZ). --kotasiz: gerçek örnek metinler bölümünü atlar.
node test-scripts/test-outfit-interpret.js
node test-scripts/test-outfit-interpret.js --birim
node test-scripts/test-outfit-interpret.js --kotasiz

# Vektör veritabanı (pgvector) — Gemini Aşama 3 (81 kontrol: 46 birim + geri
# kalanı bağlantı/gerçek embedding/vektör deposu devre dışı senaryoları).
# --birim: yalnızca birim bölümü (veritabanı, anahtar ve kota GEREKTİRMEZ)
# Gerçek embedding bölümü ai_analysis'i ELLE yazar (sentetik): "iki beyaz üst
# yakın çıkmalı" iddiası ancak girdi kontrol edilirse deterministik sınanabilir.
node test-scripts/test-vector.js
node test-scripts/test-vector.js --birim
node test-scripts/test-vector.js --cleanup

# Analizi olan ama embedding'i olmayan parçalar için toplu embedding üretimi.
# VARSAYILAN SALT OKUNURDUR. --sifirla tabloyu boşaltır (model değişince gerekir).
node test-scripts/create-embeddings.js                    # yalnızca listeler
node test-scripts/create-embeddings.js --uygula
node test-scripts/create-embeddings.js --uygula --limit 3
node test-scripts/create-embeddings.js --sifirla --uygula

# Analizi olmayan (bu özellikten önce eklenmiş) parçaları toplu analiz eder.
# VARSAYILAN SALT OKUNURDUR: her çağrı gerçek para harcar.
node test-scripts/analyze-existing-items.js              # yalnızca listeler
node test-scripts/analyze-existing-items.js --uygula
node test-scripts/analyze-existing-items.js --uygula --limit 3

# Ten tonu analizi (58 kontrol: 33 birim + 22 uçtan uca/foto ucu/migrasyon
# + 3 gerçek Gemini). --birim: yalnızca birim bölümü (sunucu ve anahtar
# GEREKTİRMEZ). --kotasiz: gerçek Gemini bölümünü atlar.
node test-scripts/test-skin-tone.js
node test-scripts/test-skin-tone.js --birim
node test-scripts/test-skin-tone.js --kotasiz

# Var olan selfie'leri uploads/ kökünden uploads/selfies/'e taşır (bu özellikten
# ÖNCE analiz yapmış kullanıcılar için). VARSAYILAN SALT OKUNURDUR, İDEMPOTENTTİR.
node test-scripts/migrate-selfie-photos.js                # yalnızca listeler
node test-scripts/migrate-selfie-photos.js --uygula

# Cloudflare R2 depolama katmanı — yapılandırma/zarif geri düşüş (15 kontrol).
# GERÇEK bir R2 hesabı GEREKTİRMEZ; yalnızca "anahtarlar eksikken zarar
# vermiyor" garantisini kapsar.
node test-scripts/test-storage.js

# Var olan yerel kıyafet fotoğraflarını Cloudflare R2'ye taşır (R2 env
# değişkenleri .env'de dolu olmalı). VARSAYILAN SALT OKUNURDUR, İDEMPOTENTTİR,
# yerel dosyayı SİLMEZ.
node test-scripts/migrate-photos-to-r2.js                 # yalnızca listeler
node test-scripts/migrate-photos-to-r2.js --uygula

# GeminiService — anahtar/bağlantı yolları (15 kontrol). SUNUCUYA HTTP İSTEĞİ
# ATMAZ (2026-08-24'te kaldırılan /gemini/test-analyze ucuna artık bağlı
# değildir) — GeminiService'i DOĞRUDAN çağırır. Birinci bölüm GEÇERLİ ANAHTAR
# OLMADAN da çalışır (eksik/geçersiz anahtar yolları); ikinci bölüm anahtar
# ve uploads/ içinde bir görsel ister.
node test-scripts/test-gemini.js
node test-scripts/test-gemini.js --image ../yol/kiyafet.jpg

# Test artıklarını temizler (test kayıtları + embedding tablosundaki öksüz
# vektörler + uploads/ öksüz dosyaları — üçü de aynı çalıştırmada temizlenir)
node test-scripts/cleanup.js --dry-run               # önce neyin silineceğini göster
node test-scripts/cleanup.js                         # test parçaları + @example.com kullanıcıları
node test-scripts/cleanup.js --all --user <uuid>     # bir kullanıcının TÜM verisi

# Öksüz dosya temizliği (12 kontrol): kullanıcı silinince kıyafet fotoğrafı VE
# selfie (artık uploads/selfies/'ten) diskten kalkıyor mu, cleanup.js'in İKİ
# AYRI dizin taraması (kıyafet kökü + selfies/) referanssız dosyaları süpürüp
# referanslı (canlı) dosyalara dokunmuyor mu.
node test-scripts/test-file-cleanup.js
```

**Frontend'de de tek bir test scripti var** (`frontend/` klasöründen çalıştırılır):

```bash
# Kombin kurma mantığı + makyaj önerisi + ten tonu işareti — saf fonksiyon
# testleri (73 kontrol).
# SUNUCU, CHROMA VE ANAHTAR GEREKTİRMEZ: lib/outfitBuilder.js React'tan ve ağ
# katmanından bağımsız olduğu için doğrudan node ile koşuyor. Asıl güvence:
# vektör adaylarının temiz/kirli ve hava durumu filtrelerini ATLAYAMAMASI.
node test-scripts/test-outfit-builder.mjs
```

`test-all-endpoints.js` mutlu yolun yanı sıra doğrulama hatalarını (400), bulunamayan
kayıtları (404), benzersizlik ihlalini (409), soft delete davranışını ve `ON DELETE CASCADE`
zincirini kontrol eder. `cleanup.js` API üzerinden değil doğrudan veritabanına bağlanır;
test kullanıcıları `@example.com` deseniyle tanınır. **`cleanup.js` ayrıca
`clothing_item_embeddings`'teki ÖKSÜZ VEKTÖRLERİ de siler** (`clothing_items`'ta
karşılığı kalmayanlar, tek bir anti-join SQL sorgusuyla) — doğrudan SQL ile
silinen test kayıtları aksi hâlde vektör bırakırdı. Sunucu kapalıysa scriptler yığın izi
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

**Dış servis de repository'dir.** `WeatherRepository` veritabanına değil
OpenWeatherMap'e bakar ama katman rolü aynıdır: yalnızca veri erişimi, iş kuralı yok.
Sıcaklığın kategoriye çevrilmesi ve **hataların "bilinmiyor"a dönüştürülmesi**
`WeatherService`'in işidir. Repository fırlatır, servis **asla fırlatmaz**.
Dış istekte `AbortSignal.timeout(5000)` zorunludur — takılan bir istek Kombin Öner
sayfasının açılışını bekletirdi.

**İstatistik katmanı genişletilebilir kurgulandı.** `StatsRepository` metodları küçük ve
tek konuludur (`getItemSummary`, `getCategoryDistribution`, `getTopColor`, …);
`StatsService` özeti bu bölümleri birleştirerek üretir. İleride "premium analiz raporu"
eklenirken izlenecek yol: yeni bir repository sorgusu + yeni bir `#buildX` bölümü.
Mevcut sorgulara ve uç noktanın sözleşmesine dokunmak gerekmez — yanıt yalnızca yeni bir
anahtarla büyür. **Sayımlar her zaman `::int` ile daraltılmalıdır** (`pg` bigint'i string
döndürür) ve "en çok" sorguları eşitlik için ikincil sıralama taşımalıdır.

**Gemini katmanı.** `config/gemini.js` istemciyi kurar (database.js ile
aynı rol), `GeminiService` görseli/metni gönderip JSON yanıtı çözer. Repository
yoktur: kalıcı veri yok, yalnızca dış çağrı. **Kendi controller/route'u
yoktur** — `ClothingAnalysisService`, `SkinToneService` ve (Kombin Öner'in
serbest metin yorumlaması için) doğrudan `OutfitController` tarafından
çağrılan bir alt bileşen olarak kullanılır (bkz. aşağıdaki "AŞAMA 1
ucu KALDIRILDI" notu).

**Görsel/metin ayrımı: `#generate` vs `#generateFromText`, ortak çekirdek
`#callGemini`.** İlk üç Gemini metodu (`analyzeClothingItem`, `analyzeSkinTone`,
eski `analyzeClothingImage`) hep GÖRSEL gönderiyordu; serbest metin yorumlaması
(`interpretOutfitRequest`) YALNIZCA METİN gönderir — inlineData'sı yoktur.
İkisi de artık `#callGemini(parts)` adlı PAYLAŞILAN bir özel metodu kullanır
(istemci kurulumu, hata çevirisi, zaman aşımı, boş yanıt kontrolü tek yerde);
`#generate(file, prompt)` image+text parçalarını hazırlayıp `#callGemini`'yi
çağırır, `#generateFromText(prompt)` yalnızca text parçasıyla aynısını yapar.
Bu refactor `interpretOutfitRequest` eklenirken yapıldı ve MEVCUT görsel
tabanlı metodların davranışını DEĞİŞTİRMEDİ — regresyon testleriyle
(`test-gemini.js`, gerçek bir Gemini çağrısıyla) doğrulandı.

**Kombin Öner'in serbest metin yorumlaması (`interpretOutfitRequest`).**
Kullanıcının kendi cümleleriyle anlattığı durumu (`"Akşam yemeğine gidiyorum
ama overdress olmak istemiyorum..."` gibi) standart bir occasion'a ve kısa bir
özete çevirir. `analyzeSkinTone`/`analyzeClothingItem` gibi **FIRLATIR** —
kullanıcı "Anlıyorum..." durumuna bakıp bekliyor, sessizce boş dönmek yanlış
olurdu. Ama bu ailedeki DİĞER akışlardan iki noktada BİLİNÇLİ olarak ayrılır:

- **RETRY YOK.** `ClothingAnalysisService`/`SkinToneService` geçici hataları
  (zaman aşımı, 503) `MAX_ATTEMPTS = 2` ile yeniden dener. Burada denenmiyor:
  başarısızlığın zaten zararsız bir geri dönüşü var (frontend ham metni
  occasion olarak kullanmaya devam eder), bu yüzden "basit başlangıç" için
  tek deneme yeterli görüldü — CLAUDE.md'de bilinçli bir sadeleştirme olarak
  işaretli, ileride gerekirse eklenebilir.
- **"Sessizce geri düş" kararı SERVİSTE DEĞİL, FRONTEND'DE.** Diğer akışlarda
  (ör. `/companions`) backend bilerek dürüst kalır ve hatayı fırlatır,
  "rastgeleye düş" kararını istemci verir — burada da AYNI ilke uygulanıyor:
  `GeminiService`/`OutfitController` hatayı OLDUĞU GİBİ fırlatır (503/400),
  `OutfitSuggestion.jsx` bu isteği yakalayıp ham metni occasion olarak
  kullanmaya devam eder. Servis "bu hatanın önemli olup olmadığını" hiç bilmez.

`occasion` normalizasyonu (`#normalizeOutfitInterpretation`) **altı standart
kategori + "Diğer" DIŞINDA bir değeri asla kabul etmez** — model kuralı
görmezden gelip serbest bir kategori uydurursa (ör. "Piknik") bu "Diğer"e
düşer. `OUTFIT_REQUEST_CATEGORIES` sabiti frontend'deki `lib/occasions.js >
OCCASIONS` ile BİREBİR AYNI tutulmalıdır — paylaşılan bir modül olmadığı için
bu senkronizasyon ELLE yapılıyor, biri değişirse diğeri de güncellenmelidir.

**Otomatik analiz orkestrasyonu `ClothingAnalysisService`'tedir** (Aşama 2) ve
`GeminiService`'ten AYRI tutulmuştur: `GeminiService` "görseli modele gönder,
şemaya oturt" der ve **fırlatır**; `ClothingAnalysisService` "hangi parça, ne
zaman, kaç kez" der ve **ASLA FIRLATMAZ**. Bu ayrım olmasaydı maliyet koruması,
eşzamanlılık sınırı ve kota soğuması ya prompt mantığına karışır ya da her
çağrı yerinde tekrar yazılırdı.

Servisin dokunulmaması gereken kuralları:

- **Asla fırlatmaz.** Analiz, kıyafet ekleme akışının parçası değil üstüne konan
  bir zenginleştirmedir (WeatherService ile aynı ilke). Her yol bir `durum`
  nesnesiyle biter: `tamamlandi` / `atlandi` / `basarisiz`.
- **Dolu `ai_analysis` yeniden analiz edilmez** (`force` hariç). Maliyet koruması.
- **In-flight işareti İLK `await`'ten ÖNCE konur.** Kayıt okuma asenkron olduğu
  için işaret sonra konsaydı iki eşzamanlı tetikleme de muhafızı geçer ve aynı
  parça için İKİ Gemini çağrısı yapılırdı (bu hata yaşandı, test kapsıyor).
- **Eşzamanlılık `MAX_CONCURRENT = 2` ile sınırlı.** Toplu yükleme tek seferde
  10 eşzamanlı isteğe dönüşseydi dakikalık kota anında dolardı.
- **Kota hatasında soğuma başlar** ve süresi Gemini'nin bildirdiği `retryDelay`
  ile varsayılanın büyüğüdür. Kota hatası **yeniden DENENMEZ**.
- **`force` EMBEDDING'E DE AKTARILIR.** Yeniden analiz `ai_analysis` üzerine
  yazdığında ondan TÜREYEN embedding de bayatlar; `indexItemInBackground`'a
  `{ force }` geçilmeseydi VectorService'in maliyet koruması ("zaten
  indekslenmiş") devreye girer ve parça artık geçersiz olan eski vektörüyle
  kalırdı — Kombin Öner ve "Buna Benzer Diğer Parçalar" bayat veriyle
  çalışmaya devam ederdi. Test bunu ayrıca doğruluyor.
- **Yalnızca GEÇİCİ hatalar yeniden denenir** (zaman aşımı, 5xx, çözülemeyen
  JSON), en fazla `MAX_ATTEMPTS = 2`. Geçersiz anahtar / bulunamayan model
  tekrar denemekle düzelmez, ikinci çağrı yalnızca kota harcardı.

**Tetikleme CONTROLLER'dadır, servis katmanında değil.** `ClothingItemController.uploadImage`
önce `res.json(...)` ile yanıtı gönderir, sonra `analyzeItemInBackground(...)`
çağırır ve **await ETMEZ**. "Önce cevapla, sonra çalış" bir HTTP sınırı
kararıdır; `ClothingItemService` isteğin ne zaman bittiğini bilmez. Analiz
servisi controller'a **opsiyonel** ikinci bağımlılık olarak verilir: verilmezse
fotoğraf yükleme eskisi gibi çalışır, yalnızca analiz devreye girmez.
`WeatherService` ile aynı iki kural geçerlidir — **anahtar yoksa dış servise HİÇ
gidilmez** ve **istek zaman aşımsız bırakılmaz** (`AbortSignal.timeout`, 30 sn).
Farkı: WeatherService asla fırlatmaz (hava durumu isteğe bağlı zenginleştirmedir),
GeminiService fırlatır — çünkü burada kullanıcı doğrudan bir analiz istemiştir ve
sessizce boş dönmek yanlış olurdu.

**Model adı `.env`'den değiştirilebilir** (`GEMINI_MODEL`). Kod değil yapılandırma
güncellensin diye; model emeklilikleri sık yaşanıyor (bkz. aşağıdaki uyarı).

> **Model listede görünmesi kullanılabilir olduğu anlamına GELMEZ.**
> `models?key=…` çıktısında `gemini-2.5-flash` görünüyor ama çağrıldığında
> `404 — no longer available to new users` veriyor. Model değiştirirken listeye
> bakmak yetmez, gerçekten **çağırarak** doğrulayın.

**Ten tonu katmanı.** `UserRepository` (yeni iki metod) → `SkinToneService` →
`SkinToneController` → `skinToneRoutes`. Zincir deponun desenine uyar; iki
ayırt edici kuralı var:

- **FIRLATIR** — `ClothingAnalysisService`'in tam TERSİ. Ölçüt yine aynı:
  orada analiz kıyafet akışının üstüne konan bir zenginleştirmeydi ve kimse
  beklemiyordu; burada kullanıcı selfie'sini yükleyip ekrana bakıyor, tek
  beklediği şey bu sonuç. Sessizce boş dönmek yanlış olurdu.
- **DOSYA YAŞAM DÖNGÜSÜ hata yollarında da doğru olmalı.** Gemini patlarsa,
  yüz bulunamazsa, veritabanı yazması düşerse YENİ dosya geri alınır; ESKİ
  dosya yalnızca yeni analiz başarıyla yazıldıktan SONRA silinir.

`skin_tone_*` kolonları `UserRepository.SAFE_COLUMNS`'a **bilerek eklenmedi**:
`/auth/me` ve `/users/:id` her yerde çağrılıyor, hassas selfie yolunu ve
büyükçe analiz nesnesini oralarda taşımanın bir sebebi yok. Yalnızca kendi
ucundan okunurlar; test bu sızıntıyı ayrıca kontrol eder.

**Selfie dosyaları AYRI bir klasörde ve AYRI bir servis mekanizmasıyla
tutulur** (`backend/uploads/selfies/`, `config/upload.js`): kıyafet
fotoğraflarıyla aynı `UPLOAD_DIR` kökünü PAYLAŞMAZLAR. Sebep — bir selfie,
tahmin edilemez UUID adına rağmen bir tişört fotoğrafından daha hassas bir
veri türüdür; adres bir kez sızarsa (ekran görüntüsü, tarayıcı geçmişi,
proxy log'u) kimlik doğrulaması olmayan `/uploads` üzerinden herkes erişebilirdi.

- **`uploadSelfieImage`** (`config/upload.js`) — `uploadImage` ile AYNI
  `fileFilter`/boyut sınırını paylaşan ama hedefi `SELFIE_UPLOAD_DIR` olan
  ayrı bir multer diskStorage. `skinToneRoutes` bunu kullanır, `uploadImage`
  DEĞİL — kıyafet route'ları hiç değişmedi.
- **`removeSelfieFile` / `resolveSelfiePath`** — `removeUploadedFile`'ın
  selfie karşılıkları, AYRI fonksiyonlar olarak tutuldu (tek bir "dizin
  parametresi" eklemek yerine): çağıran yerin hangi dosya türünü sildiğini
  isim düzeyinde görmesi, bir kıyafet silme çağrısının yanlışlıkla selfie
  dizinine (ya da tersi) bakması ihtimalini tamamen ortadan kaldırır.
  `SkinToneService` artık `removeUploadedFile`'ı HİÇ kullanmaz.
- **`server.js`, `/uploads/selfies` yolunu genel `/uploads` static
  middleware'inden ÖNCE 404'e düşürür.** Bu, fiziksel ayrımın TEK BAŞINA
  yeterli olmadığının kabulüdür — bir dizin adı tahmin edilebilir, bu yüzden
  asıl güvence Express seviyesindeki bu engelleme satırıdır. Kıyafet
  fotoğrafları (`/uploads/<uuid>.png`, kök dizinde) bu bloğa hiç girmez ve
  eskisi gibi token'sız servis edilmeye devam eder — CLAUDE.md'de zaten
  belgeli, bilinçli bir ödünleşme, DEĞİŞMEDİ.
- **`GET /users/skin-tone-analysis/photo`** — `SkinToneController.getPhoto`
  dosyayı `express.static` yerine `res.sendFile` ile DOĞRUDAN okuyup
  gönderir. Yolda `:id` YOKTUR (skinToneRoutes'un genel kuralıyla aynı):
  kimlik `req.userId`'den gelir, `SkinToneService.getPhotoPath` de bu id ile
  sorgular — başka bir kullanıcının selfie'sini "id ile bile" istemenin bir
  yolu yok, çünkü sorguya girecek böyle bir parametre hiç mevcut değil.
  `Cache-Control: private, max-age=0, no-store` döner (paylaşılan önbellekte
  iz bırakmasın diye); selfie yoksa `404`.
- **`UserRepository.collectUploadedFileNames` İKİ AYRI liste döner**
  (`clothingImageUrls` + `selfiePhotoUrl`, tek bir düz dizi DEĞİL):
  `UserService.deleteUser` artık kıyafet fotoğrafları için `removeUploadedFile`,
  selfie için `removeSelfieFile` çağırır — iki dosya türü farklı klasörlerde
  yaşadığı için tek bir silme fonksiyonu artık ikisine birden uymuyor.
- **`cleanup.js`'in öksüz dosya taraması İKİ AYRI dizini gezer**
  (`UPLOAD_DIR` kökü + `SELFIE_UPLOAD_DIR`, ortak mantık `taraVeSil`
  yardımcısında); kök taraması `selfies` klasör adını **hariç tutar** —
  aksi hâlde bir alt klasörü sıradan bir "öksüz dosya" sanıp `unlink` ile
  silmeye çalışır (ve `EISDIR` ile başarısız olurdu).
- **Var olan selfie'ler için tek seferlik taşıma scripti:**
  `test-scripts/migrate-selfie-photos.js`. Özellikten ÖNCE analiz yapmış
  kullanıcıların selfie'si hâlâ `uploads/` kökünde durabilir; script bunları
  `uploads/selfies/`'e taşır ve `users.skin_tone_photo_url`'i günceller.
  **VARSAYILAN SALT OKUNURDUR** (`create-embeddings.js` kalıbı), `--uygula`
  ile gerçekten taşır; **İDEMPOTENTTİR** (yolu zaten `/uploads/selfies/` ile
  başlayan kayıtlar atlanır, script defalarca çalıştırılabilir). Dosya önce
  taşınır, veritabanı ANCAK ondan sonra güncellenir — sıra tersine olsaydı ve
  taşıma patlasaydı kayıt, artık var olmayan bir yolu gösterirdi.

**Vektör katmanı (Aşama 3, 2026-08-27'de ChromaDB'den pgvector'a taşındı —
bkz. §9).** `config/vectorStore.js` yalnızca bir `isEnabled()` bayrağı taşır
(ayrı bir istemci/host/port YOKTUR); `VectorRepository` paylaşılan `pool`
(config/database.js) üzerinden pgvector'a SQL ile konuşur ve **fırlatır**,
`VectorService` iş mantığını taşır. Zincir depodaki desene birebir uyar —
tek fark, "vektör deposu" artık Postgres'in KENDİSİ (`clothing_item_embeddings`
tablosu), ayrı bir servis değil.

`VectorService`'in **iki ayrı sözleşmesi** var ve bu bilinçlidir (pgvector
geçişinden ETKİLENMEDİ, ChromaDB döneminden AYNEN kaldı):

- **YAZMA (`indexItem` / `indexItems` / `removeItem`): ASLA FIRLATMAZ.**
  Embedding, kıyafet akışının parçası değil üstüne konan bir zenginleştirmedir.
  Vektör deposu kapalıysa, kota dolduysa veya Gemini'ye ulaşılamıyorsa kıyafet
  kaydı ve analizi yerinde durur, kullanıcı hiçbir şey görmez.
- **OKUMA (`findSimilar` / `findCompanions`): FIRLATIR.** Sessizce boş liste
  dönmek "benzer parça yok" gibi YANLIŞ bir cevap olurdu. Erişilemeyen servis
  `503` ile bildirilir. **Aşama 4 bu kuralı değiştirmedi:** Kombin Öner'in
  rastgeleye düşmesi gerekiyor ama bu kararı İSTEMCİ verir — API dürüst kalır,
  yoksa arayüz rastgele bir öneriyi "akıllı" sanıp rozeti haksız yere gösterirdi.

`findCompanions` (Aşama 4) `findSimilar`'dan üç noktada ayrılır: **kategori
başına AYRI sorgu** atar (tek büyük sorgu az parçalı kategoriyi hiç
döndürmeyebilirdi), sonuçları **kategoriye göre gruplanmış** verir ve
**3 sn'lik kendi zaman aşımı** vardır (`COMPANION_TIMEOUT_MS`) — pgvector
sorguları aynı bağlantı havuzu üzerinden gittiği için normalde birkaç
milisaniye sürer, bu sınır artık "ayrı bir servise ağ turu" değil genel bir
güvenlik ağıdır (veritabanı o an aşırı yüklüyse öneri ekranı süresiz
beklemesin diye). Zenginleştirme tek sorguda yapılır
(`ClothingItemRepository.findByIds`): kategori başına N aday için ayrı ayrı
`findById` atmak veritabanına onlarca tur demekti.

**Bozuk biçimli id her iki okuma yolunda da `assertUuid` ile `400`'e çevrilir.**
Doğrudan Postgres'e gitseydi `22P02` ile `500` dönerdi — `GET /outfits?clothingItemId=`
filtresinde yaşanan tuzağın aynısı.

Aynı ayrım GeminiService ↔ WeatherService arasında da var ve aynı ölçüte
dayanıyor: **o anda cevap bekleyen bir kullanıcı var mı, yok mu.**

Servisin dokunulmaması gereken kuralları (ClothingAnalysisService ile aynı aile):

- **In-flight işareti İLK `await`'ten ÖNCE konur** — sonra konsaydı iki
  eşzamanlı tetikleme de muhafızı geçerdi (Aşama 2'de bu hata yaşandı).
- **Vektörü olan parça yeniden embed EDİLMEZ** (`force` hariç). Maliyet koruması.
- **Vektör deposuna erişilemiyorsa embedding HİÇ ÜRETİLMEZ.** Kontrol sırası
  bilinçlidir: önce "zaten var mı" diye tabloya sorulur, sonra Gemini'ye
  gidilir. Ters sırada olsaydı veritabanı kapalıyken her denemede para
  harcanır ve sonuç yazılamadan atılırdı.
- **Kota hatasında soğuma başlar**, süresi Gemini'nin bildirdiği `retryDelay`
  ile varsayılanın büyüğüdür; kota hatası yeniden DENENMEZ.
- **Yalnızca GEÇİCİ hatalar yeniden denenir**, en fazla `MAX_ATTEMPTS = 2`.
- **Eşzamanlılık semaforu BİLEREK YOK.** İki çağıranı da zaten sınırlı: analiz
  akışından geldiğinde `ClothingAnalysisService`'in `MAX_CONCURRENT = 2`
  semaforunun içindedir, toplu script ise N metni TEK istekte gönderir
  (`indexItems`, `BATCH_SIZE = 20`).

**Embedding metni ham JSON değil, CÜMLEdir** (`buildSummaryText`). Embedding
modeli doğal dilde eğitilmiştir: `{"kesim_tipi":"Oversize"}` ile "Kesimi
Oversize" aynı vektöre gitmez ve anahtar adları (`kesim_tipi`, `alt_kategori`)
anlam taşımayan gürültü ekler. Metne kullanıcının kendi yazdığı ad ve marka da
katılır — "Bershka crop top" bilgisi yalnızca orada var ve gerçek bir benzerlik
sinyali. Üretilen metin `clothing_item_embeddings.document` kolonunda da
saklanır, yani neyin embed edildiği sonradan SQL ile okunabilir.

**`user_id`/`category_id` BİLEREK DENORMALİZE edilir** (ChromaDB'nin metadata
deseninin AYNISI, bkz. §5 şema notu). `is_clean` veya `is_favorite` buraya
konsaydı kullanıcı her toggle'da bu tabloyu da güncellemek zorunda kalırdı;
güncellemeseydi filtre bayat veriyle çalışırdı. **Değişken durum her zaman
`clothing_items`'tan okunur.**

**pgvector `<=>` operatörü kosinüs MESAFESİ döner** (0 = birebir aynı yön) —
ChromaDB'nin koleksiyonu `cosine` uzayında açılmasıyla AYNI ölçüt; geçiş
sonrası benzerlik sıralamaları BİREBİR aynı davranışı korur (gerçek verilerle
karşılaştırılıp doğrulandı, bkz. §9). Bilinçli olarak bir ANN index'i
(ivfflat/hnsw) yok — kişisel gardırop ölçeğinde sıralı tarama yeterince hızlı
(bkz. §5).

**Tetikleme yine CONTROLLER'da.** `ClothingAnalysisService` analizi yazdıktan
SONRA `vectorService.indexItemInBackground(...)` çağırır ve **await etmez**;
sıra önemlidir çünkü embedding'in kaynağı `ai_analysis` kolonudur. Silme ise
`ClothingItemController.delete` içinde, `res` gönderildikten sonra tetiklenir.
Her iki bağımlılık da **opsiyoneldir**: verilmezse akış eskisi gibi çalışır.

**Kıyafet ile embedding'i arasında işlem bütünlüğü hâlâ YOKTUR** — artık aynı
veritabanında olsalar da FARKLI tablolardır ve silme çağrısı yukarıdaki gibi
AYRI, await edilmeyen bir adımdır (gerçek bir transaction'a sarılmamıştır).
Bu yüzden tutarsızlık hâlâ beklenen bir durumdur ve üç yerde karşılanır:
`findSimilar` sonuçları Postgres'ten doğrular (silinmiş parça yanıta düşmez),
`cleanup.js` tek bir anti-join SQL sorgusuyla öksüz kayıtları toplar
(ChromaDB döneminde bu iki AYRI depo arasında id listesi taşımayı
gerektiriyordu; artık tek sorgu yeterli), `create-embeddings.js` eksikleri
doldurur. Hard delete'lerde (`ON DELETE CASCADE`) bu risk zaten hiç oluşmaz —
yalnızca uygulamanın normal SOFT DELETE akışında geçerlidir.

**Auth katmanı.** `server.js` tek bir `AuthService` ve ondan türetilen tek bir
`authenticate` middleware kurar (token'ı imzalayan ve doğrulayan aynı örnek olmalı).
`authRoutes` bu yüzden diğerlerinden farklı olarak bir **fabrikadır**
(`createAuthRoutes(authService, authenticate)`). Yeni korumalı bir kaynak eklerken
`app.use('/api', authenticate, yeniRoutes)` deyip controller'da `req.userId` kullanın.

**Refresh token sistemi (`AuthService` + `UserRepository`, migration `007`).**
Eskiden tek bir 7 günlük access token vardı; süresi dolunca kullanıcı **zorla**
yeniden giriş yapıyordu. Artık iki token var ve amaç ayrışıyor: **access token
KISA ömürlü** (`accessTokenExpiresIn`, varsayılan `15m`) — çalınırsa saldırı
penceresi dar kalsın diye; **refresh token UZUN ömürlü** (`refreshTokenExpiresInMs`,
varsayılan `30d`, KAYAN pencere — her başarılı yenileme süresini `NOW() + 30d`'ye
iter) — kullanıcının GERÇEK oturum süresini bu taşır, ve access token dolduğunda
frontend'in arka planda sessizce yenilemesiyle kullanıcı hiçbir şey fark etmez.

- **Refresh token bir JWT DEĞİLDİR — opak bir dizedir:** `<userId>:<48 baytlık
  rastgele hex>` (384 bit entropi). Veritabanında yalnızca **bcrypt özeti**
  (`refresh_token_hash`) durur, ham değer bir daha asla sunucu tarafında görünmez
  (`password_hash` ile birebir aynı disiplin).
- **NEDEN userId TOKEN'IN İÇİNE GÖMÜLÜ — bilinçli bir mimari karar.** Bcrypt
  hash'leri SORGULANAMAZ (her hash'leme farklı salt üretir, `WHERE
  refresh_token_hash = ?` diye arama yapılamaz). Refresh isteği geldiğinde HANGİ
  kullanıcıya ait olduğunu bilmeden doğru satırı bulmanın pratik yolu ya TÜM
  kullanıcılar üzerinde `bcrypt.compare` ile doğrusal tarama yapmak (ölçeklenmez)
  ya da token'ın kendisine ucuz bir arama anahtarı gömmektir. İkincisi seçildi:
  `AuthService.#extractUserIdFromRefreshToken` token'ın `:`'dan önceki kısmını
  UUID olarak doğrulayıp `UserRepository.findRefreshTokenData(userId)` ile SADECE
  o satırı okur, sonra `bcrypt.compare` ile gerçek doğrulamayı yapar. Bu, DB'yi
  ele geçiren birine EK bir bilgi vermez (user id zaten access token payload'ında
  da açıkça duruyor) — yalnızca O(1) bir bakışta doğru satırı bulmayı sağlar.
- **ROTASYON (güvenlik pratiği, açıkça istendi).** Her başarılı `refresh()`
  çağrısı YENİ bir refresh token üretir VE `UserRepository.setRefreshToken` ile
  eski hash'in ÜZERİNE YAZAR — eski token bir daha ASLA kabul edilmez. Bir refresh
  token çalınırsa, meşru sahibi bir sonraki sessiz yenilemesini yaptığı anda
  çalıntı kopya kendiliğinden geçersiz kalır; test bunu `test-auth.js`'te
  "ROTASYONLA GEÇERSİZ KILINAN eski refresh token" kontrolüyle doğruluyor.
- **Kullanıcı başına TEK bir aktif refresh token** (ayrı bir "sessions" tablosu
  değil, `users` satırının kendisinde) — bu depodaki tek-satır-tek-kullanıcı
  deseniyle (`password_hash`, `skin_tone_photo_url`) tutarlı. Bilinçli sınırlama:
  yeni bir cihazda giriş yapmak öncekini geçersiz kılar; çoklu-cihaz oturum
  yönetimi kapsam dışı bırakıldı (bkz. §4 Eksikler).
- **Süre dolumu İKİ AYRI yerde kontrol edilir ve İKİSİ DE 401'e düşer:**
  `refresh_token_expires_at <= NOW()` (housekeeping olarak DB'den de temizlenir)
  ve `bcrypt.compare` başarısızlığı (rotasyonla geçersiz kılınmış/bozuk bir
  token). Hangi kontrolün başarısız olduğu dışarı **asla sızmaz** — ikisi de
  aynı `"Oturum yenilenemedi, lütfen tekrar giriş yapın"` mesajını döner (login'in
  "kullanıcı yok/şifre yanlış" ayrımsızlığıyla AYNI ilke).
- **`refresh()` yanıtında `user` alanı YOKTUR** — `register`/`login`'den farklı
  olarak çağıran zaten oturum açık bir sayfada, kullanıcı nesnesine ihtiyacı
  yok. Üçü de (`register`/`login`/`refresh`) ortak `#issueTokenPair(userId,
  email)` özel metodundan geçer — yalnızca `{ token, refreshToken }` döner,
  `user` alanını `register`/`login` kendi tarafında ayrıca ekler.
- **`JWT_EXPIRES_IN` ve `REFRESH_TOKEN_EXPIRES_IN` KENDİ küçük ayrıştırıcısıyla
  okunur** (`parseDurationToMs`, `AuthService.js` içinde). `jsonwebtoken` kendi
  içinde `ms` paketini kullanıyor ama bu paket `package.json`'da bizim DOĞRUDAN
  bağımlılığımız değil (transitive) — ona güvenmek kırılgan olurdu (bir üst
  paket güncellenip kaldırabilir). `.env` formatımız zaten dar bir küme
  (`"30d"`, `"12h"`, `"15m"`, düz saniye) olduğu için küçük, bağımsız bir
  regex yeterli görüldü.
- **`UUID_PATTERN` `utils/validators.js`'ten EK OLARAK export edildi** —
  `AuthService`'in refresh token'ın gömülü userId'sini biçim olarak doğrulaması
  için (`assertUuid` burada uygun değil: o fırlatır, burada sessizce `null`
  dönüp tek tip 401'e çevrilmesi gerekiyor).

**Frontend — `lib/auth.js` + `lib/api.js`.** Access token'la AYNI mekanizmayla
(`localStorage`, `dg_refresh_token` anahtarı) saklanır; httpOnly cookie'ye
BİLEREK geçilmedi (Capacitor WebView'de cookie tabanlı oturum yönetimi
karmaşıklaşır — ayrı origin/scheme, native isteklerle paylaşılmama gibi bilinen
sorunlar — ve bu depo zaten access token için de aynı ödünleşmeyi yapmıştı).

- **`setSession({ token, refreshToken })`** ikisini BİRLİKTE yazar — `Login`/
  `Register`/sessiz yenileme HEPSİ bunu kullanır. `clearToken()` artık İKİSİNİ
  DE temizler (`clearRefreshToken()` dahil) — yalnızca access token'ı silip
  refresh token'ı unutmak, oturumun "yarı düşmüş" garip bir durumda kalmasına
  yol açardı.
- **`api.js > tryRefreshSession` / `fetchWithAuth` — asıl "sessizce yenile"
  mekanizması.** `request`/`requestMultipart`/`fetchSkinTonePhoto`'nun ÜÇÜ DE
  artık ortak `fetchWithAuth`'tan geçiyor: 401 alınırsa (ve `Authorization`
  başlığı gönderilmişse) `tryRefreshSession()` çağrılır, başarılıysa
  `Authorization` başlığı YENİ access token'la değiştirilip istek **BİR KEZ**
  yeniden gönderilir — çağıran taraf (sayfa bileşenleri) bunu HİÇ BİLMEZ,
  yalnızca nihai `Response`'u görür. Yeniden deneme yalnızca bir kez yapılır
  (retry sonrası hâlâ 401 ise olduğu gibi döner, sonsuz döngü riski yok).
- **`refreshPromise` MODÜL SEVİYESİNDE paylaşılır (dedup).** Bir sayfa
  `Promise.all` ile birkaç uç çağırıyorsa (ör. Dashboard) ve hepsi AYNI ANDA
  401 alırsa, hepsi TEK bir `/auth/refresh` çağrısını PAYLAŞIR — ikinci ve
  sonraki çağıranlar kendi refresh isteklerini ATMAZ. Bu olmasaydı her biri
  kendi rotasyonunu tetikler ve birbirinin YENİ refresh token'ını anında
  geçersiz kılardı (rotasyon "en son kazanır" mantığında çalışır).
- **BİLİNÇLİ SINIRLAMA: bu dedup yalnızca BİR SEKME içindir.** Birden fazla
  sekme/pencere arasında paylaşılmaz — `refreshPromise` her sekmenin kendi JS
  heap'inde ayrı bir modül örneğidir. İki sekme aynı anda (birbirinden habersiz)
  refresh denerse, ROTASYON yüzünden ilk başarılı olan diğerinin token'ını
  geçersiz kılar ve o sekme bir sonraki isteğinde Login'e düşer. Bu, gerçek
  çok-sekmeli senkronizasyon (ör. `BroadcastChannel`) gerektirir; bu uygulamanın
  (tek kullanıcı, genelde tek sekme/cihaz) kapsamı dışında bırakıldı.
- **`hasValidSession()` artık refresh token'ı da SAYAR.** Yalnızca access
  token'ın süresine bakmak, aktif bir refresh token'ı olan bir kullanıcıyı HER
  SAYFA YÜKLEMESİNDE Login'e geri fırlatırdı — tam da bu özelliğin ORTADAN
  KALDIRMAYA çalıştığı "zorla yeniden giriş" deneyiminin ta kendisi (access
  token artık 15 dakika gibi kısa olduğu için bu her birkaç sayfa geçişinde bir
  olurdu). Artık: access token geçerliyse HIZLI yol (ağ isteği yok); değilse
  ama bir refresh token VARSA yine geçerli SAYILIR — gerçek yenileme burada
  YAPILMAZ, sayfa normal açılır ve ilk API çağrısı 401 aldığı anda
  `tryRefreshSession` sessizce devreye girer. Refresh token da geçersizse o
  ilk çağrı `notifyUnauthorized()`'a düşer ve kullanıcı GERÇEKTEN Login'e
  yönlendirilir — yani bu "iyimser" karar en kötü ihtimalle bir sayfa geçişi
  GECİKMESİYLE aynı doğru sonuca varır, asla yanlış bir "oturum açık" izlenimini
  kalıcı kılmaz.
- **`logout()` (Profile.jsx) sunucu çağrısını best-effort yapar.** `POST
  /auth/logout` başarısız olsa bile (ağ hatası, sunucu erişilemez) YEREL çıkış
  ENGELLENMEZ — `UserService.deleteUser`'daki dosya silme disipliniyle aynı
  ilke: kullanıcı deneyimi sunucu tarafı temizliğe rehin tutulmaz.
- **Doğrulama:** backend `test-auth.js`'e yeni bir bölüm eklendi (rotasyon,
  süre dolumu — veritabanında elle simüle edilir —, çıkış sonrası DB'nin
  GERÇEKTEN temizlendiği, süresi dolmuş bir access token'ın 401 döndürüp
  ARDINDAN atılan `/auth/refresh`'in çalışan yeni bir token ürettiği). Frontend
  tarafı (401 → sessiz yenile → yeniden dene, TAM SAYFA YENİLEMESİ OLMADAN;
  geçersiz refresh token → Login'e yönlendirme) gerçek tarayıcıda (Playwright +
  sistem Chrome) doğrulandı: `page.on('load')` sayacının yenileme boyunca
  **1'de kaldığı** (hiç tam sayfa yenilemesi olmadığı), localStorage'daki her
  iki token'ın da güncellendiği (rotasyon), ve geçersiz senaryoda gerçekten
  `/giris`'e düşüldüğü ölçüldü.

**Şifre sıfırlama sistemi (`AuthService` + `UserRepository` + `EmailRepository`,
migration `009`).** Öncesinde şifresini unutan bir kullanıcı için **hiçbir çıkış
yolu yoktu** — hesap kalıcı olarak kilitli kalırdı. Mekanizma refresh token'la
BİREBİR AYNI opak-token deseni kullanır ve bu bilinçli: iki akış da "kullanıcıya
verilecek, veritabanında yalnızca özeti tutulacak, tek kullanımlık/süreli bir
sır" ihtiyacını paylaşıyor.

- **`AuthService`'in özel token yardımcıları GENELLEŞTİRİLDİ.** Eskiden yalnızca
  refresh token için vardı (`#createRefreshToken` / `#extractUserIdFromRefreshToken`);
  bu çalışmayla `#createOpaqueToken(userId, byteLength)` /
  `#extractUserIdFromOpaqueToken(rawToken)` olarak yeniden adlandırılıp
  BAYT UZUNLUĞU parametrik hâle getirildi — refresh token 48 bayt
  (`REFRESH_TOKEN_BYTES`), sıfırlama token'ı 32 bayt (`RESET_TOKEN_BYTES`)
  kullanır. İkisi de `<userId>:<hex>` biçimindedir ve **JWT DEĞİLDİR** — bcrypt
  hash'leri sorgulanamadığı için (her hash'leme farklı salt üretir) token'ın
  kendisine ucuz bir arama anahtarı gömülür; bu, `refresh_token_hash` için
  zaten belgeli olan gerekçenin `reset_token_hash`'e de AYNEN uygulanmasıdır.
- **`forgotPassword(email)` ASLA fırlatmaz görünür bir sonuç üretmez —
  kayıtlı olsun olmasın controller HER ZAMAN `204` döner.** Bu, login'deki
  "kullanıcı yok/şifre yanlış" ayrımsızlığıyla AYNI ilke: yanıt farklı olsaydı
  saldırgan hangi e-postaların kayıtlı olduğunu tek tek deneyerek öğrenebilirdi.
  Kayıt bulunamazsa fonksiyon sessizce döner (hiçbir token üretilmez); bulunursa
  token üretilip `setResetToken` ile bcrypt özeti + bitiş tarihi
  (`NOW() + PASSWORD_RESET_EXPIRES_IN`, varsayılan 1 saat) yazılır ve
  `#sendResetEmail` çağrılır.
- **`#sendResetEmail` GeminiService/WeatherService ile AYNI "anahtar yoksa dış
  servise hiç gidilmez" ilkesini izler.** `emailRepository?.isConfigured`
  (`RESEND_API_KEY` dolu mu) `false` ise e-posta hiç gönderilmeye
  çalışılmaz, yalnızca sunucu log'una uyarı düşer — kullanıcıya dönen `204`
  DEĞİŞMEZ. Gönderim try/catch içindedir ve **hata yalnızca loglanır,
  fırlatılmaz**: e-posta servisi (Resend) o an düşmüş olsa bile `forgotPassword`
  çağıranına (controller'a) bunu asla yansıtmamalı — aksi hâlde yanıt süresi
  ya da hata varlığı "bu e-posta muhtemelen kayıtlı" sinyali verirdi.
- **`EmailRepository` — yeni bir "dış servis de repository'dir" örneği**
  (`WeatherRepository`/`GeminiService` ile AYNI rol): Resend API'sine native
  `fetch` ile konuşur, SDK kurulmadı (tek bir POST isteği için gereksiz bir
  bağımlılık olurdu). **Yalnızca veri erişimi, iş kuralı yok** — başarısız
  yanıtta (`!response.ok`) fırlatır, çağıranı (`AuthService`) bilgilendirmek
  onun işi değildir.
- **Resend sandbox kısıtı BİLİNÇLİ olarak kabul edildi:** özel bir alan adı
  doğrulanana kadar varsayılan gönderen adresi (`onboarding@resend.dev`)
  YALNIZCA Resend hesabının kendi sahibinin e-postasına gönderim yapabilir.
  Gerçek kullanıcılara göndermek için `RESEND_FROM_ADDRESS` doğrulanmış bir
  alan adıyla doldurulmalı — bu, `.env.example`'da açıkça not edilmiştir.
- **`resetPassword(rawToken, newPassword)` iki ayrı süre/geçerlilik kontrolü
  yapar ve İKİSİ DE aynı 401'e düşer** (refresh token'daki "hangi kontrol
  başarısız oldu dışarı sızmaz" ilkesiyle AYNI): `reset_token_expires_at`
  geçmişse (ki bu durumda ayrıca `clearResetToken` ile housekeeping yapılır)
  ve `bcrypt.compare` başarısız olursa (yanlış/kullanılmış token). Başarılı
  sıfırlamada üç şey birlikte olur: yeni şifre yazılır, sıfırlama token'ı
  **temizlenir (tek kullanımlık)** ve kullanıcının **refresh token'ı da
  geçersiz kılınır** (`clearRefreshToken`) — şifre değiştiyse tüm var olan
  oturumların düşmesi gerekir, aksi hâlde çalınmış bir cihazdaki eski oturum
  şifre sıfırlansa bile çalışmaya devam ederdi.
- **Frontend — `ForgotPassword.jsx` / `ResetPassword.jsx`, ikisi de
  `AuthLayout` kalıbını (Login/Register ile AYNI) kullanır.**
  `ForgotPassword` başarı/başarısızlık AYRIMI YAPMAZ: istek başarıyla gittiyse
  (400/429 gibi gerçek bir hata almadıysa) her zaman AYNI "E-postanı Kontrol
  Et" ekranını gösterir — backend'in enumeration-önleme sözleşmesini frontend
  BOZMAMALI. `Login.jsx`'teki "Şifremi Unuttum?" linki o an yazılmış olan
  e-postayı `state` ile taşır (kullanıcı tekrar yazmasın diye); `ResetPassword`
  URL'den `?token=` okur, token yoksa/eksikse hiç form göstermez ("Bağlantı
  Geçersiz"). Başarılı sıfırlama `navigate('/giris', { state: { passwordReset:
  true } })` ile Login'e döner; Login bu bayrağı okuyup kısa bir onay satırı
  gösterir (ayrı bir toast sistemi kurulmadı, mevcut `location.state`
  aktarım deseni — `ProtectedRoute`'un `state.from`'uyla AYNI fikir —
  yeterliydi).
- **Doğrulama:** `test-scripts/test-premium-and-reset.js` (bkz. aşağıdaki
  "Premium sınırları" ile aynı dosya, iki özellik birlikte test edilir) —
  enumeration yokluğu, token'ın veritabanına gerçekten yazılması, geçersiz/
  kullanılmış/süresi dolmuş token'ların hepsinin 401'e düşmesi, başarılı
  sıfırlama sonrası eski şifrenin çalışmaması + yeni şifrenin çalışması +
  eski refresh token'ın geçersiz kalması. Gerçek tarayıcıda (Playwright +
  sistem Chrome, 16 kontrol): "Şifremi Unuttum?" linki, e-posta ön-doldurma,
  var olan/olmayan e-postada AYNI ekran, gerçek token'la form doldurma,
  eşleşmeyen şifre hatası, başarılı sıfırlama sonrası Login'e dönüş + onay
  mesajı, eski/yeni şifreyle giriş, token'sız/geçersiz token senaryoları.

**Premium sınırları (`config/plans.js`, `ClothingItemService`,
`OutfitService`).** `users.subscription_tier` kolonu Aşama 1'den beri vardı
ama **hiçbir yerde okunmuyordu** — Profil sayfasındaki "Premium Abonelik"
kartı sabit "Ücretsiz Plan" yazan, "Premium'a Geç" butonu hiçbir şeye
bağlı olmayan (dead button) bir dekordu. Bu artık GERÇEKTEN uygulanır.

- **Sınırlar KASITLI OLARAK Gemini kotasından BAĞIMSIZ tutuldu.** Uygulamanın
  tamamı TEK bir Gemini API anahtarını, günde yalnızca 20 istekle paylaşıyor
  (bkz. §4 Eksikler) — "Premium'da sınırsız AI analizi" gibi bir vaat bu kotayla
  hemen çelişirdi. Bunun yerine sınır, kotadan tamamen bağımsız iki basit
  veritabanı SAYIMINA dayanır: `FREE_LIMITS = { clothingItems: 30, outfits: 10 }`.
  `isPremium(user)` yalnızca `user.subscription_tier === 'premium'` kontrolüdür.
- **HTTP `402 Payment Required` bilinçli olarak seçildi, `403` DEĞİL.** `403`
  "bunu asla yapamazsın" der (yetkilendirme); `402` "şu an yapamazsın ama
  yükseltirsen yapabilirsin" der — bu ayrım hem semantik olarak daha doğru
  hem de frontend'in ileride "yükselt" bağlantılı özel bir hata ekranı
  yapmasına (şimdilik generic hata mesajı gösteriliyor) zemin hazırlıyor.
  Yeni `PremiumRequiredError extends AppError` (`utils/errors.js`,
  `statusCode = 402`) eklendi; `BaseController.handleError` `error.statusCode`
  üzerinden GENERİK çalıştığı için **hiçbir controller değişmedi**.
- **Kontrol servis katmanında, repository'de DEĞİL** — depodaki "iş kuralı
  serviste yaşar" ilkesiyle tutarlı. `ClothingItemService.createItem` ve
  `OutfitService.createOutfit` yazmadan ÖNCE `#assertUnderItemLimit`/
  `#assertUnderOutfitLimit` çağırır; bu da `userRepository.findById` ile
  kullanıcıyı okuyup `isPremium` değilse `clothingItemRepository.countActive`/
  `outfitRepository.countByUser` ile GÜNCEL sayıyı okur. **Constructor'lar
  değişti:** `ClothingItemService(clothingItemRepository, userRepository)` ve
  `OutfitService(outfitRepository, userRepository)` — ikinci parametre YENİ;
  route dosyaları (`clothingItemRoutes.js`/`outfitRoutes.js`, DI container'lar)
  kendi `new UserRepository(pool)` örneklerini kurup geçirecek şekilde
  güncellendi (skinToneRoutes'un zaten yaptığı "route dosyası ihtiyaç
  duyduğunda serbestçe `new UserRepository(pool)` kurar" deseniyle AYNI).
- **Yalnızca YAZMA (create) yolları kontrol edilir**, okuma/güncelleme/silme
  DEĞİL — bir kullanıcı zaten sahip olduğu 31. parçayı düzenleyebilir/silebilir/
  favorileyebilir, yalnızca YENİ bir 31. parça EKLEYEMEZ. Sınırı aşan bir
  kullanıcı sonradan premium'dan ücretsize düşerse (şu an böyle bir akış yok
  ama ileride olursa) mevcut verisi silinmez, yalnızca yeni ekleme kilitlenir.
- **Hata mesajı sınır sayısını İÇERİR** (`` `Ücretsiz planda en fazla ${FREE_LIMITS.clothingItems}
  parça saklayabilirsin. Daha fazlası için Profil > Premium Abonelik üzerinden
  yükselt.` ``) — kullanıcı "neden" ve "nasıl çözülür"ü aynı mesajda görür,
  ayrı bir yardım sayfasına gitmesi gerekmez.
- **Frontend — `lib/plans.js` (`FREE_LIMITS`) backend'deki `config/plans.js`
  ile BİREBİR AYNI tutulmalıdır** (paylaşılan bir modül olmadığı için
  senkronizasyon ELLE yapılır — `OUTFIT_REQUEST_CATEGORIES` ↔ `lib/occasions.js`
  ile AYNI desen). Bu değer yalnızca GÖSTERİM amaçlıdır ("30 parçadan X'i
  kullandın" gibi); gerçek sınır sunucuda uygulanır, frontend'deki kopya
  ezilse bile hiçbir güvenlik/iş kuralı bozulmaz.
- **`components/PremiumCard.jsx` (YENİ) — Profil sayfasındaki dead card'ın
  yerini aldı.** `Profile.jsx`'in zaten yaptığı `fetchMe()` çağrısından gelen
  `subscription_tier`'ı prop olarak alır (AYRI bir istek atmaz); kullanım
  sayıları için KENDİ bağımsız `fetchWardrobeStats()` çağrısını yapar
  (`WardrobeStats`/`SkinToneSection`'ın bu sayfadaki "her bölüm kendi verisini
  çeker" deseniyle AYNI) — ama yalnızca ücretsiz kullanıcıda: premium'da sınır
  zaten yok, sayıyı göstermenin bir anlamı olmadığı için istek hiç atılmaz.
  Premium kullanıcıda "Premium'a Geç" butonu da HİÇ render edilmez (yükseltecek
  bir şey kalmadı).
- **`pages/Premium.jsx` (YENİ, `/profil/premium`) — buton artık GERÇEK bir
  yere gidiyor**, ama gerçek bir ÖDEME AKIŞI SUNMUYOR: ödeme altyapısı henüz
  kurulmadı. Sayfa gerçek kullanım sayılarını ve gerçek faydaları gösterir,
  ardından *"Ödeme altyapısı yakında burada olacak"* der — Bildirimler/
  Yardım & Destek'teki `ComingSoon` sayfalarıyla AYNI dürüstlük ilkesi
  (var olmayan bir işlevi varmış gibi göstermemek), ama içerik ÖZEL
  yazıldı (`ComingSoon` bileşeni yeniden kullanılmadı) çünkü burada
  gösterilecek GERÇEK veri (kullanım sayıları, faydalar) var.
- **Doğrulama — `backend/test-scripts/test-premium-and-reset.js` (YENİ, 19
  kontrol):** ücretsiz planda tam sınıra kadar sorunsuz oluşturma, sınırı aşan
  istekte `402` + sınır sayısını içeren mesaj, `subscription_tier = 'premium'`
  yapıldıktan SONRA sınırın ÜSTÜNE çıkabilme — hem parça hem kombin için ayrı
  ayrı. Gerçek tarayıcıda (Playwright + sistem Chrome, 12 kontrol): kart gerçek
  plan + gerçek kullanım sayısını gösteriyor, buton gerçekten `/profil/premium`'a
  gidiyor (ARTIK ölü buton DEĞİL), premium'a yükseltilince kart VE buton
  görünürlüğü GÜNCELLENİYOR.
- Regresyon: `test-auth` 71/71, `test-all-endpoints` 77/77, `test-stats` 60/60,
  `test-clean-status` 26/26, `test-item-outfits` 27/27, frontend lint + build
  temiz.

**Bildirimler sayfası (`pages/Notifications.jsx`, `/profil/bildirimler`).**
Öncesinde `ComingSoon` ile "yakında" yazan bir iskeletti; artık gerçek, hesaplanmış
bir özet gösterir. **Backend'de HİÇBİR DEĞİŞİKLİK gerekmedi** — sayfa tamamen
mevcut uçları (`fetchClothingItems`, `fetchCategories`, `fetchMe`, `fetchWeather`)
yeniden kullanır, bu da roadmap'teki "altyapısı zaten kod tabanında duran, yalnızca
bağlanmayı bekliyor" iddiasının doğrudan kanıtıdır.

- **GERÇEK PUSH/ANLIK BİLDİRİM DEĞİLDİR — bilinçli bir sınır.** Service Worker,
  VAPID anahtarları, native push (FCM/APNs) gibi bir altyapı bu depoda hiç yok ve
  tek bir sayfa için kurmak "hemen kazanç" ilkesiyle çelişirdi. Bunun yerine sayfa
  AÇILDIĞINDA var olan veriden GERÇEK, o an doğru olan bir özet hesaplanır —
  WeatherService/GeminiService'teki "isteğe bağlı zenginleştirme" ilkesiyle aynı
  ruh: bir bölüm için veri yoksa/hesaplanamıyorsa o bölüm sessizce hiç görünmez.
- **"Kaç gündür kirli" gibi bir tarih iddiası BİLEREK YOK.** `clothing_items.updated_at`
  yalnızca "son düzenleme" anını tutar — isim/renk gibi kirli durumla ilgisiz bir
  alan değiştirilse bile bu kolon güncellenir, dolayısıyla "ne zaman kirli
  işaretlendi" sorusuna güvenilir bir cevap DEĞİLDİR. Ayrı bir
  `kirli_isaretlenme_tarihi` kolonu eklemek tek bir bildirim satırı için orantısız
  bir migration olurdu; bu yüzden liste yalnızca GERÇEKTEN bildiği şeyi söyler
  (hangi parçalar ŞU AN kirli), uydurma bir gün sayısı göstermez.
- **Soğuk hava uyarısı yalnızca `weatherStatus === COLD_WEATHER_STATUS` iken
  çıkar** (`lib/seasons.js`, backend'in <10°C eşiğiyle senkron tutulan TEK sabit —
  `outfitBuilder.js`'in Dış Giyim slotuyla AYNI kaynak) — "BELİRSİZLİKTE EKLEME"
  değil "BELİRSİZLİKTE GÖSTERME" ilkesi burada da geçerli: şehir tanımlı değilse
  ya da hava servisine ulaşılamıyorsa bölüm hiç render edilmez, yanlış bir "hava
  soğuk" iddiası asla çıkmaz. **"Yarın"ı DEĞİL "bugün"ü** anlatır — `WeatherService`
  yalnızca GÜNCEL sıcaklığı döndürür, bir tahmin (forecast) API'si değildir; mesaj
  bilerek "Bugün hava soğuk" der, roadmap taslağındaki "yarın" ifadesi kasıtlı
  olarak kullanılmadı (var olmayan bir veriyi varmış gibi göstermemek için).
- **İki bölüm birbirinden BAĞIMSIZDIR ve BİRLİKTE görünebilir** — kirli parça listesi
  hava durumundan, hava uyarısı kirli parça sayısından etkilenmez; ikisi de yoksa
  "Her şey yolunda" boş durumu çıkar.
- **Doğrulama — gerçek tarayıcıda 12 kontrol (Playwright + sistem Chrome):** boş
  durum (kirli parça yok, şehir tanımsız); gerçek bir parça kirli işaretlenince
  bölümün göründüğü, adının listelendiği, sayacın doğru olduğu, tıklanınca
  kıyafet detayına gittiği; hava durumu mock'landığında (gerçek `/api/weather`
  route interception ile — `WEATHER_API_KEY` gerekmedi) soğuk uyarısının GERÇEKTEN
  çıktığı ve iki bölümün birlikte göründüğü; **sıcak havada uyarının HİÇ
  çıkmadığı**; temiz konsol.
- Regresyon: backend'e hiç dokunulmadı; frontend lint + build temiz.

**Fotoğraf depolama — Cloudflare R2 (`config/r2.js`, `StorageRepository`).**
Render'ın disk alanı **ephemeral**'dır — bu depoda daha önce gerçekten yaşanan
bir sorun: canlıya taşınan bir hesabın kıyafet fotoğrafları bir deploy sonrası
kayboldu ve elle yeniden yüklenmek zorunda kalındı. Bu, kalıcı bir çözümle
kapatıldı ama **yalnızca kıyafet fotoğrafları için** (aşağıdaki "Kapsam dışı"
notuna bakın).

- **`config/r2.js`, `config/gemini.js` ile AYNI rol:**
  istemci lazy kurulur ve anahtarlara bağlı önbelleklenir (`resetClient`,
  testler için — bu desen ChromaDB döneminde `config/chroma.js`'te de
  vardı). R2, S3 API'siyle uyumlu olduğu için resmi
  `@aws-sdk/client-s3` kullanılır — R2'ye özel bir SDK yoktur, Cloudflare'ın
  kendi dokümanları da bunu önerir.
- **BEŞ env değişkeninin HEPSİ dolu olmalı** (`R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`,
  `R2_PUBLIC_URL`) — `isConfigured()` biri bile eksikse `false` döner ve
  istemci HİÇ kurulmaz. Yarım yapılandırmayla denemek, yüklemenin ortasında
  patlayan bir isteğe yol açardı; WeatherService/GeminiService'teki "anahtar
  yoksa dış servise hiç gidilmez" ilkesiyle AYNI disiplin.
- **`StorageRepository` — "dış servis de repository'dir" ailesinin YENİ
  üyesi** (`WeatherRepository`/`EmailRepository` ile AYNI rol): yalnızca
  `upload`/`remove`, iş kuralı yok, **FIRLATIR** — hangi hatanın "önemli"
  olduğuna çağıran (controller/service) karar verir.
- **YEREL DOSYA SİLİNMEZ — bilinçli bir mimari karar, performans/tembellik
  değil.** R2 yapılandırıldığında fotoğraf HEM yerel diske (multer'ın zaten
  yaptığı gibi) HEM R2'ye yazılır; `image_url` kolonuna R2'nin genel adresi
  kaydedilir. Yerel kopyanın SİLİNMEMESİNİN sebebi: `ClothingAnalysisService`
  (arka plan Gemini analizi) görseli HÂLÂ yerel diskten, dosya adıyla okuyor
  (`UPLOAD_DIR` + `fileNameFromImageUrl`) — bu okuma yoluna HİÇ dokunulmadı.
  Analiz normal koşullarda saniyeler içinde tamamlandığı için yerel kopyanın
  bir sonraki deploy'a kadar HAYATTA KALMASI yeterli; kaybolsa bile artık
  ÖNEMLİ DEĞİL çünkü kalıcı referans (`image_url`) zaten R2'yi gösteriyor.
- **R2 yüklemesi BAŞARISIZ olursa sessizce yerel yola düşülür**
  (`ClothingItemController.uploadImage`) — bir bulut deposu sorunu asla bir
  kıyafet ekleme isteğini düşürmemeli; hata yalnızca loglanır.
- **Silme yolları da yansıtılır** (`ClothingItemService.#removeStoredImage`,
  kıyafet silinince/fotoğraf değiştirilince/fotoğraf kaldırılınca çağrılan TEK
  nokta): yerel dosya HER ZAMAN silinir, `image_url` mutlak bir `http(s)`
  adresiyse (yani R2'de duruyorsa) R2 objesi de silinir. **R2 silme hatası
  FIRLATILMAZ** (yalnızca loglanır) — bir bulut objesinin silinememesi,
  kıyafetin kendisinin silinmesini asla engellememeli.
- **`ClothingItemService`/`ClothingItemController` üçüncü/dördüncü OPSİYONEL
  bağımlılık aldı** (`storageRepository`) — `clothingAnalysisService`/
  `vectorService` ile AYNI desen: verilmezse (ya da yapılandırılmamışsa)
  davranış BİREBİR eskisi gibi kalır, testler ve bu özelliği istemeyen bir
  kurulum hiç etkilenmez.
- **R2 anahtarı R2'nin nesne adı olarak kıyafetin dosya adını (UUID+uzantı)
  KORUR** (`clothing-items/<dosya-adı>`) — yerel dosya adıyla R2 anahtarı
  AYNI kalır ki `fileNameFromImageUrl` (basit `path.basename`) her iki
  URL biçiminde de (yerel `/uploads/...` ve R2'nin tam `https://...` adresi)
  doğru dosya adını çıkarabilsin; ayrı bir eşleme tablosu gerekmedi.
- **Geriye dönük taşıma: `test-scripts/migrate-photos-to-r2.js`** —
  `migrate-selfie-photos.js` ile BİREBİR AYNI kalıp (VARSAYILAN SALT OKUNUR,
  `--uygula` ile gerçekten yükler, İDEMPOTENTTİR — `image_url` zaten
  `http` ile başlayan kayıtlar atlanır). Yerel dosya burada da SİLİNMEZ.
- **BİLİNÇLİ OLARAK KAPSAM DIŞI BIRAKILAN İKİ NOKTA:**
  1. **Selfie'ler R2'ye taşınmadı.** Kıyafet fotoğrafları herkese açık ve
     token'sız servis ediliyor (R2'nin genel URL'si bu modelle bire bir
     örtüşüyor); selfie'ler ise BİLEREK özel/token'lı bir uçtan servis
     ediliyor (`GET /users/skin-tone-analysis/photo`, bkz. §8). R2'nin
     genel bucket URL'sini selfie için kullanmak bu güvenlik modelini
     kırardı — doğru çözüm (özel bucket + imzalı/süreli URL ya da backend
     üzerinden proxy) bu oturumun kapsamına alınmadı, "Eksikler" tablosuna
     işlendi.
  2. **Gerçek zamanlı R2 öksüz-obje temizliği yok.** `cleanup.js`'in yerel
     disk için yaptığı `temizleOksuzDosyalar()` süpürmesi R2'ye HENÜZ
     GENİŞLETİLMEDİ — bir R2 yükleme/silme çağrısı beklenmedik şekilde
     yarım kalırsa (ör. süreç R2'ye yazdıktan hemen sonra çöker) o obje
     R2'de öksüz kalabilir. Düşük olasılıklı ve zararsız (yalnızca depolama
     alanı israfı, CLAUDE.md'de belgeli); gerçek kullanıcı verisiyle test
     edildikten sonra bir sonraki adımda eklenebilir.
- **Doğrulama — `backend/test-scripts/test-storage.js` (YENİ, 15 kontrol,
  GERÇEK bir R2 hesabı GEREKTİRMEZ):** yapılandırılmamışken `isConfigured`
  false + `getClient()` null + `upload`/`remove` network denemeden fırlıyor;
  5 alandan biri eksikken yine devre dışı; tam (sahte) yapılandırmada istemci
  gerçekten kuruluyor ve bucket/URL doğru okunuyor; anahtar değişince istemci
  önbelleğinin doğru geçersiz kılınması; `ClothingItemService`'in
  `storageRepository` verilmeden de constructor'da patlamaması.
  **Gerçek bir R2 yükleme/silme burada TEST EDİLMEDİ** — gerçek kimlik
  bilgileri elde olduğunda `POST /clothing-items/:id/image` uçtan uca
  doğrulanmalı (aşağıdaki "Açık iş"e bakın).
- **Regresyon (R2 YAPILANDIRILMAMIŞ ortamda, yani mevcut CI/geliştirme
  durumu):** `test-all-endpoints` 77/77, `test-image-upload` 29/29 (kritik —
  bu değişikliğin YEREL diske hiç dokunmadığının kanıtı), `test-auth` 71/71,
  `test-stats` 60/60, `test-clean-status` 26/26, `test-item-outfits` 27/27,
  `test-premium-and-reset` 19/19, tüm dosyalar `node --check` ile sözdizimi
  doğrulaması temiz.
- **AÇIK İŞ — gerçek bir Cloudflare R2 hesabıyla UÇTAN UCA henüz
  denenmedi.** Bu, bir hesap/bucket/API token oluşturmayı ve gerçek kimlik
  bilgilerini `.env`'e (ve Render'ın env değişkenlerine) girmeyi gerektiriyor
  — yalnızca kullanıcının yapabileceği bir adım. Kod tarafı "yapılandırılmamış"
  durumda TAM regresyonla doğrulandı; gerçek kimlik bilgileriyle asıl akış
  (yükle → R2'de gerçekten var mı → `<img>` R2'den gerçekten yükleniyor mu →
  sil → R2'den gerçekten kalkıyor mu) henüz GÖZLEMLENMEDİ. Ayrıca R2
  bucket'ında **CORS politikasının** frontend origin'ine izin verecek şekilde
  açılması gerekiyor — `shareCard.js`'in fotoğrafları `fetch` ile `data:`
  URI'ye çevirdiği paylaşım akışı, R2 CORS başlık göndermezse cross-origin
  `fetch` ile kırılır (kart o fotoğraf için yer tutucuya düşer, tüm paylaşım
  engellenmez — ama bu da doğrulanmadı).

**Kullanım başına maliyet (cost-per-wear).** Yol haritasının "Farklılaştırıcı"
şeridindeki ilk madde: kullanıcı bir parçaya ne ödediğini girer, uygulama
"bu parça sana kullanım başına kaç ₺'ye geldi" gibi somut bir rakam üretir.

- **`purchase_price` NUMERIC(10,2)** (migration `010`) — INTEGER'a (kuruşsuz)
  ya da FLOAT'a (yuvarlama hatası riski) BİLEREK konulmadı.
- **"Kaç kez giyildi" ayrı bir kolon DEĞİL — TÜRETİLEN bir değer.**
  `clothing_items`'ta bir "giyilme sayısı" kolonu yok; giyilme yalnızca
  `outfits.times_worn` üzerinden, KOMBİN bazında tutuluyor ("Bugün Giydim"
  düğmesi). Bir parçanın toplam giyilme sayısı, o parçayı İÇEREN tüm
  kombinlerin `times_worn` toplamıdır — `ClothingItemRepository.findById`
  içinde bir `SUM` alt sorgusuyla hesaplanır (`outfit_items` → `outfits` JOIN).
- **Bu alt sorgu YALNIZCA `findById`'de var, `findAll`/`findByCategory`/
  `findByIds`'te YOK.** Kapsam bilinçli olarak dar tutuldu: cost-per-wear
  yalnızca Kıyafet Detay'da gösteriliyor, Gardırop ızgarası ya da vektör aday
  zenginleştirmesi bu hesaplamaya hiç ihtiyaç duymuyor — sık çağrılan liste
  uçlarına gereksiz bir JOIN eklemenin bir karşılığı olmazdı.
- **`cost_per_wear` SERVİS katmanında hesaplanır** (`ClothingItemService.
  getItemById > #computeCostPerWear`), repository'de DEĞİL — "SQL yalnızca
  veri, iş kuralı serviste yaşar" ilkesiyle tutarlı. Fiyat yoksa VEYA parça
  hiç giyilmediyse (`total_times_worn = 0`) `null` döner; `0`'a bölmek ya da
  uydurma bir "∞" değeri göstermek YANLIŞ bir bilgi olurdu.
- **`purchasePrice` `PUT`'ta gönderilmezse KORUNUR** (`isClean` ile AYNI
  "gönderilmezse mevcut değer korunur" deseni) — `name`/`color` gibi ilgisiz
  bir alanı düzenlemek sessizce fiyatı silmemeli. `isClean`'den FARKLI olarak
  burada gerçek bir "temizle" kavramı var: kullanıcı `null` gönderirse fiyat
  BİLEREK NULL'a döner (isClean hiçbir zaman NULL olamaz, hep `true`/`false`).
- **Frontend'de fiyat alanı `age` (AccountInfo.jsx) ile AYNI kalıbı izler:**
  input'a bağlı state STRING'tir (`''` boş), sayıya çevirme yalnızca gönderim
  anında (`purchasePrice === '' ? null : Number(purchasePrice)`) yapılır —
  Postgres NUMERIC kolonları `pg` sürücüsünde string döndüğü için (float
  hassasiyet kaybını önlemek için) bu, form değerini olduğu gibi taşımanın
  en basit yolu.
- **`ClothingDetail.jsx`'te bölüm fiyat YOKSA hiç render edilmez**
  ("Buna Benzer Diğer Parçalar" ile AYNI ilke — veri yoksa boşluk da
  bırakılmaz). Fiyat var ama parça hiç giyilmediyse `cost_per_wear` yerine
  nazik bir yönlendirme gösterilir ("Henüz 'Bugün Giydim' ile işaretlenmedi").
- **Doğrulama — `backend/test-scripts/test-cost-per-wear.js` (YENİ, 22
  kontrol):** fiyatsız parçada `cost_per_wear`/`purchase_price` NULL; fiyatlı
  ama hiç giyilmemiş parçada `cost_per_wear` NULL (0'a bölme değil); **KRİTİK
  — bir kombinde 2 kez "Bugün Giydim" sonrası `cost_per_wear = fiyat/2`**;
  **İKİNCİ bir kombinle aynı parçanın giyilmelerinin TOPLANDIĞI** (iki ayrı
  kombindeki giyilmeler birleşiyor); negatif/sayı olmayan fiyatın `400`
  döndüğü; `PUT`'ta fiyat gönderilmezse KORUNDUĞU, `null` gönderilirse
  GERÇEKTEN temizlendiği; liste ucunun `cost_per_wear`/`total_times_worn`
  TAŞIMADIĞI ama `purchase_price`'ı (form ön-doldurma için) taşıdığı.
  Gerçek tarayıcıda (Playwright + sistem Chrome, 12 kontrol): form alanının
  görünmesi, kaydedilen fiyatın Kıyafet Detay'da doğru gösterilmesi, **3 kez
  "Bugün Giydim" sonrası gerçek hesaplamanın ekranda çıkması (900 ₺ / 3 =
  300 ₺)**, düzenleme modunda fiyatın ön-dolu gelmesi, fiyat temizlenince
  bölümün kaybolması, temiz konsol.
- Regresyon: `test-all-endpoints` 77/77, `test-image-upload` 29/29 (fotoğraf
  akışına dokunulmadığının kanıtı), frontend lint + build temiz.
- **Kapsam dışı bırakılan (bilinçli):** paylaşılabilir bir "kombin kartı"
  (roadmap'in "sosyal medyada kendiliğinden dolaşan bir istatistik" fikri) —
  `ShareOutfitCard` KOMBİNLER için, tekil bir PARÇA istatistiği için ayrı bir
  paylaşım mekanizması bu oturumun kapsamına alınmadı; şimdilik yalnızca
  Kıyafet Detay'da gösteriliyor.

**Güvenlik middleware'leri (`server.js`, en üstte, tüm route'lardan önce).**

- **`helmet()`** — varsayılan güvenlik başlıkları (CSP, X-Frame-Options, HSTS
  vb.), TEK istisnayla: `crossOriginResourcePolicy: { policy: 'cross-origin' }`.
  Varsayılan `same-origin` CORP, kıyafet fotoğraflarının FARKLI bir origin'den
  (web `:5173`, Android `10.0.2.2`) `<img>` ile yüklenmesini kırardı — bu, bu
  fotoğrafların zaten token'sız ve cross-origin servis edilmesi tasarımının
  (bkz. §4 Eksikler) doğal bir sonucu, yeni bir zayıflatma değil. Gerçek
  tarayıcıda doğrulandı: cross-origin `<img>` hâlâ decode ediliyor
  (`naturalWidth > 0`).
- **`cors({ origin: … })`** — ARTIK SINIRLI. Eskiden `cors()` (parametresiz)
  HERHANGİ BİR origin'e izin veriyordu. İzin verilen liste, kod içindeki
  sabit varsayılanlar (`http://localhost:5173` web geliştirme,
  `http://localhost` Capacitor Android — `androidScheme: 'http'` —,
  `capacitor://localhost` Capacitor iOS) ile `.env`'deki
  `CORS_ALLOWED_ORIGINS`'in (virgülle ayrılmış) **birleşimidir**; `.env` değeri
  varsayılanların ÜZERİNE YAZMAZ, yalnızca EKLER — aksi hâlde `.env`'i eksik
  dolduran biri kendi web ya da Android bağlantısını koparırdı. Origin
  header'ı OLMAYAN istekler (curl, sunucu-sunucu) reddedilmez: CORS zaten
  yalnızca tarayıcı davranışıdır. Reddedilen origin'ler `cors`'un fırlattığı
  hatayı yakalayan özel bir hata middleware'i (server.js'in sonunda) ile
  temiz bir `403 + JSON`'a çevrilir — aksi hâlde çıplak, yanıltıcı bir `500`
  dönerdi.
- **`authLimiter` / `geminiLimiter`** (`middleware/rateLimiters.js`) —
  `express-rate-limit` ile. `authLimiter` (`/auth/register`, `/auth/login`;
  15 dk'da 5, IP bazlı) **LOOPBACK'İ (127.0.0.1/::1) MUAF TUTAR**: bir
  saldırgan bağlantısının kaynağını uzaktan bu adres gibi gösteremez, bu
  yüzden muafiyet güvenliği zayıflatmaz — yalnızca aynı makineden art arda
  hesap oluşturan test scriptlerinin (`test-all-endpoints.js` tek başına 6
  kayıt atıyor) birbirinin kotasını tüketmesini önler. `geminiLimiter`
  (`/clothing-items/:id/analyze`, `POST /users/skin-tone-analysis`; saatte 10,
  **`req.userId` bazlı**) bu muafiyeti BİLEREK PAYLAŞMAZ — amacı uzak bir
  saldırgandan korunmak değil, gerçek parayla sınırlı günlük Gemini kotasını
  korumaktır ve bu tehdit sunucunun kendisinden gelen bir istek için de
  aynen geçerlidir; kullanıcı bazlı anahtarlama zaten test scriptlerinin
  (her biri kendi taze kullanıcısını oluşturur) bu limite takılmasını
  önlüyor, ayrı bir muafiyete gerek kalmadı.

`utils/errors.js` içindeki **`ServiceUnavailableError` (503)** dış servis hataları
içindir: 500 "bizim kodumuz patladı" der ve kullanıcıya hiçbir şey anlatmaz,
503 ise "bağımlı olduğumuz servis şu an kullanılamıyor" der. `/health` de
veritabanı için aynı kodu kullanır.

**Silinmemesi gerekenler:** `config/database.js` içindeki `pool.on('error')` dinleyicisi
(bkz. Aşama 5), `UserRepository` içindeki açık kolon listesi (bkz. Aşama 6b) ve
`UserRepository.findByEmailForAuth` / `findByIdForAuth`'un **yalnızca** AuthService
tarafından kullanılması — bunlar `password_hash` döndüren tek metodlardır, dönen nesne
asla doğrudan API yanıtına verilmemelidir.

**`UserService.deleteUser` dosya yollarını CASCADE'DEN ÖNCE toplar.** `ON DELETE CASCADE`
yalnızca Postgres satırlarını temizler, diskteki dosyalara dokunmaz; kullanıcı silindikten
sonra `clothing_items.image_url`'lere bir daha erişilemez. Sıra: `collectUploadedFileNames`
(kıyafet fotoğrafları + `skin_tone_photo_url`) → `delete` (CASCADE tetiklenir) → her yol için
`removeUploadedFile` (best-effort, sessiz — kullanıcı zaten silindi, tek bir dosyanın
silinememesi asıl işlemi geri almamalı). `cleanup.js`'in kendi `DELETE FROM ...` çağrıları
(test parçaları + test kullanıcıları) bu akıştan GEÇMEZ; onun için ayrı bir
`temizleOksuzDosyalar()` var — vektör tablosunun `temizleOksuzVektorler()`'iyle birebir aynı
desen, yalnızca "referans" kümesi `clothing_items.image_url` + `users.skin_tone_photo_url`
birleşimi. `is_deleted` fark etmez: hem soft-delete edilmiş hem canlı satırların
referansları korunur, yalnızca DİSKTE OLUP hiçbir satırdan işaret edilmeyen dosyalar silinir.

Backend ayrı `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` değişkenleri okur.
**Kökteki** `.env.example` içindeki `DATABASE_URL` satırı mevcut kod tarafından kullanılmaz.

### Frontend

**API katmanı:** `src/lib/api.js` tek fetch noktasıdır. `request` yanıt `ok` değilse
gövdedeki `{ error }` mesajını okuyup fırlatır, böylece backend'in Türkçe hataları
kullanıcıya gösterilebilir. `204` için `null` döner.

**Kullanıcı kimliği:** `getCurrentUserId()` (`lib/api.js`) **saf JWT tabanlıdır**
— `getUserIdFromToken()` (`lib/auth.js`) ile token payload'ının `sub` alanını
okur. localStorage'da ayrıca tutulan bir `dg_user_id` YOKTUR ve bir yedek
değere düşme mekanizması da yoktur; token yoksa/geçersizse boş dize döner ve
istek zaten `authenticate` middleware'inde `401` ile reddedilir. **Sabit değil
fonksiyondur** — çağrıda her seferinde güncel token okunur.

**Gardırop favori filtresi.** Kategori pilleriyle AYNI görsel dilde ama ayrı bir
bileşen: kategoriler karşılıklı dışlayan bir küme, favori ise tek başına açık/kapalı
bir anahtar (`favoriteOnly` state). `?kategori=` ile birebir aynı desen — yalnızca
İLK yüklemede `?favori=1`'den okunur, sonrası URL'e geri yazılmaz. Ana Sayfa'daki
"Favori" `StatCard`'ı artık `/gardirop?favori=1`'e gider (öncesinde filtresiz
`/gardirop`'a gidiyordu, çünkü filtre yoktu).

**Kombinlerim "Bugün Giydim".** `PATCH /outfits/:id/worn` zaten hazırdı, yalnızca
arayüzde tetikleyicisi yoktu. Favori toggle'ıyla AYNI iyimser güncelleme deseni:
sayaç anında +1 olur, sunucudan gelen gerçek `times_worn` ile değiştirilir, hata
olursa geri alınır. Artış **idempotent DEĞİLDİR** — her tıklama ayrı bir "giyme"
kaydı sayılır, bilerek (backend zaten atomik `times_worn = times_worn + 1` yapıyor).

**Kıyafet düzenleme (`QuickAddModal` iki modlu).** Yeni bir bileşen yazmak yerine
mevcut `QuickAddModal` genişletildi: opsiyonel `item` prop'u verilirse DÜZENLEME
MODU'na geçer — başlık "Parçayı Düzenle", buton "Güncelle", mevcut değerlerle
ön-doldurulur, **`PhotoPicker` hiç render edilmez** ve kaydetme `updateClothingItem`
(PUT) çağırır; `item` verilmezse eskisi gibi "Yeni Parça" oluşturma modunda çalışır.
Tek form/tek dosya — iki ayrı bileşen açmaya gerek kalmadı. `onCreated` prop'u
`onSaved` olarak yeniden adlandırıldı (her iki modda da "kayıt başarılı" anlamına
geldiği için nötr bir isim gerekiyordu).

**Form her açılışta `useLayoutEffect` ile yeniden tohumlanır, `useEffect` İLE DEĞİL.**
Modal, `Modal` bileşeninin `isOpen` kontrolüyle koşullu render edildiği için (kendisi
değil) React state açılışlar arasında KORUNUR ve elle sıfırlanması gerekir. İlk
sürümde bu `useEffect` ile yapılmıştı ve **gerçek bir görsel çakma (flash) hatası**
yarattı: `isClean`'in başlangıç değeri `useState(true)`, `useEffect` ise boyamadan
SONRA çalıştığı için kirli bir parça düzenlenirken bir kare boyunca "Temiz" pili
YANLIŞLIKLA basılı görünüyordu, sonra "Kirli"ye dönüyordu. `useLayoutEffect` DOM
güncellemesinden hemen sonra, tarayıcı boyamadan ÖNCE çalıştığı için bu çakma
tamamen ortadan kalktı. Doğrulama piksel seviyesinde yapıldı: `getComputedStyle`
ile her iki pilin `backgroundColor`'ı okunup `aria-pressed` ile karşılaştırıldı.

**Sahiplik ve fotoğraf koruması BACKEND'DE sağlanır, frontend'de TEKRARLANMAZ.**
Modal, `updateClothingItem`'a `imageUrl` alanını hiç göndermez (backend zaten
onu koşulsuz görmezden geliyor) ve sahiplik kontrolünü tekrar sormaz — `PUT`
başkasının kaydı için `404` döndürürse hata mesajı olduğu gibi kullanıcıya
gösterilir, modal açık kalır.

**Dönüştürücü:** `src/lib/transformers.js` snake_case → camelCase çevirisini ve
`category_id` → kategori **adı** eşlemesini yapar (ikon eşlemesi ada göre çalışır).
Masonry yüksekliği id'den deterministik türetilir.

**Marka alanı — `src/data/brands.js` + native `<datalist>`.** `clothing_items.brand`
kolonu ve backend doğrulaması (`FIELD_LIMITS.clothingItems.brand`, 100 karakter) Aşama
6'dan beri vardı ama **hiçbir zaman frontend formuna bağlanmamıştı** — `QuickAddModal`'da
alan yoktu. `brands.js`, **519 gerçek marka** (giyim/ayakkabı/makyaj, global + Türk
pazarına özgü — LC Waikiki, Koton, Mavi, Network, Flormar, Golden Rose, Derimod, Desa
gibi) taşıyan alfabetik, tekil bir dizi.

- **Yeni bir kütüphane/bileşen EKLENMEDİ.** 500'ün üzerinde markayı bir `<select>`e
  sığdırmak kullanılamaz olurdu (tek tek kaydırmak gerekirdi); bunun yerine native
  `<input list="marka-onerileri">` + `<datalist>` kullanıldı. Bu, tarayıcının kendi
  autocomplete mekanizmasıyla hem öneri gösterir hem de alanı **SERBEST METİN**
  olarak bırakır — kullanıcının markası listede yoksa (niş/yerel bir marka) hiçbir
  ek adım gerekmeden doğrudan kendi markasını yazabilir. `ColorPicker`'ın aksine
  (kapalı bir seçenek kümesi) burada liste yalnızca bir ÖNERİ kaynağıdır.
- **Kategori alanının AKSİNE marka ZORUNLU DEĞİLDİR** — `clothing_items.brand`
  nullable; boş bırakılırsa `''` gönderilir, `ClothingDetail`'deki
  `{item.brand && (...)}` kontrolü bunu zaten görmezden gelir.
- **Düzenleme modunda mevcut marka ön-dolu gelir** — diğer alanlarla AYNI
  `useLayoutEffect` tohumlama deseninden geçer, ayrı bir kod yolu yok.
- **Backend'de HİÇBİR DEĞİŞİKLİK gerekmedi**: `ClothingItemRepository`,
  `utils/validators.js` ve hatta `VectorService.buildSummaryText` (embedding
  metnine "Markası X." cümlesi zaten ekliyordu) marka alanını GÜNDEN BERİ tam
  destekliyordu — eksik olan yalnızca bu alanı formda göstermekti.
- **Datalist native tarayıcı bileşeni olduğu için Tailwind ile stillendirilemez**
  (öneri açılır kutusunun görünümü tarayıcı/işletim sistemi kontrolündedir) —
  bilinçli bir ödünleşme, 500+ öğeli bir listeyi özel bir bileşenle (arama/filtre,
  klavye navigasyonu, erişilebilirlik) yeniden inşa etmenin getirisi bu aşamada
  gerekli görülmedi.

**Ana Sayfa → Kombin Öner router state akışı.** "Hızlı Kombin Öner" kartları
`<Link state={{ occasion }}>` ile durumu taşır; `OutfitSuggestion` bunu okuyup gardırop
yüklendikten **sonra** tek seferlik öneri üretir. Anahtar ve durum listesi
`src/lib/occasions.js` içinde (`OCCASIONS`, `OCCASION_STATE_KEY`) — gönderen ve okuyan
tarafın ayrışmaması için tek kaynak.

Efekt bir `useRef` ile korunur ve **yalnızca bir kez** çalışır: `cleanItems`, karttaki
temiz/kirli toggle'ıyla değişir; guard olmasaydı efekt yeniden tetiklenip kullanıcının
o sırada seçtiği durumu ezer ve öneriyi habersizce yeniden üretirdi.
State bilinçli olarak **temizlenmez** (Dashboard'daki `justOnboarded` kalıbının aksine):
sayfa yenilendiğinde öneri açık kalsın diye. Navbar'dan veya temiz bir sekmeden
girildiğinde state zaten yoktur, sayfa normal (önerisiz) açılır.

**Hava durumu akışı.** Kombin Öner açılırken `fetchMe()` ile kullanıcının şehri
okunur; şehir varsa `GET /weather` çağrılır. Bu çağrının **kendi try/catch'i vardır
ve hatası `hasError`'a DÖNÜŞMEZ** — hava durumu isteğe bağlı bir zenginleştirmedir,
sayfayı asla boş duruma düşürmemelidir. Şehir yoksa istek **hiç atılmaz**.

Sezon sözlüğü ve hava→sezon eşlemesi `src/lib/seasons.js` içindedir; eşikler
backend'deki `WeatherService.#toStatus` ile **birebir aynı tutulmalıdır**.
Şehir listesi `src/lib/cities.js`: `value` (ASCII, veritabanına ve API'ye giden),
`label` (Türkçe gösterim) ve `locative` (bulunma hâli) ayrı tutulur — bulunma eki
Türkçe ünlü uyumuna tabi olduğu için kural değil **veri**dir
("İstanbul'da" ama "İzmir'de", "Gaziantep'te").

**Kombin ÜRETİMİ hâlâ İSTEMCİ TARAFINDADIR; backend yalnızca RETRIEVAL yapar.**
Bu ayrım Aşama 4'te bilinçli olarak korundu: `GET /clothing-items/:id/companions`
"vektör uzayında bunlar yakın" der ve orada durur; hangi slotun neyle dolacağı,
temiz/kirli ve hava durumu kuralları, varyant ilerletme ve geri düşüş
**`src/lib/outfitBuilder.js`** içindedir. `OutfitService` hâlâ yalnızca doğrular
ve kaydeder — backend'de kombin üreten hiçbir kod yoktur.

Mantık sayfadan `lib/outfitBuilder.js`'e ÇIKARILDI çünkü Aşama 4'te iki yol oluştu
(vektör eşleştirmesi + rastgele geri düşüş) ve ikisi de saf fonksiyon olarak
React'sız test edilebilmeliydi (`frontend/test-scripts/test-outfit-builder.mjs`).
Modül `./seasons.js` importunda **uzantıyı bilerek yazar**: Node'un ESM
çözümleyicisi uzantısız yolu bulamaz, Vite ikisini de kabul eder.

Akış:

1. **`pickSeedItem`** — temiz parçalar arasından bir başlangıç parçası seçer.
   **Analizi olan parçalar önceliklidir**: embedding'in kaynağı `ai_analysis`
   kolonudur, analizsiz bir parçayı başlangıç yapmak aramayı baştan boşa çıkarırdı.
   Sonra hava durumuna uygun sezon önceliklendirilir.
2. **`fetchCompanions`** — diğer kategorilerin adaylarını çeker. Bu çağrının
   **her hatası yutulur** (vektör deposu kapalı, zaman aşımı, ağ hatası,
   indekslenmemiş parça): sonuç `null` olur ve akış rastgele seçime döner.
3. **`buildOutfitFromCandidates`** — adayları önce TEMİZ olanlara indirger, sonra
   sezon önceliğini uygular. **Vektör benzerliği bu filtreleri atlamaz.** Bir
   kategoride aday kalmazsa YALNIZCA O SLOT `buildRandomOutfit` mantığına düşer.

**Serbest metin (mood) kutusu — `handleCustomSubmit`.** Hazır durum pill'lerinin
altındaki metin kutusu artık YALNIZCA ham metni occasion olarak kullanmıyor:
önce `POST /outfits/interpret` ile Gemini'ye gidip standart bir occasion + kısa
bir özet alıyor, SONRA mevcut `runSuggestion(occasion)` akışına (yukarıdaki 1-3
adımlarına) AYNEN devam ediyor. Bu bilinçli bir tasarım kararı: **Gemini
yalnızca "hangi hazır durum" sorusunu yanıtlıyor, kombin kurma mantığına hiç
karışmıyor** — `runSuggestion` bir pill tıklamasıyla gelen occasion ile
Gemini'nin ürettiği occasion'ı AYIRT EDEMEZ, ikisi de aynı string.

- **"Anlıyorum..." yükleme durumu** gönder butonunun kendisinde gösterilir
  (`isInterpreting`) — ayrı bir modal/overlay değil, `ShareButton`'ın
  "Hazırlanıyor..." desenindeki gibi buton içi bir durum değişimi.
  Sonuç geldiğinde (ya da başarısız olduğunda) normal "Kombin Öner" metnine
  döner.
- **SESSİZ GERİ DÜŞÜŞ tamamen frontend'dedir.** `interpretOutfitRequest` hata
  fırlatırsa (`catch` bloğunda) `occasionToUse` DEĞİŞTİRİLMEZ — başlangıç
  değeri zaten ham metnin kendisidir (`OCCASION_MAX_LENGTH`'e kırpılmış hâli,
  VARCHAR(50) taşmasını önlemek için). Kullanıcıya hiçbir hata gösterilmez,
  yalnızca `console.warn` ile loglanır. Bu, `fetchCompanions`/hava
  durumu/ten tonu ile AYNI aile: API dürüst kalır (fırlatır), "rastgeleye/ham
  değere düş" kararını istemci verir.
- **`interpretation` state'i YALNIZCA gösterim içindir.** Başarılı olursa
  "Anladığım kadarıyla: {arama_metni}" özeti (+ varsa "Kaçınılacaklar"/
  "Öncelikler" etiketleri) render edilir; bir hazır durum pill'i seçilince
  (`handlePillSelect`) hemen temizlenir — aksi hâlde başka bir durumun
  sonuçlarının yanında eski, artık ilgisiz bir özet görünür kalırdı.
- **`kacinilmasi_gerekenler` ve `stil_tercihi` artık kombin kurma mantığına
  da katılır** (aşağıdaki "Mood bağlamı" bölümüne bakın) — `onem_verilen_ozellikler`
  ise hâlâ SADECE gösterim amaçlıdır, hiçbir filtreye girmez (kullanıcının
  "önem verdiği" bir özelliği negatif değil pozitif bir sinyaldir ve
  "öncelik ver" ile "kaçın"ı aynı mekanizmada karıştırmak riskli olurdu —
  bu bilinçli olarak kapsam dışında bırakıldı).

**Mood bağlamı — `createMoodContext` / `applyMoodPreferences`
(`outfitBuilder.js`).** İlk sürümde `arama_metni`/`kacinilmasi_gerekenler`
yalnızca özet kutusunda gösteriliyordu, kombin seçimine hiç karışmıyordu.
Gerçek kullanımda bu bir HATAYA yol açtı: "sade bir şıklık istiyorum"
dendiğinde sistem parmak arası terlik önerdi — occasion doğru anlaşılmıştı
("Akşam Yemeği"/"Özel Davet") ama stil kısıtı hiçbir yere gitmiyordu. Çözüm
üç ayrı, birbirini tamamlayan mekanizma:

1. **`createMoodContext(interpretation)`** — `interpretOutfitRequest`'in
   ham yanıtını `{ occasion, stilTercihi, kacinilanKelimeler }` şekline
   sıkıştırır. `kacinilanKelimeler` bir `Set<string>`tir: her
   `kacinilmasi_gerekenler` ifadesi ("Aşırı gösterişli", "Çok rahat/spor")
   kelimelerine bölünür, 3 karakterden kısa olanlar ve bir DURAK KELİME
   listesi ("çok", "aşırı", "biraz", "gibi", "veya" vb.) elenir — aksi
   hâlde neredeyse her ifadede geçen bu kelimeler örtüşme testini anlamsız
   hâle getirirdi. `interpretation` `null`/`undefined` ise (Gemini
   erişilemedi) `createMoodContext` `null` döner ve aşağıdaki HİÇBİR
   mekanizma devreye girmez — bu, "Gemini erişilemezken hâlâ (daha basit
   ama) mantıklı bir kombin üretiliyor" garantisinin doğrudan kaynağıdır.
   **GÜNCELLEME (2026-09-02):** "kullanıcı hazır durum pill'i seçti" artık
   bu cümlenin İSTİSNASI — pill tıklaması `createMoodContext`'i hiç
   çağırmaz ama dört durumda (Spor/İş/Akşam Yemeği/Özel Davet) KENDİ sabit
   `moodContext`'ini `createFallbackMoodContext`'ten alır (bkz. aşağıdaki
   "Hazır durum pill'leri de stil önceliklendirmesinden geçiyor" bölümü ve
   §9'daki aynı tarihli değişiklik kaydı) — "stil tercihi olmadan eski akış
   aynen çalışıyor" garantisi artık yalnızca Üniversite/Buluşma pill'leri
   VE Gemini gerçekten erişilemezken (fallback'in de karşılığı olmayan bir
   metin) geçerlidir.
2. **`preferAvoidingKeywords(pool, kacinilanKelimeler)`** — TÜM kategorilerde
   uygulanır (yalnızca ayakkabıda değil). Bir parçanın `ai_analysis.veri`
   içindeki metin alanları (`stil`, `genel_aciklama`, `alt_kategori`,
   `kesim_tipi`, `urun_turu`, `ayakkabi_turu`, `canta_turu`, `bitis_efekti`)
   kaçınılan kelimelerden birini İÇERİYORSA parça **öncelik dışına atılır,
   ELENMEZ** — `preferSeason` ile AYNI "önceliklendir, eleme" deseni. Eleme
   olsaydı küçük bir gardıropta (tek ayakkabı, tek çanta) kombin hiç
   kurulamayabilirdi; bu yüzden havuzda tercih edilen alt küme boşsa
   fonksiyon sessizce TÜM havuzu geri verir.
3. **`preferFormalShoes(pool, category, moodContext)`** — yalnızca
   `category === 'Ayakkabı'` VE `moodContext.stilTercihi` **GERÇEKTEN
   resmiyet/şıklık işaret ediyor** (bkz. `stilTercihiResmiMi`, 2026-08-26
   düzeltmesi — aşağıya bakınız) VE `moodContext.occasion`
   `FORMAL_OCCASIONS = ['Akşam Yemeği', 'İş', 'Özel Davet']`
   içindeyken devreye girer. `ayakkabiFormalligi(item)` iki ayrı regex ile
   `ayakkabi_turu`/`stil`/`topuk_yuksekligi` metnini sınıflandırır:
   `RESMI_AYAKKABI_DESENI` (topuk, stiletto, oxford, klasik, rugan, deri
   bot, **babet**, makosen) ve `GUNLUK_AYAKKABI_DESENI` (terlik, sandalet,
   sneaker, spor ayakkabı, crocs, flip-flop). Resmi etiketli bir aday
   varsa o tercih edilir; yoksa en azından KESİNLİKLE günlük olanlar
   havuzdan (önceliklendirerek, yine ELEMEDEN) çıkarılır; hiçbiri
   sınıflandırılamıyorsa havuz değişmeden döner. **NEDEN AYRI BİR
   MEKANİZMA (2)'ye ek olarak):** gerçek gardırop verisiyle ölçüldüğünde
   saf embedding benzerliği TEK BAŞINA yetersiz çıktı — "Şık ama abartısız,
   dengeli bir akşam yemeği kombini" sorgusunda parmak arası terlik en
   dipte kalsa da (4 ayakkabı içinde son sırada) bir SPOR sneaker (New
   Balance 530), hem stiletto hem babetin ÜSTÜNE çıktı; embedding
   "resmiyet" kavramını güvenilir biçimde kodlamıyor, deterministik bir
   regex kuralı gerekliydi.
   **`babet` BİLEREK `RESMI_AYAKKABI_DESENI`'NDEDİR, günlük listesinde
   DEĞİL** — ilk taslakta tersiydi; gerçek demo gardırobunda
   `stradivarius babet`in `ai_analysis.veri.stil` alanı `"Klasik"` olarak
   dönüyor (bkz. §5 `ai_analysis` biçimi). Bu uygulamanın kendi
   sözlüğünde babet resmi/klasik bir kategoridir — onu "günlük" sayıp
   öncelik dışına atmak gerçek veriyle çelişir ve iyi bir resmi seçeneği
   haksız yere geri plana iterdi. Bu, kod yazılmadan ÖNCE gerçek veriyle
   doğrulanıp düzeltilen bir tasarım kararıdır.
4. **`findByText` + deterministik seed seçimi** — `pickSeedItem`
   `textRanking` (bkz. `POST /clothing-items/search-by-text` yukarıda)
   verildiğinde, `preferAvoidingKeywords` uygulandıktan SONRA kalan
   havuzda RASTGELE değil **deterministik olarak en yüksek benzerlik
   skorlu** parçayı seçer. Rastgelelik burada bilerek terk edildi:
   amaç kullanıcının GERÇEKTEN yazdığı cümleye en yakın parçayı başlangıç
   yapmak; "Başka Öneri Göster" çeşitliliği zaten mevcut `excludeSeedId`
   mekanizmasıyla korunur (bir önceki en iyi eşleşme dışlanınca doğal
   olarak ikinci en iyi eşleşme öne çıkar). `textRanking` boşsa ya da
   havuzdaki hiçbir parça onda yoksa `pickSeedItem` sessizce ESKİ (tam
   rastgele) davranışına döner — yeni bir hata yolu YOKTUR.

**2026-08-26 — İKİNCİ bir kalite turu: "şık bir akşam yemeği" hâlâ basit bir
tişört+pantolon üretiyordu.** Yukarıdaki dört mekanizma (2026-08-25) yalnızca
Ayakkabı'yı ve NEGATİF kelime kaçınmayı çözmüştü; gerçek kullanımda üç ayrı,
birbirinden bağımsız kök neden daha bulundu ve düzeltildi:

5. **`preferFormalStyle(pool, category, moodContext)`** —
   `preferFormalShoes`'un GENELLEŞTİRİLMİŞ hâli, Üst/Alt/Elbise/Çanta'ya
   uygulanır. ÖNCEDEN bu dört kategori yalnızca (zayıf, seyrek) negatif
   kelime kaçınmasından geçiyordu: Gemini `kacinilmasi_gerekenler` listesine
   "günlük"/"basic" gibi kelimeleri KOYMADIĞI SÜRECE (ki gerçek Gemini
   çağrılarında bu liste çoğu zaman BOŞ dönüyor — "Şık ama sade" gibi bir
   istek çoğunlukla "kaçınılacak" değil "istenen" bir şeydir) hiçbir Üst/Alt
   parçası geri plana atılmıyordu. `genelFormallik(item)` (`stil`,
   `genel_aciklama`, `alt_kategori`, `kesim_tipi`, `canta_turu`,
   `bitis_efekti` alanlarına bakar; ayrı bir `RESMI_STIL_DESENI`/
   `GUNLUK_STIL_DESENI` çifti kullanır — Ayakkabı'nın stiletto/sneaker
   sözlüğünden FARKLI bir genel giyim sözlüğü: klasik, şık, zarif, elegan,
   resmi, ofis, kokteyl, gece / günlük, gündelik, rahat, spor, casual) AYNI
   "önceliklendir, eleme" desenini izler.
   **`applyMoodPreferences` artık kaçınılan kelimeler → `preferFormalShoes`
   → `preferFormalStyle` sırasıyla ZİNCİRLEME uygular**; her kategori için
   ikisinden yalnızca biri gerçek etki yapar (diğeri kendi kategori
   kontrolünde no-op döner), asla ikisi birden çakışmaz.
6. **`stilTercihiResmiMi(stilTercihi)` — GERÇEK BİR REGRESYON, kod yazılırken
   YAKALANDI.** `preferFormalShoes` (ve yeni `preferFormalStyle`) ÖNCEDEN
   yalnızca `moodContext.stilTercihi`'nin DOLU olup olmadığına bakıyordu,
   İÇERİĞİNE değil. Bu, "Akşam yemeğine gidiyorum ama RAHAT giyinmek
   istiyorum" gibi bir istekte occasion resmi ("Akşam Yemeği") VE stilTercihi
   dolu ("Rahat") olduğu için sistemin YANLIŞLIKLA resmi ayakkabı/kıyafet
   önceliklendirmesine yol açıyordu — tam TERSİ gerekiyordu. Artık
   `stilTercihiResmiMi` stilTercihi'nin İÇERİĞİNİ (klasik/şık/zarif/elegan/
   resmi/ofis/sofistik) bir regex'e karşı sınıyor; yalnızca GERÇEKTEN
   resmiyet/şıklık işaret ediyorsa formal önceliklendirme devreye giriyor.
   **YAKALANAN İKİNCİ HATA (kod yazılırken, gerçek regex testiyle):**
   `\bşık\b` gibi bir desen JS'te HİÇ EŞLEŞMİYORDU — JS regex `\b`, `\w`'yi
   yalnızca ASCII harfleriyle tanımlıyor, 'ş' bir "kelime karakteri"
   sayılmıyor, bu yüzden boşlukla 'ş' arasında sınır bulunamıyordu. "şık"
   kelimesi için elle, Unicode-farkında bir sınır (`SIK_KELIME_DESENI`)
   kuruldu; listedeki diğer kelimeler ASCII bir harfle başlayıp bittiği için
   normal `\b` sorunsuz çalışıyor.
7. **Elbise, Üst+Alt ikilisine ALTERNATİF hâle getirildi
   (`resolveActiveCategories`, `DRESS_CATEGORY`).** ÖNCEDEN Elbise kategorisi
   kombin kurma mantığının HİÇBİR yerinde (ne `OUTFIT_CATEGORIES`'te, ne
   backend'e sorgulanan `CANDIDATE_CATEGORIES`'te, ne `pickSeedItem`'ın aday
   havuzunda) yer almıyordu — gardıropta kaç elbise olursa olsun ASLA
   önerilmiyordu; bu, şikayetin ikinci (ve daha temel) kök nedeniydi. Elbise
   `OUTFIT_CATEGORIES`'e basitçe EKLENEMEZDİ — Makyaj/Dış Giyim'in aksine bir
   EK değil, Üst+Alt'ın YERİNE geçen bir ALTERNATİFTİR (aksi hâlde kombin
   "elbise + tişört + pantolon" gibi anlamsız 5 parçaya çıkardı).
   `resolveActiveCategories(cleanItems, moodContext, textRanking)` bu
   suggestion için hangi "gövde" kategorilerinin kullanılacağına karar verir
   ve ya `OUTFIT_CATEGORIES`'in KENDİSİNİ (referans eşitliği korunur) ya da
   `[DRESS_CATEGORY, 'Ayakkabı', 'Çanta']`'yı döndürür; `buildRandomOutfit`,
   `pickSeedItem` ve `buildOutfitFromCandidates` artık statik
   `OUTFIT_CATEGORIES` yerine bu dinamik listeyi kullanır.
   - **Karar İKİ AŞAMALIDIR.** (a) `textRanking` VARSA (arama_metni'nin
     GERÇEK embedding benzerliği): en iyi Elbise skoru, en iyi Üst skoruyla
     en iyi Alt skorunun ORTALAMASINA karşı kıyaslanır — bir elbise İKİ
     parçanın (üst+alt) YERİNE geçtiği için karşılaştırma da bu şekilde adil
     kurulur; bu, kararın yalnızca occasion'a değil kullanıcının GERÇEKTEN
     yazdığı cümleye göre verildiğinin doğrudan kanıtıdır. (b) `textRanking`
     YOKSA (vektör deposuna erişilemedi): `genelFormallik`'e dayalı bir yedek — resmi
     occasion + gerçekten resmi bir stilTercihi + Üst+Alt tarafında resmi
     seçenek YOKKEN ama Elbise'de VARKEN Elbise'ye geçilir; Üst+Alt'ta DA
     resmi bir seçenek varsa BELİRSİZLİKTE MEVCUT DAVRANIŞ (Üst+Alt) korunur.
   - **YALNIZCA `moodContext` VARKEN devreye girer** — moodContext yoksa
     (hazır durum pill'i akışı) HER ZAMAN `OUTFIT_CATEGORIES` döner. Elbise'nin
     pill-only akışta HÂLÂ hiç değerlendirilmemesi BİLİNÇLİ bir sınırdır:
     "stil tercihi olmadan yapılan eski akış hâlâ aynı şekilde çalışıyor"
     regresyon garantisi tam olarak bunu gerektiriyor.
   - **"Rahat bir gün" gibi zıt bir istekte Elbise KENDİLİĞİNDEN elenir** —
     ayrı bir "bu occasion elbiseye uygun mu" beyaz listesi YOKTUR; dresslerin
     "rahat" bir sorguya embedding benzerliği doğal olarak düşük çıktığı için
     karşılaştırma kendiliğinden Üst+Alt'ı seçer (gerçek Gemini + gerçek
     embedding ile doğrulandı, bkz. aşağıdaki test notu).
   - `CANDIDATE_CATEGORIES`'e `DRESS_CATEGORY` eklendi (dress route
     seçilmese bile HER ZAMAN sorgulanır — backend'in kategori bazlı sorgusu
     zaten jenerik olduğu için maliyeti yok, karar verirken gerçek vektör
     adaylarına ihtiyaç var). **Backend'de HİÇBİR değişiklik gerekmedi**
     (aynı `/companions` genelleme kanıtı, bkz. 2026-08-26 "Dış Giyim" kaydı).
   - `variantDepth(candidatesByCategory, categories = OUTFIT_CATEGORIES)`
     artık opsiyonel bir `categories` parametresi alıyor — dress route
     aktifken çağıran (`showAnother`) `resolveActiveCategories`'in
     döndürdüğü listeyi geçirmeli, aksi hâlde derinlik o suggestion'da HİÇ
     KULLANILMAYAN Üst/Alt havuzlarının boyutuna göre yanlış hesaplanırdı.

**Geriye dönük uyumluluk yapısal olarak garanti edilir**: `buildRandomOutfit`,
`pickSeedItem` ve `buildOutfitFromCandidates`'ın hepsi `moodContext`/
`textRanking`'i OPSİYONEL, varsayılanı `null` olan son parametreler olarak
alır; bu değerler yoksa (hazır durum pill'i seçildiğinde `handlePillSelect`
her ikisini de bilerek `null`'a çeker) üç fonksiyon da ESKİ davranışını
BİREBİR korur. `test-outfit-builder.mjs` **132 kontrol** (91 önceki + Dış
Giyim'in 17'si + bu turun 24'ü), hiçbiri yeni parametreleri geçirmeden eski
davranışı doğruluyor.

**İsteğe bağlı makyaj bölümü (`pickMakeupItem`).** Makyaj, `OUTFIT_CATEGORIES`'e
**bilerek eklenmedi**: kombinin slotu değil, üstüne konan bir öneri. Bunun yerine
`CANDIDATE_CATEGORIES` (= kombin kategorileri + `Makyaj`) sorgulanır; ızgarayı kuran
`buildOutfitFromCandidates` yalnızca `OUTFIT_CATEGORIES` üzerinde gezdiği için makyaj
dört kartlık ızgaraya **yapısal olarak** giremez.

Bu bölümün diğerlerinden ayrılan üç kuralı var:

1. **GERİ DÜŞÜŞ YOK.** Diğer slotlarda rastgele bir parça göstermek "kombin eksik
   kalmasın" diye değerliydi; makyaj isteğe bağlı bir ek. Vektör bir şey
   söyleyemiyorsa (embedding yok, vektör deposu kapalı, hepsi kirli) doğru davranış
   rastgele bir ruj önermek değil, **bölümü hiç render etmemek**. `pickMakeupItem`
   bu yüzden `null` döner ve sayfa `{makeupItem && …}` ile tüm bölümü atlar —
   kullanıcı ölü bir düğme ya da boş bir kutu görmez.
2. **SEZON UYGULANMAZ.** "Kışlık ruj" diye bir kavram yok; mevsim kuralı kıyafetin
   sıcaklığıyla ilgili. Temiz/kirli filtresi ise aynen geçerli.
3. **`variantDepth` makyaj havuzunu SAYMAZ.** Sayılsaydı, çok makyaj ürünü olup tek
   tişörtü olan bir gardıropta "Başka Öneri Göster" dört kartı hiç değiştirmeden
   yalnızca ruju döndürür ve düğme bozuk görünürdü.

Öneri **id olarak** saklanır (`makeupItemId`) ve render sırasında güncel kayda
çözülürken temiz/kirli **yeniden kontrol edilir**: kullanıcı karttan ürünü kirli
işaretlerse bölüm anında kaybolur, bir sonraki öneriye kadar ortada durmaz.

Açılma animasyonu `grid-rows-[0fr] → [1fr]` geçişidir: `max-height` tahmini
gerektirmeden gerçek yüksekliği animasyonlar. İçerik kapalıyken de DOM'da durduğu
için panele **`inert`** verilir — aksi hâlde görünmeyen kart klavyeyle
odaklanabilir ve ekran okuyucuya okunurdu.

**Kaydetme sözleşmesi: bölüm AÇIKSA makyaj kombine dahildir, KAPALIYSA değildir.**
Ölçüt "kullanıcı bunu gördü mü" olduğu için açık/kapalı durumu kullanılıyor;
bölümü hiç açmayan kullanıcı için akış eskisiyle birebir aynı (dört parça).
Paylaşım görseli de aynı kümeyi kullanır — `ShareOutfitCard`'ın `CATEGORY_ORDER`
dizisi `Makyaj`'ı zaten tanıyor ve en sona diziyor.

**Katmanlama — koşullu 5. slot: Dış Giyim (`OUTERWEAR_CATEGORY`, `pickOuterwearItem`).**
Kışlık kombinlerde ana parçanın (Üst/Elbise) üstüne giyilen mont/kaban/hırka
katmanı. Yeni bir kategori (migration `008`, bkz. §5) ve `outfitBuilder.js`'e
eklenen bir fonksiyonla çalışır; **Makyaj'la AYNI "isteğe bağlı ek" ailesinden**
ama görünüm sözleşmesi FARKLI:

1. **Açılır/kapanır bir bölüm DEĞİL — doğrudan ana ızgaraya 5. kart olarak
   girer** (`displayItems = [...suggestionItems, outerwearItem]`, ana grid
   `displayItems.map(...)` üzerinden render edilir). Makyaj bir kozmetik
   öneriyken dış giyim gerçek bir gardırop parçasıdır; kullanıcının bir şey
   açmasını beklemek yanlış olurdu. Bu yüzden **kaydetme/paylaşım da otomatik**:
   `outfitItems = displayItems + (isMakeupOpen && makeupItem varsa)` — dış
   giyim var olduğu an kaydedilen kombine dahildir, ayrı bir onay gerekmez.
2. **GERİ DÜŞÜŞ YOK** (Makyaj'daki kuralın birebir aynısı): vektör bir şey
   söyleyemiyorsa (embedding yok, vektör deposu kapalı, hepsi kirli) rastgele bir
   mont ÖNERİLMEZ, slot `null` olur ve hiç render edilmez.
3. **EK KURAL — hava durumu koşulu (Makyaj'da YOK olan tek fark):**
   `pickOuterwearItem(candidatesByCategory, weatherStatus, variant)` yalnızca
   `weatherStatus === COLD_WEATHER_STATUS` ('soğuk', backend'in <10°C eşiği)
   iken bir şey döner.
   - Hava **sıcak/ılıksa** slot hiç denenmez, kombin **4 parça** kalır.
   - Hava **BİLİNMİYORSA** (`weatherStatus` null/undefined — şehir tanımlı
     değil ya da hava durumu servisine ulaşılamadı) yine `null` döner.
     **"BELİRSİZLİKTE EKLEME" ilkesi:** yanlışlıkla sıcak bir günde mont
     önermektense hiç önermemek daha güvenli. `COLD_WEATHER_STATUS` sabiti
     `lib/seasons.js`'te tanımlıdır — ham `'soğuk'` dizesi elde
     tekrarlanmaz, backend'in `WeatherService.#toStatus` ile senkron kalması
     gereken TEK nokta oradadır.
4. **Sezon önceliği UYGULANMAZ** (Makyaj'daki gerekçenin aynısı): bu slot
   zaten yalnızca hava soğukken çalışıyor, ayrıca bir sezon filtresi eklemek
   gereksiz bir katman olurdu.
5. **`OUTFIT_CATEGORIES`'e BİLİNÇLİ OLARAK EKLENMEDİ** (Makyaj'la aynı
   gerekçe) — bu yüzden `variantDepth` onu hiç saymaz ve `pickSeedItem`
   ondan başlangıç parçası seçmez. `CANDIDATE_CATEGORIES`'e (backend'e
   sorgulanacak kategoriler listesi) EKLENDİ — `/companions` ucu zaten
   kategori bazlı jenerik çalıştığı için **backend'de hiçbir değişiklik
   gerekmedi**, yalnızca bu frontend sabitine bir kategori daha eklendi.
6. **Kategori ikonu:** lucide-react'te doğrudan bir mont/kaban ikonu yok;
   `categoryIcons.js` bilerek `Snowflake` kullanıyor (kategori zaten yalnızca
   soğuk havada devreye giren koşullu bir slotu temsil ediyor).
7. **Gemini şeması:** `GeminiService.KATEGORI_SEMASI`'nde `'Dış Giyim':
   'giyim'` — Üst/Alt ile AYNI genel giyim şemasını kullanır, ayrı bir şema
   yazılmadı (kesim_tipi, mevsim_uygunlugu gibi alanlar bir mont için de
   anlamlı).
8. **`ShareOutfitCard`'ın `CATEGORY_ORDER`'ına eklendi** — `Üst`'ün hemen
   ardına (giyim mantığında üst parçanın üstüne giyilen katman budur).

**Rozet (`Tarzına göre seçildi`) `vectorCount > 0` iken gösterilir.** Ölçüt
"kombinde vektörün getirdiği en az bir parça var mı"dır; tamamen rastgeleye
düşüldüyse rozet HİÇ çıkmaz. Kullanıcıya olmayan bir zekâyı satmamak için
kural bilinçli olarak bu yönde katı.

**"Başka Öneri Göster" aynı başlangıç parçasıyla havuzda İLERLER** (en yakın →
ikinci en yakın → …). `variantDepth` tükendiğinde yeni bir başlangıç parçası
seçilir ve `excludeSeedId` ile öncekinin tekrar gelmesi engellenir. Rastgele
moddayken düğme eskisi gibi davranır (aynı kombin gelmesin diye 5 deneme).

**Adaylar id olarak saklanır, parça nesnesi olarak değil** (`poolRef`). Her kombin
kurulumunda güncel gardıroptan yeniden çözülürler; böylece karttaki temiz/kirli
iyimser güncellemesi bir sonraki "Başka Öneri"ye anında yansır.

**Yanıt beklenirken sayfa iskelet gösterir** ve geç gelen yanıt `requestIdRef` ile
elenir: kullanıcı bekleme sırasında başka bir duruma tıklarsa bayat yanıt yeni
öneriyi ezmemeli.

`buildRandomOutfit()` kendisine verilen havuzdan seçer; temiz filtresi çağıranda
uygulanır. Bunun sebebi sayfanın iki durumu ayırt etmek zorunda olmasıdır:
**"o kategoride hiç parçan yok"** (gardırobu doldur) ile **"temiz parçan yok"**
(çamaşır yıka) farklı mesajlar gösterir. Havuz baştan filtreli gelseydi bu ayrım kaybolurdu.

**"Buna Benzer Diğer Parçalar" (Kıyafet Detay).** `AiAnalysisPanel` ile **aynı
gerekçeyle** iki sütunlu ızgaranın altında, tam genişlikte durur: sağ sütun `md`
üstünde yarım genişliktir ve dört kartlık bir şerit oraya sıkışırdı.

- **Uç `/similar`'dır, `/companions` DEĞİL.** İkisi zıt işler yapar: `/companions`
  başlangıç parçasının kendi kategorisini hedeflerden bilerek düşürür (kombin
  slotu başka kategoriye ait), `/similar` ise aynı kategori içinde arar.
  `sameCategory` gibi bir parametre eklemek, başka bir ucun zaten yaptığı iş
  için bilinçli bir kuralı tersine çevirmek olurdu.
- **HATA DURUMU YOK — her başarısızlık "bölümü gösterme"ye çevrilir.** İndekslenmemiş
  parça, 503, zaman aşımı, boş sonuç: hepsi boş listeye düşer ve bölüm hiç render
  edilmez (başlık da çıkmaz). Gerekçe: bu bir keşif eklentisi, sayfanın taşıdığı
  bilgi değil — "benzer parçalara ulaşılamıyor" demek, kullanıcının hiç istemediği
  bir şey için özür dilemek olurdu. (Kombinler bölümü bunun AKSİNE hata gösterir:
  orada kullanıcı bir cevap bekliyordur.)
- **Kart yüksekliği sabitlenir** (`SIMILAR_CARD_HEIGHT`). `toClothingItem`
  masonry yüksekliğini id'den türetir — Gardırop ızgarası için doğru, ama YAN YANA
  dizili bir şeritte farklı yükseklikler bozuk görünür.
- Dar ekranda **yatay kaydırılabilir şerit**, `sm` üstünde dört sütunlu ızgara.
  Mobilde dört kartı iki sütuna sıkıştırmak yerine kaydırmak fotoğraf oranını korur.
- Efekt `item.categoryId`'ye bağlıdır: kategori bilinmeden aynı-kategori araması
  yapılamaz, bu yüzden kayıt yüklenene kadar istek atılmaz.

**Ten tonu (`SkinToneSection` + `SkinTonePanel`).** Bölüm Profil sayfasında,
`WardrobeStats`'in altında; kendi yükleme/hata durumunu sürer, hatası sayfanın
geri kalanını etkilemez.

- **Fotoğraf seçilir seçilmez analiz başlar** — ayrı bir "Analiz Et" düğmesi
  fazladan bir adım olurdu, kullanıcı zaten bunun için seçti.
- **Hata hâlinde seçilen dosya TEMİZLENİR.** Aksi hâlde `PhotoPicker` başarısız
  fotoğrafın önizlemesinde takılı kalıyor ve kullanıcı yenisini seçemiyordu —
  oysa mesaj tam da "başka bir fotoğrafla tekrar dene" diyor (bu hata tarayıcı
  testinde yakalandı).
- **Renk daireleri `lib/colors.js > resolveColorHex` ile çizilir.** Gemini
  serbest metin üretiyor ("Mercan", "Zeytin Yeşili") ve bunlar `CLOTHING_COLORS`
  paletinde yok; ek bir AI-renk sözlüğü tutuluyor. Tanınmayan renk sessizce
  dairesiz düz etikete düşer — uydurma bir renk göstermektense adını yazmak doğru.
  Bu sözlük bir PALET DEĞİLDİR: kıyafet kaydına bu renkler yazılmaz.
- **GİZLİLİK: selfie yalnızca bu bölümde, sahibine gösterilir.** Paylaşım
  görseline, kombin kartlarına ya da başka bir listeye girmez; test bunu
  Kombin Öner sayfasının HTML'inde arayarak doğrular.
- **Selfie görseli `resolveImageUrl` İLE DEĞİL, `fetchSkinTonePhoto()` +
  blob ile gösterilir.** Backend'in döndürdüğü `foto_url` artık doğrudan bir
  `<img src>` DEĞİLDİR — yalnızca "bir selfie var mı" bilgisini taşır ve bir
  `useEffect`'i tetikler; o effect token'lı `GET /users/skin-tone-analysis/photo`
  ucunu çağırıp blob'u `URL.createObjectURL` ile object URL'e çevirir
  (`PhotoPicker`'daki create/revokeObjectURL yaşam döngüsüyle BİREBİR AYNI
  desen: `fotoUrl` değiştiğinde — yeni analiz, silme — eski object URL
  serbest bırakılır). `<img>` etiketi `Authorization` başlığı gönderemediği
  için bu dolaylama zorunludur; doğrudan `src="/uploads/selfies/..."`
  yazılsaydı zaten `server.js`'teki blok bunu 404'e düşürürdü.

**"✓ Ten tonuna uygun" işareti (`lib/skinTone.js > matchesSkinTone`).** Kombin
Öner'de, eşleşen kartın ALTINDA. Kartın kendisine konmadı çünkü `ClothingCard`
paylaşılan bir bileşen ve bu bilgi Gardırop'ta anlamsız.

**YALNIZCA BİLGİLENDİRİCİDİR:** hiçbir parçayı elemez, sıralamayı değiştirmez,
öneriyi etkilemez — test bunu ayrıca doğrular. Karşılaştırma "içeren" mantığıyla
yapılır çünkü iki taraf farklı biçimde yazıyor (kullanıcı `"Sıcak"`, kıyafet
`["Sıcak ten", "Tüm Ten Tonları"]`); "tüm/her ten" gibi ifadeler her tona uyar.
Türkçe küçültme (`toLocaleLowerCase('tr-TR')`) şart: varsayılan `toLowerCase`
`"SICAK"` → `"sicak"` üretir ve eşleşme kaçardı.

**AI analizi (`AiAnalysisPanel`).** Kıyafet Detay sayfasında iki sütunlu ızgaranın
**ALTINDA, tam genişlikte** durur; sağ sütun `md` üstünde yarım genişliktir ve
iki sütunlu bilgi kartları oraya sıkışırdı. `ai_analysis` boşsa bileşen `null`
döner — bölüm hiç render edilmez, boşluk da bırakmaz.

Analiz arka planda tamamlandığı için sayfa **yoklar**: fotoğrafı olup analizi
olmayan parçada 5 sn aralıkla en fazla 14 kez `GET /clothing-items/:id` çağrılır
(backend'in en kötü senaryosu ≈ 62 sn: 2 deneme × 30 sn zaman aşımı). Bu sırada
başlıkta "Yapay zekâ inceliyor" rozeti görünür. Süre dolunca yoklama **sessizce**
durur; "başarısız oldu" demek zorunlu olmayan bir adım için gereksiz endişe
yaratırdı. Yoklama hatası da kullanıcıya gösterilmez.

**"Yeniden Analiz Et" düğmesi panelin içindedir** ve `onReanalyze` verilmezse
hiç render edilmez (panel, bu yeteneği olmayan bir yerde de kullanılabilsin).
İstek boyunca düğme kilitlenir; backend'de de in-flight muhafızı var, o yol
`409` döner. **Hata hâlinde `item` GÜNCELLENMEZ** — ekrandaki analiz olduğu gibi
kalır ve mesaj panelin altında, verilerin ALTINDA gösterilir; kullanıcı neyin
korunduğunu görür.

**Fotoğraf değişti ipucu OTURUM İÇİDİR.** Şemada "fotoğraf ne zaman değişti"
bilgisi yok (`updated_at` her düzenlemede değişir) ve bunun için migration
yazmaya değmezdi: hatırlatmanın hedefi zaten kullanıcının AZ ÖNCE yaptığı
değişiklik. `handlePhotoUpload` başarılı olduğunda ve parçanın analizi doluysa
`photoChanged` açılır, yeniden analiz sonrası kapanır.

**Analizi HİÇ oluşmamış parçada AYRI bir davet kutusu var** (`ClothingDetail.jsx`,
`AiAnalysisPanel`'in DIŞINDA — panel `analysis` boşken zaten null döner). Aynı
`handleReanalyze`'ı çağırır; backend zaten `force: true` gönderiyor ve
`ai_analysis` NULL olduğu için maliyet koruması baştan devre dışı kalır, force
ile forcesuz burada aynı sonucu verir. Yalnızca `item.imageUrl` VARSA ve
otomatik arka plan yoklaması (`isAnalysisPending`) BİTMİŞSE gösterilir — pencere
sürerken göstermek kafa karıştırırdı (backend'in in-flight muhafızı zaten 409
döndürür ama "neden iki tane oldu" sorusu kalırdı).

**Gösterim SIRASI arayüzde tanımlıdır** (`ALAN_ETIKETLERI` / `UYUMLULUK_ETIKETLERI`
nesnelerinin anahtar sırası). Saklanan JSON'ın sırasına güvenilemez: kolon JSONB'dir
ve anahtarları uzunluk + bayt sırasına göre yeniden dizer. İlk sürümde buna
güvenilmişti ve kartlar "Baskın Renk, Stil, Boyut, Çanta Türü, Tür…" gibi rastgele
bir sırayla çıkıyordu. Etiketi olmayan bir alan kaybolmaz, listenin sonuna düşer.

**Veri çekme deseni:** Sayfalar `useEffect` içinde `Promise.all` ile paralel çeker;
`isStale` bayrağı geç gelen yanıtın state'i ezmesini önler; `isLoading` / `hasError`
durumları iskelet ve boş/hata ekranlarını sürer.

**Kombin paylaşım görseli.** `lib/shareCard.js` (üretim mantığı) +
`components/ShareOutfitCard.jsx` (görselin kendisi) + `components/ui/ShareButton.jsx`
(düğme ve durum yönetimi). Kütüphane **html-to-image**'dır; SVG `<foreignObject>`
içinde TARAYICIYA çizdirdiği için Tailwind v4'ün `color-mix(in oklab, …)` değerlerini
sorunsuz işler (html2canvas kendi CSS ayrıştırıcısını kullanır ve bunlarda kırılır,
ayrıca son gerçek sürümü 2022'dir).

Bu kodda **bilerek yapılmış ve bozulmaması gereken dört şey** var:

1. **Kart sabit hex renklerle, satır içi stille yazılır** — Tailwind token'ı
   kullanılmaz. Token'lar karanlık modda koyu değere döner; paylaşılan görsel ise
   kullanıcının ekran tercihine değil markaya aittir ve **daima açık moddur**.
2. **Yakalanan düğüm STATİK konumlanmalıdır.** Ekran dışına taşıma işi
   `ShareButton`'daki sarmalayıcıya aittir: html-to-image, düğümün hesaplanmış
   stillerini klona da kopyalar; kartta `position:fixed; left:-10000px` olsaydı
   klon da oraya gider ve PNG **bomboş** çıkardı (yaşandı). `display:none` de
   olamaz — o hâlde kartın ölçüsü sıfır olur.
3. **`cacheBust` KULLANILMAZ.** Kütüphane onu her kaynak URL'sinin sonuna
   `?<zaman>` ekleyerek uygular; fotoğraflar `data:` URI olarak gömüldüğü için bu,
   base64 yükünü bozar ve üretim **askıda kalır** (fotoğrafsız kombin çalışır,
   fotoğraflı olan donar — tam olarak bu yaşandı).
4. **Kart DOM'a `flushSync` ile alınır.** `setCardItems` sonrası DOM'un hazır
   olduğu garanti değildir; `setTimeout(0)` ile beklemek fotoğrafsız kombinde
   çalışıp fotoğraflıda `cardRef.current`'ı null bırakıyordu.

Fotoğraflar önce `fetch` + `FileReader` ile **data: URI'ye çevrilir**. Backend
`:3001`, uygulama `:5173` olduğu için aksi hâlde canvas "tainted" olabilir ya da
serileştirme sırasında görsel yüklenemezdi. Alınamayan fotoğraf `null` kalır ve o
parça yer tutucuyla çizilir — tek bir görsel hatası paylaşımı engellemez.

Ölçü `360×640` CSS + `pixelRatio: 3` = **1080×1920** (Instagram Story). Izgara iki
sütundur; parça sayısı **tekse son parça iki sütuna yayılır**, yoksa sağ altta boş
hücre kalırdı. Parçalar giyim sırasına (`Üst → Elbise → Alt → Ayakkabı → Çanta`)
göre dizilir, API sırasına göre değil.

**`downloadBlob` PLATFORM BAZLI dallanır** (`Capacitor.isNativePlatform()`):
web'de eskisi gibi `<a download>`, Android'de `@capacitor/filesystem` +
`@capacitor/share` ile native paylaşım menüsü. Ayrım bilinçli: Android
WebView'de `<a download>` **güvenilir değildir** (bazı sürümlerde sessizce
hiçbir şey olmaz — kullanıcı boşuna bekler), oysa native `Intent.ACTION_SEND`
her zaman çalışır ve kullanıcıya "Galeriye Kaydet" (Google Fotoğraflar gibi
bir hedef üzerinden), "WhatsApp'ta Paylaş" gibi seçenekler sunar.

- **`Directory.Cache` BİLİNÇLİ seçim — YENİ BİR DEPOLAMA İZNİ EKLENMEDİ.**
  `@capacitor/filesystem`'in kendi kaynağı yalnızca **paylaşılan** (public)
  dizinlere (`Directory.Documents`, `Directory.ExternalStorage`) yazarken
  çalışma zamanı izni istiyor; `Directory.Cache` uygulamaya özel bir alandır
  ve hiçbir izin tetiklemez. `AndroidManifest.xml`'e bu yüzden yeni bir
  `<uses-permission>` **eklenmedi** — eklenseydi gereksiz olurdu ve modern
  Android'in scoped storage modeliyle tutarsız düşerdi.
- **Paylaşım için FileProvider zaten HAZIRDI.** `@capacitor/camera` kurulurken
  eklenen `androidx.core.content.FileProvider` (`AndroidManifest.xml`) ve
  `file_paths.xml`'deki `cache-path path="."` girdisi UYGULAMANIN TÜM önbellek
  dizinini zaten kapsıyor — `@capacitor/share`'in Android kaynağı
  (`SharePlugin.java`) paylaşılan dosyayı **aynı** `FileProvider` authority'siyle
  (`${applicationId}.fileprovider`) `content://` URI'ye çeviriyor. Bu yüzden
  manifest'te FileProvider tarafında da hiçbir değişiklik gerekmedi.
- **İki ayrı hata sınıfı ayrı mesajlara çevrilir** (`photoPicker.js`'teki
  izin-reddi/iptal ayrımıyla aynı disiplin): `Filesystem.writeFile` başarısız
  olursa "Görsel cihaza kaydedilemedi" (izin metni içeriyorsa ayrı bir "izin
  verilmedi" mesajı — teorik olarak Cache dizini izin istemez ama bir OEM
  tuhaflığına karşı savunma amaçlı); `Share.share()` kullanıcı tarafından
  İPTAL edilirse (Android `RESULT_CANCELED` → "Share canceled") bu bir HATA
  SAYILMAZ, sessizce dönülür — kullanıcı paylaşmamayı seçebilir.
- **`ShareButton`'daki `catch` artık `caught.message`'ı DOĞRUDAN gösteriyor**
  (öncesinde sabit tek bir mesaj vardı). `downloadBlob`'un fırlattığı her
  mesaj zaten kullanıcıya gösterilebilir Türkçe metindir; sabit mesaj yalnızca
  mesajsız kalan beklenmedik durumlar için yedek olarak kaldı.
- **`@capacitor/filesystem` ve `@capacitor/share` DİNAMİK import edilir**
  (`photoPicker.js`'teki Camera deseniyle aynı): web derlemesinde bu native
  modüller ayrı chunk'lara düşer ve hiç yüklenmez — `npm run build` çıktısında
  `web-*.js` adlı küçük ek chunk'lar bunun kanıtıdır.

**Kalıcı durum:** `src/lib/onboarding.js` `dg_` önekli localStorage anahtarlarının
tek sahibidir (onboarding bayrağı, kullanıcı profili önbelleği, anket cevapları —
`dg_user_id` YOKTUR, kullanıcı kimliği tamamen `dg_token`'daki JWT'den okunur).
**Üç istisna:** `dg_token`/`dg_refresh_token` `lib/auth.js`'e, `dg_theme` `lib/theme.js`'e,
`dg_intro_seen` **`lib/intro.js`**'e aittir. Tema ve tanıtım bayrağı birer OTURUM verisi
değil CİHAZ tercihidir — bu yüzden çıkışta `clearOnboardingState()` ile silinmez; kullanıcı
çıkış yapınca teması VE "tanıtımı gördüm" durumu korunur (aksi hâlde aynı cihazda çıkış yapan
her kullanıcı tanıtım ekranını yeniden görürdü).
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

- Renkler (**rol adı taşırlar, ham renk adı değil**): `ivory` (sayfa zemini),
  `surface` (yükseltilmiş yüzey — kartlar, form alanları, listeler), `ink` (metin),
  `warm-gray` (yer tutucu / iskelet), `dusty-rose` (yumuşak vurgu — **yalnızca
  dekoratif**), `accent-ink` (aynı vurgunun **metin/ikon** tonu), `burgundy`
  (birincil/aktif), `on-primary` (**dolu** burgundy/dusty-rose yüzeyin üstündeki metin)
- Fontlar: `font-display` (Playfair Display — başlıklar, **daima italik**),
  `font-body` (Lora), `font-sans` (Inter — arayüz metni)
- Animasyonlar: `animate-fade-in`, `animate-page-fade`
- Gölge ve perde: `shadow-[var(--dg-shadow-card)]`, `--dg-shadow-card-hover`,
  `--dg-shadow-float`, `--dg-shadow-modal`, `--dg-shadow-nav`, `--dg-scrim`

**`bg-white` KULLANMAYIN** — kart yüzeyi için `bg-surface` vardır. Aynı şekilde dolu bir
burgundy/dusty-rose zeminin üstündeki metin `text-ivory` değil `text-on-primary` olmalıdır.
İkisi de karanlık modda ters dönerdi.

**`text-dusty-rose` KULLANMAYIN — metin ve ikon için `text-accent-ink` vardır.**
`dusty-rose` (`#c9a0a0`) açık zeminde 2.11:1 verir; WCAG AA'nın (4.5:1) çok altında.
İkisi **aynı vurgunun iki tonudur**: `dusty-rose` çizgi/kenarlık/dolgu gibi dekoratif
kullanımlar için (kontrast kuralına tabi değil), `accent-ink` (`#995656`) okunması
gereken her şey için. Karanlık modda ikisi **aynı değeri alır** (`#d9b3b3`), çünkü koyu
zeminde açılmış rose zaten 9.28:1 verir.

### Karanlık mod

Tailwind'in **sınıf stratejisi** kullanılır (`@custom-variant dark`); tema `<html>`
üzerindeki `.dark` sınıfıyla belirlenir. Tercih `dg_theme` anahtarında saklanır ve
`src/lib/theme.js` bu anahtarın **tek sahibidir**.

**Sayfalarda `dark:` varyantı serpiştirilmez.** Karanlık modda token'ların *adları* değil
*değerleri* değişir (`.dark` bloğu `--color-*` değişkenlerini ezer). Bir yüzey ile
üstündeki metin daima aynı token çiftinden geldiği için "koyu zeminde koyu yazı"
**yapısal olarak imkânsızdır** — 30+ dosyaya `dark:` eklemekten çok daha güvenlidir.
Sayılı istisna: `Modal` paneli `dark:bg-surface` taşır (açık modda `ivory` olması
kasıtlıdır, karanlıkta sayfa zeminiyle aynı renk olurdu).

Palet jenerik siyah-beyaz **değildir**: zemin sıcak antrasit (`#1c1815`), metin krem.
Vurgu renkleri koyu zeminde **açılır** (`burgundy` → `#cf8e8e`) çünkü `#7a3b3b` bir metin
rengi olarak okunmazdı (1.7:1); dolayısıyla karanlık modda vurgu ile üstündeki metnin
ilişkisi **tersine döner** (açık dolgu + koyu `on-primary`).

Ölçülen kontrastlar karanlık modda açık modun **altına düşmez**. Sayı tablosu
`index.css` içindedir; yeni renk eklerken bu parite korunmalıdır.
**Her iki tema da artık WCAG AA geçer** (bkz. 2026-08-20 `accent-ink` kaydı):
sayfa bazında en düşük değer açık modda 4.97:1, karanlık modda 6.64:1.

Bilmeden bozulabilecek üç nokta:

1. **`@theme inline` kullanılamaz** — değerleri utility'lere gömer ve `.dark`
   geçersiz kılmaları hiç çalışmazdı.
2. **Gölgeler Tailwind'in `--shadow-*` ad alanına konulamaz** — o ad alanı da değeri
   gömer. Bu yüzden düz custom property (`--dg-shadow-*`) olarak tanımlanıp
   `shadow-[var(...)]` ile çağrılırlar.
3. **Perde (`scrim`) `bg-ink/40` OLAMAZ** — `ink` karanlıkta kreme döner ve perde,
   sayfayı karartmak yerine sütlü beyaz bir tüle dönüşürdü. `--dg-scrim` her iki
   temada da koyudur.

**Veri renkleri temadan bağımsızdır.** `ColorPicker` ve `WardrobeStats` içindeki kıyafet
renkleri (`colors.js`'teki hex değerleri) gerçek birer veri değeridir; üzerlerindeki onay
ikonu token değil sabit (`text-[#f7f3ed]` / `text-[#1c1a17]`) kullanır — token olsaydı
karanlık modda siyah dairede siyah tik görünürdü.

`color-scheme` hem `:root` hem `.dark` üzerinde ayarlıdır; tarayıcının kendi çizdiği
kaydırma çubuğu ve form denetimleri bu olmadan karanlık sayfada beyaz kalırdı.

Yeniden icat etmek yerine eşleşilmesi gereken kalıplar: `components/ui/Button.jsx` ile
tam genişlikte hap butonlar (`rounded-full`), `rounded-2xl border border-ink/10` kartlar,
sayfa başlıkları altında `h-px w-16 bg-dusty-rose` çizgi, büyük harf `tracking-[0.15em]`
mikro etiketler, seçili durum için `border-burgundy bg-burgundy/5 text-burgundy`.
Paylaşılan primitifler `components/ui/` altındadır.

`StatCard` opsiyonel bir `to` prop'u alır: verilirse kart `<Link>`e dönüşür ve hover'da `hover:border-dusty-rose` + etiket koyulaşması uygular; verilmezse düz `<div>` kalır. `QuickActionCard`'daki `hover:-translate-y-1` yükselme efekti **büyük eylem kartlarına ait bir idiomdur**, küçük istatistik kartlarında kullanılmaz.

Kategori → lucide ikon eşlemesi `src/lib/categoryIcons.js` içinde merkezidir ve
`001_initial_schema.sql` seed verisindeki kebab-case ikon adlarıyla hizalı tutulmalıdır.

### Geliştirici kaçış kapıları

Şu an aktif bir geliştirici kaçış kapısı **yoktur** — üçü de görevlerini
tamamlayıp kaldırıldı:

- `pages/Wardrobe.jsx` içindeki `DEV_FORCE_EMPTY` / `DEV_FORCE_EMPTY_CATEGORY`
  sabitleri (boş durumları önizlemek içindi) API'ye geçişte kaldırıldı — boş
  durum artık gerçek veriyle test edilir.
- `Navbar`'daki `RotateCcw` butonu (onboarding'i yeniden tetiklemek içindi)
  auth eklenirken kaldırıldı.
- `api.js` içindeki `logImageOutcome()` (Android'de hangi `<img src>`
  denendiğini Logcat'ten görmek içindi, `ClothingCard`/`ClothingDetail`'den
  çağrılıyordu) fotoğraf sorunu uzun süre önce teyit edildikten sonra
  kaldırıldı (2026-08-24).

---

## 9. Değişiklik Günlüğü

> Bundan sonraki her çalışma buraya tarihiyle işlenir: eklenen özellikler, düzeltilen
> hatalar, alınan mimari kararlar. En yeni kayıt en üstte.

### 2026-09-02 — KRİTİK DÜZELTME: hazır durum pill'leri artık stil önceliklendirmesinden geçiyor
- **Bağlam:** Sunuma 2 gün kala, kullanıcı gerçek gardırobunda "Spor" pill'ine tıkladı
  ve mini etek + görece resmi bir çanta içeren, spor olmayan bir kombin aldı — oysa
  AYNI niyeti serbest metinle ("spora gideceğim") yazmak doğru, sportif bir kombin
  üretiyordu. İki girdinin aynı sonucu vermesi beklenirdi.
- **Kök neden — `OutfitSuggestion.jsx > handlePillSelect`, moodContext'i KOŞULSUZ
  `null`'a çekiyordu.** 2026-08-25/26 oturumlarında kurulan tüm stil önceliklendirme
  zinciri (`preferAvoidingKeywords → preferFormalShoes → preferFormalStyle →
  preferSportyStyle`, bkz. §8 "Mood bağlamı") yalnızca `moodContext` doluyken
  çalışır ve `moodContext` yalnızca `interpretOutfitRequest`'in (Gemini) gerçek bir
  yanıtından (`createMoodContext`) üretiliyordu. Altı hazır durum pill'i
  (Üniversite/İş/Akşam Yemeği/Buluşma/Spor/Özel Davet) Gemini'ye HİÇ gitmiyor —
  bilerek: her tıklamada canlı bir çağrı hem gereksiz maliyet hem gecikme olurdu.
  Sonuç: pill'e tıklamak yukarıdaki mekanizmanın TAMAMINI atlayıp saf vektör
  benzerliğine düşüyordu; serbest metinle aynı niyeti yazmak ise doğru çalışıyordu.
  İki girdi aynı sonucu vermeliydi ve vermiyordu — bu bir hata, tasarım kararı değildi.
- **Çözüm — `outfitBuilder.js > OCCASION_STYLE_HINTS` + `createFallbackMoodContext(occasion)`.**
  Her pill tıklamasında Gemini'ye gitmek yerine, altı sabit durumdan **dördü için**
  (Spor, İş, Akşam Yemeği, Özel Davet) sabit ve ücretsiz bir `{ occasion, stil_tercihi,
  kacinilmasi_gerekenler }` ipucu tanımlandı ve bu, serbest metnin kullandığı **AYNI**
  `createMoodContext`/`applyMoodPreferences` yoluna sokuldu — iki ayrı, birbirinden
  sapabilecek kod yolu yerine TEK bir önceliklendirme mekanizması.
  - `Spor` → `stil_tercihi: 'Spor ve Rahat'`, kaçınılan: Resmi/Topuklu/Şık aksesuar.
  - `İş` → `'Şık ve Sade'`, kaçınılan: Aşırı rahat/Spor.
  - `Akşam Yemeği` / `Özel Davet` → `'Şık'`, kaçınılan: Günlük/Spor.
  - **`Üniversite` ve `Buluşma` BİLEREK haritada YOK** — bu iki durumda net bir
    resmi/spor ön yargısı olması gerekmiyor (biri hem şık hem rahat olabilir);
    `createFallbackMoodContext` bu ikisi (ve haritada olmayan her occasion) için
    `null` döner, çağıran taraf bunu "eski nötr davranış" olarak ele alır —
    vektör sırası hiç filtrelenmeden aynen korunur.
- **Fallback ÜÇ AYRI çağrı noktasına bağlandı** (`OutfitSuggestion.jsx`):
  `handlePillSelect` (asıl düzeltme), `handleCustomSubmit`'in `catch` bloğu
  (Gemini yorumlama başarısız olduğunda — kullanıcı ham metin olarak tam olarak
  bir occasion adı yazmışsa BİLE eskiden moodContext boşta kalıyordu), ve Ana
  Sayfa'nın hızlı kombin kartlarından gelen `useEffect` (bu efekt
  `handlePillSelect`'i hiç çağırmıyor, doğrudan `runSuggestion`'a düşüyordu —
  düzeltilmeseydi "Akşam Yemeği Kombini" kartından gelen istek pill'e
  tıklamışçasına değil eski, stilsiz davranışla üretilmeye devam ederdi).
- **Serbest metin YİNE ÖNCELİKLİDİR ve fallback'i EZER.** `createMoodContext`
  (Gemini'nin gerçek yanıtından) ile `createFallbackMoodContext` (statik harita)
  AYNI mekanizmadan geçtiği için biri diğerini bozmaz; Gemini gerçek bir yanıt
  ürettiyse kullanıcının YAZDIĞI cümlenin daha zengin ayrıntıları (`kacinilmasi_
  gerekenler`, `stil_tercihi`) devrede kalır, fallback yalnızca Gemini hiç
  çalışmadıysa (pill tıklaması, ya da yorumlama başarısız oldu) devreye girer.
- **Doğrulama — `frontend/test-scripts/test-outfit-builder.mjs`'e 14 yeni kontrol
  (bölüm 13), toplam 154/154:** Spor/Akşam Yemeği/İş/Özel Davet pill'lerinin
  gerçek Gemini kelime dağarcığıyla (`stil: 'Spor'/'Klasik'/'Günlük'`) doğru yönde
  önceliklendirme yaptığı, Üniversite/Buluşma'nın vektör sırasını HİÇ değiştirmediği
  (regresyon), ve serbest metinden gelen Gemini bağlamının fallback'i doğru şekilde
  ezdiği (regresyon) izole birim testleriyle kanıtlandı.
- **Doğrulama — CANLI, gerçek demo hesabıyla (`deneme@gmail.com`), production
  Render API'sinden çekilen GERÇEK `/companions` yanıtı ve GERÇEK Gemini
  embedding'leriyle** (`outfitBuilder.js`'in production'a deploy edilmiş AYNI
  kaynak kodu doğrudan import edilerek çalıştırıldı, ayrı bir kopya YAZILMADI):
  - **"Spor" pill → zara esofman (Spor) + New balance 530 (Spor) + spor çantası
    (Spor)** — tamamen sportif bir kombin; kullanıcının bildirdiği hatalı
    senaryo (etek + resmi çanta) bir daha ÜRETİLMİYOR.
  - **"Akşam Yemeği" / "Özel Davet" pill → mango etek (Minimalist) + stradivarius
    babet (Klasik) + Guess siyah çanta (Şık)** — resmi ayakkabı ve şık çanta
    doğru önceliklendirildi, sportif hiçbir parça seçilmedi.
  - **"İş" pill → zara siyah kot (Günlük) + babet (Klasik) + Guess çanta (Şık)** —
    iş ortamına uygun, aşırı rahat/spor parça geri itildi.
  - **"Üniversite" ve "Buluşma" → REGRESYONSUZ**, moodContext `null` kaldığı için
    sonuç bu düzeltmeden ÖNCEKİ ile BİREBİR AYNI (zara siyah kot + babet + Guess
    çanta — saf vektör sırası, hiç filtrelenmeden).
  - Tüm senaryolarda `vectorCount > 0` — **"Tarzına göre seçildi" rozeti artık
    pill'den gelen sonuçlarda da doğru şekilde çıkıyor** (öncesinde bu davranışta
    değişiklik yoktu, ama rozetin karşılık geldiği "akıllı eşleşme" artık gerçekten
    stil-farkında bir seçim yapıyor).
  - Serbest metin regresyonu izole birim testinde (bölüm 13e) doğrulandı; canlıda
    ayrıca `POST /outfits/interpret` çağrılmadı — demo öncesi Gemini kotasını
    (`geminiLimiter`, saatte 10 istek/kullanıcı) korumak için bilinçli bir tercih,
    zaten mekanizma AYNI (`createMoodContext`/`applyMoodPreferences`) olduğu için
    ayrı bir canlı doğrulama gerekmiyordu.
- Regresyon: `test-outfit-builder.mjs` 154/154, `npm run lint` + `npm run build` temiz.
- **Not — `stilTercihiResmiMi`/`stilTercihiGunlukMu`/`stilTercihiSportifMi`
  (§8 "Mood bağlamı") bu fallback ipuçlarını da AYNI regex'lerle sınıflandırır** —
  `'Spor ve Rahat'` → sportif, `'Şık ve Sade'`/`'Şık'` → resmi. Yeni bir sınıflandırma
  kuralı YAZILMADI, var olan mekanizma sabit ipucu metnini de doğru okuyor.

### 2026-08-31 — Sunum öncesi cila: Yardım & Destek gerçek sayfaya döndü, küçük düzeltmeler
- **Bağlam:** Proje 4 gün içinde sunulacak; kullanıcı "büyük değişiklik yapmadan
  küçük eksiklikleri hallet" dedi. Önce Profil'deki Premium/Bildirimler'in
  "tıklanamıyor" gibi göründüğü iddiası araştırıldı — **hem yerel hem CANLI
  (Vercel + Render) ortamda uçtan uca test edildi, ikisi de sorunsuz
  çalışıyordu** (gerçek bir kayıt akışıyla, Playwright + sistem Chrome):
  Premium kartı `/profil/premium`'a, Bildirimler `/profil/bildirimler`'e
  doğru gidiyor, konsol hatası yok, CORS doğru yapılandırılmış. Kök neden
  bulunamadı — muhtemelen kullanıcının o an baktığı tarayıcı sekmesi/önbellek
  kaynaklı geçici bir durumdu.
- **Bu incelemede GERÇEK bir eksiklik bulundu ve düzeltildi: `/profil/yardim-destek`
  uygulamadaki SON `ComingSoon` yer tutucusuydu** (`App.jsx`'teki tüm rotalar
  tek tek gözden geçirilerek doğrulandı — başka hiçbir placeholder rota kalmamıştı).
  Yeni `pages/HelpSupport.jsx`: beş soruluk bir SSS (native `<details>`/
  `<summary>` ile açılır-kapanır — yeni bir state/kütüphane GEREKMEDİ) ve bir
  "Bize Ulaş" mailto kartı. `ComingSoon.jsx` artık hiçbir yerden kullanılmadığı
  için silindi. Açık/kapalı, karanlık mod ve 390px mobilde gerçek tarayıcıda
  doğrulandı (Playwright + sistem Chrome): temiz konsol, taşma yok.
- **`frontend/index.html`'deki `<html lang="en">` → `lang="tr"` düzeltildi.**
  Uygulamanın tamamı Türkçe (CLAUDE.md'nin kendi kuralı) ama kök etiket
  yanlışlıkla İngilizce kalmıştı — ekran okuyucu telaffuzunu ve tarayıcı yazım
  denetimini etkiliyordu.
- **`geminiLimiter`'ın gürültülü başlangıç uyarısı düzeltildi.** Sunucu her
  açılışında `middleware/rateLimiters.js` konsola bir `ValidationError`
  basıyordu (`ERR_ERL_KEY_GEN_IPV6`) — **gerçek bir çökme DEĞİLDİ**
  (express-rate-limit bu hatayı içeride yakalayıp yalnızca logluyor, asla
  fırlatmıyor) ama gürültülüydü ve ilk bakışta bir çökme gibi okunuyordu.
  Sebep: `keyGenerator: (req) => req.userId || req.ip` — kütüphane özel
  `keyGenerator` fonksiyonlarının IPv6 alt ağını doğru ele almasını (kendi
  `ipKeyGenerator` yardımcısıyla) zorunlu tutuyor. `req.ip` çağrısı
  `ipKeyGenerator(req.ip)` ile değiştirildi; artık temiz açılıyor.
- **Production demo verisi hazırlandı (kod değişikliği DEĞİL, veri
  operasyonu):** gerçek demo hesabının (`deneme@gmail.com`, Neon) 20 parçası
  da analiz edilmişti ama **hiçbirinin embedding'i yoktu** — yani Kombin
  Öner bu hesapta HER ZAMAN sessizce rastgele seçime düşüyor, "Tarzına göre
  seçildi" rozeti hiç çıkmıyordu. `test-scripts/create-embeddings.js --uygula`
  production Neon'a karşı çalıştırılıp 20/20 embedding üretildi (0 atlandı,
  0 başarısız) — artık RAG akışı bu hesapta gerçekten çalışıyor.
- **Regresyon:** `test-all-endpoints.js` 77/77 (yerel), lint + build temiz.
- **AÇIK RİSKLER — kod tarafında düzeltilemeyen, kullanıcının kendisinin
  ele alması gereken sunum riskleri:**
  1. **Şifre sıfırlama e-postası GERÇEK bir kullanıcıya hâlâ denenmedi**
     (Resend sandbox kısıtı — bkz. §4 Eksikler). Sunumda canlı "şifremi
     unuttum" göstermeyi planlıyorsan bu YALNIZCA Resend hesabının kendi
     sahibinin e-postasına gidiyor; başka bir e-postayla denenirse sessizce
     hiçbir şey gelmez (ama uygulama yine de "kontrol et" ekranını gösterir
     — enumeration önleme ilkesi gereği, bkz. §8).
  2. **Android APK gerçek cihaz/emülatörde hâlâ denenmedi** — bu makinedeki
     JDK/Gradle sürüm uyuşmazlığı yüzünden (`./gradlew` çalışmıyor, bkz. §7).
     Sunumda mobil demo planlanıyorsa ayrı bir ortamda (uyumlu JDK 17/21
     kurulu bir makinede) önceden denenmeli.

### 2026-08-28 — Render'dan Neon'a geçiş (production Postgres artık kalıcı)
- **Bağlam:** Render'ın ücretsiz Postgres'i 30 gün sonra otomatik siliniyordu
  (§4 Eksikler'de uzun süre açık kalan bir risk). Kullanıcı hesap açıp Neon'a
  (kredi kartı istemeyen kalıcı ücretsiz katman, pgvector destekli) geçmeyi
  seçti; bu çalışma taşımayı ve gerçek cutover'ı (Render'ın canlı env
  değişkenlerini Neon'a çevirmeyi) tamamladı.
- **Veri taşıma:** `pg_dump -Fc --no-owner --no-privileges` ile Render'daki
  tüm şema + veri (7 tablo: `users`, `clothing_items`, `outfits`,
  `outfit_items`, `categories`, `style_preferences`,
  `clothing_item_embeddings`) yedeklendi, `pg_restore --no-owner
  --no-privileges` ile Neon'a geri yüklendi. `--no-owner`/`--no-privileges`
  ZORUNLUYDU: iki sağlayıcının rol adları farklı (Render'ın
  `dijital_gardirop_user`'ı ile Neon'un `neondb_owner`'ı).
- **Neon'un POOLED (`-pooler`) ucu yerine DİREKT uç kullanılıyor.** Pooled
  bağlantı üzerinden `ALTER ROLE/DATABASE SET search_path` değişiklikleri
  bazı sorgularda YANSIMADI — PgBouncer'ın bağlantı havuzlaması, halihazırda
  açık backend bağlantılarına oturum varsayılanlarını her zaman yeniden
  uygulamıyor. Uygulamanın kendi `pg.Pool`'u zaten kalıcı bir süreç için
  havuzlama sağladığından Neon'un PgBouncer'ına ayrıca ihtiyaç yok; `DB_HOST`
  bu yüzden **direkt** ucu (`-pooler` son eki OLMADAN) gösteriyor.
- **YAKALANAN HATA (asıl cutover engelini oluşturdu) — Render'daki `DB_HOST`
  ASLA güncellenmemiş, hâlâ eski Render-içi Postgres'in dahili adresini
  (`dpg-...`) taşıyordu.** `DB_NAME`/`DB_USER` Neon'un değerlerine
  güncellenmişti ama `DB_HOST` gözden kaçmıştı. Semptom yanıltıcıydı:
  Render'ın dahili Postgres'i kendinden imzalı bir sertifika kullandığı için
  hata "self-signed certificate" (Neon'un TLS zinciriyle ilgiliymiş gibi
  görünen bir mesaj) olarak çıkıyordu. `/health`'e geçici bir teşhis eklenip
  (`DB_HOST`/`DB_PORT`/`DB_NAME`/`DB_USER` — şifre HARİÇ — döndürülerek) kök
  neden bulundu; `DB_HOST` düzeltilince bağlantı ANINDA çalıştı. Teşhis kodu
  sorun çözülünce kaldırıldı.
- **Bu iz sürerken TLS zinciri için de kalıcı bir sağlamlaştırma yapıldı**
  (`backend/src/config/database.js`, `backend/certs/neon-ca-bundle.pem`):
  Neon'un ucu Let's Encrypt'in nispeten yeni bir çapraz-imza kökünden geçiyor
  ("Root YR") ve bazı Node/OpenSSL sürümleri bunu henüz tanımayabilir.
  Sertifika doğrulaması **GEVŞETİLMEDİ** (`rejectUnauthorized: false`
  YAZILMADI) — bunun yerine ara sertifikalar `certs/neon-ca-bundle.pem`'e
  açıkça eklendi. **Kritik ayrıntı:** bu ekstra sertifikalar Node'un
  varsayılan kök listesinin YERİNE değil YANINA verilmeli — `ca` seçeneği
  tek başına verilirse varsayılan listenin TAMAMEN yerini alır (`ca:
  [...tls.rootCertificates, ...extraCerts]`). Kök sertifika `tls.rootCertificates`'ten
  alındı, harici bir URL'den İNDİRİLMEDİ.
- **Doğrulama:** yeniden yazılmış `database.js` ile production'ın TAM
  bağlantı yapılandırması (Neon direkt uç + `DB_SSL=true`) kullanılarak
  `test-all-endpoints.js` (77/77) ve `test-auth.js` (71/71) çalıştırıldı;
  canlı Render API üzerinden gerçek bir kayıt (`POST /auth/register`)
  atılıp Neon'da doğrudan SQL ile göründüğü doğrulandı, sonra temizlendi.
  `/api/health` canlıda `{"status":"ok","database":{"connected":true}}`
  döndürüyor.
- **Açık iş:** eski Render Postgres kaynağı henüz SİLİNMEDİ — bir süre
  yedek olarak tutulup cutover'ın günler içinde sorunsuz kaldığı
  doğrulandıktan sonra kapatılabilir.

### 2026-08-27 — ChromaDB'den pgvector'a geçiş (vektör deposu artık ayrı bir servis değil)
- **Bağlam:** Kullanıcı SQL ve vektör veritabanlarını Render'ın dışına, kalıcı
  bir yere taşımak istedi ("her deploy'da kaybolmasın diye"). Araştırma bunu
  ortaya çıkardı: **ChromaDB hiçbir zaman Render'a (production) taşınmamıştı**
  — yalnızca yerel Docker'da çalışıyordu. Yani "deploy'da kayboluyor" değil,
  canlı sitede baştan beri **hiç yoktu**: `CHROMA_HOST` production'da
  varsayılan `localhost`'a düşüyor, orada dinleyen hiçbir şey olmadığı için
  her Chroma çağrısı sessizce başarısız oluyordu — Kombin Öner'in "akıllı"
  eşleştirmesi canlıda hep rastgele seçime düşüyordu. Kullanıcı iki ayrı karar
  verdi: SQL veritabanı **Neon**'a taşınacak (ayrı bir iş, henüz kullanıcı
  hesap açmadı — bkz. "Açık iş"), vektör deposu için ise **ayrı bir servisi
  hiç kurmamayı**, embedding'leri DOĞRUDAN Postgres'in içine (pgvector
  uzantısıyla) taşımayı seçti — tek veritabanı, tek fatura, "kaybolma" riski
  yapısal olarak ortadan kalkıyor.
- **Yerel Postgres imajı `postgres:16` → `pgvector/pgvector:pg16`** (resmi
  postgres:16'nın üzerine pgvector ekleyen resmi bir varyant, aynı Debian
  tabanı) — mevcut `postgres_data` volume'üyle birebir uyumlu, veri kaybı
  olmadan geçildi (33 gerçek kıyafet kaydı doğrulandı).
- **Migration `011_add_vector_store.sql`:** `CREATE EXTENSION vector` +
  yeni `clothing_item_embeddings` tablosu (bkz. §5 şema notu). Bilinçli
  olarak bir ANN index'i (ivfflat/hnsw) YOK — kişisel gardırop ölçeğinde
  sıralı kosinüs taraması yeterince hızlı.
- **`VectorRepository` TAMAMEN YENİDEN YAZILDI** — artık ChromaDB istemcisi
  yerine paylaşılan `pool` üzerinden SQL çalıştırıyor (`upsertItem` →
  `INSERT ... ON CONFLICT DO UPDATE`, `query` → `ORDER BY embedding <=>
  $1::vector LIMIT`, `getEmbedding` → tekil `SELECT`, `deleteItems` →
  `DELETE ... WHERE = ANY(...)`). **`VectorService`'in iş mantığı (retry,
  kota soğuması, in-flight muhafızı, maliyet koruması, YAZMA-asla-fırlatmaz/
  OKUMA-fırlatır sözleşmesi) NEREDEYSE HİÇ DEĞİŞMEDİ** — yalnızca
  `query()`'ye geçirilen filtre şekli ChromaDB'nin `where: { $and: [...] }`
  DSL'inden düz `{ userId, categoryId }` parametrelerine sadeleşti.
  `#readOwnVector` artık `getCollection().get(...)` yerine doğrudan
  `vectorRepository.getEmbedding(id)` çağırıyor.
- **`config/chroma.js` SİLİNDİ, yeni `config/vectorStore.js` eklendi** —
  yalnızca bir `isEnabled()` bayrağı taşır (`VECTOR_STORE_ENABLED`, eski
  `CHROMA_ENABLED`'ın karşılığı); ayrı bir host/port/istemci kurulumu
  YOKTUR çünkü artık ayrı bir servis yok.
- **pgvector'ın `<=>` operatörü ChromaDB'nin kosinüs mesafesiyle AYNI ölçüt**
  (0 = birebir aynı yön) — geçiş sonrası benzerlik sıralamaları birebir aynı
  davranışı korudu; gerçek Gemini embedding'leriyle YENİDEN doğrulandı (aşağıya
  bakın), rastgele bir varsayım değil.
- **`cleanup.js`'in öksüz-vektör süpürmesi ÖNEMLİ ÖLÇÜDE BASİTLEŞTİ.**
  ChromaDB döneminde bu, iki AYRI depo arasında id listesi taşımayı
  gerektiriyordu (Chroma'dan tüm id'leri çek → Postgres'e sorup canlı
  olanları bul → farkı hesapla → Chroma'dan sil). Artık İKİSİ DE aynı
  veritabanında olduğu için TEK bir anti-join SQL sorgusu yeterli:
  `DELETE FROM clothing_item_embeddings WHERE NOT EXISTS (...)`.
- **`chromadb` npm bağımlılığı kaldırıldı**, `docker-compose.yml`'deki
  `chromadb` servisi ve `chroma_data` volume'ü silindi (yerel container ve
  volume da temizlendi — `postgres_data` ise korunuyor).
- **Test scriptleri güncellendi:** `test-vector.js`, `test-outfit-rag.js`,
  `cleanup.js`, `create-embeddings.js` — sahte (mock) repository'lerdeki
  `getCollection()`/`where: {$and:...}` desenleri yeni `getEmbedding()`/
  `{userId, categoryId}` şekline çevrildi. **"Vektör deposu erişilemezken
  uygulama ayakta kalıyor" senaryosu YENİDEN TASARLANDI:** ChromaDB
  döneminde bu, ikinci bir sunucuyu ÖLÜ BİR PORTA bakan `CHROMA_PORT` ile
  açıp gerçek bir ağ hatası simüle ediyordu; pgvector aynı Postgres'i
  paylaştığı için bu senaryo (Postgres ayakta, yalnızca vektör deposu
  erişilemez) fiilen İMKÂNSIZ hâle geldi — pgvector düşerse zaten tüm
  uygulama düşer. Senaryo `VECTOR_STORE_ENABLED=false` ile DEVRE DIŞI
  BIRAKMAYA çevrildi: `isEnabled()` kontrolü her yazma/okuma yolunun EN
  BAŞINDA olduğu için (gerçek bir sorguya hiç gidilmeden) bu, "erişilemez"
  ile BİREBİR AYNI kod yolunu (yazma: sessizce atla, okuma: 503) egzersiz
  ediyor — test edilen asıl garanti ("vektör katmanı kıyafet akışını asla
  düşürmemeli") aynen korunuyor.
- **Doğrulama — GERÇEK Gemini embedding'leriyle, iki ayrı test script'inde:**
  - `test-vector.js`: 81/81 (46 birim + gerçek bağlantı/embedding/devre dışı
    senaryoları). Kontrollü veri (iki beyaz üst, siyah bot, ruj) ile
    **BİREBİR AYNI sıralama** elde edildi: beyaz pamuklu bluz 0.9555 > mat
    ruj 0.7977 > siyah deri bot 0.7973 — ChromaDB döneminde ölçülen
    değerlerle (bkz. 2026-08-21 kaydı) aynı.
  - `test-outfit-rag.js`: 69/69 (36 birim + gerçek RAG akışı + devre dışı
    senaryosu). Siyah tişörte en yakın Alt adayı yine siyah kumaş pantolon
    (0.9638), beyaz keten şort (0.8518) — ChromaDB döneminin sonuçlarıyla
    (bkz. 2026-08-26 kaydı) tutarlı.
  - Regresyon: `test-all-endpoints` 77/77, `test-auth` 71/71, `test-stats`
    60/60, `test-clean-status` 26/26, `test-item-outfits` 27/27,
    `test-premium-and-reset` 19/19, `test-cost-per-wear` 22/22,
    `test-image-upload` 29/29 (fotoğraf akışına dokunulmadığının kanıtı),
    `test-storage` 15/15, `test-ai-analysis --birim` 49/49, `test-skin-tone
    --birim` 33/33.
- **Kapsam dışı bırakılan (bilinçli):** SQL veritabanının Render'dan Neon'a
  taşınması AYRI bir iştir ve bu oturumda BAŞLATILMADI — kullanıcının bir
  Neon hesabı/projesi oluşturması gerekiyor. Neon taşındığında migration `011`
  (ve `009`/`010`) o veritabanında da uygulanmalı; pgvector uzantısı Neon'da
  standart olarak desteklendiği için ek bir adım gerekmez.
- **AÇIK İŞ:** Kullanıcı Neon hesabı oluşturmayı henüz TAMAMLAMADI (kredi
  kartı istemeyen bir akış istendi, adım adım rehberlik sürüyor). SQL
  veritabanı hâlâ Render'da; yalnızca vektör deposu taşındı.

### 2026-08-27 — Kullanım başına maliyet (cost-per-wear) eklendi
- **Bağlam:** Yol haritasının "Farklılaştırıcı" şeridindeki ilk madde. Kullanıcı
  R2 kurulumunu (kredi kartı istemeden ücretsiz katmanla bile olsa) şimdilik
  ertelemeyi seçti; bu madde hiçbir dış hesap gerektirmediği için hemen
  uygulandı. Tam mimari not için bkz. §8 "Kullanım başına maliyet".
- **Migration `010_add_purchase_price.sql`:** `clothing_items.purchase_price
  NUMERIC(10,2)`, nullable.
- **"Kaç kez giyildi" TÜRETİLEN bir değer** — ayrı bir kolon eklenmedi.
  `outfits.times_worn` yalnızca kombin bazında tutulduğu için bir parçanın
  toplam giyilme sayısı, o parçayı içeren TÜM kombinlerin `times_worn`
  toplamıdır (`ClothingItemRepository.findById`'e eklenen bir `SUM` alt
  sorgusu). Bu alt sorgu BİLEREK yalnızca `findById`'de var — liste uçlarına
  (Gardırop ızgarası, vektör aday zenginleştirmesi) sızmıyor.
- **`GET /clothing-items/:id`'e iki computed alan eklendi:** `total_times_worn`
  ve `cost_per_wear` (`ClothingItemService` içinde hesaplanır, repository'de
  DEĞİL). `cost_per_wear`, fiyat yoksa ya da parça hiç giyilmediyse `null`
  döner — `0`'a bölme ya da uydurma bir değer asla üretilmez.
- **`purchasePrice`, `isClean` ile AYNI "PUT'ta gönderilmezse korunur"
  ilkesini izler** ama gerçek bir "temizle" kavramı da var: `null` göndermek
  fiyatı bilerek siler.
- **Frontend:** `QuickAddModal`'a "Satın Alma Fiyatı (₺)" alanı eklendi
  (`age` alanıyla AYNI string-state deseni); `ClothingDetail.jsx`'e fiyat
  varsa gösterilen, yoksa hiç render edilmeyen bir "Kullanım Başına Maliyet"
  bölümü eklendi.
- **Doğrulama — `test-scripts/test-cost-per-wear.js` (YENİ, 22 kontrol):**
  fiyatsız/giyilmemiş parçada `null` korumaları, **KRİTİK — İKİ AYRI kombinde
  giyilen bir parçanın giyilme sayılarının TOPLANDIĞI** doğrulaması, geçersiz
  fiyat reddi, `PUT`'ta koruma/temizleme, liste ucunun computed alanları
  taşımadığı. Gerçek tarayıcıda (Playwright + sistem Chrome, 12 kontrol):
  formdan kayıt, Kıyafet Detay'da doğru gösterim, **3 kez "Bugün Giydim"
  sonrası 900₺/3 = 300₺'nin GERÇEKTEN ekrana çıkması**, düzenlemede ön-dolu
  gelme, fiyat temizlenince bölümün kaybolması, temiz konsol.
- Regresyon: `test-all-endpoints` 77/77, `test-image-upload` 29/29, frontend
  lint + build temiz.
- **Kapsam dışı bırakılan (bilinçli):** paylaşılabilir bir istatistik kartı
  (roadmap'in "sosyal medyada dolaşan rakam" fikri) — yalnızca Kıyafet
  Detay'da gösteriliyor, ayrı bir paylaşım mekanizması eklenmedi.

### 2026-08-27 — Kıyafet fotoğrafları Cloudflare R2'ye yansıtılabiliyor (kod hazır, hesap kurulumu bekliyor)
- **Bağlam:** Aynı profesyonelleştirme yol haritasının "Hemen kazanç" şeridindeki
  son madde. Render'ın disk alanı ephemeral olduğu için bu ay yaşanan gerçek bir
  olay vardı: canlıya taşınan bir hesabın kıyafet fotoğrafları bir deploy sonrası
  kayboldu, elle yeniden yüklendi. Kullanıcı sağlayıcı olarak Cloudflare R2'yi
  seçti (S3 uyumlu, geniş ücretsiz katman). Tam mimari not için bkz. §8
  "Fotoğraf depolama — Cloudflare R2".
- **Yeni `config/r2.js` + `repositories/StorageRepository.js`** —
  `config/gemini.js`/`WeatherRepository` ile AYNI iki desen: lazy + anahtara
  bağlı önbelleklenen istemci, "dış servis de repository'dir, fırlatır" kuralı.
  BEŞ env değişkeninin (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
  `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`) hepsi dolu
  değilse özellik TAMAMEN devre dışı kalır, davranış eskisi gibi kalır.
- **`ClothingItemService`/`ClothingItemController`'a OPSİYONEL üçüncü/dördüncü
  bağımlılık eklendi** (`storageRepository`) — `clothingAnalysisService`/
  `vectorService` ile AYNI "verilmezse eskisi gibi çalışır" deseni.
- **Yerel dosya BİLEREK silinmiyor** — R2 yalnızca yerel diskin YANINA
  ekleniyor, yerine geçmiyor: arka plan Gemini analizi hâlâ yerel dosyayı
  okuyor, bu okuma yoluna hiç dokunulmadı. Kalıcılık artık `image_url`
  kolonundaki R2 adresinden geliyor; yerel kopyanın bir redeploy'da
  kaybolması artık ÖNEMLİ DEĞİL.
- **Yeni `test-scripts/migrate-photos-to-r2.js`** — var olan yerel fotoğrafları
  geriye dönük R2'ye taşır, `migrate-selfie-photos.js` ile birebir aynı kalıp
  (salt okunur varsayılan, `--uygula`, idempotent, yerel dosyayı silmez).
- **Doğrulama — `test-scripts/test-storage.js` (YENİ, 15 kontrol, gerçek R2
  hesabı GEREKTİRMEZ):** yapılandırılmamışken/yarım yapılandırmadayken devre
  dışı kalma, tam (sahte) yapılandırmada istemcinin gerçekten kurulması,
  anahtar değişince önbelleğin geçersiz kılınması, geriye dönük uyumluluk.
- **Regresyon (R2 yapılandırılmamış — mevcut durum):** `test-all-endpoints`
  77/77, **`test-image-upload` 29/29 (kritik — yerel diske hiç dokunulmadığının
  kanıtı)**, `test-auth` 71/71, `test-stats` 60/60, `test-clean-status` 26/26,
  `test-item-outfits` 27/27, `test-premium-and-reset` 19/19.
- **Yeni bağımlılık:** `@aws-sdk/client-s3` (backend).
- **AÇIK İŞ — kullanıcı henüz gerçek bir Cloudflare R2 hesabı/bucket/API token'ı
  OLUŞTURMADI.** Kod "yapılandırılmamış" durumda tam regresyonla doğrulandı;
  gerçek kimlik bilgileri girildiğinde uçtan uca (yükle → sil, bucket CORS
  ayarı dahil) doğrulama YAPILMASI GEREKİYOR. **Bilinçli olarak kapsam dışı
  bırakılan iki nokta:** selfie'ler R2'ye taşınmadı (özel/token'lı servis
  modeliyle R2'nin genel URL'si çelişir); R2 için gerçek zamanlı öksüz-obje
  temizliği (`cleanup.js` sweep'i) henüz eklenmedi.

### 2026-08-27 — "Bildirimler" sayfası gerçek bir özelliğe dönüştürüldü
- **Bağlam:** Aynı profesyonelleştirme yol haritasının "Hemen kazanç" şeridindeki
  üçüncü madde. `/profil/bildirimler` öncesinde `ComingSoon` ile "yakında" yazan
  boş bir iskeletti; artık kirli parça hatırlatıcısı ve soğuk hava uyarısı
  gösteren gerçek bir sayfa. Tam mimari not için bkz. §8 "Bildirimler sayfası".
- **Backend'de HİÇBİR DEĞİŞİKLİK gerekmedi** — sayfa tamamen mevcut uçları
  (`GET /clothing-items`, `GET /categories`, `GET /auth/me`, `GET /weather`)
  yeniden kullanıyor. Roadmap'in "altyapısı zaten kod tabanında duran, yalnızca
  bağlanmayı bekliyor" iddiasının doğrudan kanıtı.
- **Gerçek bir push/anlık bildirim sistemi DEĞİLDİR** (Service Worker/VAPID/FCM
  yok) — sayfa açıldığında var olan veriden hesaplanan bir özettir; bu bilinçli
  bir kapsam kararı (bkz. §8).
- **"Kaç gündür kirli" gibi bir iddia BİLEREK YOK** — `updated_at` yalnızca
  "son düzenleme" anını tutar, "kirli işaretlenme anı" için güvenilir değildir;
  liste yalnızca hangi parçaların ŞU AN kirli olduğunu söyler.
- **Soğuk hava uyarısı yalnızca hava GERÇEKTEN soğukken çıkar**
  (`COLD_WEATHER_STATUS`, Dış Giyim slotuyla AYNI kaynak) ve **"bugün" der,
  "yarın" DEMEZ** — `WeatherService` bir tahmin API'si değil, yalnızca güncel
  sıcaklığı döndürür.
- **Doğrulama:** gerçek tarayıcıda 12 kontrol (Playwright + sistem Chrome) —
  boş durum, kirli parça hatırlatıcısının uçtan uca çalışması (işaretle → görün
  → tıkla → detaya git), hava durumu mock'lanarak soğuk uyarısının çıkması ve
  sıcakken HİÇ çıkmaması, iki bölümün birlikte görünebilmesi, temiz konsol.
  Backend'e dokunulmadığı için regresyon riski yok; frontend `npm run lint` +
  `npm run build` temiz.
- **Kapsam dışı bırakılan (bilinçli):** fotoğraf depolamayı Render'ın ephemeral
  diskinden Cloudflare R2/S3 gibi kalıcı bir depoya taşımak — aynı yol
  haritasının bir sonraki maddesi, ama bir depolama sağlayıcısı seçimi ve
  hesap/kimlik bilgisi gerektirdiği için (yalnızca kullanıcının verebileceği bir
  karar) bu oturumda BAŞLATILMADI.

### 2026-08-27 — Premium sınırları GERÇEKTEN uygulandı + şifre sıfırlama akışı eklendi
- **Bağlam:** Uygulama Render (backend) + Vercel (frontend) üzerinde canlıya
  alındıktan sonra çıkarılan bir profesyonelleştirme/pazarlanabilirlik yol
  haritasından, en yüksek öncelikli iki madde uygulandı: (1) `subscription_tier`
  kolonu Aşama 1'den beri veritabanında duruyordu ama hiçbir yerde okunmuyordu —
  Profil'deki "Premium'a Geç" düğmesi hiçbir şeye bağlı olmayan bir dekordu;
  (2) şifresini unutan bir kullanıcı için **hiçbir kurtarma yolu yoktu**, hesap
  kalıcı olarak kilitli kalırdı. İkisinin tam mimarisi için bkz. §8 "Premium
  sınırları" ve "Şifre sıfırlama sistemi".

**Premium sınırları — özet.** `config/plans.js > FREE_LIMITS = { clothingItems:
30, outfits: 10 }`. `ClothingItemService.createItem` / `OutfitService.createOutfit`
yazmadan önce kullanıcının planını (`UserRepository.findById`) ve güncel sayısını
kontrol eder; sınır ücretsiz kullanıcıda aşılırsa yeni `PremiumRequiredError`
(`402 Payment Required`) fırlatılır. Sınır BİLİNÇLİ olarak paylaşılan Gemini
kotasından (günde 20 istek) BAĞIMSIZ, saf veritabanı sayımıdır — "premium'da
sınırsız AI" gibi kotayla çelişecek bir vaat verilmedi. Frontend: `PremiumCard.jsx`
gerçek plan + kullanım sayısını gösterir, `pages/Premium.jsx` (`/profil/premium`)
butonun gittiği gerçek (ama ödeme akışı henüz kurulmamış, dürüstçe "yakında"
diyen) hedef sayfadır.

**Şifre sıfırlama — özet.** `POST /auth/forgot-password` (`{ email }` → her
zaman `204`, enumeration yok) ve `POST /auth/reset-password` (`{ token,
newPassword }` → `204`) eklendi. Migration `009`: `users.reset_token_hash` +
`reset_token_expires_at`. Mekanizma refresh token'la BİREBİR AYNI opak-token
deseni kullanır (`<userId>:<hex>`, bcrypt özeti, tek kullanımlık, süreli).
Yeni `EmailRepository` (Resend API, native `fetch`) — `RESEND_API_KEY` yoksa
e-posta sessizce gönderilmez ama yanıt değişmez (WeatherService/GeminiService
ile AYNI "anahtar yoksa dış servise hiç gidilmez" ilkesi). Başarılı sıfırlamada
kullanıcının mevcut refresh token'ı da geçersiz kılınır (tüm oturumlar düşer).
Frontend: `ForgotPassword.jsx` / `ResetPassword.jsx` (yeni rotalar
`/sifremi-unuttum`, `/sifre-sifirla`), `Login.jsx`'e "Şifremi Unuttum?" linki.

**Doğrulama:**
- **Backend — yeni `test-scripts/test-premium-and-reset.js`, 19 kontrol:**
  ücretsiz planda tam sınıra kadar sorunsuz oluşturma + sınırı aşan istekte
  `402` (hem parça hem kombin için), premium'a yükseltilince sınırın üstüne
  çıkabilme; şifre sıfırlamada enumeration yokluğu, token'ın veritabanına
  gerçekten yazılması, geçersiz/kullanılmış/süresi dolmuş token'ların hepsinin
  `401`'e düşmesi, başarılı sıfırlama sonrası eski şifrenin ÇALIŞMAMASI + yeni
  şifrenin ÇALIŞMASI + eski refresh token'ın geçersiz kalması.
  **Test script'inde yakalanan iki kendi hatam (ürün hatası DEĞİL):**
  (a) `call()` yardımcısı GET isteklerinde `body: null`'ı `JSON.stringify(null)`
  = `"null"` metnine çevirip GET'e gövde ekliyordu (`fetch` bunu reddediyor) —
  koşul `body === null || body === undefined ? undefined : ...` olarak
  düzeltildi. (b) "süresi dolmuş token" senaryosu YANLIŞLIKLA "başarılı
  sıfırlama" senaryosuyla AYNI token'ı paylaşıyordu; `forgotPassword`'ın her
  çağrıda hash'in ÜZERİNE YAZMASI yüzünden ikinci `forgotPassword` çağrısı
  ilk token'ı sessizce geçersiz kılıp "başarılı sıfırlama" testini bozuyordu —
  test, süresi dolmuş senaryoyu KENDİ bağımsız/taze token'ıyla akışın EN SONUNA
  taşıyarak düzeltildi.
- **Backend regresyon:** `test-auth` 71/71, `test-all-endpoints` 77/77,
  `test-stats` 60/60, `test-clean-status` 26/26, `test-item-outfits` 27/27.
- **Frontend — gerçek tarayıcıda (Playwright + sistem Chrome), iki ayrı script,
  toplam 28 kontrol:** şifre sıfırlama akışı (16 kontrol — "Şifremi Unuttum?"
  linki, e-posta ön-doldurma, var olan/olmayan e-postada AYNI ekran, gerçek
  token'la form doldurma, eşleşmeyen şifre hatası, başarılı sıfırlama →
  Login'e dönüş + onay mesajı, eski/yeni şifreyle giriş, token'sız/geçersiz
  token senaryoları) ve premium kartı (12 kontrol — kart gerçek plan + gerçek
  kullanım sayısını gösteriyor, buton GERÇEKTEN `/profil/premium`'a gidiyor,
  premium'a yükseltilince kart VE buton görünürlüğü güncelleniyor).
  **Test sırasında yakalanan üç ortam/test tuzağı (ürün hatası DEĞİL):**
  (a) fresh bir tarayıcı profilinde `dg_intro_seen` yoksa App.jsx tanıtım
  (intro) ekranını Login'in ÖNÜNE koyuyor — testler `context.addInitScript`
  ile bu bayrağı navigasyondan ÖNCE basacak şekilde düzeltildi; (b) ikinci bir
  `vite` dev sunucusu (`5174`) CORS'un varsayılan izinli listesinde
  (`http://localhost:5173`) OLMADIĞI için `forgotPassword` isteği tarayıcıda
  sessizce CORS hatasıyla düştü — test, zaten çalışan ve DOĞRU origin'deki
  `5173` sunucusuna yönlendirilerek düzeltildi (fazladan açılan `5174`
  kapatıldı); (c) `/profil/premium`'a geçiş sonrası kullanım verisini
  bekleyen `useEffect` henüz tamamlanmadan `isVisible()` kontrolü hemen
  çalıştırılmıştı — `waitForSelector` eklenerek düzeltildi.
- Frontend `npm run lint` + `npm run build` temiz.
- **Bilinçli olarak kapsam dışı bırakılanlar:** gerçek bir ödeme sağlayıcısı
  (Stripe vb.) entegrasyonu — roadmap'in daha büyük, ayrı bir maddesi;
  premium'dan ücretsize düşme akışı — şu an hiçbir yerde tetiklenmiyor;
  şifre sıfırlama e-postasının GERÇEK bir kullanıcıya gönderilmesi —
  Resend sandbox kısıtı (`onboarding@resend.dev` yalnızca hesap sahibine
  gönderebilir) nedeniyle özel alan adı doğrulanana kadar test edilemedi,
  akışın GERİ KALANI (token üretimi, e-posta HTML'i, doğrulama, sıfırlama)
  uçtan uca gerçek ve doğrulandı.

### 2026-08-27 — "Yeni Parça Ekle" formuna Marka alanı eklendi (519 markalık öneri listesi)
- **Ne eklendi:** `QuickAddModal`'a (hem oluşturma hem düzenleme modunda) "Marka"
  alanı eklendi. Kullanıcı yazmaya başlayınca 519 gerçek markadan (giyim/ayakkabı/
  makyaj, global + Türk pazarına özgü) öneriler çıkıyor; markası listede yoksa
  **doğrudan kendi markasını yazabiliyor** — alan kapalı bir seçenek kümesi değil,
  serbest metin.
- **Backend'de HİÇBİR DEĞİŞİKLİK GEREKMEDİ.** `clothing_items.brand` kolonu,
  `utils/validators.js > FIELD_LIMITS.clothingItems.brand` (100 karakter) ve hatta
  `VectorService.buildSummaryText`'in embedding metnine "Markası X." eklemesi
  Aşama 6'dan beri hazırdı — eksik olan tek şey bu alanı frontend formuna
  bağlamaktı. `createClothingItem`/`updateClothingItem` zaten payload'ı olduğu
  gibi ilettiği için `api.js`'te de değişiklik gerekmedi.
- **Yeni dosya `frontend/src/data/brands.js`** — alfabetik sıralı, tekil, 519
  markalık bir dizi. **Yeni bir kütüphane/bileşen EKLENMEDİ**: 500'ün üzerinde
  markayı bir `<select>`e sığdırmak kullanılamaz olurdu; bunun yerine native
  `<input list="marka-onerileri">` + `<datalist>` kullanıldı — tarayıcının kendi
  autocomplete'i hem öneri gösteriyor hem alanı serbest metin olarak bırakıyor.
- **YAKALANAN EKSİK (yazarken fark edildi):** ilk taslakta en büyük Türk giyim
  markalarından dördü (**LC Waikiki, Koton, Mavi, Network**) unutulmuştu —
  toplam sayım script'iyle (dedupe + alfabetik sıralama) kontrol edilirken
  fark edilip 46 markalık ek bir turla (Türk markaları + çanta/aksesuar +
  outdoor + skate/surf + streetwear + ek makyaj markaları) birlikte eklendi.
- Marka **zorunlu değil** (kategori gibi değil) — DB kolonu nullable, boş
  bırakılırsa `''` gönderiliyor, `ClothingDetail`'deki `{item.brand && (...)}`
  kontrolü bunu zaten görmezden geliyor.
- **Doğrulama — gerçek tarayıcıda 9 kontrol (Playwright + sistem Chrome),**
  geçici bir test kullanıcısıyla: Marka alanının göründüğü ve datalist'e bağlı
  olduğu; datalist'in 500'ün üzerinde seçenek taşıdığı; "Zara" ve "LC Waikiki"nin
  listede olduğu; **listede olan bir markayla ("Zara") kaydın gerçekten
  veritabanına yazıldığı**; Kıyafet Detay'da markanın göründüğü; **KRİTİK —
  listede HİÇ olmayan serbest bir marka adının ("Benim Kendi Markam XYZ") da
  sorunsuz kaydedildiği**; düzenleme modunda mevcut markanın ön-dolu geldiği;
  temiz konsol.
- Regresyon: `test-all-endpoints` 77/77 (backend'e dokunulmadığı için beklenen),
  lint + build temiz.
- **Not — `test-scripts/test-clothing-items.js` bu çalışmadan BAĞIMSIZ olarak
  zaten kırık:** script auth öncesi dönemden kalma, `test-data.json`'daki statik
  `userId`'yi Authorization header'ı OLMADAN gönderiyor ve `401` alıyor. Bu
  görevle ilgisi yok (dokunulmadı), ama fark edildiği için not düşülüyor —
  gerçek regresyon kanıtı `test-all-endpoints.js`'ten geliyor.

### 2026-08-26 — Kalite düzeltmesi: "şık bir akşam yemeği" artık gerçekten şık
- **Rapor edilen sorun:** Serbest metin/mood akışında "şık bir akşam yemeği"
  dendiğinde Gemini occasion'ı ve stil tercihini ("Şıklık") doğru çıkarıyordu
  ama seçilen kombin basit bir tişört+pantolondan ibaret kalıyordu; gardıropta
  elbiseler olmasına rağmen HİÇBİR ZAMAN önerilmiyordu. Bu, önceki günün
  "mood bağlamı" düzeltmesinin (bkz. yukarıdaki 2026-08-25 kaydı) kapsamının
  yetersiz kaldığı ikinci bir tur — o düzeltme yalnızca Ayakkabı'yı ve
  NEGATİF kelime kaçınmasını (Gemini'nin `kacinilmasi_gerekenler` listesi)
  çözmüştü.
- **Üç bağımsız kök neden bulundu** (ayrıntılı mimari not için bkz. §8
  "Mood bağlamı" bölümündeki 2026-08-26 eki):
  1. **Elbise kategorisi kombin kurma mantığının HİÇBİR yerinde yoktu** —
     ne `OUTFIT_CATEGORIES`'te ne backend'e sorgulanan kategorilerde ne
     `pickSeedItem`'ın aday havuzunda. Gardıropta kaç elbise olursa olsun
     sistem yapısal olarak asla bir elbiseyi değerlendirmiyordu.
  2. **Stil filtreleri (`preferFormalShoes`) SADECE Ayakkabı'ya
     uygulanıyordu.** Üst/Alt/Elbise/Çanta yalnızca (çoğu zaman boş dönen)
     negatif kelime kaçınmasından geçiyordu — "şık" isteyen bir sorguda
     "Günlük"/"Rahat" etiketli bir tişört+pantolon hiçbir zaman geri plana
     atılmıyordu.
  3. **`stilTercihi` yalnızca "DOLU MU" diye kontrol ediliyordu, İÇERİĞİNE
     hiç bakılmıyordu** — "Akşam yemeğine gidiyorum ama RAHAT giyinmek
     istiyorum" gibi bir istekte occasion resmi olduğu için sistem
     YANLIŞLIKLA resmi kıyafet önceliklendiriyordu, tam TERSİ gerekirken.
- **Düzeltme — `frontend/src/lib/outfitBuilder.js`:**
  - `resolveActiveCategories(cleanItems, moodContext, textRanking)` +
    `DRESS_CATEGORY = 'Elbise'`: Elbise artık Üst+Alt ikilisine bir
    ALTERNATİF olarak değerlendiriliyor (ek değil — bir elbise iki parçanın
    YERİNE geçer). Karar `textRanking` varsa gerçek embedding benzerliği
    karşılaştırmasıyla (Elbise skoru vs. Üst+Alt skorlarının ortalaması),
    yoksa `genelFormallik`'e dayalı bir yedekle veriliyor. **Yalnızca
    moodContext varken devrede** — pill-only akış hiç etkilenmiyor.
  - `preferFormalStyle(pool, category, moodContext)` — `preferFormalShoes`'un
    Üst/Alt/Elbise/Çanta'ya genelleştirilmiş hâli, kendi genel giyim
    sözlüğüyle (klasik/şık/zarif/elegan/resmi/ofis/kokteyl/gece vs.
    günlük/gündelik/rahat/spor/casual).
  - `stilTercihiResmiMi(stilTercihi)` — hem `preferFormalShoes` hem
    `preferFormalStyle` hem de dress route kararı artık stilTercihi'nin
    İÇERİĞİNİN gerçekten resmiyet/şıklık işaret edip etmediğini kontrol
    ediyor, yalnızca doluluğunu değil.
  - **YAKALANAN İKİNCİ, BAĞIMSIZ HATA (kod yazılırken, gerçek regex testiyle
    tespit edildi):** `\bşık\b` deseni JS'te HİÇBİR ZAMAN eşleşmiyordu — JS
    regex `\b` sınırı `\w`'yi yalnızca ASCII harfleriyle tanımlıyor, Türkçe'ye
    özgü harfler (ş, ğ, ı, ö, ü, ç) "kelime karakteri" sayılmıyor. "sade ve
    şık" gibi bir cümle bu yüzden `stilTercihiResmiMi`'yi hiç tetiklemiyordu.
    Elle, Unicode-farkında bir sınır (`SIK_KELIME_DESENI`) kuruldu.
  - `CANDIDATE_CATEGORIES`'e `DRESS_CATEGORY` eklendi; `variantDepth` artık
    opsiyonel bir `categories` parametresi alıyor (dress route aktifken
    doğru derinlik hesaplansın diye).
  - **Backend'de HİÇBİR DEĞİŞİKLİK GEREKMEDİ** — `/companions` ucu zaten
    tamamen kategori-jenerik (aynı gün eklenen "Dış Giyim" özelliğinde
    doğrulanan aynı gerçek).
- **Doğrulama — `test-outfit-builder.mjs` 108 → 132 kontrol.** Yeni bölüm
  "13) KALİTE DÜZELTMESİ": `resolveActiveCategories`'in hem textRanking hem
  formallik-fallback dallarında doğru karar vermesi (dahil: "şık" isteğinde
  Elbise kazanıyor, "rahat" isteğinde kazanmıyor, moodContext yokken HER
  ZAMAN eski davranış, elbise yoksa HER ZAMAN eski davranış); uçtan uca
  `pickSeedItem` + `buildOutfitFromCandidates` izi (seed olarak GERÇEKTEN
  elbise seçiliyor, kombin TAM 3 parça — Üst/Alt hiç yok, vektörce daha
  yakın ama GÜNLÜK ayakkabı/çanta değil RESMİ olanlar seçiliyor);
  `preferFormalStyle`'ın Üst/Çanta'da genel günlük/şık ayrımını GERÇEKTEN
  yaptığı; **`stilTercihiResmiMi` regresyon testi** ("Akşam Yemeği" + "Rahat"
  stilTercihiyle sneaker/günlük çanta ARTIK geri itilmiyor); `variantDepth`'in
  dress route kategorileriyle doğru derinlik hesapladığı VE eski imzasının
  (parametre verilmeden) regresyonsuz çalıştığı.
- **Doğrulama — GERÇEK backend + GERÇEK Gemini + GERÇEK ChromaDB
  embeddingleriyle uçtan uca (13 kontrol, Playwright + sistem Chrome).**
  Karışık bir test gardırobu kuruldu (her kategoride hem "şık" hem "günlük"
  etiketli parçalar: beyaz basic tişört/ipek şık bluz, mavi kot pantolon/
  siyah kumaş pantolon, siyah kokteyl elbisesi, beyaz sneaker/siyah topuklu
  ayakkabı, kanvas günlük çanta/siyah saten clutch); `ai_analysis` elle
  yazıldı (generateContent kotası harcanmadan), embeddingler GERÇEK
  `create-embeddings.js --uygula` ile üretildi:
  - **KRİTİK — "Şık bir akşam yemeğine gidiyorum, sade ama zarif görünmek
    istiyorum."** GERÇEK Gemini `stil_tercihi: "Sade ve Zarif"`,
    `kacinilmasi_gerekenler: []` (BOŞ — kök neden #2'nin gerçek kanıtı)
    döndürdü. Sonuç: **siyah kokteyl elbisesi + siyah topuklu ayakkabı +
    siyah saten clutch** — vektörce daha yakın sneaker ve günlük çanta
    DEĞİL, RESMİ olanlar seçildi; "Tarzına göre seçildi" rozeti çıktı.
  - **KRİTİK — ZIT istek: "Rahat bir gün geçirmek istiyorum, günlük ve
    konforlu bir kombin lazım."** GERÇEK Gemini `stil_tercihi: "Rahat"`
    döndürdü. Sonuç: **beyaz basic tişört + mavi kot pantolon + beyaz
    sneaker + kanvas günlük çanta** — dört parça, Elbise HİÇ seçilmedi.
  - **REGRESYON — yalnızca "Spor" pill'i (stil tercihi YOK):** yorumlama
    özeti hiç görünmedi (Gemini hiç çağrılmadı), kombin yine 4 parça, Elbise
    seçenek olarak hiç değerlendirilmedi — pill-only akış BİREBİR eskisi gibi.
  - Üç senaryoda da temiz konsol.
- Regresyon: backend'e hiç dokunulmadığı için `test-all-endpoints` 77/77,
  `test-outfit-rag --birim` 36/36, `test-outfit-interpret --kotasiz` 15/15
  değişmeden geçti; frontend lint + build temiz.
- **Temizlik:** test kullanıcısı ve 9 test parçası `cleanup.js` ile silindi
  (kullanıcı CASCADE + 9 öksüz Chroma vektörü süpürüldü).
- **Bilinçli olarak DOKUNULMAYAN bir nokta:** `dirtyOnlyCategories`/
  `emptyCategories` (`OutfitSuggestion.jsx`, "Temiz Alt parçan yok" gibi
  mesajlar) hâlâ STATİK `OUTFIT_CATEGORIES`'e bakıyor — dress route aktifken
  (kombin Üst/Alt kullanmıyorken) teorik olarak ilgisiz bir "Temiz Alt
  parçan yok" notu görünebilir. Bu, `moodContext`'in bir REF'te tutulup
  render'ı tetiklememesiyle ilgili ayrı bir mimari kısıt (ref okumak useMemo
  bağımlılığı olamaz) ve raporlanan kalite sorunuyla doğrudan ilgisi yok;
  eklenen karmaşıklığa değmedi, bilinçli olarak dokunulmadı.

### 2026-08-26 — Katmanlama (layering): koşullu 5. slot olarak Dış Giyim
- **Ne eklendi:** Kombin Öner artık kışlık kombinlerde ana parçanın (Üst/
  Elbise) üstüne giyilen bir mont/kaban/hırka önerebiliyor. Yeni bir kategori
  (`Dış Giyim`) ve `outfitBuilder.js`'e eklenen koşullu bir 5. slot mantığıyla
  çalışıyor; mevcut vektör/RAG sistemi, temiz/kirli filtresi ve hava durumu
  entegrasyonu **hiç değişmeden** korundu.

**VERİTABANI — migration `008_add_outerwear_category.sql`.** `categories`
tablosuna tek satır (`INSERT INTO categories (name, icon) VALUES ('Dış Giyim',
'snowflake')`), şema değişikliği YOK. İkon `snowflake`: lucide-react'te
doğrudan bir mont/kaban ikonu yok, en yakın anlamlı seçim "yalnızca soğuk
havada giyilir" fikrini taşıyan kar tanesi oldu. **`icon` kolonunun DEĞERİ
frontend'de programatik olarak OKUNMAZ** (diğer beş satırla aynı, önceden de
böyleydi) — kategori ikonu eşlemesi `categoryIcons.js`'te isme göre elle
tanımlı; bu satır da oraya elle eklendi (`Snowflake`).

**BACKEND — İKİ küçük değişiklik, `/companions` ucuna SIFIR değişiklik.**
- `GeminiService.KATEGORI_SEMASI`'ne `'Dış Giyim': 'giyim'` eklendi — Üst/Alt
  ile AYNI genel giyim şemasını kullanıyor, ayrı bir şema gerekmedi.
- **`GET /clothing-items/:id/companions` ucu KONTROL EDİLDİ, HİÇBİR SATIR
  DEĞİŞMEDİ.** `VectorService.findCompanions` `categoryIds`'i tamamen jenerik
  işliyor (kategori adı/sayısı hakkında hiçbir varsayım yok); yeni kategori
  frontend'in `CANDIDATE_CATEGORIES` sabitine eklenmesi yeterli oldu. Bu,
  Aşama 4'ün "kategori başına ayrı sorgu" tasarımının **doğrudan** ödediği bir
  genişleyebilirlik kazancı.

**FRONTEND — koşullu 5. slot mantığı `outfitBuilder.js`'te.** Ayrıntılı
mimari not için bkz. §8 "Katmanlama — koşullu 5. slot: Dış Giyim". Özet:
- `OUTERWEAR_CATEGORY = 'Dış Giyim'` — **`OUTFIT_CATEGORIES`'e BİLİNÇLİ
  OLARAK EKLENMEDİ** (Makyaj'la aynı gerekçe: "zorunlu 4 slot" ile "hava
  soğukken üstüne eklenen katman" farklı kavramlar). `CANDIDATE_CATEGORIES`'e
  eklendi ki `/companions` bu kategoriden de aday getirsin.
- **`pickOuterwearItem(candidatesByCategory, weatherStatus, variant)`** —
  Makyaj'ın `pickMakeupItem`'ıyla AYNI iskelet (id-tabanlı geri düşüşsüz
  seçim, havuzda ilerleme, temiz/kirli filtresi, sezon uygulanmaz) ama TEK
  EK KURALLA: `weatherStatus !== COLD_WEATHER_STATUS` ('soğuk', <10°C) iken
  HİÇ denenmeden `null` döner. `weatherStatus` null/undefined olduğunda
  (şehir tanımlı değil, hava durumu servisine ulaşılamadı) da `null`
  döner — **"BELİRSİZLİKTE EKLEME"** ilkesi, yanlışlıkla sıcak bir günde
  mont önermektense hiç önermemeyi tercih eder.
- **`COLD_WEATHER_STATUS` sabiti `lib/seasons.js`'e eklendi** (`'soğuk'`).
  Backend'in `WeatherService.#toStatus`'üyle senkron kalması gereken ham
  dize artık TEK bir yerde tanımlı; `STATUS_SEASONS` da bu sabiti kullanacak
  şekilde güncellendi (davranış değişmedi, yalnızca literal tekrarı kaldırıldı).
- **Görünüm sözleşmesi Makyaj'dan BİLİNÇLİ olarak farklı:** dış giyim
  açılır/kapanır bir bölüm değil, VARSA doğrudan ana ızgaraya 5. kart olarak
  giriyor (`displayItems = [...suggestionItems, outerwearItem]`) ve
  kaydetme/paylaşıma OTOMATİK dahil oluyor (`outfitItems` artık
  `displayItems`'tan türüyor) — kullanıcının bir şey açmasına gerek yok,
  çünkü bu kozmetik bir öneri değil gerçek bir gardırop parçası.
- `ClothingCard`'ın `onCleanChange` callback'i dış giyim kartında da AYNEN
  kullanılıyor: kullanıcı kirli işaretlerse (`outerwearItem` memo'su id'den
  yeniden çözülür) kart anında ızgaradan düşer.
- `categoryIcons.js`'e `'Dış Giyim': Snowflake` ve `ShareOutfitCard.jsx`'in
  `CATEGORY_ORDER`'ına `Üst`'ün hemen ardına eklendi (giyim mantığında üst
  parçanın üstüne giyilen katman budur) — paylaşım görseli de otomatik doğru
  sırada gösteriyor.
- **QuickAddModal'a hiçbir kod değişikliği GEREKMEDİ.** Kategori dropdown'ı
  zaten `GET /categories`'i dinamik olarak render ediyordu (`data-driven`,
  sabit bir liste değil); migration uygulanır uygulanmaz "Dış Giyim" orada
  kendiliğinden belirdi.

**Doğrulama:**
- **Backend — birim testleri güncellendi:** `test-all-endpoints.js`'teki
  "6 kategori seed edilmiş" kontrolü "7 kategori" olarak güncellendi (77/77
  hâlâ yeşil); `test-ai-analysis.js --birim`'e `Dış Giyim → giyim şeması`
  kontrolü eklendi (49/49).
- **Frontend — `test-outfit-builder.mjs` 91 → 108 kontrol.** Yeni bölüm
  "9b) pickOuterwearItem": havuz yok/boş/uygun kategori yok → null; **KRİTİK
  hava durumu koşulu** — soğukken seçiliyor, ılık/sıcakken VE hava
  bilinmiyorken (`null`/`undefined`) HİÇ denenmiyor; havuzda ilerleme ve başa
  sarma; kirli ürün eleniyor, hepsi kirliyse rastgeleye düşülmüyor; sezon
  dış giyimi elemiyor; **dört kartlık ızgaraya sızmıyor** (`vectorCount`'a
  girmiyor, `variantDepth` onu saymıyor, makyaj havuzuyla aynı anda var
  olmaktan etkilenmiyor); `CANDIDATE_CATEGORIES` eşitlik kontrolü güncellendi.
- **Uçtan uca, GERÇEK backend + GERÇEK ChromaDB embeddingleriyle (12 + 5
  kontrol, Playwright + sistem Chrome).** İki geçici test kullanıcısı
  kuruldu: Kullanıcı A (Üst/Alt/Ayakkabı/Çanta/**Dış Giyim**, 5 parça,
  `ai_analysis` test-vector.js'teki "kontrollü veri" deseniyle ELLE yazıldı
  — Gemini `generateContent` kotası harcanmadı — ve `create-embeddings.js
  --uygula` ile GERÇEK embedding üretildi, ayrı bir kota) ve Kullanıcı B
  (Dış Giyim KATEGORİSİNDE HİÇ parçası olmayan 4 kategori). `GET
  /api/weather` Playwright route interception ile kontrollü sıcaklık/durum
  değerleri döndürecek şekilde mocklandı (gerçek `WEATHER_API_KEY` gerekmedi):
  - **KRİTİK — SOĞUK hava + Dış Giyim ürünü VAR:** kombin gerçekten **5
    KART** içeriyor, "Dış Giyim" kartı görünüyor, **"Bu Kombini Kaydet"**
    sonrası veritabanından okunan kombin GERÇEKTEN 5 `outfit_items` taşıyor
    (montun id'si dahil).
  - **KRİTİK — AYNI kullanıcı + SICAK hava:** kombin **4 KARTTA KALIYOR**,
    Dış Giyim kartı hiç görünmüyor (slot hiç denenmiyor, rastgele bir monta
    da düşülmüyor).
  - **KRİTİK — SOĞUK hava + Dış Giyim ürünü YOK (Kullanıcı B):** kombin yine
    **4 KART**, Dış Giyim hiç görünmüyor, kullanıcıya hiçbir hata/uyarı
    mesajı gösterilmiyor (tamamen SESSİZ atlama, Makyaj'daki ilkeyle aynı).
  - Üç senaryoda da temiz konsol.
  - **Ek kontroller:** QuickAddModal kategori dropdown'ında "Dış Giyim"
    gerçekten listeleniyor (kod değişikliği olmadan); Gardırop'un kategori
    filtre pilinde "Dış Giyim" görünüyor; **karanlık modda** 5 kartlı kombin
    doğru render ediliyor ve zemin rengi doğru (`rgb(28,24,21)`).
- Regresyon: `test-all-endpoints` 77/77, `test-auth` 71/71, `test-stats`
  60/60, `test-item-outfits` 27/27, `test-clean-status` 26/26,
  `test-outfit-rag --birim` 36/36, `test-vector --birim` 46/46,
  `test-ai-analysis --birim` 49/49, frontend `test-outfit-builder.mjs`
  108/108, lint + build temiz.
- **Temizlik:** test için oluşturulan iki kullanıcı ve 9 test parçası
  `cleanup.js` ile silindi (kullanıcı CASCADE + 9 öksüz Chroma vektörü
  süpürüldü); gerçek demo verisine dokunulmadı. `categories` tablosundaki
  `Dış Giyim` satırı KALICI (bu, test verisi değil özelliğin kendisi).

### 2026-08-26 — İlk açılış tanıtım (intro) ekranı eklendi
- **Ne eklendi:** Uygulama bir cihazda İLK KEZ açıldığında, Login ekranından ÖNCE
  3 kaydırmalı ekrandan oluşan bir tanıtım (intro carousel) gösteriliyor:
  "Gardırobunu Dijitalleştir" → "Yapay Zekâ Senin İçin Analiz Etsin" →
  "Akıllı Kombin Önerileri Al". Her ekranda büyük bir ikon, serif italik başlık,
  kısa açıklama ve alt kısımda nokta göstergesi var; "Atla" linki (sağ üstte) her
  ekrandan direkt çıkışı, son ekrandaki "Başla" butonu bitirmeyi sağlıyor.
- **Yeni dosyalar:** `frontend/src/lib/intro.js` (`hasSeenIntro()` / `markIntroSeen()`)
  ve `frontend/src/pages/Intro.jsx` (carousel'in kendisi). İkon seçimi BİLEREK
  uygulamanın KENDİ sözlüğünden yapıldı, yeni bir görsel dil icat edilmedi:
  `Shirt` (kategori ikonu), `Sparkles` (AiAnalysisPanel/WardrobeStats zaten
  "yapay zekâ"yı bununla temsil ediyor), `Layers` (BottomNav'daki "Kombinler"
  sekmesinin ikonu).
- **`dg_intro_seen` yeni bir localStorage anahtarı, `lib/onboarding.js`'İN DIŞINDA
  tutuldu.** `dg_theme` ile AYNI gerekçe: bu bir OTURUM verisi değil CİHAZ
  tercihidir ("bu cihazda tanıtım hiç gösterildi mi") — `clearOnboardingState()`
  kapsamına alınmadı, çünkü alınsaydı aynı cihazda çıkış yapan HER kullanıcı
  tanıtımı yeniden görürdü. `İki istisna` notu artık `Üç istisna` (bkz. §8).
- **App.jsx'e entegrasyon — eski `showOnboarding` tam-devre-dışı-bırakma
  deseniyle AYNI yaklaşım** (route eklenmedi): `showIntro = !isAuthenticated
  && !hasSeenIntro()` doğruyken `App()` router/nav ağacı yerine DOĞRUDAN
  `<Intro>` döner. `isAuthenticated` kontrolü `hasSeenIntro()`'dan BİLEREK ÖNCE
  gelir — zaten oturumu olan bir kullanıcı (ör. token varken uygulama yeniden
  açıldığında) tanıtım bayrağı hiç set edilmemiş olsa bile ekranı ASLA görmez;
  bu ekran yalnızca "hiç kullanmamış" kişiler içindir.
- **`onFinish` (Atla ya da Başla) yalnızca bayrağı yazıp bir `introTick`
  state'iyle yeniden render tetikler — `navigate()` ÇAĞRILMAZ.** `authTick`
  ile BİREBİR AYNI desen: `hasSeenIntro()` de state değil, her render'da
  localStorage'dan okunan bir değer; `markIntroSeen()` sonrası React bunu
  kendiliğinden fark etmeyeceği için tetikleyici bir state gerekiyor. Nereye
  düşüleceğine (oturumsuzsa `/giris`, StyleQuiz henüz bitmemişse oraya vb.)
  mevcut `ProtectedRoute`/route ağacı zaten karar veriyor — intro bunu
  tekrarlamıyor.
- **Kaydırma (swipe) kütüphanesiz, düz `onTouchStart`/`onTouchEnd` ile.**
  Depoda bir carousel/swipe paketi yoktu ve tek ihtiyaç "50px'ten büyük yatay
  hareketi sayfa değişimine çevir" olduğu için yeni bir bağımlılık eklenmedi.
  Nokta göstergesine tıklamak da bir gezinme yolu (`aria-label="N. ekrana
  git"`, aktif nokta `aria-current`).
- **Doğrulama — gerçek tarayıcıda 24 kontrol (Playwright + sistem Chrome):**
  ilk açılışta tanıtımın görünmesi; "İleri" ile üç ekranın sırayla açılması;
  nokta göstergesiyle gezinme; **gerçek dokunmatik `TouchEvent` ile** (390px
  mobil viewport, sayfa içinden `new TouchEvent(...)` dispatch edilerek —
  Chrome DevTools Protocol'ün touch emülasyon tuhaflıklarından bağımsız)
  sola kaydırınca ileri, sağa kaydırınca geri gitmesi; 390px'te yatay taşma
  olmaması; **Başla VE Atla'nın ikisinin de** `dg_intro_seen`'i `true` yazması
  ve ardından Login ekranına düşülmesi; **sayfa yenilendiğinde tanıtımın BİR
  DAHA görünmemesi**; **zaten geçerli bir oturumu olan kullanıcıda (`dg_token`
  elle basılarak, `dg_intro_seen` KASITLI OLARAK set edilmeden) tanıtımın HİÇ
  görünmeyip doğrudan Ana Sayfa'nın açılması**; karanlık modda doğru
  zemin/metin renkleri (`rgb(28,24,21)` / `rgb(247,243,237)`); temiz konsol.
- Regresyon: `npm run lint` + `npm run build` temiz, frontend
  `test-outfit-builder.mjs` 91/91 (bu değişiklik yalnızca App.jsx'e ve iki yeni
  dosyaya dokundu, backend/outfitBuilder'a hiç dokunulmadı).

### 2026-08-25 — JWT refresh token sistemi: zorla yeniden giriş kaldırıldı
- **Ne değişti:** Kullanıcılar artık **7 gün sonra zorla yeniden giriş yapmak
  zorunda değil.** Access token KISA ömürlü hâle getirildi (`JWT_EXPIRES_IN`,
  eski varsayılan `7d` → yeni varsayılan **`15m`**) ve yanına UZUN ömürlü, kayan
  pencereli bir refresh token (`REFRESH_TOKEN_EXPIRES_IN`, varsayılan **`30d`**)
  eklendi. Access token süresi dolduğunda frontend arka planda **sessizce**
  yeniler ve orijinal isteği yeniden gönderir — kullanıcı hiçbir şey fark
  etmez; yalnızca refresh token da geçersizse (süresi dolmuş/iptal
  edilmiş/hiç yoksa) GERÇEKTEN Login'e yönlendirilir. "Eksikler" tablosundaki
  *"Token yenileme yok"* maddesi bu çalışmayla kapandı.
- **Migration `007_add_refresh_token.sql`:** `users.refresh_token_hash
  VARCHAR(500)` + `users.refresh_token_expires_at TIMESTAMP`. Kolon adı
  BİLEREK `refresh_token` DEĞİL `refresh_token_hash`dır — `password_hash` ile
  AYNI kural: kolonda asla düz metin token durmaz.

**BACKEND — `AuthService` refresh token'ın TAM sahibi.**
- **Refresh token bir JWT DEĞİL, opak bir dize:** `<userId>:<48 baytlık
  rastgele hex>` (384 bit entropi). DB'de yalnızca bcrypt özeti durur.
  **NEDEN userId gömülü:** bcrypt hash'leri sorgulanamaz (her hash'leme farklı
  salt üretir); token'a ucuz bir arama anahtarı gömmek, tüm kullanıcılar
  üzerinde doğrusal `bcrypt.compare` taraması yapmaktan çok daha iyi ölçekleniyor
  ve DB'yi ele geçiren birine ek bilgi vermiyor (user id zaten access token
  payload'ında da açık).
- **ROTASYON:** her başarılı `POST /auth/refresh` çağrısı YENİ bir access +
  refresh token çifti üretir ve eski refresh token'ın hash'inin ÜZERİNE YAZAR —
  eski token bir daha asla kabul edilmez. Çalınmış bir kopyanın kullanım
  penceresi, meşru sahibinin bir sonraki sessiz yenilemesine kadardır.
- **Kullanıcı başına TEK bir aktif refresh token** (`users` satırının kendisinde,
  ayrı bir "sessions" tablosu değil) — bu depodaki tek-satır-tek-kullanıcı
  deseniyle tutarlı. Bilinçli sınırlama: yeni bir cihazda giriş yapmak
  öncekini geçersiz kılar; çoklu-cihaz oturum yönetimi kapsam dışı (yeni bir
  Eksikler satırı olarak işlendi).
- **Yeni uçlar:** `POST /auth/refresh` (korumasız — tam olarak bu uca
  gelindiğinde access token zaten süresi dolmuş olur; `authLimiter`'ın arkasında)
  ve `POST /auth/logout` (korumalı, `req.userId`'nin refresh token'ını
  veritabanından SİLER — gerçek çıkış, yalnızca localStorage temizlemek değil).
- **`refresh()` yanıtında `user` alanı YOK** — `register`/`login`'in aksine
  çağıran zaten oturum açık bir sayfada. Üçü de ortak `#issueTokenPair`'den geçer.
- **`parseDurationToMs` — küçük, bağımsız bir süre ayrıştırıcı** (`"30d"`,
  `"12h"`, `"15m"`, düz saniye). `jsonwebtoken`'ın kullandığı `ms` paketine
  DOĞRUDAN güvenilmedi (transitive bağımlılık, package.json'da bildirilmemiş —
  kırılgan olurdu); `.env` formatımız zaten dar bir küme olduğu için kendi
  yardımcımız yeterli.
- **`UUID_PATTERN` `utils/validators.js`'ten EK OLARAK export edildi** —
  refresh token'ın gömülü userId'sini biçim olarak doğrulamak için.

**FRONTEND — `lib/auth.js` + `lib/api.js`.**
- Refresh token access token'la AYNI mekanizmayla (`localStorage`,
  `dg_refresh_token`) saklanır — httpOnly cookie BİLEREK kullanılmadı
  (Capacitor WebView'de karmaşıklaşır, access token için de aynı ödünleşme
  zaten yapılmıştı). `setSession({ token, refreshToken })` ikisini BİRLİKTE
  yazar; `clearToken()` artık ikisini de temizler.
- **`api.js > fetchWithAuth` — üç fetch yolunun (`request`/`requestMultipart`/
  `fetchSkinTonePhoto`) PAYLAŞTIĞI tek nokta.** 401 alınırsa `tryRefreshSession()`
  dener, başarılıysa isteği YENİ access token'la **bir kez** yeniden gönderir —
  çağıran sayfa bileşenleri bunu hiç bilmez.
- **`refreshPromise` modül seviyesinde PAYLAŞILIR (dedup).** Bir sayfanın
  `Promise.all` ile attığı birkaç uç AYNI ANDA 401 alırsa, hepsi TEK bir
  `/auth/refresh` çağrısını paylaşır — aksi hâlde her biri kendi rotasyonunu
  tetikleyip birbirinin YENİ token'ını geçersiz kılardı. **Bilinçli sınırlama:**
  bu dedup yalnızca BİR SEKME içindir, sekmeler arası paylaşılmaz (gerçek
  çok-sekme senkronizasyonu kapsam dışı).
- **`hasValidSession()` artık refresh token'ı da SAYAR.** Yalnızca access
  token'ın süresine bakmak, kısa ömürlü hâle geldiği için kullanıcıyı HER
  SAYFA YÜKLEMESİNDE Login'e geri fırlatırdı — tam da bu özelliğin kaldırmaya
  çalıştığı deneyimin ta kendisi. Artık access token geçerliyse hızlı yol; değilse
  ama bir refresh token varsa yine geçerli SAYILIR — gerçek yenileme sayfa
  açıldıktan SONRA, ilk API çağrısının 401'ine tepki olarak sessizce olur.
- **`logout()` best-effort:** sunucu çağrısı başarısız olsa bile yerel çıkış
  engellenmez (`UserService.deleteUser`'daki dosya silme disipliniyle aynı ilke).
- **Bu görevin kapsamı dışında BİLEREK bırakılan bir nokta:** `fetchWithAuth`
  içindeki `timeoutMs` tabanlı `AbortSignal`, YALNIZCA ilk denemede oluşturulur
  ve retry aynı sinyali paylaşır — çok kısa zaman aşımlı uçlarda (ör.
  `VECTOR_REQUEST_TIMEOUT_MS = 4000`) 401+refresh+retry döngüsü teorik olarak
  bütçeyi aşabilir. Zararsız: bu uçlar zaten "başarısızlığı tolere edilebilir"
  olarak tasarlanmış (bkz. `fetchCompanions`), başarısız retry sessizce
  rastgele geri düşüşe döner.

**Doğrulama:**
- **Backend — `test-scripts/test-auth.js` 48 → 71 kontrol.** Yeni bölüm:
  temel yenileme + ROTASYON (eski token'ın rotasyon sonrası kesin reddi),
  geçersiz/eksik/bozuk refresh token (401, 500 DEĞİL), **KRİTİK — süresi
  dolmuş bir access token'ın 401 döndürüp ARDINDAN atılan `/auth/refresh`'in
  çalışan yeni bir token ürettiği** (backend'in "sessiz yenileme" sözleşmesi),
  süresi dolmuş refresh token'ın veritabanında elle simüle edilip 401 + DB
  housekeeping ile doğrulanması, ve **GERÇEK ÇIKIŞ**: `/auth/logout` sonrası
  `refresh_token_hash`/`refresh_token_expires_at`'in veritabanında GERÇEKTEN
  `NULL` olduğu ve çıkıştan önceki refresh token'ın bir daha kabul edilmediği.
- **Frontend — gerçek tarayıcıda 13 kontrol (Playwright + sistem Chrome),**
  gerçek bir test kullanıcısı ve elle imzalanmış süresi dolmuş bir access
  token'la: `page.on('load')` sayacının **1'de kaldığı** (401→sessiz
  yenileme→yeniden deneme sırasında TAM SAYFA YENİLEMESİ OLMADIĞI), sayfanın
  `/gardirop`'ta kaldığı (Login'e düşmediği), `/auth/refresh`'in gerçekten
  çağrılıp başarılı olduğu, orijinal isteğin yeniden gönderilip 200 döndüğü,
  localStorage'daki HER İKİ token'ın da güncellendiği (rotasyon), hata
  ekranının hiç görünmediği; **ayrı bir senaryoda** geçersiz bir refresh
  token'la gerçekten `/giris`'e yönlendirildiği ve localStorage'ın temizlendiği.
- Regresyon: `test-auth` 71/71, `test-all-endpoints` 77/77, `test-stats` 60/60,
  `test-item-outfits` 27/27, `test-clean-status` 26/26, `test-file-cleanup`
  12/12, `test-image-upload` 29/29, `test-vector --birim` 46/46,
  `test-outfit-rag --birim` 36/36, `test-outfit-interpret --birim` 10/10,
  `test-ai-analysis --birim` 48/48, `test-skin-tone --birim` 33/33,
  lint + build temiz.
- **TEST TUZAĞI (yakalandı, ürün hatası DEĞİL):** İlk tarayıcı koşusunda iki
  kontrol yanlış yere kırmızı yandı. (1) "Tam sayfa yenilemesi olmadı" ölçümü
  `page.goto(FRONTEND)` sonra `page.goto(FRONTEND + '/gardirop')` ile İKİ AYRI
  gerçek navigasyon yapıyordu — ikinci `goto` kendi başına bir tam yüklemedir,
  ölçümü anlamsızlaştırıyordu. Düzeltme: `context.addInitScript` ile
  localStorage TEK navigasyondan ÖNCE dolduruldu, `page.on('load')` sayacı
  yalnızca o TEK goto'yu saydı. (2) "Konsol temiz mi" kontrolü, senaryonun
  KENDİSİNİN kasten tetiklediği 401 kaynaklı "Failed to load resource" tarayıcı
  loglarını da hata sayıyordu (2026-08-22 kaydındaki AYNI tuzak) — bu satırlar
  filtrelendi.

### 2026-08-25 — Serbest metin (mood) bağlamı artık GERÇEKTEN kombin seçimine katılıyor
- **Düzeltilen gerçek hata:** bir önceki çalışma (`interpretOutfitRequest`,
  hemen aşağıdaki kayıt) Gemini'ye `occasion`'ı doğru buldurdu ama
  `arama_metni`/`kacinilmasi_gerekenler`/`stil_tercihi` yalnızca özet
  kutusunda GÖSTERİLİYORDU, kombin kurma mantığına hiç girmiyordu — o
  kaydın kendi notu bunu bilinçli bir "basit başlangıç" sınırı olarak
  işaretlemişti. Gerçek kullanıcı testinde bu somut bir hataya yol açtı:
  "sade bir şıklık istiyorum" dendiğinde sistem **parmak arası terlik**
  önerdi. Bu çalışma o boşluğu kapatıyor.
- **Kök neden ölçümle doğrulandı:** gerçek demo gardırobuyla (`deneme@gmail.com`)
  `arama_metni`'nin embedding'i tüm ayakkabılarla karşılaştırıldığında terlik
  gerçekten en dipte kaldı (4 ayakkabı içinde son sırada) ama **saf embedding
  benzerliği tek başına yetersizdi**: bir spor sneaker (New Balance 530), hem
  stiletto'nun hem babetin ÜSTÜNE çıktı — yani salt vektör yakınlığı
  "resmiyet" kavramını güvenilir şekilde kodlamıyor. Bu, kullanıcının önerdiği
  üçüncü mekanizmanın (deterministik resmi-ayakkabı kuralı) neden GEREKLİ
  olduğunu (fazladan değil) kanıtladı.
- **Üç tamamlayıcı mekanizma eklendi** (`frontend/src/lib/outfitBuilder.js`):
  1. `createMoodContext(interpretation)` — Gemini yanıtını
     `{ occasion, stilTercihi, kacinilanKelimeler }`'e sıkıştırır;
     `kacinilmasi_gerekenler` ifadeleri kelimelere bölünür, durak kelimeler
     ("çok", "aşırı", "biraz"…) ve 3 karakterden kısa kelimeler elenir.
     `interpretation` yoksa (pill seçimi, Gemini erişilemedi) `null` döner.
  2. `preferAvoidingKeywords(pool, kacinilanKelimeler)` — bir parçanın
     `ai_analysis.veri` metin alanları kaçınılan bir kelimeyle örtüşüyorsa
     parça **öncelik dışına atılır, ELENMEZ** (`preferSeason` ile aynı
     "önceliklendir, eleme" deseni — küçük bir gardıropta tam eleme kombini
     hiç kurulamaz hâle getirebilirdi).
  3. `preferFormalShoes(pool, category, moodContext)` — yalnızca Ayakkabı
     kategorisinde, yalnızca `stilTercihi` VARSA ve occasion
     `FORMAL_OCCASIONS = ['Akşam Yemeği', 'İş', 'Özel Davet']` içindeyse
     devreye girer; iki regex (`RESMI_AYAKKABI_DESENI` / `GUNLUK_AYAKKABI_DESENI`)
     ile `ayakkabi_turu`/`stil` metnini sınıflandırıp resmi etiketli bir
     adayı önceliklendirir.
     **Tasarım sırasında yakalanan hata:** ilk taslakta `babet`
     `GUNLUK_AYAKKABI_DESENI`'NDEYDİ; kod yazılmadan önce gerçek gardırop
     verisiyle doğrulama yapılınca `stradivarius babet`in `ai_analysis.veri.stil`
     alanının `"Klasik"` olduğu görüldü — bu uygulamanın kendi sözlüğünde
     babet resmi/klasik sayılıyor. Regex, kod yazılmadan ÖNCE düzeltilip
     `babet` yalnızca `RESMI_AYAKKABI_DESENI`'NE taşındı.
  4. **Yeni retrieval ucu `POST /clothing-items/search-by-text`**
     (`VectorService.findByText`, bkz. §6) — `arama_metni`'ni embedding'e
     çevirip kullanıcının TÜM indekslenmiş gardırobunu buna yakınlığa göre
     sıralar. `pickSeedItem` bu sıralama (`textRanking`) verildiğinde seed
     parçayı RASTGELE değil **deterministik olarak en yüksek benzerlikli**
     adaydan seçer — çeşitlilik "Başka Öneri Göster"in mevcut
     `excludeSeedId` mekanizmasıyla korunur (bkz. §8 "Mood bağlamı").
- **Geriye dönük uyumluluk YAPISAL olarak garanti edildi:**
  `buildRandomOutfit`, `pickSeedItem`, `buildOutfitFromCandidates` yeni
  bağlamı OPSİYONEL, varsayılanı `null` olan son parametreler olarak alır;
  `handlePillSelect` (hazır durum pill'i seçimi) bu iki ref'i (`moodContextRef`,
  `textRankingRef`) BİLEREK `null`'a çeker — "stil tercihi olmadan yapılan
  eski akış" bu sayede birebir eskisi gibi çalışmaya devam eder.
- **Doğrulama — `frontend/test-scripts/test-outfit-builder.mjs` 73 → 91
  kontrol.** Yeni 18 kontrol gerçek gardırop verisinin AYNI şeklini kullanıyor
  (`stil: 'Plaj'/'Terlik'`, `'Klasik'/'Stiletto'`, `'Klasik'/'Babet'`,
  `'Spor'/'Sneaker'`): kritik senaryo ("Akşam Yemeği" + "Sade ve Şık" iken
  terlik VE sneaker'ın seçilmemesi, resmi bir ayakkabının seçilmesi),
  moodContext yokken eski davranışın korunması (tek aday terlikse yine
  seçilmesi), yalnızca FORMAL_OCCASIONS'ta devreye girmesi ("Spor" durumunda
  sneaker'ın geri itilmemesi), öncelik-eleme değil davranışı (tek seçenek
  kacinilan kelimeyle örtüşse bile kombin kuruluyor), `pickSeedItem`
  deterministik seçimi + boş `textRanking`'de sessiz rastgele geri düşüş,
  ve rastgele geri düşüşte (Chroma tamamen erişilemez varsayımıyla) BİLE
  kaçınılan kelimelerin uygulanması.
- **Doğrulama — CANLI, gerçek gardıropla (`deneme@gmail.com`, JWT kendi
  imzalandı, backend/Gemini/Chroma GERÇEK).** `generateContent` günlük kotası
  (20/gün) doluydu; adım 1 (occasion yorumlama) bu yüzden kullanıcının
  bildirdiği SENARYOYU birebir yansıtan gerçekçi bir yorumla taklit edildi,
  ama adım 2'den (embedding araması) itibaren HER ŞEY gerçek — embedding
  kotası `generateContent`'ten AYRI olduğu için (CLAUDE.md'de daha önce de
  doğrulanmış bir gözlem) bu adım gerçekten Gemini'ye gitti:
  - `search-by-text` gerçekten `stradivarius bordo stiletto`'yu ayakkabılar
    arasında en yakın 2. sıraya koydu (benzerlik 0.8521, en yakının hemen
    ardından).
  - `pickSeedItem` bu stiletto'yu deterministik seed olarak seçti;
    `buildOutfitFromCandidates` tam kombini kurdu (trençkot + siyah pantolon
    + **stiletto** + siyah çanta) — **terlik seçilmedi**.
  - moodContext OLMADAN aynı adaylarla kurulan eski akış farklı (rastgele)
    bir seed seçti — davranış farkı doğrulandı (regresyon KANITI: eski yol
    hâlâ çalışıyor, yalnızca artık moodContext varken FARKLI davranıyor).
  - Rastgele geri düşüşte (20 deneme, moodContext ile) seçilen ayakkabı
    HER ZAMAN {stiletto, babet} kümesinden çıktı — terlik ve sneaker HİÇ
    seçilmedi. Bu, "Gemini/Chroma erişilemezken sistem hâlâ mantıklı bir
    kombin üretiyor" gereksinimini gerçek koşullarda kanıtlıyor.
- Regresyon: `test-outfit-builder.mjs` 91/91 (73 eski + 18 yeni),
  `test-all-endpoints` 77/77, `test-auth` 48/48, `test-vector --birim` 46/46,
  `test-outfit-rag --birim` 36/36, `test-outfit-interpret --birim` 10/10,
  `test-item-outfits` 27/27, `test-clean-status` 26/26, `test-stats` 60/60,
  `test-file-cleanup` 12/12, lint + build temiz.
- **Bilinçli olarak DOKUNULMAYAN bir nokta:** `variantDepth()` hâlâ ham aday
  sayısına bakar, mood filtresinin daralttığı havuzu saymaz — "Başka Öneri
  Göster" nadiren bir varyantı tekrarlayıp SONRA yeni bir başlangıç
  parçasına geçebilir. Zararsız (indeksleme sınır içinde kalır), eklenen
  karmaşıklığa değmedi; "Eksikler" tablosuna işlendi.

### 2026-08-25 — Kombin Öner: serbest metin (doğal dil) mood/durum anlatımı
- **Ne eklendi:** Kombin Öner'deki hazır durum pill'lerinin altındaki metin
  kutusu artık ham metni doğrudan occasion olarak kullanmıyor — kullanıcı
  kendi cümleleriyle durumunu anlatabiliyor (ör. "Akşam yemeğine gidiyorum
  ama overdress ya da underdress olmak istemiyorum, sade bir şıklık
  istiyorum.") ve bu metin Gemini'ye gidip standart bir occasion'a + kısa bir
  özete çevriliyor. Kutunun KENDİSİ zaten vardı (`customText` state'i, önceki
  bir aşamadan kalma) — eksik olan yorumlama adımıydı, bu çalışma onu ekledi.

**BACKEND — `GeminiService.interpretOutfitRequest(text)`**
- Yeni prompt: `OUTFIT_REQUEST_PROMPT` + `OUTFIT_REQUEST_CATEGORIES` (altı
  standart kategori: Üniversite/İş/Akşam Yemeği/Buluşma/Spor/Özel Davet).
  **Bu liste frontend'deki `lib/occasions.js > OCCASIONS` ile BİREBİR AYNI
  tutulmalıdır** — paylaşılan bir modül olmadığı için senkronizasyon ELLE
  yapılıyor, `test-outfit-interpret.js`'teki bir birim kontrolü bunu ayrıca
  doğruluyor (JSON.stringify karşılaştırması).
- **`occasion` normalizasyonu KATI:** model altı kategoriden biri ya da
  "Diğer" dışında bir şey döndürürse (ör. modelin uydurduğu "Piknik" gibi bir
  kategori) `#normalizeOutfitInterpretation` bunu sessizce "Diğer"e indirger.
  Uydurma bir kategori kabul etmek, frontend'in var olmayan bir pill'i aktif
  göstermeye çalışması gibi sessiz ama yanıltıcı bir hataya yol açardı.
- **REFACTOR — `#generate` → paylaşılan `#callGemini(parts)` çekirdeği.**
  Önceki `#generate(file, prompt)` yalnızca GÖRSEL+metin gönderebiliyordu
  (inlineData zorunluydu). Serbest metin yorumlaması görsel taşımadığı için
  bu, `#generate`'i doğrudan kullanamıyordu. İstemci kurulumu + hata çevirisi
  + zaman aşımı + boş yanıt kontrolünü tekrar yazmak yerine ortak çekirdek
  `#callGemini(parts)`'a çıkarıldı; `#generate` artık image+text parçalarını
  hazırlayıp buna devrediyor, yeni `#generateFromText(prompt)` yalnızca text
  parçasıyla aynısını yapıyor. **Mevcut görsel tabanlı metodların
  (`analyzeClothingItem`, `analyzeSkinTone`) davranışı DEĞİŞMEDİ** — gerçek
  bir Gemini çağrısıyla (`test-gemini.js`, 15/15) doğrulandı.
- **FIRLATIR, retry YOK.** `analyzeSkinTone`/`analyzeClothingItem` gibi
  sessizce boş dönmez (kullanıcı "Anlıyorum..." durumuna bakıp bekliyor) ama
  bu ailedeki diğer akışların aksine (`MAX_ATTEMPTS = 2`) **hiç yeniden
  denemez** — bilinçli bir sadeleştirme: başarısızlığın zaten zararsız bir
  geri dönüşü var (frontend ham metni occasion olarak kullanmaya devam
  eder), "basit başlangıç" için tek deneme yeterli görüldü.
- **Metin en fazla 500 karakter** (`MAX_INTERPRETATION_TEXT_LENGTH`) —
  Gemini'ye gitmeden ÖNCE reddedilir. Bu sınır `outfits.occasion`'ın
  VARCHAR(50)'siyle karıştırılmamalı: bu serbest metin veritabanına HİÇ
  yazılmaz, yalnızca Gemini'ye gidip atılır.
- Basit string birleştirme kullanıldı, `String.replace(placeholder, metin)`
  DEĞİL — `replace`'in ikinci argümanı kullanıcı metniyken `$&`/`$$` gibi özel
  değiştirme dizilerini yorumlar; kullanıcı metninde tesadüfen böyle bir dizi
  geçseydi prompt'u sessizce bozardı.

**Yeni uç `POST /outfits/interpret`** (`OutfitController.interpretRequest`,
`outfitRoutes.js`). Sahiplik/kaynak kavramı YOK — hiçbir şey kaydedilmez,
yalnızca metin gidip yorumlanmış hâliyle döner. `OutfitController` artık
ikinci bir bağımlılık (`geminiService`) alıyor — `ClothingItemController`'ın
`vectorService`/`clothingAnalysisService`'i `OutfitService`'ten AYRI tutmasıyla
aynı desen (biri veritabanı katmanı, diğeri dış bir çağrı). **Hız
sınırlıdır** (`geminiLimiter`, diğer Gemini uçlarıyla aynı — saatte 10 istek).
`/outfits/:id` rotalarıyla YOL ÇAKIŞMASI yok: "interpret" farklı bir HTTP
metoduna (POST, `/outfits/:id` yalnızca GET/PUT/DELETE tanımlıyor) düşüyor;
yine de bir regresyon testi bu isteğin yanlışlıkla `POST /outfits`
(kombin kaydetme) ile karışıp bir kayıt YARATMADIĞINI ayrıca doğruluyor.

**FRONTEND — `OutfitSuggestion.jsx`**
- `handleCustomSubmit` artık `async`: önce `interpretOutfitRequest(text)`
  çağrılır ("Anlıyorum..." durumu — gönder butonunun İÇİNDE, `ShareButton`'ın
  "Hazırlanıyor..." desenindeki gibi, ayrı bir modal/overlay DEĞİL), sonra
  dönen `occasion` ile mevcut `runSuggestion(occasion)` akışına AYNEN devam
  edilir. **Gemini yalnızca "hangi hazır durum" sorusunu yanıtlar** —
  `runSuggestion` bir pill tıklamasıyla gelen occasion ile Gemini'nin
  ürettiği occasion'ı ayırt edemez, ikisi de aynı string; kombin kurma
  mantığına (`outfitBuilder.js`) hiçbir yeni kavram eklenmedi.
- **SESSİZ GERİ DÜŞÜŞ tamamen frontend'dedir** (backend'in "GeminiService
  fırlatır" sözleşmesiyle uyumlu): `interpretOutfitRequest` hata fırlatırsa
  `occasionToUse` ham metnin KENDİSİ olarak kalır (VARCHAR(50) taşmasını
  önlemek için `OCCASION_MAX_LENGTH`'e kırpılmış) — bu, bu özellikten ÖNCEKİ
  davranışın BİREBİR AYNISI. Kullanıcıya hiçbir hata gösterilmez, yalnızca
  `console.warn` ile loglanır.
- **`interpretation` state'i "Anladığım kadarıyla: {arama_metni}" özetini
  besler** (+ varsa "Kaçınılacaklar"/"Öncelikler" etiketleri, virgülle
  ayrılmış). Yalnızca yorumlama BAŞARILI olduysa render edilir; başarısızlıkta
  `interpretation` null kalır ve kullanıcı hiçbir özet görmez. Bir hazır durum
  pill'i seçilince (`handlePillSelect`) hemen temizlenir — aksi hâlde başka
  bir durumun sonuçlarının yanında eski, artık ilgisiz bir özet asılı kalırdı.
- **`kacinilmasi_gerekenler`/`onem_verilen_ozellikler` yalnızca gösterim
  amaçlıdır** — kombin kurma mantığına hiç girmezler (kullanıcının isteği
  gereği: "kombin mantığını karmaşıklaştırmadan").
- Metin kutusunun `maxLength`'i 50'den (eski, occasion'a özgü sınır)
  **500'e** çıkarıldı (`CUSTOM_TEXT_MAX_LENGTH`, backend'in
  `MAX_INTERPRETATION_TEXT_LENGTH`'iyle AYNI) — artık tek kelimelik bir
  occasion değil, gerçek bir cümle/paragraf yazılabiliyor. Placeholder
  "Ya da kendi durumunu yaz..."tan "Ya da durumunu kendi cümlelerinle
  anlat..."a güncellendi.

**Kapsam dışı bırakılan (bilinçli, "basit başlangıç" ilkesiyle):**
`arama_metni` vektör aramasına HİÇ dahil edilmedi — yalnızca `occasion`
kullanılıyor, `arama_metni` sadece kullanıcıya geri gösteriliyor. CLAUDE.md
§8'e iki gelecek genişletme seçeneği (ek ağırlık olarak vs. tamamen yeni bir
embedding sorgusu olarak) mimari not olarak yazıldı, ikisi de UYGULANMADI.

**Doğrulama:**
- **Gerçek Gemini ile 3 farklı serbest metin** (elle, `node -e` ile):
  "Akşam yemeğine gidiyorum ama overdress..." → `Akşam Yemeği` / "Sade ve Şık";
  "Yarın sabah spor salonuna gidicem, rahat bir şeyler lazım." → `Spor` /
  "Rahat"; "Bugün üniversitede sunum yapıcam, ciddi ama fazla resmi olmasın."
  → `Üniversite` / "Yarı Resmi". Üçünde de occasion beklenenle birebir
  eşleşti, `arama_metni` doğal ve isabetli bir özetti.
- **Yeni `test-scripts/test-outfit-interpret.js`, 15 kontrol** (birim + HTTP,
  --birim ve --kotasiz bayraklarıyla): prompt'un altı kategoriyi de içerdiği,
  "Diğer" kuralı, şema alan adları, frontend `OCCASIONS` ile birebir eşleşme;
  boş/çok uzun metin → Gemini'ye hiç gitmeden `ValidationError`; anahtar
  yokken 503; HTTP: token'sız 401, boş/eksik/çok uzun metin 400, **`POST
  /outfits/interpret`'in yanlışlıkla bir kombin KAYDETMEDİĞİ** (regresyon
  kontrolü). Gerçek Gemini bölümü bu koşuda GÜNLÜK KOTA TÜKENDİĞİ için
  atlandı (yukarıdaki elle yapılan 3 örnek zaten kotayı kullanmıştı) — kod
  bunu "kota dolu" olarak nazikçe raporlayıp başarısız SAYMADI.
- **Gerçek tarayıcıda 15 kontrol** (Playwright + sistem Chrome):
  - **BAŞARILI senaryo** (`/outfits/interpret` yanıtı Playwright route
    interception ile mocklandı — backend'in KENDİSİ ayrı, gerçek Gemini
    çağrılarıyla doğrulandığı için bu yalnızca UI mantığını sınıyor):
    metin kutusunun doğru placeholder'la görünmesi, "Anlıyorum..." durumunun
    gerçekten görünmesi, özetin "Anladığım kadarıyla" ile başlaması ve
    `arama_metni`/kaçınılacaklar/öncelikler içermesi, DOĞRU occasion'la
    (`Akşam Yemeği`) öneri üretilmesi, o pill'in görsel olarak aktif
    görünmesi (arka plan rengiyle doğrulandı — `FilterPills` `aria-pressed`
    KULLANMIYOR), başka bir pill seçilince özetin kaybolması, temiz konsol.
  - **BAŞARISIZ senaryo (GERÇEK 503 — kota tükendi, mock DEĞİL):** yorumlama
    başarısız olsa da önerinin YİNE DE üretildiği (ham metin occasion oldu),
    özetin hiç gösterilmediği, kullanıcıya hiçbir hata mesajı çıkmadığı,
    konsolda beklenmeyen bir hata olmadığı (yalnızca uygulamanın kendi
    `console.warn`'ı ve tarayıcının 503 için kendiliğinden bastığı ağ
    logu hariç tutuldu — bunlar birer hata değil, tam da test edilen
    senaryonun beklenen izleri).
- Regresyon: `test-all-endpoints` 77/77, `test-auth` 48/48, `test-stats`
  60/60, `test-item-outfits` 27/27, `test-clean-status` 26/26,
  `test-file-cleanup` 12/12, `test-image-upload` 29/29, `test-vector --birim`
  46/46, `test-outfit-rag --birim` 36/36, `test-ai-analysis --birim` 48/48,
  `test-skin-tone --kotasiz` 58/58, frontend `test-outfit-builder.mjs` 73/73,
  lint + build temiz.
- **Not:** `test-gemini.js`'in gerçek-analiz bölümü bu oturumda BİR KEZ
  başarısız oldu — kod hatası DEĞİL, günlük Gemini kotası (20/gün) bu
  çalışma sırasındaki yoğun test kullanımıyla (3 gerçek örnek metin + birden
  fazla `test-gemini.js` koşusu) tükendi. Aynı script bu oturumda DAHA ÖNCE
  15/15 geçmişti; kota ertesi gün sıfırlanır.
### 2026-08-25 — Güvenlik Sertleştirmesi ve Kod Temizliği
- **Bağlam:** Önceki bir tarama (bkz. bir önceki oturumun raporu) CLAUDE.md'nin
  Eksikler tablosunda hâlâ duran maddeleri, kod içi ölü kod/eskimiş yorumları,
  bir bilinen test kırılganlığını ve **üç yeni güvenlik boşluğunu** (kod tabanında
  Eksikler'e hiç işlenmemiş) tek tek listelemişti. Bu çalışma o listedeki
  **küçük/kolay** maddelerin TAMAMINI ve **üç güvenlik boşluğunun HEPSİNİ**
  kapatıyor. Büyük/orta ölçekli maddeler (şifre sıfırlama, e-posta doğrulama,
  refresh token vb.) BİLEREK kapsam dışı bırakıldı.

## GÜVENLİK (öncelikli)

**1) CORS artık SINIRLI.** `server.js`'teki `cors()` (parametresiz, HERHANGİ
BİR origin'e izin veren hâli) `cors({ origin: … })`'a çevrildi. İzin verilen
liste kod içindeki sabit varsayılanlarla (`http://localhost:5173` web
geliştirme, `http://localhost` Capacitor Android, `capacitor://localhost`
Capacitor iOS) yeni `.env` değişkeni `CORS_ALLOWED_ORIGINS`'in (virgülle
ayrılmış) **birleşimidir** — `.env` değeri varsayılanların ÜZERİNE YAZMAZ,
yalnızca EKLER; aksi hâlde `.env`'i eksik dolduran biri kendi web ya da
Android bağlantısını koparırdı. Origin header'ı OLMAYAN istekler (curl,
sunucu-sunucu) reddedilmez — CORS zaten yalnızca tarayıcı davranışıdır.
Reddedilen origin'ler artık ÇIPLAK bir `500` yerine `server.js`'in sonundaki
özel bir hata middleware'iyle temiz bir `403 + JSON`'a çevriliyor.

**2) `express-rate-limit` kuruldu** (`middleware/rateLimiters.js`, yeni dosya).
İki ayrı limiter, İKİ FARKLI GEREKÇEYLE:
- **`authLimiter`** — `/auth/register` ve `/auth/login`. 15 dakikada 5 deneme,
  IP bazlı. **LOOPBACK (127.0.0.1/::1) MUAFTIR.** Bu bir güvenlik açığı
  DEĞİLDİR: bir saldırgan bağlantısının kaynak adresini UZAKTAN 127.0.0.1
  gibi gösteremez — yalnızca sunucunun KENDİSİNDEN atılan istekler bu adresi
  taşır. Muafiyet olmadan bu depodaki test scriptleri (aynı makineden onlarca
  hesap oluşturuyor; `test-all-endpoints.js` TEK BAŞINA 6 kayıt atıyor)
  birbirinin kotasını dakikalar içinde tüketip regresyon paketini kırardı —
  bu YAKALANDI: ilk regresyon koşusunda `test-all-endpoints.js` tam bu
  sebeple başarısız oldu, loopback muafiyeti eklenerek düzeltildi.
- **`geminiLimiter`** — `POST /clothing-items/:id/analyze` ve
  `POST /users/skin-tone-analysis`. Saatte 10 istek, **`req.userId` bazlı**
  (IP değil — aynı ağın arkasındaki farklı kullanıcılar birbirinin kotasını
  paylaşmasın diye). **LOOPBACK MUAFİYETİ BİLEREK YOK:** buradaki amaç uzak
  bir saldırgandan korunmak değil, gerçek parayla sınırlı günlük Gemini
  kotasını korumaktır ve bu tehdit sunucunun kendisinden (yerel bir
  script/otomasyon) gelse de aynen geçerlidir. Kullanıcı bazlı anahtarlama
  zaten test scriptlerinin (her biri kendi taze kullanıcısını oluşturur) bu
  limite takılmasını önlüyor, ayrı bir muafiyete gerek kalmadı.

**3) `helmet` kuruldu**, TEK bir ayarla: `crossOriginResourcePolicy: {
policy: 'cross-origin' }`. **YAKALANAN RİSK:** helmet'in VARSAYILANI CORP'u
`same-origin` yapar; bu, kıyafet fotoğraflarının FARKLI bir origin'den (web
`:5173`, Android `10.0.2.2`) `<img>` ile yüklenmesini KIRARDI — gerçek
tarayıcıda test edilip doğrulandı (bkz. aşağı). Fotoğraflar zaten bilinçli
olarak cross-origin ve token'sız servis ediliyor (tahmin edilemez UUID adı,
CLAUDE.md'de belgeli bir ödünleşme) — bu yüzden CORP'u gevşetmek yeni bir
zayıflatma değil, MEVCUT tasarımın doğal sonucu. Geri kalan tüm helmet
varsayılanları (CSP, X-Frame-Options, HSTS vb.) olduğu gibi bırakıldı.

**Doğrulama — gerçek tarayıcıda 6 kontrol (Playwright + sistem Chrome),
geçici test kullanıcısıyla:** tarayıcıdan (origin `http://localhost:5173`)
CORS ile kayıt isteğinin başarılı olması (401/403 DEĞİL); Gardırop sayfasının
açılması; kıyafet + fotoğraf oluşturmanın (multipart CORS isteği) çalışması;
**kıyafet fotoğrafının CROSS-ORIGIN olarak gerçekten decode edilmesi**
(`naturalWidth > 0` — CORP `cross-origin` ayarının doğru çalıştığının kanıtı);
konsol hatası yok; başarısız ağ isteği yok. Ayrıca curl ile: izinli origin'de
`Access-Control-Allow-Origin` başlığının doğru döndüğü, izinsiz origin'de
temiz `403 + JSON`, `RateLimit-*` başlıklarının doğru limit/pencere
değerlerini taşıdığı (`5;w=900` ve `10;w=3600`) ve 6. login denemesinin
gerçekten `429` döndüğü doğrulandı.

**AÇIK KALAN İŞ — Android tarafı gerçek cihazda denenmedi** (aynı önceden
bilinen JDK/Gradle ortam kısıtı, CLAUDE.md'nin "Android emülatöründe test
etme" bölümünde belgeli). CORS'un varsayılan izinli listesi Android'in
kullandığı `http://localhost` origin'ini (capacitor.config.json >
`androidScheme: 'http'`) zaten İÇERİYOR ve bu curl ile doğrulandı
(`Origin: http://localhost` → izinli); gerçek cihaz/emülatör çalıştırması
hâlâ gerekiyor.

## TEMİZLİK

**4) `logImageOutcome()` teşhis logu kaldırıldı** (`api.js`,
`ClothingCard.jsx`, `ClothingDetail.jsx`). Kendi yorumunda "geçicidir, sorun
teyit edildikten sonra kaldırılabilir" diyordu — teyit çoktan yapılmıştı,
temizlendi. `ClothingCard`'daki `onError` handler'ının `setImageFailed(true)`
kısmı (işlevsel) KORUNDU, yalnızca log satırı kaldırıldı; `onLoad` handler'ı
YALNIZCA log yaptığı için tamamen kaldırıldı.

**5) `POST /gemini/test-analyze` kaldırıldı** — Aşama 1'den kalan, ürün
akışında hiç kullanılmayan bir teşhis ucuydu. Bununla birlikte:
- `GeminiController.js` ve `geminiRoutes.js` silindi, `server.js`'teki mount
  satırı kaldırıldı.
- `GeminiService.analyzeClothingImage()` ve onun `ANALYZE_PROMPT` sabiti de
  kaldırıldı — bu metodun TEK çağıranı silinen controller'dı, kalsaydı kendisi
  de ölü kod olurdu.
- `config/upload.js`'teki `uploadImageToMemory` (yalnızca bu ucun kullandığı
  bellek-tabanlı multer varyantı) kaldırıldı — başka hiçbir yerden
  kullanılmıyordu.
- **`test-gemini.js` YENİDEN YAZILDI, silinmedi.** CLAUDE.md'nin Eksikler
  tablosu bu ucun "kaldırılmadığı" gerekçesini `test-gemini.js`'in anahtar/
  bağlantı yollarını onun üzerinden doğrulamasına bağlıyordu. Script artık
  SUNUCUYA HİÇ HTTP İSTEĞİ ATMIYOR — `GeminiService.analyzeClothingItem()`'ı
  (Aşama 2'nin hâlâ kullanılan gerçek metodu) DOĞRUDAN çağırıyor. Bu metod,
  kaldırılan ucun kullandığı `#generate()` özel yardımcısını AYNI ŞEKİLDE
  çağırdığı için doğrulanan davranış (anahtar yok → 503, geçersiz anahtar →
  503, ham SDK hatası sızmıyor) birebir korundu. **Gerçek bir Gemini
  çağrısıyla doğrulandı: 15/15 kontrol geçti**, gerçek kıyafet fotoğrafı
  doğru analiz edildi (`gemini-3.6-flash`, 9.5 sn).

**6) CLAUDE.md'deki 2 eskimiş belge bölümü güncellendi:**
- **"Kullanıcı kimliği" paragrafı** (§8) `getCurrentUserId()`'nin localStorage
  `dg_user_id`'ye "yoksa sabit bir yedek id'ye düşer" dediğini ve "Auth
  geldiğinde ikisi de kaldırılacak" yazıyordu — bu, auth ÖNCESİ döneme ait,
  ARTIK YANLIŞ bir açıklamaydı (kod çoktan `getUserIdFromToken()` üzerinden
  saf JWT tabanlı çalışıyor, hiçbir yedek id yok). Doğru duruma güncellendi;
  "Kalıcı durum" paragrafındaki `dg_user_id` referansı da düzeltildi.
- **"Geliştirici kaçış kapıları" bölümü** `Navbar`'daki `RotateCcw` butonundan
  hâlâ VARMIŞ gibi bahsediyordu — bu buton auth eklenirken ÇOKTAN kaldırılmıştı.
  Bölüm, üç kaçış kapısının da (DEV_FORCE_EMPTY, RotateCcw, logImageOutcome)
  artık KALDIRILMIŞ olduğunu netçe belirtecek şekilde yeniden yazıldı.

**7) `onboarding.js`'deki ölü kod temizlendi.** `getUserId()`, `setUserId()`,
`resetOnboarding()` fonksiyonları ve `USER_ID_STORAGE_KEY` (`dg_user_id`)
sabiti kaldırıldı — hepsi tanımlıydı ve export ediliyordu ama UYGULAMANIN
HİÇBİR YERİNDE (test scriptleri dahil) ÇAĞRILMIYORDU; `getUserId`/`setUserId`
kendi yorumunda "kimlik doğrulama gelene kadarki geçici çözüm" diyordu — auth
geleli çok oldu. `dg_user_id` artık `clearOnboardingState()`'in temizlediği
anahtar listesinden de çıkarıldı (zaten hiçbir yerden yazılmıyordu).

**8) `test-image-upload.js`'in bilinen kırılganlığı düzeltildi VE §7'ye geri
eklendi.** Script `uploads/` klasöründeki dosya sayısını MUTLAK olarak
sayıyordu (`uploadDirBefore === 2` → ".gitkeep + 1 foto" varsayımı, sonda
`leftover.length === 0` → klasörün TAMAMEN boş kalması beklentisi) — gerçek
kullanıcı fotoğrafları klasörde durduğu sürece (şu an 9-20 arası değişen bir
sayıda gerçek dosya var) bu haksız yere başarısız olurdu. **Düzeltme:** script
artık BAŞLANGIÇTAKİ dosya kümesinin bir anlık görüntüsünü (`baselineFiles`)
alıyor ve her kontrol noktasında yalnızca KENDİ EKLEDİĞİ dosya sayısını
(baseline'a göre fark, `newFileCount()`) doğruluyor — mutlak sayı yerine
"kendi oluşturduğunu say" mantığı. `selfies/` alt klasörü bu sayıma hiç
girmiyor (ayrı bir dizin, kıyafet fotoğraflarıyla ilgisi yok). Script
CLAUDE.md §7'nin komut listesinden bir süredir düşürülmüştü (dosyanın kendisi
repoda kalmıştı) — `test-clothing-items.js`'in hemen altına geri eklendi.
**Doğrulama: gerçek (20 dosyalı, dolu) `uploads/` klasörüne karşı 29/29.**

## REGRESYON

Tüm değişikliklerden sonra ilgili testler ayrı ayrı, en sonda TAM regresyon
paketi çalıştırıldı — hepsi yeşil:
`test-all-endpoints` 77/77, `test-auth` 48/48, `test-stats` 60/60,
`test-item-outfits` 27/27, `test-clean-status` 26/26, `test-file-cleanup`
12/12, `test-image-upload` 29/29 (düzeltme sonrası), `test-gemini` 15/15
(yeniden yazım sonrası, gerçek Gemini çağrısıyla), `test-vector --birim`
46/46, `test-outfit-rag --birim` 36/36, `test-ai-analysis --birim` 48/48,
`test-skin-tone --kotasiz` 58/58, frontend `test-outfit-builder.mjs` 73/73,
`npm run lint` + `npm run build` (backend script syntax + frontend) temiz.

**Yeni bağımlılıklar:** `express-rate-limit@8.6.2`, `helmet@8.3.0` (backend).
`npm audit`: 0 yeni zafiyet (mevcut 3 orta seviye uyarı — `@capacitor/cli`'nin
transitive `uuid` bağımlılığı üzerinden, frontend'de, bu çalışmadan ÖNCE de
vardı, build-time/iOS-only bir araç zinciri parçası, ilgisiz).

**Temizlik:** önceki oturumdan kalan 4 test kullanıcısı (`@example.com`) ve
1 öksüz kıyafet fotoğrafı `cleanup.js` ile temizlendi.
### 2026-08-24 — Kombin paylaşım indirmesi: Android'de native paylaşım menüsü
- **Ne değişti:** `downloadBlob` (`lib/shareCard.js`) artık PLATFORM BAZLI
  dallanıyor (`Capacitor.isNativePlatform()`). **Web'de HİÇBİR ŞEY değişmedi**
  — mevcut `<a download>` akışı aynen duruyor. **Android'de** görsel artık
  `@capacitor/filesystem` ile cihazın önbellek klasörüne yazılıp
  `@capacitor/share` ile native paylaşım menüsü (`Intent.ACTION_SEND`)
  açılıyor — kullanıcı "Galeriye Kaydet" (Google Fotoğraflar gibi bir hedef
  üzerinden), "WhatsApp'ta Paylaş" gibi seçenekler arasından seçiyor.
- **GEREKÇE:** Android WebView'de `<a download>` GÜVENİLİR DEĞİLDİR — bazı
  WebView sürümlerinde indirme sessizce hiçbir şey yapmaz, kullanıcı boşuna
  bekler. Native `Intent.ACTION_SEND` her Android sürümünde çalışan, sistemin
  kendi mekanizması. "Eksikler" tablosundaki *"Paylaşım indirmesi mobilde
  denenmedi"* maddesi bu çalışmayla değişti (bkz. aşağıdaki "AÇIK KALAN İŞ").

**Yeni bağımlılıklar:** `@capacitor/filesystem@8.1.3`, `@capacitor/share@8.0.1`
(ikisi de `@capacitor/core@^8.5.0` ile uyumlu, `npm view ... peerDependencies`
ile doğrulandı). `npx cap sync android` ile Android projesine kaydedildiler
(`capacitor.build.gradle` + `capacitor.settings.gradle` güncellendi;
`AndroidManifest.xml` ve `res/xml/` — beklendiği gibi — **hiç değişmedi**,
`cap sync` bu dosyalara dokunmaz).

- **`Directory.Cache` BİLİNÇLİ seçim — YENİ BİR DEPOLAMA İZNİ EKLENMEDİ.**
  `@capacitor/filesystem`'in Android kaynağı (`FilesystemPlugin.kt`) okunarak
  doğrulandı: eklenti yalnızca **paylaşılan** (public) dizinlere
  (`Directory.Documents`, `Directory.ExternalStorage`) yazarken çalışma
  zamanı izni istiyor (`isPublicDirectory(directory)` kontrolü); `Directory.
  Cache` uygulamaya ÖZEL bir alandır ve hiçbir izin tetiklemez — modern
  Android'in scoped storage modelinde bu tür bir dosya için zaten hiç izin
  gerekmiyor. `AndroidManifest.xml`'e bu yüzden `WRITE_EXTERNAL_STORAGE` gibi
  yeni bir `<uses-permission>` **BİLEREK EKLENMEDİ** — eklenseydi gereksiz
  olur ve talimatın "gerekli izinleri ekle" ruhundan çok "izin listesini
  şişir"e kayardı. Bu karar kod yorumunda ve CLAUDE.md'de belgeli.
- **FileProvider için de HİÇBİR manifest değişikliği gerekmedi.**
  `@capacitor/camera` kurulumundan kalma `androidx.core.content.FileProvider`
  girdisi (`AndroidManifest.xml`) ve `file_paths.xml`'deki
  `cache-path name="my_cache_images" path="."` girdisi UYGULAMANIN TÜM
  önbellek dizinini zaten kapsıyor. `@capacitor/share`'in Android kaynağı
  (`SharePlugin.java`) okunarak doğrulandı: paylaşılan dosyayı **aynı**
  FileProvider authority'siyle (`${applicationId}.fileprovider`)
  `content://` URI'ye çeviriyor — yani mevcut kamera altyapısı, hiç
  planlanmamış olsa da, paylaşım özelliğini bedavaya destekliyordu.
- **İki katmanlı, birbirinden bağımsız hata yönetimi** (`shareBlobNative`):
  1. `Filesystem.writeFile` başarısız olursa "Görsel cihaza kaydedilemedi.
     Tekrar deneyebilirsin." (mesaj "izin"/"denied" içeriyorsa ayrı bir
     "Depolama izni verilmedi..." mesajı — teorik olarak Cache dizini izin
     istemez ama bir OEM tuhaflığına karşı savunma amaçlı, `photoPicker.js`
     ile aynı disiplin).
  2. `Share.share()` KULLANICI TARAFINDAN iptal edilirse (Android
     `RESULT_CANCELED` → eklenti bunu "Share canceled" ile reddeder) bu bir
     HATA SAYILMAZ — sessizce dönülür, kullanıcı ekranında hiçbir hata
     mesajı görmez. Yalnızca GERÇEK bir paylaşım hatası "Paylaşım açılamadı.
     Tekrar deneyebilirsin." mesajını tetikler.
  Her iki yol da **asla fırlatılmamış (raw) bir teknik hata** göstermez;
  `ShareButton` zaten `console.error` ile teknik detayı loglar, ekrana yalnızca
  anlaşılır Türkçe mesaj çıkar — uygulama hiçbir hata yolunda çökmez.
- **`@capacitor/filesystem` ve `@capacitor/share` DİNAMİK import edilir**
  (`photoPicker.js`'teki Camera deseniyle birebir aynı desen): web
  derlemesinde bu native modüller HİÇ YÜKLENMEZ, ayrı küçük chunk'lara düşer
  (`npm run build` çıktısında yeni `web-*.js` parçaları bunun kanıtı).
- **`ShareButton`'ın `catch` bloğu artık `caught.message`'ı DOĞRUDAN
  gösteriyor** (öncesinde tek bir sabit mesaj vardı, platformdan bağımsız).
  `downloadBlob`'un fırlattığı her mesaj zaten kullanıcıya gösterilebilir
  Türkçe metin; sabit mesaj yalnızca mesajsız kalan beklenmedik durumlar
  için yedek olarak kaldı. `downloadBlob` bu yüzden artık `async` — `await
  downloadBlob(...)` olarak çağrılıyor (öncesinde senkron bir çağrıydı, hata
  fırlatması `await` edilmeden `catch`'e düşmüyordu — bu regresyon web
  testinde ayrıca doğrulandı: hata olsaydı `catch` bloğu tetiklenmeden
  fonksiyon sessizce yarım kalabilirdi).

**Doğrulama — WEB (gerçek tarayıcıda, Playwright + sistem Chrome), geçici
test kullanıcısı ve gerçek bir kombinle, 9 kontrol:**
- "Paylaş" düğmesinin görünmesi; tıklanınca **hâlâ gerçek bir `<a download>`
  indirmesinin tetiklenmesi** (Playwright `download` olayı yakalandı);
  dosya adının beklenen kalıpta olması; indirilen dosyanın boş olmaması;
  **PNG imzasının doğru olması** (gerçek bir PNG dosyası, bozuk veri değil);
  **görselin hâlâ Story ölçüsünde olması** (1080×1920, byte'lar IHDR
  chunk'ından okunarak doğrulandı — dış bir PNG kütüphanesi kurulmadan);
  düğmenin işlem bitince "Paylaş"a geri dönmesi; **hiçbir hata mesajının
  ÇIKMAMASI** (web akışında native kod hiç tetiklenmediğinin kanıtı);
  temiz konsol.
- **TEST TUZAĞI (yakalandı, ürün hatası DEĞİL):** İlk denemede seçici
  `getByRole('button', { name: 'Paylaş' })` düğmeyi HİÇ bulamadı. Sebep:
  `ShareButton`'da `aria-label="Kombini görsel olarak indir"` VAR ve bu,
  erişilebilir ADI görünür metinden ("Paylaş") tamamen FARKLI hâle getiriyor
  (aria-label her zaman önceliklidir) — bu, koddaki ÖNCEDEN VAR OLAN,
  bilinçli bir erişilebilirlik kararı (buton boşken de anlamlı bir isim
  taşısın diye). Test, role tabanlı seçici yerine metin tabanlı seçiciye
  (`locator('button', { hasText: 'Paylaş' })`) çevrilerek düzeltildi.
- Regresyon: `npm run lint` + `npm run build` temiz (build çıktısında yeni
  `web-*.js` chunk'ları filesystem/share'in web derlemesine hiç girmediğini
  gösteriyor).

**AÇIK KALAN İŞ — Android tarafı gerçek cihaz/emülatörde HENÜZ ÇALIŞTIRILMADI.**
Bu ortamda (`./gradlew`) yerel bir Gradle derlemesi denenip **JDK/Gradle sürüm
uyuşmazlığı** yüzünden engellendi: proje Gradle 8.14.3'e sabit, makinedeki
JDK'ların hiçbiri (sistem `java` = JDK 26, Android Studio'nun JBR'si = JDK 25)
bu Gradle sürümüyle Groovy ayarlar dosyasını derleyemiyor
(`Unsupported class file major version 69/70`) — bu, KODDAN BAĞIMSIZ bir
ortam sorunu (makinede JDK 17/21 kurulu değil), CLAUDE.md'nin "Android
emülatöründe test etme" bölümüne troubleshooting notu olarak işlendi.
Bunun yerine yapılan doğrulama:
1. **Kaynak kod seviyesinde** — `@capacitor/filesystem` ve `@capacitor/share`
   paketlerinin GERÇEK Android kaynak dosyaları (`FilesystemPlugin.kt`,
   `SharePlugin.java`) okunarak `Directory.Cache`'in izin istemediği ve
   mevcut `FileProvider` yapılandırmasının paylaşılan dosyayı doğru
   kapsadığı doğrulandı (varsayımla değil, gerçek kaynakla).
2. **`npx cap sync android`'in temiz çalışması** — üç native eklenti de
   (camera, filesystem, share) doğru şekilde kaydedildi, `AndroidManifest.xml`
   beklendiği gibi değişmedi.
3. **Web regresyonu** — yukarıdaki 9 kontrol.
Gerçek bir Android Studio/emülatör çalıştırması (izin akışı, paylaşım
menüsünün gerçekten açılması, "Galeriye Kaydet" hedefinin gerçekten
çalışması) hâlâ **kullanıcı tarafında** yapılmalı.
### 2026-08-24 — Selfie'ler AYRI klasörde ve token'lı bir uçtan servis ediliyor
- **Ne değişti:** Selfie'ler artık kıyafet fotoğraflarından FİZİKSEL VE
  ERİŞİM olarak ayrıldı. Dosyalar `backend/uploads/selfies/` altına yazılıyor
  (kıyafet fotoğrafları hâlâ `uploads/` kökünde) ve bu alt yol `/uploads`
  static middleware'inden TAMAMEN hariç tutuluyor — tek okuma yolu **yeni**
  `GET /api/users/skin-tone-analysis/photo` ucu, kimlik her zamanki gibi
  `req.userId`'den okunuyor (`:id` parametresi YOK). Kıyafet fotoğrafları
  **hiç etkilenmedi**: eskisi gibi `/uploads/<uuid>.png` üzerinden token'sız
  servis edilmeye devam ediyor — bu, CLAUDE.md'de zaten belgeli bilinçli bir
  ödünleşme ve bilerek değiştirilmedi.
- **GEREKÇE:** dosya adı tahmin edilemez UUID olsa da, bir selfie bir tişört
  fotoğrafından daha hassas bir veri türü. Adres bir kez sızarsa (ekran
  görüntüsü, tarayıcı geçmişi, paylaşılan bir proxy log'u) `/uploads` hiçbir
  kimlik doğrulaması yapmadan dosyayı verirdi. "Eksikler" tablosundaki
  *"Selfie'ler `/uploads`'tan token'sız servis ediliyor"* maddesi bu çalışmayla
  kapandı.

**BACKEND — iki katmanlı koruma (biri tek başına yetmez):**

1. **Fiziksel ayrım.** `config/upload.js`'e `SELFIE_UPLOAD_DIR`
   (`uploads/selfies/`) ve buna yazan ayrı bir multer diskStorage
   (`uploadSelfieImage`) eklendi — `uploadImage` ile AYNI `fileFilter`/boyut
   sınırını paylaşır, tek farkı hedef klasördür. `skinToneRoutes` artık
   `uploadImage` yerine bunu kullanıyor; kıyafet route'ları hiç dokunulmadı.
2. **Erişim engeli (ASIL güvence).** Fiziksel konum TEK BAŞINA yeterli
   değildir — bir klasör adı tahmin edilebilir. `server.js`, genel `/uploads`
   static middleware'inden **ÖNCE** `/uploads/selfies` yolunu 404'e düşüren
   bir blok mount ediyor. Bu satır olmasaydı `uploads/selfies/` yine de
   `express.static(UPLOAD_DIR)`'in kapsama alanında kalırdı (SELFIE_UPLOAD_DIR
   fiziksel olarak UPLOAD_DIR'in bir alt klasörü) ve hiçbir şey değişmemiş
   olurdu — asıl koruma budur, klasör ayrımı yalnızca onu kolaylaştırır.

- **Yeni uç `GET /users/skin-tone-analysis/photo`.** `SkinToneController.
  getPhoto`, `SkinToneService.getPhotoPath(req.userId)`'den mutlak dosya
  yolunu alıp `res.sendFile` ile DOĞRUDAN okuyup gönderir — `express.static`
  KULLANILMAZ. Yolda `:id` yok (diğer ten tonu uçlarıyla aynı kural):
  kimlik her zaman `req.userId`'den geldiği için "başka bir kullanıcının
  selfie'sini id ile iste" senaryosunun sorguya girecek bir parametresi hiç
  yok — ayrı bir sahiplik kontrolü yazmaya bile gerek kalmadı. `Cache-Control:
  private, max-age=0, no-store` döner (paylaşılan önbellekte iz bırakmasın).
  Analiz/selfie yoksa `404` (bu, `GET /users/skin-tone-analysis`'in "analiz
  yoksa 200+null" sözleşmesinden bilerek farklı — orada JSON gövdesi var ve
  `null` doğal, burada ikili bir dosya isteniyor ve dönecek bir "boş dosya"
  kavramı yok).
- **`removeSelfieFile` / `resolveSelfiePath` eklendi, `removeUploadedFile`
  DOKUNULMADI.** Selfie ve kıyafet dosyaları artık farklı klasörlerde
  yaşadığı için tek bir "dosya sil" fonksiyonu ikisine de uymuyor. Tek bir
  fonksiyona dizin parametresi eklemek yerine bilerek AYRI iki fonksiyon
  tutuldu: çağıran kodun hangi dosya türünü sildiği isim düzeyinde görünsün,
  bir kıyafet silme çağrısının yanlışlıkla selfie dizinine (ya da tam tersi)
  bakması ihtimali sıfırlansın. `SkinToneService` artık yalnızca
  `removeSelfieFile` kullanıyor.
- **`UserRepository.collectUploadedFileNames` ARTIK İKİ AYRI liste
  döndürüyor** (`{ clothingImageUrls, selfiePhotoUrl }`, tek düz dizi değil).
  `UserService.deleteUser` bu ayrıma göre her dosya türü için doğru silme
  fonksiyonunu (`removeUploadedFile` / `removeSelfieFile`) çağırıyor —
  önceki tek-liste hâliyle kullanıcı silindiğinde selfie artık YANLIŞ
  klasörden silinmeye çalışılıp sessizce (ENOENT) atlanacaktı, yani öksüz
  kalacaktı. Bu regresyon `test-file-cleanup.js`'te yakalandı ve doğrulandı.
- **`cleanup.js`'in öksüz dosya taraması İKİ AYRI dizini geziyor** (ortak
  mantık yeni `taraVeSil` yardımcısında): `UPLOAD_DIR` kökü (referans =
  `clothing_items.image_url`, `selfies` klasör adı taramadan HARİÇ TUTULUR
  — aksi hâlde bir alt klasörü sıradan bir dosya sanıp `unlink` ile silmeye
  çalışıp `EISDIR` ile başarısız olurdu) ve `SELFIE_UPLOAD_DIR` (referans =
  `users.skin_tone_photo_url`).
- **Yeni migrasyon scripti `test-scripts/migrate-selfie-photos.js`.**
  Özellikten ÖNCE analiz yapmış kullanıcıların selfie'si hâlâ `uploads/`
  kökünde durabilir; script `users.skin_tone_photo_url IS NOT NULL` olan
  kayıtları tarar, dosyayı `uploads/selfies/`'e taşır ve veritabanı yolunu
  günceller. **VARSAYILAN SALT OKUNURDUR** (`create-embeddings.js` /
  `analyze-existing-items.js` kalıbı), `--uygula` ile gerçekten uygular.
  **İDEMPOTENTTİR:** yolu zaten `/uploads/selfies/` ile başlayan kayıtlar
  atlanır, script güvenle birden fazla kez çalıştırılabilir. Dosya ÖNCE
  taşınır, veritabanı ANCAK ondan SONRA güncellenir (`SkinToneService`'teki
  "önce yaz, sonra sil" disipliniyle aynı gerekçe: sıra tersine olsaydı ve
  taşıma yarıda patlarsa kayıt artık var olmayan bir yolu gösterirdi).
  Elde gerçek bir eski-düzen selfie kaydı olmadığı için doğrulama, testte
  BİLEREK simüle edilen bir "eski konum" kaydıyla yapıldı (bkz. aşağı).

**FRONTEND**

- **`SkinToneSection`, selfie'yi artık `resolveImageUrl` İLE DEĞİL, yeni
  `fetchSkinTonePhoto()` + blob ile gösteriyor.** Backend'in döndürdüğü
  `foto_url` artık doğrudan bir `<img src>` DEĞİL — yalnızca "bir selfie var
  mı" bilgisini taşıyor ve bir `useEffect`'i tetikliyor; o effect token'lı
  `/photo` ucunu çağırıp blob'u `URL.createObjectURL` ile object URL'e
  çeviriyor. **Mevcut `PhotoPicker` deseni AYNEN tekrar kullanıldı**
  (`useEffect` + `createObjectURL` + cleanup'ta `revokeObjectURL`): `fotoUrl`
  değiştiğinde (yeni analiz, silme) eski object URL serbest bırakılıyor.
  `<img>` etiketi `Authorization` başlığı gönderemediği için bu dolaylama
  zorunlu; doğrudan `/uploads/selfies/...` yazılsaydı zaten backend'deki blok
  bunu 404'e düşürürdü.
- Yeni `api.js` fonksiyonu: `fetchSkinTonePhoto()` — token'lı `fetch` ile
  `/users/skin-tone-analysis/photo`'yu çağırır, `404`'ü hata SAYMAZ (`null`
  döner — "henüz selfie yok" durumu), diğer hatalarda (401 dahil, oturumu
  düşürerek) mesajlı bir `Error` fırlatır, başarıda `response.blob()` döner.

**Doğrulama — `test-scripts/test-skin-tone.js` 43 → 58 kontrol:**
- Mevcut birim bölümündeki tüm fixture'lar (`geciciSelfie`, "eski selfie"
  senaryoları) `SELFIE_UPLOAD_DIR`'e ve `/uploads/selfies/...` yoluna
  taşındı — gerçek multer akışını (artık `uploadSelfieImage`) doğru
  yansıtsınlar diye.
- **Yeni bölüm — `/photo` ucu (11 kontrol):** analiz yokken 404; kendi
  selfie'sinin 200 + doğru `Content-Type: image/*` + **bayt seviyesinde
  diskteki dosyayla birebir aynı içerik** ile dönmesi; `Cache-Control:
  private, no-store`; **başka bir kullanıcının token'ıyla 404** (kendi
  selfie'si olmadığı için — sızıntı imkânsız, çünkü sorguya girecek bir id
  parametresi hiç yok); token'sız 401; **KRİTİK GÜVENLİK: aynı dosyanın
  `/uploads/selfies/...` üzerinden token OLSA DA OLMASA DA 404 dönmesi**
  (static tamamen kapalı); kıyafet fotoğraflarının hâlâ token'sız
  `/uploads/...` üzerinden çalıştığının regresyon kontrolü.
- **Yeni bölüm — migrasyon scripti (7 kontrol):** eski konumda (uploads/
  kökü) simüle edilen bir selfie'nin `--uygula` sonrası doğru şekilde
  taşınması (dosya + veritabanı yolu), taşıma sonrası `/photo` ucunun
  dosyayı YENİ konumdan bulması, script **ikinci kez** çalıştırıldığında
  hata vermemesi (idempotentlik) ve kullanıcı silindiğinde taşınmış
  selfie'nin de (artık doğru klasörden) diskten kalkması.
- **Doğrulama — `test-scripts/test-file-cleanup.js` 9 → 12 kontrol:**
  selfie simülasyonu artık `SELFIE_UPLOAD_DIR`'e yazılıyor; öksüz-selfie
  süpürme testi ayrıca eklendi (ayrı klasör, ayrı tarama); `selfies` alt
  klasörünün kıyafet taramasında yanlışlıkla silinmeye çalışılmadığı kontrolü.
- **Doğrulama — gerçek tarayıcıda 7 kontrol (Playwright + sistem Chrome),
  geçici test kullanıcısı ve Gemini tetiklenmeden SQL ile bağlanan gerçek bir
  selfie'yle:** `<img>` görünüyor; **`src` bir `blob:` URL** (`/uploads`
  değil); tarayıcının `/uploads/selfies/...`'e DOĞRUDAN bir `<img>` isteği
  ATMADIĞI, bunun yerine token'lı `/photo` ucunu çağırdığı (ağ isteklerinden
  doğrulandı); temiz konsol; **silme sonrası selfie `<img>`'in kaybolması**
  ve davet ekranının geri gelmesi.
- Regresyon: `test-all-endpoints` 77/77, `test-auth` 48/48, `test-stats`
  60/60, `test-item-outfits` 27/27, `test-clean-status` 26/26, `test-vector
  --birim` 46/46, `test-outfit-rag --birim` 36/36, `test-ai-analysis --birim`
  48/48, lint + build temiz.

### 2026-08-24 — Kıyafet Düzenleme (Edit) Özelliği
- **Ne eklendi:** Kullanıcı, mevcut bir kıyafetin isim/kategori/renk/sezon/
  temiz-kirli durumunu düzenleyebiliyor. Kıyafet Detay'da "Düzenle" düğmesi
  (mevcut "Sil" düğmesiyle aynı bölgede, aynı ince metin-link stili);
  tıklanınca mevcut değerlerle dolu bir modal açılıyor, kaydedince Kıyafet
  Detay, Gardırop ve Kombin Öner ANINDA güncel veriyi gösteriyor.
- **Backend ZATEN HAZIRDI** — `PUT /api/clothing-items/:id` (`ClothingItemService.
  updateItem`, sahiplik kontrolüyle 404) Aşama 6'dan beri vardı, arayüzde
  hiç bağlantısı yoktu. Bu çalışma yeni bir uç EKLEMEDİ, mevcut ucu bağladı —
  ama bunu yaparken kritik bir hata bulup düzeltti (aşağıya bakın).
- **YAKALANAN HATA (gerçek veri kaybına yol açtı) — `PUT` fotoğrafı SİLİYORDU.**
  `ClothingItemRepository.update`'in SQL'i `image_url = $6` ile TAM DEĞİŞTİRME
  yapıyor; `data.imageUrl` payload'da yoksa `undefined` oluyor ve Postgres bunu
  `NULL` olarak yazıyordu. Düzenleme formu (task'ın kendisi bilerek istediği
  gibi) fotoğrafı HİÇ göndermiyor — yani ucu ilk kez gerçek bir düzenleme
  isteğiyle denediğimde **gerçek bir kıyafetin fotoğrafı anında NULL'a düştü**.
  Dosya diskte durduğu için veri kaybı olmadı (elle geri yüklendi), ama bu tam
  olarak talimatın "Fotoğraf değişikliği bu akışın parçası OLMASIN" diye
  bilerek uyardığı senaryoydu. **Düzeltme:** `ClothingItemService.updateItem`
  artık `imageUrl`'i payload'dan HİÇ okumuyor, `existingItem.image_url`'i
  KOŞULSUZ olarak geri yazıyor — `isClean`'in "gönderilmezse koru" deseninden
  bir adım daha katı: `isClean` isteğe bağlı korunur, `imageUrl` bu uçtan
  **hiçbir şekilde** değiştirilemez (fotoğraf yönetimi tamamen ayrı uçların işi).
- **`ai_analysis` KASITLI OLARAK dokunulmuyor.** İsim/kategori değişince analiz
  eski bilgiyle tutarsız kalabilir (örn. "Beyaz Gömlek" olarak analiz edilmiş
  bir parça "Siyah Pantolon" olarak yeniden adlandırılırsa analiz hâlâ eski
  görseli anlatır) ama bu OTOMATİK silinmiyor/güncellenmiyor — kullanıcı
  isterse zaten "Yeniden Analiz Et" düğmesini kullanabilir. Bilinçli bir
  tutarsızlık penceresi, talimatın istediği gibi.
- **Frontend: yeni bileşen yazılmadı, `QuickAddModal` İKİ MODLU hâle getirildi.**
  Opsiyonel `item` prop'u verilirse düzenleme modu: başlık "Parçayı Düzenle",
  buton "Güncelle", alanlar mevcut değerlerle dolu, **`PhotoPicker` hiç render
  edilmez** (fotoğraf bu akışın dışında) ve kaydetme `updateClothingItem` (PUT)
  çağırır. `item` verilmezse eskisi gibi "Yeni Parça" oluşturma modu.
  `onCreated` prop'u `onSaved` olarak yeniden adlandırıldı (her iki modda da
  "kayıt başarılı" anlamına geliyor).
- **YAKALANAN HATA (arayüz, veri kaybı değil ama gerçek) — kirli bir parça
  düzenlenirken bir kare boyunca "Temiz" YANLIŞLIKLA basılı görünüyordu.**
  Form seyahat (seeding) mantığı `useEffect` ile yazılmıştı; `isClean`'in
  başlangıç değeri `useState(true)` ve `useEffect` DOM boyandıktan SONRA
  çalıştığı için modal İLK karede yanlış durumu gösterip HEMEN ARDINDAN
  düzeltiyordu — kısa ama gerçek bir "flash of wrong content". **Düzeltme:**
  seeding `useLayoutEffect`'e taşındı (DOM güncellemesinden hemen sonra,
  tarayıcı boyamadan ÖNCE çalışır); kullanıcı yanlış durumu hiç görmüyor.
  Bu, üç ayrı repro script'i ve piksel-seviyeli `getComputedStyle` ölçümüyle
  doğrulandı (aria-pressed ile arka plan rengi birbirini doğruluyor).
- **Doğrulama — `test-scripts/test-all-endpoints.js` 72 → 77 kontrol:**
  `season` alanının da güncellendiği; `PUT` name/categoryId eksikken `400`;
  **`PUT`'ta `imageUrl` gönderilmezse fotoğrafın SİLİNMEMESİ** (asıl regresyon
  kontrolü — doğrudan SQL ile sahte bir yol yazılıp `PUT` sonrası korunduğu
  doğrulanıyor, gerçek bir Gemini çağrısı gerektirmeden); **başka bir
  kullanıcının bu parçayı düzenleyememesi (404)**, geçici bir ikinci hesapla.
- **Doğrulama — gerçek tarayıcıda 27 + 4 kontrol (Playwright + sistem Chrome),
  geçici test kullanıcısı ve GERÇEK bir kopyalanmış fotoğrafla (Gemini
  tetiklenmeden):** "Düzenle" düğmesinin "Sil" ile aynı bölgede olması; modal
  ön-doldurması (isim/kategori); **fotoğraf seçicinin düzenleme modunda HİÇ
  render edilmemesi**; boş isimle kaydetmenin engellenmesi (modal açık kalıyor);
  gerçek bir düzenlemenin isim/kategori/renk/sezon/temiz-kirli'yi hem ekranda
  hem veritabanında güncellemesi; **fotoğrafın KORUNMASI**; Gardırop
  listesinin YENİ ismi göstermesi (eskisi hiç çıkmıyor); başkasının `PUT`
  isteğinin `404` ile reddedilmesi; 390px'te modalın taşmaması; **yeniden
  açılan modalın Kirli durumunu ve kategoriyi doğru göstermesi** (piksel
  ölçümüyle: `Kirli` arka planı tam `rgb(122,59,59)`, `Temiz` tam saydam).
  Ayrı bir koşuda: düzenlemeden ÖNCE Kombin Öner'in eski ismi kullanabildiği,
  düzenlemeden SONRA aynı sekmede yeni açılan önerilerin **anında** yeni ismi
  kullandığı ve eski ismin bir daha hiç çıkmadığı doğrulandı.
- Regresyon: `test-all-endpoints` 77/77, `test-auth` 48/48, `test-stats` 60/60,
  `test-item-outfits` 27/27, `test-clean-status` 26/26, `test-file-cleanup` 9/9,
  `test-skin-tone --kotasiz` 40/40, `test-vector` 82/82, `test-outfit-rag` 69/69,
  `test-ai-analysis --kotasiz` 67/67, `test-outfit-builder` 73/73, lint + build
  temiz.
- **Temizlik:** düzenleme testi sırasında yanlışlıkla NULL'a düşürülen gerçek
  bir kıyafetin fotoğrafı elle geri yüklendi (dosya diskte durduğu için veri
  kaybı olmadı); ayrıca demo hesapta önceki bir oturumdan kalma sentetik bir
  ten tonu analizi/selfie fark edilip uygulamanın kendi silme ucundan temizlendi.

### 2026-08-24 — Bilinen Eksikliklerin Temizlenmesi
- **Kapsam:** CLAUDE.md'nin "Eksikler" tablosundan, küçük ve izole olan dört
  madde tarandı, düzeltildi ve tablodan çıkarıldı. Her biri ayrı ayrı test
  edildi; büyük mimari değişiklik gerektiren maddelere (selfie'nin token'sız
  servis edilmesi gibi) BİLEREK dokunulmadı, yalnızca raporlandı.

**1) "Şimdi Analiz Et" — analizi hiç oluşmamış parçada manuel tetikleyici**
- **Sorun:** "Yeniden Analiz Et" düğmesi `AiAnalysisPanel`'in içindeydi ve panel
  yalnızca DOLU bir analiz varken render oluyordu; `ai_analysis` hiç oluşmamış
  ya da kalıcı olarak başarısız kalmış bir parçada arayüzde HİÇBİR tetikleyici
  yoktu — tek çözüm `analyze-existing-items.js`'i elle çalıştırmaktı.
- **Çözüm:** `ClothingDetail.jsx`'e, panelin DIŞINDA yeni bir davet kutusu
  eklendi (`data-testid="ai-analiz-daveti"`). AYNI `handleReanalyze`'ı çağırıyor;
  backend zaten `force: true` gönderiyor ve `ai_analysis` NULL olduğu için
  maliyet koruması baştan devre dışı — force ile forcesuz burada aynı sonucu
  veriyor, **backend'de hiçbir değişiklik gerekmedi**.
- **Görünürlük koşulları bilinçli:** yalnızca `item.imageUrl` VARSA (analiz
  edilecek görsel olmalı) ve otomatik arka plan yoklaması BİTMİŞSE
  (`!isAnalysisPending`) gösterilir. Pencere sürerken göstermek kafa
  karıştırırdı — backend'in in-flight muhafızı zaten 409 döndürür ama kullanıcı
  "neden iki tane oldu" diye sorardı.
- **Doğrulama — gerçek tarayıcıda 18 kontrol** (geçici test kullanıcısıyla):
  arka plan yoklaması sürerken davet YOK; yoklama penceresi (70 sn) kapanınca
  davet çıkıyor; Gemini erişilemezken davet ekranında kalıp panele GEÇMİYOR,
  eski hâliyle tekrar denenebiliyor; **gerçek Gemini ile ilk analiz** sonrası
  davet kayboluyor ve panel + "Yeniden Analiz Et" düğmesi beliriyor; fotoğrafsız
  parçada davet hiç görünmüyor.
- **TEST TUZAĞI — SQL ile `ai_analysis`'i NULL'a çekmek gerçek arka plan
  analiziyle YARIŞTI.** İlk denemede fotoğraf yükleme ucu (`POST .../image`)
  HER ZAMAN arka plan analizini tetikliyor; SQL null-out'un hemen ardından o
  analiz bitip kolonu geri doldurdu, test kararsız oldu. Ürün hatası değildi —
  düzeltme: fotoğraf, upload ucu yerine dosyayı elle kopyalayıp `image_url`'i
  DOĞRUDAN SQL ile yazarak eklendi; bu yol analiz tetikleyicisini hiç
  çağırmadığı için "analizi hiç yapılmamış parça" durumu YARIŞSIZ kuruldu.

**2) Öksüz dosya temizliği — kullanıcı silme + `cleanup.js`**
- **Sorun:** `DELETE /api/users/:id` `ON DELETE CASCADE` ile Postgres
  satırlarını temizliyordu ama `uploads/` altındaki kıyafet fotoğrafları ve
  selfie'ler diskte kalıyordu — kullanıcı silindikten SONRA `image_url`'lere
  bir daha erişilemediği için bu dosyalar sonsuza dek öksüz kalıyordu.
- **Çözüm — iki ayrı kaynak, iki ayrı düzeltme:**
  1. `UserRepository.collectUploadedFileNames(userId)` eklendi: kıyafet
     fotoğrafları + `skin_tone_photo_url`'i CASCADE'DEN ÖNCE toplar.
     `UserService.deleteUser` artık: topla → sil (CASCADE tetiklenir) → her
     yol için `removeUploadedFile` (best-effort, sessiz). Sıra bilinçli:
     kullanıcı zaten silindiği için tek bir dosyanın silinememesi asıl işlemi
     ne geri alır ne engeller.
  2. `cleanup.js`'e Chroma'nın `temizleOksuzVektorler()`'iyle BİREBİR AYNI
     desende bir `temizleOksuzDosyalar()` eklendi: bu, `cleanup.js`'in KENDİ
     doğrudan `DELETE FROM ...` çağrılarının (test parçaları + test
     kullanıcıları) UserService akışından geçmediği için bıraktığı öksüzleri
     süpürür. Referans kümesi `clothing_items.image_url` +
     `users.skin_tone_photo_url` birleşimi; `is_deleted` FARK ETMEZ (hem
     soft-delete hem canlı satırların referansları korunur), yalnızca diskte
     olup HİÇBİR satırdan işaret edilmeyen dosyalar silinir.
- **Gerçek veriyle doğrulandı:** kullanıcı silme akışı gerçek bir kıyafet
  fotoğrafını ve simüle edilmiş bir selfie'yi diskten kaldırdığı, `cleanup.js`
  çalıştırıldığında 6 önceden birikmiş test artığı dosyanın süpürüldüğü ve
  **canlı gardırop fotoğraflarının hiçbirine dokunulmadığı** doğrulandı
  (referans testi: rastgele seçilen canlı bir dosyanın sweep sonrası hâlâ
  diskte olduğu kontrol edildi).
- **Doğrulama — yeni `test-scripts/test-file-cleanup.js`, 9 kontrol:**
  kullanıcı silme akışı (kıyafet fotoğrafı gerçek upload ucundan yükleniyor,
  selfie SQL ile simüle ediliyor — Gemini kotası harcanmıyor), ikisinin de
  silme sonrası diskten kalktığı, kullanıcının veritabanından da gittiği;
  `cleanup.js` (gerçek `execFileSync` ile child process olarak çalıştırılıyor)
  öksüz dosyayı süpürüyor VE referanslı dosyaya dokunmuyor.

**3) Gardırop favori filtresi + Kombinlerim "Bugün Giydim" sayacı**
- Eksikler tablosunda ayrıca iki küçük UI/bağlantı eksikliği bulundu:
  "Gardırop'ta favori filtresi yok" (kullanıcının açıkça adlandırdığı madde)
  ve "Kombin 'giyildi' sayacı" (endpoint hazır, arayüzde tetikleyici yok —
  madde 1'le AYNI kalıp). İkisi de düzeltildi.
- **Favori filtresi:** `Wardrobe.jsx`'e kategori pilleriyle AYNI görsel dilde
  ama ayrı bir bileşen eklendi — kategoriler karşılıklı dışlayan bir küme,
  favori ise tek başına açık/kapalı bir anahtar (`favoriteOnly`). `?kategori=`
  ile BİREBİR AYNI desen: yalnızca İLK yüklemede `?favori=1`'den okunur, sonrası
  URL'e geri yazılmaz. Ana Sayfa'daki "Favori" `StatCard`'ı artık
  `/gardirop?favori=1`'e gidiyor (kodda zaten "filtre eklenirse buraya
  bağlanmalı" diye yorumla işaretlenmişti). Kategori + favori + arama filtreleri
  BİRLİKTE çalışıyor (zincirleme, birbirini geçersiz kılmıyor).
- **"Bugün Giydim":** `PATCH /outfits/:id/worn` zaten hazırdı (Aşama 6'dan
  kalma), yalnızca arayüzde tetikleyicisi yoktu. `OutfitHistory.jsx`'teki
  favori toggle'ıyla BİREBİR AYNI iyimser güncelleme deseni: sayaç anında +1
  olur, sunucudan gelen gerçek `times_worn` ile değiştirilir, hata olursa geri
  alınır. Artış **idempotent DEĞİLDİR** — her tıklama ayrı bir "giyme" kaydı
  sayılır (backend zaten atomik `times_worn = times_worn + 1` yapıyor,
  yarış durumu oluşturmuyor).
- **Backend'de hiçbir değişiklik gerekmedi** — ikisi de mevcut uçların üstüne
  yalnızca frontend bağlantısıydı.
- **Doğrulama — gerçek tarayıcıda 8 + 6 kontrol:** favori kartının doğru
  yolu taşıması, tıklanınca filtrenin ÖNCEDEN AKTİF açılması, gösterilen kart
  sayısının gerçek favori sayısıyla eşleşmesi, kartların hepsinin gerçekten
  dolu kalp taşıması, filtre kapanınca tüm gardırobun görünmesi, kategoriyle
  birlikte çalışması; "Bugün Giydim" düğmesinin görünmesi, tıklanınca
  veritabanında `times_worn`'un GERÇEKTEN +1 olması, ekrandaki "X kez giyildi"
  metninin güncellenmesi, ikinci tıklamada tekrar artması (idempotent
  olmadığının kanıtı). Test sonunda gerçek kombinin sayacı test öncesi
  değerine geri alındı.

**Rapor edilen, DOKUNULMAYAN maddeler** (kullanıcı talebiyle mimari kapsam dışı
bırakıldı, karar kullanıcıya bırakıldı):
- **Kıyafet düzenleme yok** — `PUT /api/clothing-items/:id` ucu hazır ama
  arayüzde düzenleme akışı yok. "Quick fix" kapsamına GİRMEDİ: tam bir form/akış
  gerektiriyor (QuickAddModal'ı "düzenleme modu"na taşımak gibi), tek satırlık
  bir bağlantı değil.
- **Selfie'ler `/uploads`'tan token'sız servis ediliyor** — güvenlik mimarisi
  kararı, kullanıcı açıkça dokunulmamasını istedi.
- **Paylaşım indirmesi mobilde denenmedi** — fiziksel cihaz gerektiriyor,
  koddan doğrulanamaz.
- **Şifre sıfırlama / e-posta doğrulama / token yenileme** — yeni özellik
  gerektiren maddeler, "küçük UI/bağlantı eksikliği" tanımına girmiyor.
- **Fotoğraflar yerel diskte / boyutlandırma yok** — depolama mimarisi kararı.
- **Bildirimler / Yardım & Destek "Yakında" sayfaları** — kasıtlı yer tutucular,
  bug değil.
- **Gemini kota, embedding/durum sınırlamaları, Chroma-Postgres bütünlüğü**
  — bilinçli mimari ödünleşmeler ya da veri/algoritma sınırlamaları, UI
  bağlantısı eksikliği değil.

Regresyon: `test-all-endpoints` 72/72, `test-auth` 48/48, `test-stats` 60/60,
`test-item-outfits` 27/27, `test-clean-status` 26/26, `test-skin-tone --kotasiz`
40/40, `test-vector` 82/82, `test-outfit-rag` 69/69, `test-ai-analysis --kotasiz`
67/67, `test-outfit-builder` 73/73, lint + build temiz. Temizlik sonrası
gardırop 17 parça / 9 dosya (öksüz yok), test kullanıcısı kalmadı.

### 2026-08-23 — Gemini Entegrasyonu — Ten Tonu Analizi
- **Ne eklendi:** Kullanıcı Profil > "Ten Tonu Analizim" bölümünden bir selfie
  yükler; Gemini ten tonunu (Sıcak/Soğuk/Nötr), yakışan 6-8 rengi, kaçınılacak
  renkleri, metal tonunu ve kısa bir tavsiyeyi döndürür. Sonuç renk daireleriyle
  gösterilir; yeniden analiz ve silme mümkün.
- **Migration `006_add_skin_tone.sql`:** `users.skin_tone_analysis` (JSONB) ve
  `users.skin_tone_photo_url` (VARCHAR(500)). İkisi de **nullable ve
  varsayılansız** — özellik TAMAMEN İSTEĞE BAĞLI, NULL "henüz yapmadı" demektir
  ve hiçbir akışı bloklamaz.
- **Yeni uçlar** (`GET` / `POST` / `DELETE` `/api/users/skin-tone-analysis`),
  yeni katman zinciri `SkinTone*` (repository metodları → service → controller
  → routes). SENKRON: kullanıcı ekranda bekliyor.
- **YOLDA `:id` YOK — kimlik daima `req.userId`'den.** Bilinçli: selfie hassas
  veri ve "başkasının analizine bakma" ihtimalini yol seviyesinde tamamen
  ortadan kaldırmak, her istekte sahiplik karşılaştırmasından güvenli.
- **ROUTE SIRASI TUZAĞI:** `skinToneRoutes`, `userRoutes`'TAN ÖNCE mount
  edilmelidir. Sonra gelseydi `GET /users/:id` "skin-tone-analysis" metnini bir
  id sanıp o handler'a düşürürdü. `server.js`'te yorumlandı, test doğruluyor.
- **SÖZLEŞME: SkinToneService FIRLATIR** — `ClothingAnalysisService`'in tam
  tersi, ölçüt yine aynı: orada analiz kıyafet akışının üstüne konan bir
  zenginleştirmeydi ve kimse beklemiyordu; burada kullanıcı selfie'sini yükleyip
  sonucu bekliyor.
- **YÜZ TESPİT EDİLEMEZSE HATA DEĞİL, YÖNLENDİRME.** Prompt'ta
  `yuz_tespit_edildi` alanı ŞEMANIN PARÇASI: fotoğraf bulanıksa ya da yüz yoksa
  modelin UYDURMASINI değil bunu SÖYLEMESİNİ istiyoruz ("tahmin yürütme").
  Servis bunu görünce hiçbir şey kaydetmeden `400` + *"Yüz görünmüyor.
  Yüzünüzün net göründüğü, iyi aydınlatılmış bir fotoğrafla tekrar deneyin."*
  döner. Gerçek Gemini ile doğrulandı: yüz içermeyen bir kıyafet fotoğrafı
  (gövde/kol teni görünüyor ama yüz yok) tam olarak bu yola düştü.
- **DOSYA YAŞAM DÖNGÜSÜ hata yollarında da doğru.** Gemini patlarsa, yüz
  bulunamazsa, veritabanı yazması düşerse YENİ dosya geri alınır (öksüz selfie
  kalmaz); ESKİ selfie yalnızca yeni analiz başarıyla YAZILDIKTAN SONRA silinir
  — sıra tersine olsaydı yazma patladığında kullanıcı ikisini birden kaybederdi.
- **Çift tıklama ikinci Gemini çağrısı yapmaz:** kullanıcı başına in-flight
  muhafızı (`409`), ve o isteğin dosyası da geri alınır. İşaret İLK await'ten
  ÖNCE konuyor (Aşama 2'de yaşanan hatanın aynısını tekrarlamamak için).
- **YAKALANAN HATA — uyumlu renkler 4'e kırpılıyordu.** İlk gerçek çağrıda
  prompt 6-8 renk isterken yanıt 4 renkle döndü: `listeyiNormalize` kıyafet
  şemasının `MAX_LIST_ITEMS = 4` sınırını paylaşıyordu ve model doğru sayıda
  renk döndürse bile SESSİZCE kırpıyordu. Fonksiyona `maxItems` parametresi
  eklendi; ten tonu 8'e kadar renk taşıyor, kıyafet şemasının 4'lük sınırı
  (kartlar kısa etiket listesi gösteriyor) aynen korundu.
- **YAKALANAN HATA — ilk gerçek çağrı 30 sn'de zaman aşımına düştü.** Ölçülen
  dalgalanma modelin bilinen davranışı (Aşama 2'de de yaşanmıştı) ve serviste
  yeniden deneme yoktu. `ClothingAnalysisService` ile aynı disiplinde sınırlı
  yeniden deneme eklendi (`MAX_ATTEMPTS = 2`, yalnızca GEÇİCİ hatalar; kota ve
  geçersiz anahtar hiç denenmez). Sonraki koşular 23-29 sn'de başarılı.
- **YAKALANAN HATA (arayüz) — başarısız denemeden sonra fotoğraf seçici
  kilitleniyordu.** Seçilen dosya hata yolunda temizlenmediği için `PhotoPicker`
  başarısız fotoğrafın önizlemesinde takılı kalıyor, kullanıcı yenisini
  seçemiyordu — oysa mesaj tam da "başka bir fotoğrafla tekrar dene" diyor.
  Tarayıcı testi yakaladı; hata yolunda `secilenDosya` sıfırlanıyor.
- **GİZLİLİK:**
  - `skin_tone_*` kolonları `UserRepository.SAFE_COLUMNS`'a **bilerek eklenmedi**:
    `/auth/me` ve `/users/:id` her yerde çağrılıyor, hassas selfie yolunu orada
    taşımanın sebebi yok. Test bu sızıntıyı ayrıca kontrol ediyor.
  - Selfie **paylaşım görseline, kombin kartlarına, hiçbir listeye girmiyor**;
    test bunu Kombin Öner sayfasının HTML'inde arayarak doğruluyor.
  - **"Analizi Sil"** düğmesi var: hassas veri için silebilmek pazarlık konusu değil.
  - **Kalan risk `/uploads` statik servisi:** dosya adı tahmin edilemez UUID ve
    yol yalnızca sahibine dönüyor (kıyafet fotoğraflarıyla aynı mekanizma) ama
    bir selfie için bu daha zayıf bir güvence. "Eksikler" tablosuna işlendi.
- **ENTEGRASYON — "✓ Ten tonuna uygun" işareti.** Kombin Öner'de, eşleşen kartın
  ALTINDA (kartın kendisine konmadı: `ClothingCard` paylaşılan bir bileşen ve bu
  bilgi Gardırop'ta anlamsız). **YALNIZCA BİLGİLENDİRİCİ:** hiçbir parçayı
  elemez, sıralamayı değiştirmez, öneriyi etkilemez — test bunu ayrıca kanıtlıyor.
  Ten tonu çağrısının kendi try/catch'i var ve hatası sayfayı etkilemez
  (hava durumuyla aynı ilke).
- **Karşılaştırma "içeren" mantığıyla** çünkü iki taraf farklı yazıyor: kullanıcı
  `"Sıcak"`, kıyafet `["Sıcak ten", "Tüm Ten Tonları"]`. "tüm/her ten" ifadeleri
  her tona uyar. **Türkçe küçültme şart** (`toLocaleLowerCase('tr-TR')`):
  varsayılan `toLowerCase` `"SICAK"` → `"sicak"` üretir ve eşleşme kaçardı.
- **Renk daireleri için `lib/colors.js > resolveColorHex` eklendi.** Gemini
  serbest metin üretiyor ("Mercan", "Zeytin Yeşili", "Kiremit Rengi") ve bunlar
  `CLOTHING_COLORS` paletinde yok; ek bir AI-renk sözlüğü tutuluyor. Tanınmayan
  renk sessizce dairesiz düz etikete düşer. Bu sözlük bir PALET DEĞİLDİR —
  kıyafet kaydına bu renkler yazılmaz, hiçbir seçicide görünmez.
- **`api.js`'te `requestMultipart` ayıklandı:** dosya yükleyen iki çağrı
  (kıyafet fotoğrafı + selfie) aynı yolu paylaşıyor; ikincisi zaman aşımı da
  taşıyor (90 sn, sunucunun kendi en kötü senaryosunun üstünde).
- **Doğrulama — `backend/test-scripts/test-skin-tone.js`, 43 kontrol:**
  - *Birim (33) SUNUCU VE ANAHTAR GEREKTİRMEZ* (`--birim`): şema/prompt
    kontrolleri; başarılı analizin kaydı; **yüz bulunamayınca hiçbir şey
    yazılmaması ve dosyanın geri alınması**; **Gemini hatasında eski analizin
    ve eski selfie'nin korunması**; geçici hatanın denenip kalıcı hatanın
    denenmemesi; eşzamanlı ikinci isteğin 409 ile tek çağrıya inmesi; eski
    selfie'nin yalnızca başarılı yazmadan sonra silinmesi; silme; dosyasız istek.
  - *HTTP (7):* 401, analizi olmayan kullanıcıda 200 + null, **yolun
    `/users/:id` ile çakışmaması**, dosyasız/görsel olmayan dosya 400 ve
    **`/auth/me` ile `/users/:id` yanıtlarında skin_tone alanlarının OLMAMASI**.
  - *Gerçek Gemini (3):* yüz içermeyen gerçek fotoğrafta 400 + yönlendirme
    (500 değil), öksüz dosya kalmaması, kaydın bozulmaması.
- **Doğrulama — gerçek tarayıcıda 43 kontrol (Playwright + sistem Chrome),
  geçici test kullanıcısıyla:** davet ekranı ve "isteğe bağlı" notu; **analiz
  yokken Ana Sayfa / Gardırop / Kombin Öner'in normal çalışması**; hata yolunda
  nazik yönlendirme + davet ekranının kullanılabilir kalması + veritabanına
  yazılmaması; **gerçek Gemini ile başarılı analiz**, 8 renk dairesi, selfie
  önizlemesi, gizlilik notu, kaynak dipnotu, yenilemede korunma; gizlilik
  kontrolleri; **ten tonu işaretinin uyumlu parçada çıkması ve analizi olmayan
  kullanıcıda HİÇ çıkmaması**; silme; karanlık mod ve 390px'te taşma olmaması;
  temiz konsol.
- **Doğrulama — `frontend/test-scripts/test-outfit-builder.mjs` 63 → 73 kontrol:**
  `matchesSkinTone` (eşleşme, "Tüm Ten Tonları", Türkçe büyük harf, analizsiz
  parça, kullanıcının tonu yokken hiç işaret olmaması) ve **ten tonu bilgisinin
  kombin kurulumunu ETKİLEMEDİĞİ**.
- **GERÇEK GEMİNİ SONUCU** (sentetik portre, çizilen palet: sıcak/açık buğday):
  *"Sıcak / Açık buğday teni"*, uyumlu → Mercan, Şeftali, Zeytin Yeşili, Taba,
  Krem, Kiremit Rengi, Hardal Sarı; uzak dur → Buz Mavisi, Soğuk Gri, Neon
  Pembe; metal → Altın. Model çizilen tonu doğru okudu, genel bir cevap vermedi.
  **Gerçek bir selfie ile denenmedi** (elde yok) — "Eksikler"e işlendi.
- Regresyon: `test-all-endpoints` 72/72, `test-auth` 48/48, `test-stats` 60/60,
  `test-item-outfits` 27/27, `test-clean-status` 26/26, `test-vector` 82/82,
  `test-outfit-rag` 69/69, `test-ai-analysis --kotasiz` 67/67,
  `test-outfit-builder` 73/73, lint + build temiz.
- **Temizlik:** test kullanıcıları ve sentetik analiz silindi; kullanıcı
  silmenin diskte öksüz fotoğraf bıraktığı görüldü (önceden beri var olan
  davranış) — 20 öksüz dosya toplandı ve "Eksikler"e işlendi.

### 2026-08-22 — Kıyafet Detay: "Yeniden Analiz Et" düğmesi
- **Ne eklendi:** AI analiz panelinin altında ince outline bir düğme. Tıklanınca
  "Analiz ediliyor..." durumuna geçip kilitleniyor, sonuç gelince panel yeni
  veriyle güncelleniyor. Yeni uç: **`POST /clothing-items/:id/analyze`**.
- **`force: true` yolu zaten hazırdı** (Aşama 2'de "ileride bağlanacak tek nokta"
  diye bırakılmıştı) — `#prepare` içindeki maliyet koruması force ile atlanıyor,
  in-flight muhafızı ve eşzamanlılık semaforu da yerindeydi. Servis tarafında
  yalnızca aşağıdaki hata düzeltildi.
- **YAKALANAN HATA — yeniden analiz BAYAT VEKTÖR bırakıyordu.** `#run`, analizi
  yazdıktan sonra `vectorService.indexItemInBackground(itemId)` çağırıyordu ama
  `force` AKTARILMIYORDU. VectorService'in kendi maliyet koruması ("zaten
  indekslenmiş") devreye giriyor, embedding eski `ai_analysis` metnine ait
  kalıyordu — yani parça yeniden analiz edilse bile Kombin Öner ve "Buna Benzer
  Diğer Parçalar" ESKİ vektörle çalışmaya devam ederdi. `force` artık zincir
  boyunca aktarılıyor (`analyzeItem → #run → indexItemInBackground → indexItem`).
  Gerçek veriyle doğrulandı: yeniden analiz sonrası Chroma'daki vektör tarihi de
  değişti (00:25 → 19:34).
- **UÇ SENKRON — deponun "önce cevapla, sonra çalış" kuralından bilinçli sapma.**
  Fotoğraf yüklemede analiz arka planda çalışır çünkü kullanıcı fotoğrafı bırakıp
  işine bakar; burada düğmeye basıp ekrana bakıyor. 202 + yoklama yolu, arayüze
  "yeni analiz geldi mi" sorusunu çözdürmek zorunda bırakırdı — kolon zaten dolu
  olduğu için mevcut null-yoklaması işe yaramaz, `analiz_tarihi` karşılaştırmak
  gerekirdi. Ölçülen gerçek süre: **8.7 sn**.
- **HATA HÂLİNDE ESKİ ANALİZ KORUNUR** — özelliğin en kritik sözleşmesi.
  `ClothingAnalysisService` yalnızca BAŞARIDA kolona yazıyor (yapısal garanti),
  arayüz de `item`'ı yalnızca 200 yanıtında güncelliyor. Ekrandaki veri hiçbir
  hata yolunda boşaltılmıyor; mesaj panelin altında, verilerin ALTINDA çıkıyor
  ki kullanıcı neyin korunduğunu görsün.
- **Sahiplik CONTROLLER'da doğrulanıyor.** `analyzeItem` yalnızca id ile çalışır,
  kullanıcıya bakmaz — kontrol olmasaydı bir kullanıcı başkasının parçası için
  Gemini çağrısı tetikleyebilirdi (para harcatma yolu). `getItemById(id, userId)`
  ile doğrulanıyor, başkasının kaydı **404**.
- **Çift tıklama Gemini'ye ikinci çağrı YAPMAZ:** arayüzde düğme kilitleniyor,
  backend'de mevcut in-flight muhafızı **409** döndürüyor. Test, ilk çağrı
  Gemini'de asılıyken ikinci isteği atıp tek çağrı yapıldığını doğruluyor.
- **Sebep kodları Türkçe mesajlara çevriliyor, HAM KOD SIZMIYOR:** 409 zaten
  analiz ediliyor · 400 fotoğraf yok/okunamıyor · 404 kayıt yok · 503 anahtar
  yok, kota dolu, Gemini erişilemiyor. Genel 503 mesajı bilerek şunu diyor:
  *"Analiz şu anda yapılamadı, mevcut analiz korundu."*
- **İstemci zaman aşımı 90 sn** — sunucunun KENDİ en kötü senaryosunun
  (2 deneme x 30 sn + kuyruk ≈ 62 sn) ÜSTÜNDE. Erken kesilseydi sunucu analizi
  yazmaya devam eder, arayüz "olmadı" der ve ekran bayat kalırdı; bu sınır
  normal işleyişte hiç devreye girmez.
- **Fotoğraf değişti hatırlatması** (istenen opsiyonel iyileştirme): panelde
  *"Fotoğrafı değiştirdin — bu analiz hâlâ eski fotoğrafa ait. Güncellemek ister
  misin?"* İpucu OTURUM İÇİDİR: şemada "fotoğraf ne zaman değişti" bilgisi yok
  (`updated_at` her düzenlemede değişir) ve bunun için migration yazmaya
  değmezdi — hatırlatmanın hedefi zaten kullanıcının az önce yaptığı değişiklik.
  Otomatik yeniden analiz YAPILMIYOR: her çağrı gerçek para harcıyor, kararı
  kullanıcı veriyor.
- **Doğrulama — `test-ai-analysis.js` 90 → 104 kontrol.** Yeni birim kontrolleri:
  normal analizde embedding `force:false`, **yeniden analizde `force:true`**
  (bayat vektör düzeltmesi); Gemini patladığında ve kota dolduğunda
  **kolona HİÇ yazılmaması ve eski analizin aynen kalması**; çift tıklamada
  ikinci isteğin `zaten-analiz-ediliyor` ile dönüp tek Gemini çağrısı yapılması.
  Uçtan uca (geçersiz anahtarlı ikinci sunucu, `:3199`): yeniden analiz **503**,
  ham sebep kodu sızmıyor, **eski analiz korunuyor**, sunucu ayakta, başkasının
  parçası 404, token'sız 401.
- **Doğrulama — gerçek tarayıcıda 28 kontrol (Playwright + sistem Chrome).**
  Geçici bir test kullanıcısı kuruluyor (sonda siliniyor), kullanıcının kendi
  gardırobuna dokunulmuyor: düğmenin panel içinde ve outline stilde olması;
  503'e düşürüldüğünde "Analiz ediliyor..." + kilit + dönen ikon, ardından nazik
  mesaj ve **eski analizin hem ekranda hem veritabanında durması**; sonra
  **gerçek bir Gemini çağrısıyla** analizin güncellenmesi ve panelin yeni veriyi
  basması (`eski-test-modeli` → `gemini-3.6-flash`); fotoğraf değiştirilince
  ipucunun çıkması; karanlık mod ve 390px'te taşma olmaması; temiz konsol.
- **Gerçek gardıroptan da doğrulandı:** Guess siyah çanta yeniden analiz edildi —
  8.7 sn, `analiz_tarihi` 2026-08-21 → 2026-08-22, Chroma vektörü de tazelendi.
- Regresyon: `test-ai-analysis --kotasiz` 67/67, `test-vector` 82/82,
  `test-outfit-rag` 69/69, `test-outfit-builder` 63/63, `test-all-endpoints`
  72/72, `test-auth` 48/48, `test-stats` 60/60, `test-item-outfits` 27/27,
  `test-clean-status` 26/26, lint + build temiz.
- **TEST TUZAĞI — kasten kırılan istek konsol denetimini kirletir.** Tarayıcı
  testinde 503 senaryosundan sonra "konsol temiz mi" kontrolü kırmızı yandı:
  topladığı iki satır da BİZİM kurduğumuz 503'e aitti (tarayıcının
  "Failed to load resource" kaydı ve uygulamanın kendi `console.error`'ı).
  Ürün hatası değil; denetim, kasıtlı hata bölümünden SONRA sıfırlanacak
  biçimde düzeltildi.

### 2026-08-22 — Kıyafet Detay: "Buna Benzer Diğer Parçalar" bölümü
- **Ne eklendi:** Kıyafet Detay'da, kombinler bölümünün altında, aynı kategoriden
  en yakın **4** parçayı gösteren bir bölüm. Kartlar paylaşılan `ClothingCard`
  bileşeni; tıklanınca o parçanın kendi detay sayfasına gidiliyor. Benzer parça
  yoksa bölüm **hiç render edilmiyor** (başlık dahil).
- **UÇ SEÇİMİ — `/companions` DEĞİL, mevcut `/similar` kullanıldı.** İstenen
  "companions'a `sameCategory=true` ekle" yoluydu; ölçüp vazgeçildi çünkü ikisi
  **zıt işler** yapıyor: `/companions` kombin kurmak için var ve başlangıç
  parçasının KENDİ kategorisini hedeflerden **bilerek** düşürüyor (kombin slotu
  başka bir kategoriye ait; hedef kalmazsa 400). Aynı-kategori araması ise
  `/similar`'ın zaten tek işi — kendisini eliyor, kullanıcıyla filtreliyor,
  Postgres'ten zenginleştiriyor, 503'ü dürüstçe bildiriyor.
  `sameCategory` eklemek, başka bir ucun zaten yaptığı iş için bilinçli bir
  kuralı tersine çevirmek olurdu. **Sonuç: sıfır yeni uç, sıfır yeni parametre.**
- **Aşama 3'ten kalan "kullanılmayan doğrulama ucu" böylece ürün akışına bağlandı.**
  "Eksikler" tablosundaki *"Kıyafet Detay'da benzer parçalar bölümü yok"* satırı
  kapandı; artık iki vektör okuma ucu da gerçek bir ekranı besliyor.
- **`/similar` yanıtına `season`, `is_clean`, `is_favorite` eklendi** —
  `/companions` ile aynı gerekçe. Bu satırlar **paylaşılan kıyafet kartına**
  besleniyor ve kart favori kalbini, "Kirli" rozetini bu alanlardan çiziyor;
  eksik olsalardı favorilenmiş bir parça boş kalple, kirli bir parça rozetsiz
  görünürdü. Yalnızca alan EKLENDİ, mevcut sözleşme değişmedi.
- **HATA DURUMU YOK — her başarısızlık "bölümü gösterme"ye çevriliyor.**
  İndekslenmemiş parça, ChromaDB 503, zaman aşımı, aynı kategoride başka parça
  olmaması: hepsi boş listeye düşüyor ve bölüm hiç render edilmiyor.
  Gerekçe: bu bir keşif eklentisi, sayfanın taşıdığı bilgi değil — "benzer
  parçalara ulaşılamıyor" demek, kullanıcının hiç istemediği bir şey için özür
  dilemek olurdu. **Kombinler bölümü bunun AKSİNE hata gösteriyor** ve bu ayrım
  bilinçli: orada kullanıcı bir cevap bekliyor.
- **Yerleşim `AiAnalysisPanel` ile aynı gerekçeye dayanıyor:** iki sütunlu
  ızgaranın ALTINDA, tam genişlikte. Sağ sütun `md` üstünde yarım genişlikte ve
  dört kartlık bir şerit oraya sıkışırdı.
- **Kart yüksekliği sabitlendi** (`SIMILAR_CARD_HEIGHT = 'h-52'`). `toClothingItem`
  masonry yüksekliğini id'den türetiyor — Gardırop ızgarası için doğru ama YAN YANA
  dizili bir şeritte farklı yükseklikler bozuk görünürdü. Ölçüldü: dört kartın
  görsel yüksekliği de genişliği de birebir eşit (208px / 254px).
- Dar ekranda **yatay kaydırılabilir şerit**, `sm` üstünde dört sütunlu ızgara;
  mobilde dört kartı iki sütuna sıkıştırmak yerine kaydırmak fotoğraf oranını
  koruyor. 390px'te sayfada yatay taşma yok (şerit kendi içinde kayıyor).
- İstemci tarafı zaman aşımı `fetchCompanions` ile paylaşıldı; sabit
  `COMPANION_TIMEOUT_MS` → **`VECTOR_REQUEST_TIMEOUT_MS`** olarak yeniden
  adlandırıldı (iki vektör okuma çağrısının da ortak özelliği: kullanıcı bekliyor
  ve başarısızlık tolere edilebilir).
- **Doğrulama — `test-vector.js` 77 → 82 kontrol.** Mevcut "iki beyaz üst"
  fixture'ı zaten aynı-kategori senaryosunu kuruyordu; üstüne eklenenler:
  kart alanlarının (`is_favorite`/`is_clean`/`season`) yanıtta olması ve gerçek
  boolean dönmesi, fotoğraf/renk alanlarının varlığı, **aynı kategoride başka
  parça yoksa 200 + BOŞ LİSTE dönmesi** (hata değil) ve parçanın kendi
  kategorisinde bile sonuçlara düşmemesi.
- **Doğrulama — gerçek tarayıcıda 34 + 15 kontrol (Playwright + sistem Chrome):**
  bölümün görünmesi ve kombinler bölümünün ALTINDA olması, kendisinin listede
  çıkmaması, karta tıklayınca hedef parçanın detayına gidilmesi ve orada bölümün
  yine çalışması (karşılıklı benzerlik); **aynı kategoride tek parça olan
  kıyafette (New balance 530) bölümün hiç görünmemesi**; **analizi olmayan
  kıyafette (Bershka crop top) sessizce atlanması**; `/similar` 503'e
  düşürüldüğünde ve ağ tamamen koptuğunda bölümün gizlenmesi ama sayfanın geri
  kalanının ayakta kalması ve kullanıcıya hata gösterilmemesi; karanlık mod ve
  390px'te yatay taşma olmaması; temiz konsol.
- **ÇOK KARTLI DÜZEN ayrı doğrulandı:** gerçek gardıropta bir kategoride en fazla
  2 indeksli parça olduğu için geçici bir test kullanıcısına 5 üst kuruldu
  (sonda silindi). Dört kart tek satırda, eşit genişlik ve yükseklikte diziliyor;
  390px'te şerit gerçekten kayıyor.
- **BENZERLİK SIRALAMASI (kontrollü veri):** beyaz keten gömlek →
  **beyaz pamuklu bluz 0.9584** > krem basic tişört 0.9418 > desenli yün kazak
  0.8735 > siyah deri ceket 0.8506. İki beyaz üst açık ara en yakın, tam da
  beklendiği gibi.
- **GERÇEK GARDIROP VERİSİYLE:** Alt kategorisinde Koton beyaz keten şort ↔ H&M
  siyah kumaş pantolon 0.826 (karşılıklı); Makyaj'da panorama maskara ↔
  Maybelline lifter gloss 0.8454. Kategorisinde tek indeksli parça olanlar
  (Üst, Ayakkabı, Çanta) boş liste döndürüyor → bölüm görünmüyor. Analizi
  olmayanlar (Bershka crop top, Zara beyaz elbise) `indekslendi:false` →
  bölüm görünmüyor.
- Regresyon: `test-vector` 82/82, `test-outfit-rag` 69/69, `test-outfit-builder`
  63/63, `test-all-endpoints` 72/72, `test-auth` 48/48, `test-stats` 60/60,
  `test-item-outfits` 27/27, `test-clean-status` 26/26,
  `test-ai-analysis --kotasiz` 53/53, lint + build temiz.

### 2026-08-22 — Kombin Öner: isteğe bağlı makyaj önerisi bölümü
- **Ne eklendi:** Dört kombin kartının altında, **kapalı başlayan** bir bölüm.
  İçinde fırça ikonu, "Bu kombine uygun makyaj önerisi ister misin?" metni ve bir
  "Göster" düğmesi var; tıklanınca yumuşak bir geçişle başlangıç parçasına vektör
  uzayında en yakın TEMİZ makyaj ürünü açılıyor, düğme "Gizle"ye dönüyor.
  Mevcut RAG akışı, temiz/kirli ve hava durumu kuralları **hiç değişmedi**.
- **BACKEND'E TEK SATIR EKLENMEDİ.** `/companions` zaten `categoryIds` alıyor;
  istemci artık listeye Makyaj kategorisini de koyuyor. Yeni uç, yeni servis
  metodu, yeni migration yok — kategori başına ayrı sorgu atan mevcut tasarım
  bunu bedavaya veriyordu.
- **Makyaj `OUTFIT_CATEGORIES`'e BİLEREK EKLENMEDİ.** Kombinin slotu değil, üstüne
  konan bir öneri. Yeni `CANDIDATE_CATEGORIES` (= kombin kategorileri + Makyaj)
  yalnızca "neyi sorgula" sorusunu yanıtlıyor; ızgarayı kuran
  `buildOutfitFromCandidates` hâlâ yalnızca `OUTFIT_CATEGORIES` üzerinde geziyor,
  dolayısıyla makyaj dört kartlık ızgaraya **yapısal olarak** giremiyor.
- **BU KATEGORİDE GERİ DÜŞÜŞ YOK — kasıtlı bir istisna.** Diğer slotlarda rastgele
  bir parça göstermek "kombin eksik kalmasın" diye değerliydi; makyaj isteğe bağlı
  bir ek. Vektör bir şey söyleyemiyorsa (embedding yok, Chroma kapalı, hepsi kirli)
  doğru davranış rastgele bir ruj önermek değil, **bölümü hiç render etmemek**.
  `pickMakeupItem` null döner ve sayfa tüm bölümü atlar: makyajı olmayan kullanıcı
  boş bir çağrı da, ölü bir düğme de görmez.
- **Sezon makyaja UYGULANMIYOR** ("kışlık ruj" diye bir kavram yok; mevsim kuralı
  kıyafetin sıcaklığıyla ilgili), **temiz/kirli filtresi ise aynen geçerli.**
- **`variantDepth` makyaj havuzunu SAYMIYOR.** Sayılsaydı, çok makyaj ürünü olup
  tek tişörtü olan bir gardıropta "Başka Öneri Göster" dört kartı hiç
  değiştirmeden yalnızca ruju döndürür ve düğme bozuk görünürdü.
- **Öneri id olarak saklanıyor ve render sırasında temiz/kirli YENİDEN kontrol
  ediliyor:** kullanıcı karttan ürünü kirli işaretlerse bölüm anında kayboluyor,
  bir sonraki öneriye kadar ortada durmuyor. (Test bunu ayrıca doğruluyor.)
- **KAYDETME SÖZLEŞMESİ: bölüm AÇIKSA makyaj dahil, KAPALIYSA değil.** Ölçüt
  "kullanıcı bunu gördü mü" olduğu için açık/kapalı durumu kullanılıyor. Bölümü
  hiç açmayan kullanıcı için akış eskisiyle birebir aynı — dört parça kaydediliyor,
  makyaj sessizce eklenmiyor. Paylaşım görseli de aynı kümeyi kullanıyor;
  `ShareOutfitCard`'ın `CATEGORY_ORDER` dizisi `Makyaj`'ı zaten tanıyor ve en sona
  diziyor, o yüzden orada değişiklik gerekmedi.
- **Açılma animasyonu `grid-rows-[0fr] → [1fr]` geçişi.** `max-height` tahmini
  gerektirmeden gerçek yüksekliği animasyonluyor (ölçüldü: 0 → 295px, 300ms).
  İçerik kapalıyken de DOM'da durduğu için panele **`inert`** veriliyor — aksi
  hâlde görünmeyen kart klavyeyle odaklanabilir ve ekran okuyucuya okunurdu.
- Görsel dil mevcut sisteme bağlı: `rounded-2xl border border-dusty-rose/40
  bg-surface/60`, `bg-dusty-rose/15` daireli `Brush` ikonu (`text-accent-ink`) ve
  paylaşılan `Button variant="outline"`. Yeni token ya da yeni idiom icat edilmedi.
- **Doğrulama — `frontend/test-scripts/test-outfit-builder.mjs` 48 → 63 kontrol.**
  Yeni bölümler: `pickMakeupItem` (havuz yok/boş/makyajsız → null, en yakın ürün,
  varyantla ilerleme, **kirli ürünün elenmesi**, **hepsi kirliyse RASTGELEYE
  DÜŞMEMESİ**, sezonun elemamesi) ve "Makyaj kombin ızgarasına sızmıyor"
  (`vectorCount`'a sayılmaması, `buildRandomOutfit` regresyonu,
  `CANDIDATE_CATEGORIES` bileşimi, `variantDepth`'in makyajı saymaması).
- **Doğrulama — gerçek tarayıcıda 39 + 12 kontrol (Playwright + sistem Chrome):**
  bölümün dört kartın altında olması, kapalı başlaması (yükseklik 0, `inert`,
  `aria-expanded=false`), ızgaranın 4 kart kalması, aç/kapa döngüsü ve 300ms
  geçişi, kartın kategori etiketi + fotoğrafla diğer kartlarla aynı stilde
  çıkması; **kapalıyken 4 parça / açıkken 5 parça kaydedilmesi ve makyajın
  `outfit_items`'a gerçekten girmesi (veritabanından doğrulandı)**; ürün karttan
  kirli işaretlenince bölümün tamamen kaybolması; **makyaj ürünü olmayan
  kullanıcıda (serra1110) bölümün hiç görünmemesi**; **`/companions` 503'e
  düşürüldüğünde bölümün gösterilmemesi ama kombinin üretilip kaydedilebilmesi**;
  temiz konsol. Ayrı koşuda karanlık mod ve 390px: kontrast **7.88:1 / 6.30:1**
  (ikisi de WCAG AA), yatay taşma yok.
- **GERÇEK MAKYAJ VERİSİYLE doğrulandı** (2 ürün: Maybelline lifter gloss, panorama
  maskara). Siyah parçalar siyah maskarayı öne alıyor — siyah pantolon → maskara
  0.8455 > gloss 0.7892; siyah tişört → 0.8348 > 0.8041; siyah çanta →
  0.8385 > 0.8016. **Beyaz yazlık keten şortta sıra TERSİNE dönüyor:**
  gloss 0.7809 > maskara 0.7558. Renk ve ton kümelenmesi makyajda da çalışıyor.
- Regresyon: `test-outfit-rag` 69/69, `test-vector` 77/77, `test-all-endpoints`
  72/72, `test-auth` 48/48, `test-stats` 60/60, `test-item-outfits` 27/27,
  `test-clean-status` 26/26, `test-ai-analysis --kotasiz` 53/53, lint + build temiz.
- **TEST TUZAĞI — Playwright'ın `:visible` sayımı ata kırpmasını GÖRMEZ.** Kapalı
  panelin içindeki kart, ata `grid-rows-[0fr]` + `overflow-hidden` ile tamamen
  kırpılmış olmasına rağmen kendi kutusu olduğu için `:visible` sayılıyor ve
  "ızgarada 4 kart olmalı" kontrolü 5 buluyordu. Ürün hatası değil; sayım
  `:not(#makyaj-onerisi a)` ile panel dışına sınırlandı.
- **TEST TUZAĞI — kontrast ölçümü `oklab()` renklerinde sessizce saçmalıyor.**
  Tailwind v4 saydamlığı `oklab(… / 0.7)` olarak üretiyor; `rgb()` bekleyen bir
  regex bu dizeden rastgele rakamlar toplayıp 4.088.840.765:1 gibi "geçen" bir
  oran üretti — yani kontrol yeşil yandığı hâlde hiçbir şey ölçmüyordu. Ölçüm,
  rengi canvas'a çizdirip pikselden okuyacak (ve saydam katmanları ata zincirinde
  birleştirecek) biçimde yeniden yazıldı; gerçek değerler 7.88:1 / 6.30:1.
  Ders: kontrast testi, ölçtüğü rengi de raporlamalı — yoksa yalancı yeşil verir.

### 2026-08-22 — Gemini Entegrasyonu — Aşama 4: RAG ile Kombin Öner
- **Vektör altyapısı nihayet ÜRÜN AKIŞINA BAĞLANDI.** Kombin Öner artık rastgele
  bir "başlangıç parçası" seçip ChromaDB'den o parçaya en yakın adayları DİĞER
  kategorilerden çekiyor ve kombini bunlardan kuruyor. Mevcut temiz/kirli ve hava
  durumu filtreleri **korundu ve adaylara da uygulanıyor** — vektör benzerliği
  hiçbir filtreyi atlamıyor.
- **Yeni uç `GET /clothing-items/:id/companions?categoryIds=1,2,4,5&limit=8`.**
  `categoryIds` zorunlu; başlangıç parçasının KENDİ kategorisi hedeflerden düşer.
- **KATEGORİ BAŞINA AYRI SORGU — ölçülmüş bir gereklilik, süsleme değil.** Tek bir
  büyük sorgu (`nResults=50`) istatistiksel olarak çok parçalı bir kategoriyi öne
  alır ve az parçalı kategoriden hiç sonuç döndürmeyebilir; kombin ise HER slotu
  doldurmak zorunda. Sorgular paralel gidiyor, Chroma yerel ağda.
- **RETRIEVAL backend'de, KOMBİN KURMA istemcide.** Bilinçli bir sınır: uç "vektör
  uzayında bunlar yakın" der ve durur. Hangi slotun neyle dolacağı, temiz/kirli,
  hava durumu, varyant ilerletme ve geri düşüş **yeni `src/lib/outfitBuilder.js`**
  modülünde. `OutfitService` hâlâ yalnızca doğrulayıp kaydediyor.
- **Mantık `OutfitSuggestion.jsx`'ten `lib/outfitBuilder.js`'e ÇIKARILDI** çünkü artık
  iki yol var (vektör + rastgele geri düşüş) ve ikisi de React'sız, deterministik
  test edilebilmeliydi. Modül `./seasons.js` importunda **uzantıyı bilerek yazıyor**:
  Node'un ESM çözümleyicisi uzantısız yolu bulamaz, Vite ikisini de kabul eder.
- **BAŞLANGIÇ PARÇASI ANALİZLİ OLANLARDAN SEÇİLİR.** Embedding'in kaynağı
  `ai_analysis` kolonudur; analizsiz bir parçayı başlangıç yapmak aramayı baştan
  boşa çıkarır ve her seferinde rastgeleye düşerdi. Sonra hava durumuna uygun
  sezon önceliklendirilir (mevcut kural).
- **GERİ DÜŞÜŞ KATEGORİ BAZINDA, KOMBİN BAZINDA DEĞİL.** Çanta kategorisinde vektör
  adayı yoksa (embedding'i olmayan parça, ya da hepsi kirli) yalnızca o slot
  rastgele seçime düşer; kalan üç slot vektörden gelmeye devam eder. "Ya hep ya
  hiç" olsaydı tek bir indekslenmemiş parça tüm özelliği kapatırdı.
- **"Başka Öneri Göster" aynı başlangıç parçasıyla HAVUZDA İLERLİYOR** (en yakın →
  ikinci en yakın → …). Kategori başına 8 aday isteniyor; havuz tükendiğinde yeni
  bir başlangıç parçası seçiliyor ve `excludeSeedId` ile öncekinin tekrar gelmesi
  engelleniyor. Rastgele moddayken düğme eskisi gibi davranıyor.
- **Adaylar id olarak saklanıyor, parça nesnesi olarak DEĞİL.** Her kombin
  kurulumunda güncel gardıroptan yeniden çözülüyorlar; böylece karttaki
  temiz/kirli iyimser güncellemesi bir sonraki öneriye anında yansıyor. Nesne
  saklansaydı havuz kullanıcının az önce kirli işaretlediği parçayı önermeye
  devam ederdi.
- **API DÜRÜST KALDI: Chroma erişilemezse uç `503` döner, boş liste değil.**
  Sessizce rastgeleye düşme kararı İSTEMCİNİN. Uç boş dönseydi arayüz akıllı
  olmayan bir öneriyi akıllı sanar ve rozeti haksız yere gösterirdi. VectorService'in
  "OKUMA fırlatır" sözleşmesi bu yüzden değişmedi.
- **Rozet: "✦ Tarzına göre seçildi".** `vectorCount > 0` iken görünür; tamamen
  rastgeleye düşüldüyse HİÇ çıkmaz. Mikro etiket idiomu (`uppercase`,
  `tracking-[0.15em]`, `text-accent-ink`) — yeni bir görsel dil icat edilmedi.
  Ölçüldü: açık modda **4.97:1**, karanlık modda **9.28:1**, ikisi de WCAG AA.
- **ÖNERİ BAŞINA GEMİNİ ÇAĞRISI YOK.** Başlangıç parçasının vektörü Chroma'da zaten
  var, oradan okunuyor. Her öneri gerçek para harcasaydı özellik kullanılamazdı;
  test bunu ayrıca doğruluyor.
- **Zaman aşımı 3 sn** (`COMPANION_TIMEOUT_MS`), istemcide 4 sn. `VectorRepository`'nin
  10 sn'lik sınırı burada FAZLA UZUN: orada kullanıcı fotoğraf yükleyip işine
  bakıyor, burada öneri ekranına bakıp bekliyor. Sınır servis katmanında ayrıca
  uygulanıyor çünkü koleksiyon nesnesi üzerinden yapılan `get`/`query` çağrıları
  repository'nin kendi zaman aşımının dışında kalıyor. Ölçülen gerçek yanıt: **53–77 ms**.
- **Zenginleştirme tek sorguda** (`ClothingItemRepository.findByIds`): kategori
  başına N aday için ayrı ayrı `findById` atmak veritabanına onlarca tur demekti
  ve bu yol kullanıcı beklerken çalışıyor.
- **YAKALANAN HATA — bozuk id 500 döndürüyordu.** Test `?id=bozuk-uuid` ile
  `500` aldı: id doğrudan Postgres'e gidip `22P02` veriyordu. `assertUuid` ile
  `400`'e çevrildi; **aynı hata `/similar` ucunda da vardı ve o da düzeltildi**
  (`GET /outfits?clothingItemId=` filtresinde yaşanan tuzağın aynısı).
- **Doğrulama — `backend/test-scripts/test-outfit-rag.js`, 69 kontrol:**
  - *Birim (36) CHROMA VE ANAHTAR GEREKTİRMEZ* (`--birim`): yetkilendirme
    (başkasının parçası 404, bozuk id 400, `categoryIds` yoksa 400); **her
    sorguda kullanıcı VE kategori filtresinin bulunması**; kategori başına ayrı
    sorgu; başlangıç parçasının kendisinin elenmesi; Chroma'da kalan öksüz
    vektörün Postgres doğrulamasında düşmesi; `limit` sınırlaması; indekslenmemiş
    parçanın hata DEĞİL `indekslendi:false` dönmesi; **Chroma çöktüğünde 503
    FIRLATMASI**; **askıda kalan Chroma'nın 3 sn'de zaman aşımına düşmesi**;
    `CHROMA_ENABLED=false`; ve **öneri başına Gemini çağrısı olmaması**.
  - *Gerçek embedding (21):* kontrollü sentetik veriyle (siyah tişört, siyah
    pantolon, beyaz yazlık şort, sneaker, kirli çanta). **Sonuç: siyah pantolon
    0.9638, beyaz şort 0.8518** — fark 0.1120, gürültünün çok üstünde. Ayrıca
    kirli adayın backend'de ELENMEYİP `is_clean:false` ile işaretli dönmesi,
    `season`/`image_url`/`color` alanlarının varlığı, 401/400/404, `limit=1`,
    **başka kullanıcının NEREDEYSE AYNI parçasının sonuçlara sızmaması** ve
    kıyafet silinince adaylardan düşmesi.
  - *KRİTİK — Chroma erişilemezken (12):* script **ikinci bir sunucu açar**
    (`:3197`, ölü Chroma portu) ve Kombin Öner'i besleyen akışın kırılmadığını
    kanıtlar: sunucu açılıyor, kategoriler/gardırop/kullanıcı okunabiliyor,
    **kombin kaydedilebiliyor**, `/companions` **503 ile açıkça** bildiriyor
    (18 ms'de, istemci beklemiyor), ham bağlantı hatası sızmıyor, süreç çökmüyor.
- **Doğrulama — `frontend/test-scripts/test-outfit-builder.mjs`, 48 kontrol.**
  Depodaki İLK frontend test scripti. Sunucu/Chroma/anahtar gerektirmez.
  Asıl güvence burada: **vektör adaylarının temiz/kirli ve hava durumu
  filtrelerini atlayamaması** (100 kombinde kirli parça çıkmaması dahil), geri
  düşüşün kategori bazında olması, varyant ilerletme, `variantDepth`, ve
  `buildRandomOutfit`'in eski davranışının birebir korunması.
- **Doğrulama — gerçek tarayıcıda (Playwright + sistem Chrome), 23 + 9 kontrol:**
  rozetin görünmesi ve metni, `accent-ink` rengi ve mikro etiket idiomu, kirli
  parçanın kombine girmemesi, "Başka Öneri Göster"in farklı kombinler üretmesi;
  **`/companions` 503'e düşürüldüğünde kombinin YİNE üretilmesi, rozetin
  ÇIKMAMASI, kullanıcıya hata gösterilmemesi ve sayfanın çökmemesi**; ağ tamamen
  koptuğunda aynı davranış; **hiç analizi olmayan bir gardıropta (serra1110)
  sessizce rastgeleye düşülmesi**; iki Alt parçası kirletildiğinde 8 önerinin
  hiçbirinde çıkmaması ve "Temiz Alt parçan yok" notunun görünmesi; temiz konsol.
  Ayrı koşuda karanlık mod ve 390px: rozet görünür, kontrast **9.28:1 / 4.97:1**,
  yatay taşma yok.
- **GERÇEK GARDIROP VERİSİYLE de doğrulandı** (`deneme@gmail.com`, 6 indeksli parça):
  siyah tişört → **siyah pantolon 0.9104** > siyah çanta 0.8643 > beyaz şort 0.8492
  > sneaker 0.8465; siyah çanta → siyah pantolon 0.8801; beyaz yazlık şort →
  sneaker 0.8502, siyah çanta ise en sonda (0.8013). Renk ve resmiyet kümelenmesi
  gözle görülür biçimde doğru.
- **Not — bu gardıropta "Üst" slotu genellikle rastgele doluyor:** tek indeksli
  üst parçası (Colins siyah tişört) kirli, temiz olan (Bershka crop top) ise
  analizsiz. Kombin yine kuruluyor ve rozet çıkıyor (Ayakkabı + Çanta vektörden
  geliyor) — geri düşüşün kategori bazında olmasının pratikteki karşılığı tam
  olarak bu.
- Regresyon: `test-all-endpoints` 72/72, `test-auth` 48/48, `test-stats` 60/60,
  `test-item-outfits` 27/27, `test-clean-status` 26/26, `test-vector` 77/77,
  `test-ai-analysis --kotasiz` 53/53, lint + build temiz.
- **TEST TUZAĞI (iki kez yaşandı):** `assertUuid` eklenince, item id'si olarak
  `'x'` / `'yok-boyle-bir-id'` gibi **yer tutucu** kullanan iki eski kontrol
  kırmızı yandı — ürün hatası değil, fixture hatası. Yer tutucu id'ler biçimi
  geçerli UUID'lerle değiştirildi ve bozuk biçim için AYRI birer kontrol eklendi.
  Ders: id doğrulaması ekleyen bir değişiklik, id'yi önemsemeyen testleri de kırar.

### 2026-08-21 — Gemini Entegrasyonu — Aşama 3: Vektör Veritabanı (ChromaDB)
- **Kapsam: YALNIZCA ALTYAPI.** Analiz tamamlanınca parçanın özeti embedding'e
  çevrilip ChromaDB'ye akıyor ve `GET /clothing-items/:id/similar` en yakın
  komşuları döndürüyor. **Kombin Öner'e DOKUNULMADI** — öneri hâlâ istemci
  tarafında rastgele seçim yapıyor; bağlama işi sonraki aşamanın.
- **Docker Compose'a `chromadb` servisi eklendi** (`chromadb/chroma:1.5.9`,
  `:8000`, `chroma_data` volume). **Sürüm SABİTLENDİ**: Docker Hub'daki
  etiketlerin neredeyse tamamı `.dev` yapısı (günde birkaç kez yayımlanıyor);
  1.5.9 en güncel kararlı sürüm. `latest` kullanılsaydı bir `docker compose pull`
  sunucuyu habersizce başka bir sürüme taşır ve istemci uyumu sessizce bozulabilirdi.
- **YAŞANAN HATA — healthcheck sürekli `unhealthy` kaldı.** İlk sürümde
  `/bin/sh` + `/dev/tcp` kullanılmıştı; `/dev/tcp` bir **bash** özelliğidir ve
  image'ın `sh`'i dash ("cannot create /dev/tcp/...: Directory nonexistent").
  Image'da **curl, wget, nc ve python YOK** — tek HTTP aracı bash. `/bin/bash`
  ile düzeltildi, container artık `healthy` raporluyor.
- **`docker compose down && up -d` sonrası 9 vektörün korunduğu doğrulandı**
  (named volume çalışıyor); iki servis de birlikte ayağa kalkıyor.
- **`chromadb` npm 3.5.0 kuruldu.** Paket ESM ama `require` dışa aktarımı var,
  CommonJS backend ile sorunsuz çalışıyor.
- **EMBEDDING MODELİ ÖLÇÜMLE SEÇİLDİ — istenen `text-embedding-004` ARTIK YOK:**
  çağrıldığında `404 ... is not supported for embedContent`. (Aşama 1'deki
  model emekliliği hikâyesinin aynısı.) API'nin listesinde embedding destekleyen
  üç model dönüyor: `gemini-embedding-001`, `gemini-embedding-2`,
  `gemini-embedding-2-preview`. İlk ikisi gerçekten **çağrılarak** doğrulandı:
  üçü de **3072 boyut**, ~300–500 ms. Varsayılan **`gemini-embedding-001`**
  (GA ve en uzun süredir kararlı olan), `GEMINI_EMBEDDING_MODEL` ile değiştirilebilir.
- **`taskType: SEMANTIC_SIMILARITY`.** Benzer parça araması "hangi belge sorguya
  yakın" işi değil, iki parçanın BİRBİRİNE benzemesi işidir. Yazma ve sorgu
  tarafı aynı görev tipini kullanmalıdır.
- **Boyut indirgeme (`outputDimensionality`) KULLANILMADI.** 3072 float ≈ 12 KB;
  yüzlerce parçalık kişisel bir gardırop için önemsiz. İndirgemek, Google'ın
  yeniden normalizasyon şartı yüzünden sessiz bir hata kaynağı olurdu.
- **Yeni katman zinciri `Vector*`:** `config/chroma.js` → `VectorRepository`
  (yalnızca Chroma, **fırlatır**) → `VectorService` (iş mantığı). Depodaki
  desene birebir uyar; tek fark "veritabanı"nın Postgres değil Chroma olması
  (`WeatherRepository` ile aynı gerekçe).
- **VectorService'in İKİ AYRI SÖZLEŞMESİ var ve bu bilinçli:**
  *YAZMA asla fırlatmaz* (embedding bir zenginleştirmedir; Chroma kapalıysa
  kıyafet ve analiz yerinde durur), *OKUMA fırlatır* (`findSimilar` 503 döner —
  sessizce boş liste dönmek "benzer parçan yok" gibi YANLIŞ bir cevap olurdu).
  Ölçüt aynı: o anda cevap bekleyen bir kullanıcı var mı, yok mu.
- **Embedding metni HAM JSON DEĞİL, CÜMLE.** `buildSummaryText` ai_analysis'i
  "Koton beyaz keten şort (Keten Şort). Alt kategorisinde bir parça. Baskın rengi
  Beyaz. … Crop top ve Sandalet ile iyi gider." biçimine çevirir. Sebep: embedding
  modeli doğal dilde eğitilmiştir; anahtar adları (`kesim_tipi`, `alt_kategori`)
  anlam taşımayan gürültüdür. Kullanıcının kendi yazdığı ad ve marka da metne
  katılır — "Bershka crop top" bilgisi yalnızca orada var.
- **Küçük dil düzeltmesi:** ten tonu cümlesi "Sıcak ten **ten** tonuna uygun"
  diye tekrarlıyordu (değerler zaten "Sıcak ten" biçiminde geliyor); "tonuna
  uygun" olarak düzeltildi.
- **KONTROL SIRASI MALİYET İÇİN ÖNEMLİ:** önce "bu parçanın vektörü var mı" diye
  Chroma'ya sorulur, sonra Gemini'ye gidilir. Ters sırada olsaydı Chroma
  kapalıyken her denemede gerçek para harcanır ve sonuç yazılamadan atılırdı.
  Test bunu ayrıca doğruluyor.
- **Metadata yalnızca DEĞİŞMEYEN alanlardan:** `user_id`, `category_id`, `sema`,
  `embedding_modeli`, `olusturma`. `is_clean`/`is_favorite` konsaydı her toggle'da
  Chroma'yı da güncellemek gerekirdi; güncellenmese filtre bayat veriyle çalışırdı.
  **Değişken durum daima Postgres'ten okunur.**
- **Chroma'nın kendi embedding fonksiyonu DEVRE DIŞI bırakıldı.** Koleksiyona,
  çağrıldığında hata fırlatan açık bir fonksiyon veriliyor. Varsayılan
  bırakılsaydı istemci her koleksiyon açılışında "@chroma-core/default-embed
  kurun" uyarısı basıyordu (ölçüldü: koleksiyon başına 4 satır) ve bir gün
  gerçekten metinden embedding üretmeye kalkışabilirdi — bizim modelimizle
  uyumsuz vektör demekti.
- **Tetikleme:** `ClothingAnalysisService` analizi KOLONA YAZDIKTAN SONRA
  `indexItemInBackground` çağırır ve await etmez (sıra önemli: embedding'in
  kaynağı `ai_analysis`). Silme `ClothingItemController.delete` içinde,
  `res` gönderildikten sonra. Her iki bağımlılık da **opsiyonel**.
- **`GET /clothing-items/:id/similar`** — doğrulama ucu. `limit` (varsayılan 5,
  en fazla 20) ve `categoryId` opsiyonel. **Sorgu daima `user_id` ile filtrelenir**
  (filtresiz bir vektör sorgusu başkalarının gardıroplarını döndürürdü); parçanın
  kendisi elenir; sonuçlar Postgres'ten zenginleştirilir, böylece silinmiş bir
  parça Chroma'da kalsa bile yanıta sızmaz. Henüz indekslenmemiş parça hata değil,
  `{"indekslendi": false, "sebep": …}` ile bildirilir.
- **İki depo arasında işlem bütünlüğü YOK ve olması da beklenmiyor.** Postgres tek
  doğru kaynak, Chroma türetilmiş veri. Tutarsızlık üç yerde karşılanıyor:
  `findSimilar` Postgres'ten doğruluyor, **`cleanup.js` artık öksüz vektörleri de
  siliyor**, `create-embeddings.js` eksikleri dolduruyor.
- **Yeni script `create-embeddings.js`:** analizi olup embedding'i olmayan
  parçaları toplu doldurur. **Varsayılan SALT OKUNUR** (`analyze-existing-items.js`
  kalıbı). N metni TEK istekte gönderir (`indexItems`, `BATCH_SIZE = 20`).
  `--sifirla` koleksiyonu siler — embedding modeli değiştiğinde ZORUNLU, çünkü
  farklı modellerin vektörleri aynı uzayda değildir.
- **Doğrulama — `test-scripts/test-vector.js`, 76 kontrol:**
  - *Birim (45) CHROMA VE ANAHTAR GEREKTİRMEZ* (`--birim`): embedding metninin
    her alanı, makyaj şeması, eksik/boş analiz; ve asıl güvence — Chroma ya da
    embedding API'si çöktüğünde **servisin fırlatmaması ve yarım veri yazmaması**;
    maliyet koruması; `force`; in-flight muhafızı; kota soğuması; yeniden deneme;
    `CHROMA_ENABLED=false`; **okuma yolunun 503 fırlatması**; ve **sorguda
    kullanıcı filtresinin bulunması**.
  - *Bağlantı (4):* container ayakta, Postgres ile birlikte çalışıyor, koleksiyon
    açılıyor ve sayılabiliyor.
  - *Gerçek embedding + benzerlik (27):* **kontrollü veriyle** — iki beyaz üst,
    bir siyah bot, bir ruj. `ai_analysis` **elle yazılır** (Gemini'ye görsel
    analizi yaptırılmaz): hem günlük `generateContent` kotasına bağlı kalmamak
    hem de "iki beyaz üst yakın çıkmalı" iddiasını DETERMİNİSTİK sınamak için.
    Embedding çağrıları gerçektir. **Sonuç: beyaz bluz 0.9555, ruj 0.7977,
    bot 0.7973** — iki beyaz üst açık ara en yakın. Ayrıca kategori filtresi,
    `limit`, bozuk `limit`, token'sız 401, başkasının parçası için 404,
    **başka kullanıcının neredeyse aynı parçasının sonuçlara sızmaması** ve
    kıyafet silinince vektörünün de silinmesi.
  - *KRİTİK — Chroma erişilemezken (9):* script **ikinci bir sunucu açar**
    (`:3198`, ölü Chroma portu) ve kıyafet akışının kırılmadığını kanıtlar:
    sunucu açılıyor, kayıt/kıyafet 201, kayıt okunabiliyor, analiz kolonu
    etkilenmiyor, süreç çökmüyor — ve `/similar` **503 ile açıkça** bildiriyor.
- **YAŞANAN TEST HATASI (kendi varsayımım):** "makyaj ürünü en uzak çıkmalı"
  diye bir kontrol yazmıştım; ruj 0.7977, bot 0.7973 çıktı — fark gürültü
  seviyesinde ve böyle bir kural yok. Kontrol, gerçekten kararlı olan özellikle
  değiştirildi: **ilgisiz parçaların hepsi benzer parçadan belirgin biçimde
  (>0.1) uzak** (ölçülen ayrım ~0.16).
- **Gerçek gardırop verisiyle de doğrulandı:** siyah tişört → siyah pantolon
  (0.9104) > siyah çanta (0.8643) > beyaz şort (0.8492) > sneaker (0.8465) >
  ruj (0.8041). Renk ve resmiyet kümelenmesi gözle görülür.
- Regresyon: `test-all-endpoints` 72/72, `test-auth` 48/48, `test-stats` 60/60,
  `test-item-outfits` 27/27, `test-clean-status` 26/26,
  `test-ai-analysis --kotasiz` 53/53, lint + build temiz.
  (`test-ai-analysis`'in gerçek analiz bölümü ve `test-gemini`'nin analiz bölümü
  **günlük `generateContent` kotası dolu olduğu için** koşulmadı — embedding ucu
  ayrı bir kotadan besleniyor ve sorunsuz çalıştı.)

### 2026-08-21 — Gemini Entegrasyonu — Aşama 2: Otomatik Kıyafet Analizi
- **Ne eklendi:** Bir parçaya fotoğraf yüklendiğinde Gemini **arka planda**
  kategoriye özgü bir şemayla analiz ediyor; sonuç yeni `clothing_items.ai_analysis`
  (JSONB) kolonuna yazılıyor ve Kıyafet Detay'daki **"Bu Parça Hakkında"**
  bölümünde gösteriliyor. **ChromaDB / vektör veritabanına dokunulmadı** —
  o Aşama 3'ün işi.
- **Migration `005_add_ai_analysis.sql`:** `ai_analysis JSONB`, **nullable ve
  varsayılansız**. Şema kategoriye göre DEĞİŞTİĞİ için (giyim / ayakkabı / çanta /
  makyaj farklı alanlar taşır) sabit kolonlara açmak altı ayrı tablo ya da
  onlarca çoğu boş kolon demekti. `COMMENT ON COLUMN` eklendi — DBeaver kolon
  açıklamasında görünüyor. Ayrıca **kısmi index**: analiz edilmiş satırlar
  index'e hiç girmediği için "analiz bekleyenler" sorgusu ucuz, index küçük.
- **Kategori bazlı prompt — `GeminiService.buildPromptForCategory()`.** Onaylanan
  dört şema: giyim (Üst/Alt/Elbise), ayakkabı (+`topuk_yuksekligi`,
  `ayakkabi_turu`), çanta (+`boyut`, `canta_turu`), makyaj (tamamen ayrı).
  Ayakkabı ve çanta giyim şemasını **genişletir**, kopyalamaz. Tanınmayan
  kategori en genel şemaya (giyim) düşer — hiç analiz etmemekten iyidir.
- **Prompt alan AÇIKLAMALARIYLA örnekleniyor.** Yalnızca anahtar listesi
  verildiğinde model "stil" alanına paragraf, "renk" alanına "açık pembeye çalan
  bir ton" gibi cümleler yazıyordu; her anahtarın yanına beklenen biçim örneği
  konunca kısa etiketler geldi.
- **Yanıt ŞEMAYA OTURTULUYOR** (`#normalizeToSchema`): eksik alanlar `null`/`[]`
  ile tamamlanır, fazlalıklar atılır, dizi/metin tip karışması düzeltilir,
  "bilinmiyor / belirsiz / yok" gibi yer tutucular `null`'a indirgenir, metinler
  120 (açıklama 400) karaktere, listeler 4 öğeye kırpılır. Böylece arayüz her
  alanın var olduğuna güvenebilir ve modelin biçimden sapması sayfayı kırmaz.
- **YENİ SERVİS `ClothingAnalysisService` — GeminiService'ten AYRI.** GeminiService
  "görseli gönder, şemaya oturt" der ve **fırlatır**; ClothingAnalysisService
  "hangi parça, ne zaman, kaç kez" der ve **ASLA FIRLATMAZ**. Ayrım olmasaydı
  maliyet koruması, eşzamanlılık ve kota mantığı prompt koduna karışırdı.
- **KRİTİK SÖZLEŞME: analiz kıyafet eklemeyi ASLA engellemez.** Gemini düşse,
  kota dolsa, dosya kaybolsa, veritabanı yazması patlasa bile kıyafet kaydı
  yerinde durur ve kullanıcı hiçbir hata görmez; kolon NULL kalır. Her yol bir
  `durum` nesnesiyle biter (`tamamlandi` / `atlandi` / `basarisiz`) ve sessizce
  loglanır.
- **Tetikleme controller'da, `res.json()`'DAN SONRA ve `await` EDİLMEDEN.**
  "Önce cevapla, sonra çalış" bir HTTP sınırı kararıdır — `ClothingItemService`
  isteğin ne zaman bittiğini bilmez. Analiz servisi controller'a **opsiyonel**
  bağımlılıktır: verilmezse fotoğraf yükleme eskisi gibi çalışır.
- **MALİYET KORUMASI:** `ai_analysis` doluysa Gemini'ye **hiç gidilmez**.
  `analyzeItem(id, { force: true })` yolu duruyor ama arayüzde tetikleyicisi yok
  (istenmedi). Yan etkisi bilinçli: fotoğraf değiştirilse bile eski analiz kalır —
  "Eksikler" tablosuna işlendi.
- **YAŞANAN HATA — in-flight muhafızı çalışmıyordu.** İşaret ilk `await`'ten
  SONRA konuyordu; kayıt okuma asenkron olduğu için iki eşzamanlı tetikleme de
  muhafızı geçiyor ve aynı parça için **İKİ Gemini çağrısı** yapılıyordu.
  Test bunu yakaladı; işaret ilk await'ten önceye alındı.
- **Eşzamanlılık `MAX_CONCURRENT = 2`** (basit semafor). Toplu yükleme tek
  seferde 10 eşzamanlı isteğe dönüşseydi dakikalık kota anında dolardı.
- **ÖLÇÜLDÜ — ücretsiz kota GÜNDE 20 istek**
  (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit 20,
  `gemini-3.6-flash`). Toplu analiz sırasında gerçekten doldu ve koruma tam
  tasarlandığı gibi davrandı: soğuma başladı, sunucu ayakta kaldı, kalan parçalar
  analizsiz kaldı, kullanıcıya hiçbir şey yansımadı. Soğuma süresi Gemini'nin
  bildirdiği `retryDelay` ile varsayılanın **büyüğü** olarak alınıyor — servisin
  istediğinden erken dönmek yeni bir 429'dan başka bir şey getirmezdi.
- **Sınırlı yeniden deneme eklendi (`MAX_ATTEMPTS = 2`).** Ölçümde aynı model aynı
  fotoğraf için bir koşuda 6 sn, bir koşuda 30 sn'yi aşarak zaman aşımına düştü;
  denemesiz bırakıldığında tek bir sıçrama parçayı **kalıcı olarak** analizsiz
  bırakıyordu (ilk test koşusunda Makyaj parçası tam olarak böyle kaçtı).
  Yalnızca GEÇİCİ hatalar denenir; geçersiz anahtar / kota / bulunamayan model
  denenmez — ikinci çağrı yalnızca kota harcardı.
- **Frontend:** yeni `components/AiAnalysisPanel.jsx`. İki sütunlu ızgaranın
  **altında, tam genişlikte** (sağ sütun yarım genişlik, kartlar oraya sıkışırdı).
  `ai_analysis` boşsa bileşen `null` döner — bölüm hiç görünmez, boşluk da kalmaz.
  Analiz sürerken başlıkta **"Yapay zekâ inceliyor"** rozeti çıkar; sayfa 5 sn
  aralıkla en fazla 14 kez yoklar (backend'in en kötü senaryosu ≈ 62 sn) ve süre
  dolunca **sessizce** durur.
- **YAŞANAN HATA — JSONB anahtar sırasını KORUMAZ.** Kartların backend'deki şema
  sırasında çıkacağı sanılmıştı; ekran görüntüsünde "Baskın Renk, Stil, Boyut,
  Çanta Türü, Tür…" gibi rastgele bir sırayla çıktı. Sebep: JSONB anahtarları
  uzunluk + bayt sırasına göre yeniden dizer (`json` korurdu ama indekslenemez).
  Gösterim sırası artık arayüzde `ALAN_ETIKETLERI` / `UYUMLULUK_ETIKETLERI`
  anahtar sırasıyla tanımlı; etiketi olmayan alan kaybolmaz, sona düşer.
- **Kaynak gizlenmiyor:** panelin altında "gemini-3.6-flash ile otomatik
  oluşturuldu · 21 Ağustos 2026" dipnotu var — kullanıcı bunun editöryal bir
  insan yorumu değil, otomatik bir analiz olduğunu bilmeli.
- **Yeni yardımcı script `analyze-existing-items.js`:** bu özellikten önce
  eklenmiş parçaları toplu analiz eder. **Varsayılan davranış SALT OKUNURDUR**
  (`migrate-passwordless-users.js` kalıbı) çünkü her çağrı gerçek para harcar;
  `--uygula` ve `--limit N` ile çalıştırılır.
- **Doğrulama — `test-scripts/test-ai-analysis.js`, 90 kontrol:**
  - *Birim bölümü (40) ANAHTAR VE SUNUCU GEREKTİRMEZ* (`--birim`, saniyeler
    sürer): dört şemanın prompt'ları, kategori→şema eşlemesi ve asıl güvence —
    Gemini fırlattığında / zaman aşımında / kota dolduğunda / veritabanı yazması
    patladığında **servisin fırlatmaması ve kolona yarım veri yazmaması**;
    maliyet koruması; `force`; in-flight muhafızı; eşzamanlılık sınırı;
    yeniden deneme kuralları; soğuma süresi.
  - *KRİTİK uçtan uca (13):* script **ikinci bir sunucu açar** (`:3199`,
    geçersiz `GEMINI_API_KEY`) ve kıyafet eklemenin hâlâ çalıştığını kanıtlar:
    sunucu açılıyor, kayıt/kıyafet/fotoğraf 201-200, analiz başarısız olduktan
    SONRA sunucu ayakta, süreç çökmemiş, `ai_analysis` NULL, fotoğraf yerinde,
    hata yalnızca loglanmış.
  - *Gerçek analiz (37):* **3 farklı kategoriden gerçek fotoğrafla** (Üst,
    Ayakkabı, Makyaj) — kolona yazılma, şemanın kategoriye göre seçilmesi,
    kategoriye özgü alanların varlığı, uyumluluk dizileri, değerlerin paragraf
    değil kısa etiket olması, liste sınırı, markdown çitinin sızmaması ve
    **aynı parçanın tekrar yüklenmesinde yeniden analiz EDİLMEMESİ**.
  - Sonuçlar gerçek veriyle tutarlı: New Balance 530 → *Sneaker / Beyaz / Düz
    topuk*, Guess çanta → *El Çantası / Siyah / Kapitone*, Maybelline →
    **ambalajdan okuyarak** *"Maybelline New York Lifter Gloss - Moon" /
    Dudak Parlatıcısı*.
  - *Tarayıcıda (20 kontrol, Playwright + sistem Chrome):* bölümün görünmesi,
    değerlerin basılması, uyumluluk etiketleri, ham anahtar adının
    (`alt_kategori`) sızmaması, **analizi olmayan parçada bölümün HİÇ çıkmaması**,
    "inceliyor" rozeti, karanlık modda token'ların çalışması, 390px'te taşma
    olmaması, temiz konsol.
- **Test verisi BİLEREK silinmiyor:** `ai_analysis`'in gerçekten dolduğu DBeaver'da
  gözle görülebilsin diye script sonda çalıştırılacak SQL'i yazdırır
  (`jsonb_pretty(ai_analysis)`); temizlik `--cleanup` ya da `cleanup.js` ile.
  Ayrıca mevcut gardıroptaki 5 gerçek parça analiz edilmiş durumda bırakıldı.
- Regresyon: `test-all-endpoints` 72/72, `test-auth` 48/48, `test-stats` 60/60,
  `test-item-outfits` 27/27, `test-clean-status` 26/26, lint + build temiz.
  `test-gemini` (Aşama 1) 10 kontrol geçti, analiz bölümü **günlük kota dolduğu
  için** koşamadı — bu çalışmayla ilgisi yok, kota ertesi gün sıfırlanır.
- **Windows notu:** `docker exec … psql -f /tmp/m.sql` Git Bash'te yol dönüşümüne
  takılıyor (`/tmp/…` Windows yoluna çevriliyor). Başına `MSYS_NO_PATHCONV=1`
  eklemek gerekiyor.

### 2026-08-21 — Gemini entegrasyonu — Aşama 1 (bağlantı kanıtı)
- **Kapsam:** yalnızca Gemini'nin çalıştığını kanıtlamak. Yeni katman
  (`config/gemini.js` → `GeminiService` → `GeminiController` → `geminiRoutes`) ve
  **geçici** bir uç: `POST /api/gemini/test-analyze`. Otomatik kıyafet analizi ve
  vektör veritabanı **bu aşamanın kapsamı dışında** — kod o yönde genişletilebilir
  bırakıldı ama hiçbir ürün akışına bağlanmadı.
- **SDK: `@google/genai` kuruldu, `@google/generative-ai` DEĞİL.** İstenen paket
  Google'ın eski SDK'sı: 0.24.1'de kalmış, Nisan 2025'ten beri güncellenmemiş,
  hiç 1.0'a ulaşmamış. Yerini alan resmi paket `@google/genai` (googleapis/js-genai,
  o sırada 2.18.0, iki gün önce güncellenmiş). Bu dosyalar sonraki aşamaların
  temeli olduğu için bakımlı olan seçildi. CommonJS ile sorunsuz çalışıyor.
- **MODEL SEÇİMİ ÖLÇÜMLE YAPILDI — istenen iki model de artık yok:**
  - `gemini-1.5-flash` ve `gemini-2.0-flash`: API'nin model listesinde **hiç
    dönmüyorlar**, emekliye ayrılmışlar.
  - `gemini-2.5-flash`: **listede görünüyor ama çağrıldığında 404**:
    *"no longer available to new users. Please update your code to use
    models/gemini-3.6-flash"*. **Alınan ders: listede olmak kullanılabilir olmak
    değildir** — model seçerken gerçekten çağırarak doğrulayın.
  - `gemini-3.7-flash`: çağrıldığında `503 high demand`.
  - **Varsayılan `gemini-3.6-flash`** (Google'ın kendi hata mesajındaki öneri).
    Gerçek bir kıyafet fotoğrafıyla `gemini-3.5-flash` ile karşılaştırıldı: 3.6
    iki koşuda da aynı etiketi verdi ("Crop Top"), 3.5 bir koşuda "tişört"e kaydı.
  - Model `GEMINI_MODEL` ile değiştirilebilir: emeklilikler sık yaşandığı için
    kod değil yapılandırma güncellensin.
- **Zaman aşımı 30 sn.** Ölçümde aynı model aynı fotoğraf için bir kez 4.4 sn,
  bir kez 20.4 sn sürdü; `WeatherService`'teki 5 sn burada yetmezdi. Zaman aşımsız
  bırakmak ise isteği tutan HTTP bağlantısını askıda bırakırdı.
- **Görsel DİSKE YAZILMAZ.** `config/upload.js`'e `uploadImageToMemory` eklendi
  (aynı fileFilter ve 5 MB sınırı, `multer.memoryStorage`). Mevcut `uploadImage`
  diskStorage kullanıyor; onunla analiz edilen her görsel `uploads/` altında
  hiçbir kaydın referans vermediği **öksüz bir dosya** olarak kalırdı. Test bunu
  ayrıca doğruluyor (analiz sonrası dosya sayısı değişmiyor).
- **Hatalar 500 değil 503.** `utils/errors.js`'e `ServiceUnavailableError` eklendi.
  500 "bizim kodumuz patladı" der ve kullanıcıya hiçbir şey anlatmaz; 503
  "bağımlı olduğumuz servis kullanılamıyor" der (`/health` de aynı kodu kullanır).
  Ayrı ayrı Türkçeleştirilen durumlar: anahtar yok, anahtar geçersiz, yetki
  reddedildi, kota doldu, model bulunamadı, zaman aşımı, JSON çözülemedi.
  **Ham SDK hatası asla sızmaz** — yığın izi ve anahtar parçası içerebilir;
  test bunu ayrıca kontrol ediyor.
- **Anahtar yoksa sunucu PATLAMAZ** (`WEATHER_API_KEY` ile aynı yaklaşım,
  `JWT_SECRET`'in aksine): anahtarsız kurulumda uygulamanın geri kalanı tam
  çalışır, yalnızca bu uç 503 ile "anahtar tanımlı değil" der ve dış servise
  **hiç gidilmez**.
- **İstemci önbelleği anahtara bağlandı.** Yalnızca istemci saklansaydı çalışma
  anında `GEMINI_API_KEY` değiştiğinde eski anahtarlı istemci sessizce kullanılmaya
  devam ederdi; testte geçersiz anahtar senaryosunu sürmek de imkânsız olurdu.
- **Uç korumalıdır** (token ister) — aksi hâlde API anahtarımız herkese açık bir
  Gemini vekiline dönüşürdü. Kimlik `req.userId`'den okunur.
- **Doğrulama — `test-scripts/test-gemini.js`, 20 kontrol:**
  - *Birinci bölüm geçerli anahtar OLMADAN çalışır* (`test-weather.js` kalıbı):
    görselsiz istek 400; anahtarsız 503 + "GEMINI_API_KEY ekleyin"; **gerçekten
    geçersiz bir anahtarla Gemini'ye gidilip** 503 + Türkçe mesaj alınması ve ham
    SDK hatasının sızmaması.
  - *HTTP:* token'sız 401, dosyasız 400, görsel olmayan dosya 400.
  - *Gerçek analiz:* `uploads/` içindeki en büyük fotoğraf (ya da `--image`) ile
    200, `model`/`analysis`/`raw` alanları, `kategori`/`renk`/`stil` alanlarının
    dolu olması, değerlerin **paragraf değil kısa etiket** olması, ham yanıtın
    markdown çiti içermemesi, süre < 30 sn.
  - **Sonuç gerçek veriyle doğrulandı:** Gemini `{"kategori":"Crop Top",
    "renk":"Pembe","stil":"Günlük"}` döndürdü; aynı fotoğrafın veritabanındaki
    kendi kaydı **"Bershka crop top / Pembe / Üst"** — tür ve renk birebir tutuyor.
- Regresyon: `test-all-endpoints` 72/72, `test-auth` 48/48, `test-stats` 60/60,
  `test-item-outfits` 27/27, `test-clean-status` 26/26.
  `test-image-upload` yine 26/3 — **bilinen ortam sorunu**: script `uploads/`
  dosyalarını MUTLAK sayar, klasörde 8 gerçek kullanıcı fotoğrafı var. Bu
  çalışmayla ilgisi yok (Gemini ucu diske hiç yazmıyor).

### 2026-08-21 — Kombin paylaşımı: Story oranında PNG indirme (html-to-image)
- **Ne eklendi:** Kombin Öner'deki öneriye ve Kombinlerim'deki HER kombine "Paylaş"
  düğmesi. Kombin, **1080×1920** (Instagram Story) bir PNG olarak indiriliyor:
  üstte marka yazısı, ortada parçaların kolajı, altta durum ve tarih.
- **Kütüphane seçimi — html-to-image.** İstenen iki seçenekten html2canvas'ın son
  gerçek sürümü **Ocak 2022** (v1.4.1), html-to-image ise aktif bakımda (2025).
  Teknik olarak da belirleyici: html-to-image SVG `<foreignObject>` içinde
  **tarayıcıya** çizdirir, dolayısıyla Tailwind v4'ün ürettiği
  `color-mix(in oklab, …)` değerlerini anlar; html2canvas kendi CSS ayrıştırıcısını
  kullandığı için modern renk fonksiyonlarında kırılır.
- **Görsel DAİMA AÇIK MOD.** Kart, Tailwind token'ı değil **sabit hex + satır içi
  stil** kullanır. Token kullanılsaydı karanlık modda koyu bir kart üretilirdi;
  oysa paylaşılan görsel kullanıcının ekran tercihine değil markaya aittir.
  Test bunu karanlık modda indirip **PNG'nin köşe pikselini okuyarak** doğrular
  (`247,243,237` = ivory).
- **Fotoğraflar önce `data:` URI'ye çevrilir** (`fetch` + `FileReader`). Backend
  `:3001`, uygulama `:5173` olduğu için aksi hâlde canvas "tainted" olabilir veya
  serileştirmede görsel yüklenemezdi. Alınamayan fotoğraf `null` kalır → o parça
  yer tutucuyla çizilir; tek bir görsel hatası paylaşımı engellemez.
- **ÜÇ GERÇEK TUZAK yaşandı, üçü de kodda yorumlandı:**
  1. **PNG bomboş çıktı.** Kartın kendisinde `position:fixed; left:-10000px` vardı;
     html-to-image yakaladığı düğümün hesaplanmış stillerini klona da kopyaladığı
     için klon da ekran dışına konumlanıyordu. Çözüm: **kart statik konumlanır**,
     ekran dışına taşıma işi `ShareButton`'daki sarmalayıcıya ait. (`display:none`
     de olamaz — o hâlde ölçü sıfır olur.)
  2. **Fotoğraflı kombinde üretim ASKIDA KALDI** (fotoğrafsız çalışıyordu).
     Sebep `cacheBust: true`: kütüphane bunu her kaynak URL'sinin sonuna
     `?<zaman>` ekleyerek uygular ve bu, gömülü `data:` URI'nin base64 yükünü
     bozuyordu. Gömülü veride önbellek sorunu zaten yok — seçenek kaldırıldı.
  3. **`cardRef.current` null kaldı** (yine yalnızca fotoğraflı kombinde).
     `setCardItems` sonrası DOM'un hazır olduğu garanti değil; `setTimeout(0)` ile
     beklemek fotoğrafsızda tesadüfen çalışıyordu, `embedItemImages`'in await'i
     zamanlamayı kaydırınca kırıldı. Çözüm: **`flushSync`** ile senkron commit.
- **Düzen kuralı:** ızgara iki sütun; parça sayısı **tekse son parça iki sütuna
  yayılır**, yoksa sağ altta boş hücre kalırdı. Parçalar giyim sırasına
  (`Üst → Elbise → Alt → Ayakkabı → Çanta`) dizilir, API sırasına göre değil.
- **Hata yolu:** görsel üretimi tarayıcıya bağlıdır; başarısızlıkta `try/catch`
  nazik bir Türkçe mesaj gösterir, **sayfa çökmez** ve düğme yeniden denenebilir
  hâle döner. Üretim sırasında düğme "Hazırlanıyor..." + dönen ikon gösterir.
- **Gizli kart yalnızca üretim sırasında DOM'dadır**; iş bitince kaldırılır.
  Sürekli duran bir kopya, her kombin kartı için ekstra DOM ve görsel yükü demekti.
- **Doğrulama — gerçek tarayıcıda 29 kontrol.** İndirme Playwright ile yakalanıp
  dosya diske yazıldı, sonra PNG **geri açılıp piksel örneklendi**:
  Story ölçüsü (1080×1920), dosya adının occasion'dan türemesi, zeminin ivory
  olması, **gömülü fotoğrafların gerçekten görselde çıkması** (test için yüklenen
  düz mavi `0,128,255` ve magenta `255,0,128` karolar birebir okundu),
  2/3/4 parçalı düzenlerin bozulmaması, **karanlık modda bile açık mod renkleri**,
  Kombin Öner sayfasından paylaşım, konsolun temiz kalması ve `getContext`
  bozulduğunda nazik hata + sayfanın ayakta kalması.
- Regresyon: statik kontrast denetimi 40/40, karanlık mod akışları 36/36,
  hover kontrastı 10/10, istatistik kartı 37/37, `test-stats` 60/60,
  `test-all-endpoints` 72/72, `test-auth` 48/48, `test-item-outfits` 27/27,
  `test-clean-status` 26/26, lint + build temiz.
- **Açık iş — mobil indirme.** Görsel üretimi platformdan bağımsız çalışır ama
  indirme `<a download>` ile yapılır; Android WebView'de bu desteklenmeyebilir.
  Denenmedi (web önceliklendirildi). Gerekirse Capacitor Filesystem + Share
  eklentisine geçilmelidir; `downloadBlob` bu ayrımı tek noktada tutuyor.

### 2026-08-20 — `rose` butonunun hover hâli AA'ya çıkarıldı
- `Button` `rose` varyantında `hover:bg-dusty-rose` → **`hover:bg-accent-ink`**.
  Açık modda hover dolgusu açık rose (`#c9a0a0`), üstündeki metin ise `on-primary`
  (krem) olduğu için **2.11:1** kalıyordu — buton hover'landığında yazısı
  okunmuyordu. Artık **4.97:1**.
- Tek kullanım yeri: Kombin Öner'deki **"Bu Kombini Kaydet"**.
- **Karanlık mod etkilenmez:** orada `accent-ink` ile `dusty-rose` aynı değeri
  (`#d9b3b3`) alır; hover zaten 9.28:1 idi ve öyle kaldı.
- **Kenarlık bilinçli olarak `dusty-rose` bırakıldı.** Açık modda hover'da açık rose
  kenarlık + koyu dolgu oluşuyor (2.36:1 fark); ekran görüntüsüyle bakıldığında bu
  bir hata gibi değil, hapın kenarını yumuşatan ince bir rim gibi duruyor.
  Karanlıkta kenarlık ile dolgu zaten birebir aynı (1.00).
- **Yeni test: hover kontrastı ölçen script.** Depodaki statik denetim yalnızca
  dinlenme hâlini ölçüyordu — bu satırın gözden kaçmasının sebebi buydu. Yeni script
  fareyi gerçekten butonun üstüne getirip hesaplanmış rengi okuyor: **10/10**
  (açık: dinlenme 4.97, hover 4.97; karanlık: 9.28 / 9.28; dolgunun gerçekten
  `accent-ink` olduğu ve konsolun temiz kaldığı da doğrulanıyor).
- **Test tuzağı:** "Bu Kombini Kaydet" ancak öneri ÜRETİLDİKTEN sonra DOM'a gelir ve
  öneri, **durum pill'ine** tıklayınca üretilir — formdaki "Kombin Öner" butonu
  yalnızca serbest metin girilmişse çalışır, boş girdiyle tıklamak hiçbir şey yapmaz.
  Ayrıca buton `disabled` iken `disabled:pointer-events-none` yüzünden **hover hiç
  uygulanmaz**; hover ölçen testin önce geçerli bir öneri üretmesi şarttır.
- Regresyon: statik kontrast denetimi 40/40 (her iki tema AA), karanlık mod akışları
  36/36, istatistik kartı 37/37, `test-stats` 60/60, `test-all-endpoints` 72/72,
  `test-auth` 48/48, `test-item-outfits` 27/27, `test-clean-status` 26/26,
  lint + build temiz.

### 2026-08-20 — Açık modda vurgu metinleri WCAG AA'ya çıkarıldı (`accent-ink`)
- **Sorun:** `text-dusty-rose` (`#c9a0a0`) ile yazılan mikro etiketler açık zeminde
  okunmuyordu: beyaz kartta **2.33:1**, ivory sayfada **2.11:1** — AA eşiği 4.5:1.
  Etkilenenler: "Kombin Önerisi" eyebrow'ları, kart kategori etiketleri, kombin durum
  etiketleri, "Premium Abonelik" ve dusty-rose ikonlar.
- **Token KOYULAŞTIRILMADI, İKİYE AYRILDI.** `--color-dusty-rose` tek başına
  koyulaştırılsaydı sayfa başlıklarının altındaki `h-px w-16` ince çizgi, kart hover
  kenarlıkları ve `border-dusty-rose/40` çerçeveler de koyulaşırdı — yani genel tasarım
  değişirdi. Bunun yerine **`--color-accent-ink`** eklendi: aynı vurgunun *metin* tonu.
  `dusty-rose` dekoratif (çizgi/kenarlık/dolgu, 6 dolgu + 24 kenarlık) **aynen kaldı**,
  yalnızca `text-dusty-rose` → `text-accent-ink` değişti (19 dosya).
  Bu, `surface` ve `on-primary` ile aynı desendir: rol ayrışıyorsa token de ayrışır.
- **Renk ölçümle seçildi: `#995656`.** Dusty-rose'un **hue'su (0°) ve doygunluğu
  (%28, orijinal %27.5) korundu**, yalnızca açıklık %71 → %47'ye indirildi — marka
  hissi hue+doygunlukta yaşar, okunabilirlik açıklıkta. Adaylar AA geçen en **açık**
  (yani rose'a en yakın) ton olacak şekilde tarandı.
- **Belirleyici zemin beyaz değil, ivory'dir.** Metin koyu olduğu için ivory (`#f7f3ed`)
  beyazdan daha düşük kontrast verir. Üçüncü ve en dar zemin ise Profil'deki Premium
  kartıdır (`bg-dusty-rose/10` üzerine yazı) — token seçilirken üçü birden denetlendi.
- **Ölçülen sonuç (açık mod):** ivory 4.97:1, beyaz kart 5.50:1, Premium kartı 4.97:1.
  Sayfa bazında en düşük değer **2.11 → 4.97**'ye çıktı.
- **Karanlık mod bu değişiklikten HİÇ etkilenmez.** `.dark` içinde `accent-ink`,
  `dusty-rose` ile aynı değeri (`#d9b3b3`) alır: koyu zeminde açılmış rose zaten
  9.28:1 veriyordu, ayrı bir tona gerek yoktu.
- **Doğrulama:** kontrast denetimi eşiği gerçek **WCAG AA**'ya sıkılaştırıldı (normal
  metin 4.5:1, büyük metin 3.0:1) ve 9 sayfa × 2 tema yeniden gezildi:
  **40/40 — her sayfa, her iki tema AA geçiyor** (açık min 4.97, karanlık min 6.64).
  Öncesinde aynı eşikle 4 sayfa kırmızıydı. 1280px ekran görüntüleriyle etiketlerin
  okunur, dekoratif çizginin ise **değişmemiş** olduğu görsel olarak da doğrulandı.
- Regresyon: karanlık mod akış testleri 36/36, istatistik kartı 37/37,
  `test-stats` 60/60, `test-all-endpoints` 72/72, `test-auth` 48/48,
  `test-item-outfits` 27/27, `test-clean-status` 26/26, lint + build temiz.
- **Kapsam dışı bırakılan ilgili nokta:** `Button` `rose` varyantının **hover** hâli
  (`hover:bg-dusty-rose` + `text-on-primary`) açık modda **2.11:1**'dir. Bu bir etiket
  değil buton dolgusudur ve düzeltmek butonun görünümünü değiştirir; tek kullanım yeri
  Kombin Öner'deki "Bu Kombini Kaydet"tir. Statik denetim hover durumlarını ölçmez,
  bu yüzden 40/40 sonucu bu satırı kapsamaz.
  **→ Bir sonraki kayıtta düzeltildi.**
- **Test tuzağı:** "tekrar açığa dönüyor" kontrolü bir kez haksız yere kırmızı yandı —
  ölçüm 150ms'de yapılıyordu ama tema geçişi **300ms**. Okunan renk animasyonun ara
  karesiydi (`rgb(228,224,218)`), ürün hatası değil. Tema rengi ölçen testler geçiş
  süresinden **sonra** bakmalıdır.

### 2026-08-20 — Karanlık mod (sınıf stratejisi + rol tabanlı token'lar)
- **Yaklaşım: `dark:` varyantı serpiştirmek YERİNE token değerlerini değiştirmek.**
  30+ dosyaya `dark:bg-… dark:text-…` eklemek yerine `.dark` bloğu `@theme`'deki
  `--color-*` değişkenlerini ezer. Sebep dayanıklılık: bir yüzey ile üstündeki metin
  daima aynı token çiftinden geldiği için **"koyu zeminde koyu yazı" yapısal olarak
  imkânsız** hâle gelir. `dark:` yolunda tek bir unutulan sınıf okunmaz bir ekran
  demekti. Sayfa dosyalarında tek bir `dark:` istisnası var (`Modal` paneli).
- **Bu ancak token'lar ROL adı taşıdığı için mümkün oldu.** Depodaki `ivory`/`ink`/
  `warm-gray` adları zaten "sayfa zemini / metin / yer tutucu" demekti; iki eksik rol
  eklendi: **`surface`** (kart yüzeyi, 17 yerdeki `bg-white`'ın yerine) ve
  **`on-primary`** (dolu burgundy zemin üstündeki metin, `text-ivory`'nin yerine).
  Bu ikisi olmasaydı karanlık modda kartlar beyaz, buton metinleri görünmez kalırdı.
- **Palet sezgiyle değil ÖLÇÜMLE seçildi.** Aday renkler için WCAG kontrastı
  hesaplandı ve ölçüt "karanlık mod açık modun altına düşmesin" olarak konuldu:
  `ink/zemin` 15.95 (açık 15.71), `ink/40` 3.59 (açık 2.47), `dusty-rose/zemin`
  9.28 (açık 2.11), buton metni 6.64 (açık 7.55). Tablo `index.css` içinde durur.
- **Vurgu renkleri koyu zeminde AÇILIR ve ilişki tersine döner.** `#7a3b3b` bir metin
  rengi olarak `#1c1815` üzerinde okunmaz (1.7:1); karanlıkta `burgundy` `#cf8e8e`
  olur. Dolayısıyla buton artık "koyu dolgu + açık metin" değil **"açık dolgu + koyu
  metin"**tir — `on-primary` token'ının varlık sebebi budur.
- **Zemin sıcak antrasit (`#1c1815`), metin krem (`#f7f3ed`)** — nötr siyah/beyaz
  değil. Amaç açık moddaki "premium, sıcak" hissin karanlıkta da korunması.
- **Üç teknik tuzak (hepsi yaşandı, hepsi ölçülerek yakalandı):**
  1. **`@theme inline` kullanılamaz** — değerleri utility'ye gömer, `.dark` hiç çalışmaz.
     Depoda düz `@theme` var, korunmalı.
  2. **Gölgeler Tailwind'in `--shadow-*` ad alanına konulamaz.** Önce oraya konuldu;
     üretilen CSS `var(--tw-shadow-color,#1c1a172e)` ile değeri GÖMDÜ, yani gölge
     karanlık modda açık kalıyordu. Düz custom property'ye (`--dg-shadow-*`) taşınıp
     `shadow-[var(...)]` ile çağrıldı; build çıktısından `--tw-shadow:var(--dg-shadow-card)`
     olduğu doğrulandı.
  3. **Modal perdesi `bg-ink/40` idi.** `ink` karanlıkta kreme döndüğü için perde,
     sayfayı karartmak yerine **sütlü beyaz bir tüle** dönüşüyordu. Perde bir metin
     rengi değil ÖRTÜCÜDÜR: `--dg-scrim` her iki temada da koyudur
     (açık `rgba(28,26,23,.4)`, karanlık `rgba(0,0,0,.65)`).
- **Veri renkleri temadan bağımsız bırakıldı.** `ColorPicker`'daki onay ikonu token
  kullansaydı karanlık modda ters döner ve **siyah dairede siyah tik** görünürdü;
  sabit `text-[#f7f3ed]` / `text-[#1c1a17]` kullanır. Arkasındaki şey kıyafetin
  gerçek rengidir, bir yüzey değil.
- **FOUC önlendi:** tema `index.html` içindeki satır içi script ile React'tan ÖNCE
  uygulanır; beklenseydi karanlık modda bir kare beyaz flaş görünürdü. Bu mantık
  `lib/theme.js` ile bilinçli olarak tekrarlanır — **ikisi birlikte güncellenmelidir.**
- **Geçiş animasyonu yalnızca değişim anında.** `theme-transition` sınıfı toggle'da
  eklenip 300ms sonra kaldırılır; kalıcı olsaydı uygulamadaki HER hover da 300ms'e
  uzar, arayüz ağırlaşmış hissettirirdi.
- **Sistem tercihi varsayılan, kullanıcı seçimi ezer.** Seçim yapılmadıysa
  `prefers-color-scheme` canlı takip edilir (`watchSystemTheme`) ama bu bir tercih
  olarak **kaydedilmez** — kaydedilseydi sistemi takip etmeyi bırakırdı.
  `color-scheme` de ayarlanır; olmasaydı kaydırma çubuğu ve `<select>` açılır
  listeleri karanlık sayfada beyaz kalırdı.
- **Tema çıkışta silinmez:** `dg_theme` `lib/theme.js`'e aittir ve
  `clearOnboardingState()` kapsamı dışındadır — cihaz tercihi, oturum verisi değil.
- **Doğrulama — iki tarayıcı scripti, toplam 73 kontrol:**
  - *Kontrast denetimi (40 kontrol):* 9 sayfa × 2 tema gezildi ve sayfadaki **her görünür
    metin düğümünün** hesaplanmış rengi ile ARKASINDAKİ gerçek zemin (saydam katmanlar
    ata zincirinde birleştirilerek) bulunup WCAG oranı hesaplandı — "beyaz zeminde beyaz
    yazı" ancak böyle yakalanır. **Karanlık modda her sayfada en düşük değer ≥ 6.64:1.**
  - *Akış ve davranış (36 kontrol):* Giriş/Kayıt/Tarz anketi (chrome-free ekranlar),
    Kıyafet Detay, silme modalı, QuickAddModal, form alanları ve `<select>`'in koyu
    yüzeyde olması, siyah dairedeki onay ikonunun açık kalması, anahtarın **sayfa
    yenilenmeden** çalışması, geçiş sınıfının kaldırılması, `dg_theme`'e yazılması,
    **yenilemede ve sayfa geçişlerinde korunması**, sistem tercihinin varsayılan olması,
    kullanıcı seçiminin sistemi ezmesi, FOUC'un oluşmaması, temiz konsol.
  - 1280px ve 390px ekran görüntüleriyle görsel doğrulama.
  - Regresyon: `test-stats` 60/60, `test-all-endpoints` 72/72, `test-auth` 48/48,
    `test-item-outfits` 27/27, `test-clean-status` 26/26, istatistik kartı tarayıcı
    testi 37/37, lint + build temiz.
- **Denetimin ortaya çıkardığı MEVCUT sorun:** açık modda `text-dusty-rose` mikro
  etiketler beyaz kart üzerinde **2.33:1** ("Kombin Önerisi" eyebrow'ları, kart kategori
  etiketleri, "Premium Abonelik" 2.11:1). Bu, karanlık mod öncesinde de böyleydi —
  `bg-white` → `bg-surface` açık modda birebir aynı `#ffffff` değeridir. O sırada marka
  görünümünü tek taraflı değiştirmemek için dokunulmadı; **bir sonraki kayıtta
  (`accent-ink`) düzeltildi.**

### 2026-08-20 — Profil: "Gardırop İstatistiklerim" kartı (yeni `Stats*` katmanı)
- **Yeni uç `GET /api/users/:id/stats`** — kullanıcının kendi verisinden türetilen özet:
  toplam parça, kategori dağılımı, en çok kullanılan renk, kombin sayısı, en çok
  oluşturulan durum, favori sayısı, temiz/kirli oranı.
- **Hesaplama SQL'de, istemcide değil.** Tüm sayımlar `GROUP BY` / `COUNT` / `FILTER` ile
  veritabanında yapılır; frontend'e ham kayıt değil hazır özet gider. "Tüm parçaları çekip
  istemcide say" yolu seçilmedi: gardırop büyüdükçe yanıt da büyürdü.
- **Yeni katman zinciri `Stats*`** (repository → service → controller → route), depodaki
  katmanlı mimariye birebir uyar. Rota `userRoutes`'a değil **kendi dosyasına** kondu
  (`statsRoutes.js`) — bu ağaç ileride "premium analiz raporu" uçlarını da taşıyacak.
- **Genişletilebilirlik bilinçli olarak kuruldu.** `StatsService` özeti bölümlerden
  (`#buildItemStats`, `#buildOutfitStats`) birleştirir; repository metodları küçük ve tek
  konuludur. Yeni bir analiz eklemek = yeni sorgu + yeni bölüm; **mevcut sorgulara ve uç
  noktanın sözleşmesine dokunmak gerekmez**, yanıt yalnızca yeni bir anahtarla büyür.
- **Yetkilendirme:** kimlik `req.userId`'den okunur, `:id` ile karşılaştırılır ve ihlalde
  **404** döner (403 kaydın varlığını ele verirdi) — `UserService` ile aynı kalıp.
  Sahiplik kontrolü sorgudan ÖNCE yapıldığı için bozuk biçimli bir UUID Postgres'e hiç
  gitmez; `22P02` ile 500'e düşmek yerine 404 döner (ayrı bir `assertUuid` gerekmedi).
- **Tuzak — `COUNT(*)` string döner.** Postgres `COUNT` bigint üretir, `pg` sürücüsü
  bigint'i **string**'e çevirir. Her sayım `::int` ile daraltıldı; olmasaydı yanıtta
  `"11"` (metin) çıkar ve frontend'de `11 + 2 = "112"` gibi sessiz hatalar doğardı.
  Test bunu tip kontrolüyle ayrıca doğrular.
- **Tuzak — eşitlikte sıralama belirsizliği.** "En çok renk/durum" sorgularına ikincil
  sıralama (`ORDER BY count DESC, color ASC`) eklendi; olmasaydı eşit sayıdaki iki renk
  için Postgres rastgele birini döndürür ve test aralıklı kırılırdı.
- **Veri yoksa `null`, uydurma varsayılan değil.** `colors.top` / `top_occasion` boş
  gardıropta `null` döner; `{"name":"Beyaz","count":0}` göstermek yanlış bilgi olurdu.
- **`has_data` sunucuda hesaplanır** — istemcinin boş durumu yeniden türetmesi gerekmesin
  diye. Parçaları silinmiş ama kombini duran kullanıcı da "veri var" sayılır.
- Kategori dağılımında `INNER JOIN` kullanıldı: parçası olmayan kategori listelenmez
  ("0 Makyaj" satırı özeti gereksiz uzatırdı).
- **Frontend:** yeni bileşen `components/WardrobeStats.jsx`, Profil'de hesap bilgileri
  kartlarının hemen altında. Mevcut `StatCard` **olduğu gibi** yeniden kullanıldı
  (Parça / Kombin / Favori, tıklanınca Gardırop ve Kombinlerim'e gider); kategori
  dağılımı `CATEGORY_ICONS`'tan ikon alan haplara, diğer üç istatistik ikon + mikro
  etiket + editöryal cümle satırlarına döküldü.
- **En çok kullanılan renk gerçek renk dairesiyle gösteriliyor** (`getColorSwatch`):
  bir moda uygulamasında "Pudra" adı tek başına soyut kalır. Palette olmayan bir renk
  (elle girilmiş eski kayıt) sessizce ikona düşer.
- **Kart kendi yükleme/hata/boş durumunu sürer.** İskelet yüklenirken gösterilir; istek
  düşerse **yalnızca bu bölüm** hata metnine geçer, profil sayfasının geri kalanı ayakta
  kalır (`ClothingDetail`'deki ayrı-effect kalıbıyla aynı). Yeni kullanıcıya sıfırlarla
  dolu kartlar yerine "Henüz yeterli veri yok…" mesajı + "İlk parçanı ekle" bağlantısı çıkar.
- **Doğrulama:**
  - Yeni `test-scripts/test-stats.js` — **60 kontrol**, üç veri durumu ayrı ayrı:
    **BOŞ** (yeni kullanıcı, `has_data:false`, `null` alanlar, sayım tipleri),
    **AZ VERİ** (tek parça, kombin yok; soft delete sonrası düşmesi),
    **ÇOK VERİ** (10 parça / 5 kombin; renk-kategori-durum dağılımları, sıralama,
    `clean + dirty = total`, kategori toplamı = `items.total`, Türkçe karakterler).
    Yetkilendirme: başkasının id'siyle **404**, 403 DEĞİL, yanıtta veri sızmaması,
    token'sız/bozuk token **401**, bozuk UUID **404** (500 değil).
  - Gerçek tarayıcıda (Playwright + sistem Chrome) **37 kontrol**: boş durum mesajı ve
    bağlantısı, üç `StatCard`'ın `href`/değerleri ve `font-display italic` tipografisi,
    kategori hapları, renk dairesinin gerçekten Siyah'ın hex'iyle boyanması
    (`rgb(28, 26, 23)`), "En çok Akşam Yemeği kombini oluşturdun (2 kez)" cümlesi,
    temiz/kirli satırı, kartın hesap bilgilerinin ALTINDA olması, dusty-rose ayraç,
    kart tıklanınca `/kombinlerim`'in açılması, başka kullanıcıda verinin sızmaması,
    **500 senaryosunda** sayfanın geri kalanının ayakta kalması, temiz konsol.
    Ayrıca 1280px ve 390px'te ekran görüntüsüyle görsel doğrulama yapıldı (mobilde
    3'lü ızgara ve haplar taşmadan sarıyor).
  - Regresyon: `test-all-endpoints` 72/72, `test-auth` 48/48, `test-item-outfits` 27/27,
    `test-clean-status` 26/26, `npm run lint` + `npm run build` temiz.

### 2026-08-20 — Hava durumuna göre kombin önerisi (OpenWeatherMap + sezon)
- **`season` zaten vardı, migration yazılmadı.** `clothing_items.season VARCHAR(20)`
  `001_initial_schema.sql` ile geliyordu; yalnızca hiç kullanılmıyordu (tüm kayıtlarda
  NULL'dı). Bu yüzden **NULL sezon "her mevsim uygun" sayılır** — aksi hâlde özellik
  açılır açılmaz mevcut 9 parçalık gardırobun tamamı öneri dışı kalırdı.
- **Migration `004_add_user_city.sql`:** `users.city VARCHAR(100)`, nullable.
  Şehir zorunlu değildir; boşsa hava durumu **hiç sorgulanmaz**.
- **Yeni katman: `Weather*`** (repository → service → controller → route).
  Repository dış servise bakar ama rolü değişmez: yalnızca veri erişimi, fırlatır.
  Servis sıcaklığı kategoriye çevirir ve **asla fırlatmaz**.
- **Uç her zaman 200 döner** (`{ status: "bilinmiyor" }`). Depodaki `{ error }` kalıbından
  bilinçli sapma: hava durumu isteğe bağlı bir zenginleştirme, hata olarak dönmesi
  frontend'de gereksiz bir kırılma noktası yaratırdı. `reason` alanı teşhis için.
- **`WEATHER_API_KEY` yoksa sunucu PATLAMAZ** — `JWT_SECRET`'in aksine. Gerekçe: JWT'siz
  sunucu güvensiz çalışır, hava durumsuz sunucu yalnızca bir özelliği kaybeder.
  Anahtar yoksa dış servise **hiç gidilmez**.
- **Zaman aşımı zorunlu:** `AbortSignal.timeout(5000)`. Olmasaydı takılan bir
  OpenWeatherMap isteği Kombin Öner sayfasının açılışını süresiz bekletirdi.
- **`UserRepository.SAFE_COLUMNS`'a `city` eklendi.** Bu liste `password_hash`'i dışarıda
  tutmak için var; yeni kolon eklerken **buraya da yazılmalı**, yoksa alan API yanıtına
  hiç düşmez. Testte `password_hash` sızmadığı ayrıca doğrulandı.
- **Önceliklendirme, filtreleme DEĞİL.** `buildRandomOutfit(items, seasons)` uygun
  sezondaki parçaları tercih eder ama o kategoride uygun parça yoksa **tüm havuza
  düşer**. Sert filtre olsaydı hava durumu yüzünden kombin slotları boş kalırdı.
  `Tüm Sezon` ve sezonsuz parçalar her havada uygundur.
- **Şehir listesi sabit** (`src/lib/cities.js`, 20 büyük şehir). Serbest metin girilseydi
  OpenWeatherMap'in tanımadığı adlarla dolar ve hava durumu sessizce hep "bilinmiyor"
  dönerdi. `value` ASCII ("Istanbul") — veritabanına ve API'ye giden; `label` Türkçe
  gösterim ("İstanbul"); sorgu Türkçe karakterlerle güvenilir eşleşmiyor.
- **Dil hatası önlendi — bulunma eki veri olarak tutuluyor.** Not önce sabit `'da`
  ekiyle yazılmıştı; Türkçe ünlü uyumu gereği listenin yarısında yanlış olurdu
  ("İzmir'**de**", "Gaziantep'**te**"). Her şehre `locative` alanı eklendi ve not
  kullanıcının KAYITLI ŞEHİR DEĞERİne bağlandı — OpenWeatherMap'in döndürdüğü ada
  değil, çünkü liste anahtarı odur.
- **Frontend:** `QuickAddModal`'a Sezon seçimi (varsayılan **Tüm Sezon**),
  Hesap Bilgilerim'e Şehir dropdown'u (varsayılan **Seçilmedi**), öneri altında
  "İstanbul'da 27°C, sıcak hava için önerildi." notu (yalnızca hava gerçekten
  dikkate alındıysa görünür).
- **Doğrulama:**
  - `test-scripts/test-weather.js` — **62 kontrol**. Başındaki bölüm `WeatherService`'i
    **sahte repository** ile sürer: eşik sınırları (20/20.1/10/9.9), yuvarlama ve
    **API BOZULDUĞUNDA fırlatmaması** (ağ hatası, zaman aşımı, 404, 401, boş gövde,
    metin/NaN sıcaklık). Bu, gerçek anahtar olmadan test edilemeyecek yolları kapsar.
  - Gerçek tarayıcıda **32 kontrol**: şehir kaydı, hava notu, sıcak/soğuk havada doğru
    sezon seçimi (25'er öneri), **4 ayrı çökme senaryosunda** (500, ağ hatası, bozuk JSON,
    "bilinmiyor") önerinin yine de üretilmesi, şehri olmayan kullanıcıda hava durumunun
    **hiç çağrılmaması**, QuickAddModal sezon seçimi.
  - Regresyon: `test-clean-status` 26/26, `test-all-endpoints` 72/72, `test-auth` 48/48,
    `test-item-outfits` 27/27, tarayıcı testleri 22/22 + 17/17 + 20/20, lint + build temiz.
  - `test-image-upload` yine 26/3 verdi — **bilinen ortam sorunu**, bkz. 2026-08-20
    temiz/kirli kaydı (uploads/ klasöründeki gerçek kullanıcı fotoğrafı mutlak dosya
    sayımını bozuyor). Bu çalışmayla ilgisi yok.
- **Açık iş:** `WEATHER_API_KEY` henüz boş. Anahtar girilene kadar hava durumu her
  zaman "bilinmiyor" döner ve öneri eskisi gibi (temiz/kirli filtresiyle) çalışır.

### 2026-08-20 — Ana Sayfa'daki hızlı kombin kartları işlevsel hale getirildi
- "Üniversite Kombini" ve "Akşam Yemeği Kombini" kartları artık Kombin Öner sayfasını
  **öneri üretilmiş halde** açıyor; kullanıcının ikinci kez tıklaması gerekmiyor.
  Kart metinleri, alt başlıkları, ikonları ve tasarımı **aynen korundu** — yalnızca
  tıklama davranışı gerçek oldu.
- **Router state ile taşınıyor** (StyleQuiz'in `state: { justOnboarded }` kalıbının
  bildirimsel karşılığı): `QuickActionCard` opsiyonel bir `state` prop'u aldı ve
  `<Link state={...}>` olarak geçiriyor. Query param tercih edilmedi — adres çubuğunda
  Türkçe karakterli, kodlanmış bir `?durum=%C3%9Cniversite` bırakması gereksizdi.
- **Yeni ortak modül `src/lib/occasions.js`:** `OCCASIONS` listesi (önceden yalnızca
  `OutfitSuggestion.jsx` içindeydi) ve `OCCASION_STATE_KEY`. Ana Sayfa ile Kombin Öner
  aynı kelimeleri kullanmak zorunda: karttan gelen `occasion` değeri sayfada **aktif pill**
  olarak işaretleniyor. Sayfadan sayfaya import etmek yerine `lib/`e çıkarıldı
  (`colors.js`, `styleQuestions.js` ile aynı desen).
- **Mevcut mantık yeniden kullanıldı:** ayrı bir üretim yolu yazılmadı; efekt doğrudan
  `startSuggestion()`’ı çağırıyor, dolayısıyla temiz/kirli filtresi, "başka öneri",
  kategori notları ve kaydetme akışı aynen geçerli.
- **Önlenen hata — efektin kullanıcının seçimini ezmesi.** Efekt `cleanItems`'a bağlı ve
  `cleanItems`, karttaki temiz/kirli toggle'ıyla değişiyor. Guard olmasaydı: kullanıcı
  karttan gelip "Spor"a geçiyor, sonra bir parçayı kirli işaretliyor → efekt yeniden
  tetikleniyor ve öneri habersizce "Üniversite"ye dönüyordu. `useRef` ile efekt
  **yalnızca bir kez** çalışıyor; test bu senaryoyu açıkça doğruluyor.
- **State bilinçli olarak temizlenmiyor.** Dashboard `justOnboarded`'ı temizler çünkü
  bayat kalması gerçek bir hataya yol açıyordu; burada tersi geçerli: state kalınca
  sayfa yenilendiğinde öneri açık kalıyor. Navbar'dan veya temiz sekmeden girildiğinde
  state zaten oluşmuyor, sayfa normal açılıyor.
- **Efekt gardırop yüklenmeden çalışmaz** (`isLoading`/`hasError` kontrolü):
  `buildRandomOutfit`'in seçecek parçası olmalı. Gardırop boşsa mevcut
  "Önce gardırobunu dolduralım" ekranı, hiç temiz parça yoksa mevcut
  "Şu an temiz parçan yok" ekranı görünür — ikisi de değiştirilmedi.
- **Doğrulama — gerçek tarayıcıda 20 kontrol:** kart metin/tasarımının değişmemesi,
  tıklayınca önerinin otomatik açılması, doğru occasion ve aktif pill, iki kartın farklı
  durum taşıması, ref guard senaryosu, yenileme sonrası korunma, navbar'dan/temiz sekmeden
  girildiğinde öneri çıkmaması, temiz parça yok ve boş gardırop durumları, temiz konsol.
  Regresyon: temiz/kirli web testi 22/22, istatistik kartları 17/17,
  `test-clean-status` 26/26, `test-all-endpoints` 72/72, `test-auth` 48/48,
  `test-item-outfits` 27/27, lint + build temiz.
- **Test tuzağı (ileride lazım olur):** İlk koşuda iki kontrol boşuna kırmızı yandı,
  ikisi de test kurgusundandı: (1) `innerText` CSS `text-transform: uppercase`'i uygular,
  ham metin için `textContent` gerekir; (2) Playwright'ta **aynı URL'e `page.goto`**
  tarayıcı tarafından reload sayılıp `history.state`'i korur — "temiz giriş" senaryosu
  başka bir sayfadan navbar linkiyle gelerek ya da yeni sekmede test edilmelidir.

### 2026-08-20 — Temiz/kirli durumu eklendi; kombin önerisi yalnızca temiz parçalardan seçiyor
- **Migration `003_add_is_clean.sql`:** `clothing_items.is_clean BOOLEAN NOT NULL DEFAULT true`.
  Mevcut 9 kayıt temiz olarak işaretlendi. `DEFAULT false` olsaydı tüm gardırop bir anda
  öneri dışı kalırdı.
- **`NOT NULL`, tablodaki diğer boolean'lardan bilinçli sapmadır.** `is_favorite`/`is_deleted`
  nullable ama null bir `is_clean` JavaScript'te falsy okunur ve parça sessizce hiç önerilmez
  olurdu — üç durumlu bir alan istemiyoruz.
- **Kritik bulgu — kombin üretimi backend'de DEĞİL.** Bu iş "OutfitService'teki rastgele
  üretim mantığını güncelle" diye istendi, ancak `OutfitService` rastgele seçim yapmıyor;
  yalnızca doğrulayıp kaydediyor. Rastgele üretim `OutfitSuggestion.jsx > buildRandomOutfit()`
  içinde, **istemci tarafında**. Temiz filtresi bu yüzden oraya yazıldı.
  (Mimari notlara da işlendi ki bir daha yanlış katmanda aranmasın.)
- **Filtre `buildRandomOutfit`'in İÇİNE değil ÇAĞIRANINA kondu.** Sayfanın iki durumu
  ayırt etmesi gerekiyor: "o kategoride hiç parçan yok" (→ gardırobu doldur) ile
  "temiz parçan yok" (→ çamaşır yıka). Havuz baştan filtreli gelseydi bu ayrım kaybolurdu.
  Sayfa `cleanItems`, `dirtyOnlyCategories` ve `emptyCategories` türetir; her biri kendi
  mesajını sürüyor.
- **Backend:** `is_clean` create/update'te kabul edilir; yeni uç
  `PATCH /clothing-items/:id/clean-status` favori toggle'ıyla aynı deseni izler
  (okuma+yazma yerine tek atomik `SET is_clean = NOT is_clean`).
- **`PUT`'ta `isClean` gönderilmezse mevcut değer korunur** — `true`'ya düşmek, herhangi bir
  düzenlemenin kirli parçayı sessizce temiz yapması demekti. Servis ayrıca boolean olmayan
  değeri `400`'e çevirir; `Boolean("false") === true` tuzağına düşmemek için gevşek
  dönüşüm yapılmaz.
- **Frontend:** `ClothingCard`'a sol üstte "Kirli" rozeti (yalnızca kirliyken) ve sağ üstte
  çamaşır makinesi ikonlu toggle. `ClothingDetail`'e aynı rozet + "Temiz Olarak İşaretle"
  butonu. `QuickAddModal`'a "Şu an temiz mi?" seçimi (varsayılan **Temiz**).
  Hepsi iyimser güncelleme, hata olursa geri alınıyor.
- **Tasarım kararı — karttaki toggle yalnızca hover'da çıkar.** Önce favori kalbi gibi
  "kirliyken kalıcı görünür" yapılmıştı; ekran görüntüsünde butonun sağında (kalbin
  yerinde) boşluk kalıp yüzer gibi durduğu görüldü. Kalıcı gösterge zaten rozettir;
  buton aksiyondur ve hover'a alındı. Dokunmatikte durum değiştirmek için detay
  sayfasındaki buton kullanılır (favori kalbi de aynı sınırlamaya sahip).
- **Kirli parçalar Gardırop'ta görünür**, yalnızca öneri havuzundan çıkarılır.
  Hiç temiz parça kalmadıysa öneri bölümü "Şu an temiz parçan yok." boş durumuna düşer
  ve "Bu Kombini Kaydet" devre dışı kalır (önceden boş kombin kaydedilmeye çalışılırdı).
- **Kaydedilmiş kombinlerde kirli parça yasaklanmadı.** Bir parça kombin kaydedildikten
  sonra kirlenebilir; geçmiş kombinleri geçersiz kılmak yanlış olurdu. Kural yalnızca
  öneri üretimine aittir.
- **Doğrulama:**
  - Yeni `test-scripts/test-clean-status.js` — **26 kontrol**: varsayılan değer, boolean
    doğrulaması, toggle ucu (401/404 dahil), `PUT` koruması, **200 rastgele öneride kirli
    parçanın hiç seçilmemesi**, kategoride temiz parça yoksa slotun hata vermeden boş
    kalması, veri izolasyonu.
  - Gerçek tarayıcıda (Playwright + sistem Chrome) **22 kontrol**: rozet, karttan ve
    detaydan toggle'ın veritabanına yazılması, 25 öneride kirli parçanın çıkmaması,
    kategori notu, "temiz parçan yok" boş durumu, QuickAddModal seçimi, temiz konsol.
  - Regresyon: `test-all-endpoints.js` 72/72, `test-auth.js` 48/48,
    `test-item-outfits.js` 27/27, `test-image-upload.js` 29/29.
- **Not — `test-image-upload.js` ortama duyarlıdır.** `uploads/` klasöründeki dosya sayısını
  MUTLAK olarak sayar (`.gitkeep` + 1 bekler), yani klasörde gerçek bir kullanıcı fotoğrafı
  varken 3 kontrolü **haksız yere** başarısız olur. Dosya geçici olarak kaldırılıp test
  tekrar çalıştırıldığında 29/29 geçtiği doğrulandı. Testi mutlak sayım yerine
  "kendi oluşturduklarını say" mantığına çevirmek ileriye dönük bir iyileştirme olur.

### 2026-08-20 — Ana Sayfa istatistik kartları tıklanabilir yapıldı
- Üç kart artık birer kısayol: **Toplam Parça → `/gardirop`**, **Kombin → `/kombinlerim`**,
  **Favori → `/gardirop`**.
- **`StatCard` opsiyonel `to` prop'u aldı.** Verilmezse bileşen eskisi gibi düz bir `<div>`
  kalır; verilirse `<Link>`e dönüşür. Böylece kart başka bir yerde salt gösterim
  amaçlı da kullanılabilir ve mevcut çağrı yerleri kırılmaz.
- **Hover — bilinçli olarak sade:** `hover:border-dusty-rose` + etiketin `text-ink/50`→`/70`
  koyulaşması. `QuickActionCard`'daki `hover:-translate-y-1` yükselme efekti **kullanılmadı**:
  o idiom büyük eylem kartlarına ait, küçük istatistik kartlarında abartı kaçardı.
  Odak stili depodaki kalıbı izler (ring değil, dusty-rose kenarlık).
- **"Favori" kartı filtresiz `/gardirop`'a gidiyor.** Gardırop sayfasında kategori pilleri ve
  aramadan başka filtre yok — favorileri tek başına listeleyen bir toggle bulunmuyor.
  Kart bu yüzden listenin tamamına götürür; `Dashboard.jsx` içine bunu belirten bir yorum
  bırakıldı, "Eksikler" tablosuna da işlendi. Favori filtresi eklenirse bağlanacak tek yer orası.
- Hata durumunda kartlar `–` göstermeye devam eder ama tıklanabilir kalır — kullanıcıyı
  aynı hatayı göreceği sayfaya götürmek, kartı ölü bırakmaktan iyi.
- **Doğrulama — gerçek tarayıcıda (17 kontrol).** Playwright, sistemde kurulu Chrome'u
  sürerek (`channel: 'chrome'`, ayrı tarayıcı indirmesi yok) doğrulandı: üç kartın da `<a>`
  olması ve `href`leri, istatistik değerlerinin doğruluğu (3 parça / 2 kombin / 1 favori),
  hover'da kenarlık renginin değişmesi (→ `rgb(201,160,160)` = dusty-rose), `cursor: pointer`,
  üç kartın tıklanınca gerçekten hedef sayfayı açması, klavyeyle odaklanabilme ve konsolun
  temiz olması. Ayrıca `npm run lint` + `npm run build`.
  Test scripti kalıcı değildi (scratchpad); depoda tarayıcı test altyapısı **yok**, Playwright
  proje bağımlılığı olarak eklenmedi.

### 2026-08-20 — Kıyafet Detay: "Bu Kıyafetle Yapılan Kombinler" gerçek veriye bağlandı
- **Sorun:** Bölüm hiçbir zaman veri çekmiyordu; kod içinde sabit bir
  "Henüz bir kombinde kullanılmadı." metni duruyordu — parça 4 kombinde geçse bile.
- **Yaklaşım — yeni uç yerine mevcut uca opsiyonel filtre.** `GET /api/outfits` artık
  `?clothingItemId=<uuid>` kabul ediyor. Bu, `GET /clothing-items?categoryId=` ile aynı
  kalıp; böylece rota/controller/service/repository zinciri `Outfit*` içinde kalıyor ve
  yeni bir kaynak ağacı açılmıyor. Alternatif olan "tüm kombinleri çekip istemcide
  filtrele" yolu, birkaç kart göstermek için kullanıcının bütün kombinlerini
  parçalarıyla indirmek anlamına geldiği için seçilmedi.
- **Kritik SQL detayı — filtre `EXISTS` ile yazılır, `JOIN` koşuna değil.**
  `OutfitRepository.findAllByClothingItem` ortak `SELECT_WITH_ITEMS` parçasını yeniden
  kullanır ve filtreyi ayrı bir `EXISTS` alt sorgusuna koyar. Filtre `LEFT JOIN
  outfit_items` koşuna eklenseydi `json_agg` yalnızca aranan parçayı toplardı ve her
  kombin tek parçalı görünürdü. Test bunu açıkça doğrular (2 parçalı kombin
  `items.length === 2` dönmeli).
- Silinmiş parça hiçbir kombinde geçmiyor sayılır (`fci.is_deleted = false`) —
  uygulamanın geri kalanıyla tutarlı. Parçası silinen kombin **kaybolmaz**, yalnızca
  o parça `items` dizisinden düşer.
- **`assertUuid` eklendi** (`utils/validators.js`). Sorgu paramı olarak gelen bozuk bir id
  doğrudan Postgres'e gitseydi `22P02` ile **500** dönerdi; artık **400** ve Türkçe mesaj.
  Boş string filtresiz sayılır (regresyon: filtresiz `GET /outfits` aynen çalışır).
- **Frontend:** `fetchOutfits(clothingItemId)` opsiyonel parametre aldı (çağrısız hali
  Kombinlerim sayfası için değişmedi). `ClothingDetail` kombinleri **ayrı bir
  `useEffect`'te** çeker: bu istek düşerse sayfanın tamamı değil yalnızca bu bölüm hata
  durumuna geçer ("Kombin bilgisine şu an ulaşılamıyor."), kıyafet bilgisi durur.
- Kartlar `occasion` + tarih (`Intl.DateTimeFormat('tr-TR')`) + parça sayısı gösterir ve
  `/kombinlerim` sayfasına götürür. `occasion` boşsa "Kombin" yazılır. Yükleme sırasında
  iki iskelet satırı, hiç kombin yoksa eski "Henüz bir kombinde kullanılmadı." mesajı kalır.
- **Yeni test:** `test-scripts/test-item-outfits.js` (27 kontrol) — filtreleme, tam `items`
  dizisi, sıralama, boş sonuç, filtresiz regresyon, geçersiz UUID → 400, veri izolasyonu
  (başkasının parça id'siyle sorgu boş döner), token'sız 401 ve soft delete davranışı.
- **Doğrulama:** `test-item-outfits.js` 27/27; regresyon olarak `test-all-endpoints.js`
  72/72 ve `test-auth.js` 48/48. Frontend `npm run lint` temiz, `npm run build` başarılı.
  Sorgu ayrıca gerçek veritabanı verisiyle elle çalıştırıldı: 4 kombinde geçen bir
  parça için 4 satır ve her satır kombinin **tam** parça sayısıyla (4/4/2/3) döndü.

### 2026-08-20 — Android'de yüklenen fotoğraflar görünmüyordu (mixed content, ikinci raunt)
- **Belirti:** Web'de bir kıyafete fotoğraf eklendi; Android'de aynı hesapla girildiğinde
  kıyafet verisi (isim, kategori, favori) doğru geliyordu ama **görsel hiç görünmüyor**,
  placeholder kalıyordu. Yani API/JSON yolu sağlam, kırılan yalnızca `<img>` yoluydu.
- **Elenen ihtimaller (hepsi doğru çalışıyordu):**
  - `resolveImageUrl()` Android'de doğru host'u ekliyor → `http://10.0.2.2:3001/uploads/….png`
  - Veritabanındaki `image_url` doğru biçimde **göreli**: `/uploads/<uuid>.png`
  - `express.static` dosyayı `200` + `Content-Type: image/png` ile veriyor
  - `/uploads` **CORS başlığı da dönüyor** (`Access-Control-Allow-Origin: *`) — zaten
    `crossorigin` taşımayan bir `<img>` için CORS denetimi yapılmaz, bu bir neden olamazdı
  - `allowMixedContent: true` gerçekten uygulanıyor (`Bridge.java` →
    `MIXED_CONTENT_ALWAYS_ALLOW`) — nitekim `fetch` çağrıları çalışıyordu
- **Kök sebep:** `allowMixedContent` WebView'ün **engelleme** politikasını gevşetir, ama
  Chromium bundan bağımsız olarak **pasif (optionally-blockable) alt kaynakları** — yani
  görselleri — HTTPS bir sayfada `http` → `https` **auto-upgrade** eder ve HTTPS yükleme
  başarısız olunca görseli düşürür. `fetch` bu yükseltmeye tabi değildir, `<img>` tabidir.
  Dünkü düzeltmenin API'yi çalıştırıp fotoğrafı çalıştırmamasının sebebi tam olarak budur.
- **Çözüm:** `capacitor.config.json`'a `server.androidScheme: "http"` eklendi. Uygulama
  sayfası artık `http://localhost` üzerinden servis edilir; `http://10.0.2.2:3001` isteği
  **aynı şemadadır**, mixed content koşulu hiç oluşmaz ve auto-upgrade devreye girmez.
  `http://localhost` spec gereği "potentially trustworthy" origin sayıldığı için
  secure-context API'leri kaybedilmez; kamera zaten native Capacitor eklentisidir.
- **Yan etki (bilinçli):** Şema değişikliği **origin'i değiştirir**, dolayısıyla
  `localStorage` bir kereliğine silinir — token ve `dg_` önekli profil önbelleği gider,
  kullanıcı bir kez yeniden giriş yapar. Tek seferlik ve beklenen bir maliyettir.
- `allowMixedContent: true` **kaldırılmadı**: bu şemayla etkisizdir, ancak ileride şema
  `https`'e döndürülürse `fetch` yolunun kırılmaması için bırakıldı.
- **Geçici tanı logu eklendi:** `api.js` içindeki `logImageOutcome()`, `ClothingCard` ve
  `ClothingDetail` içinden `onLoad`/`onError` üzerinde çağrılır. Logcat'ten okuma:
  `adb logcat | grep DG_IMG`. Basılan satır denenen `src`'i ve sayfa origin'ini içerir:
  `DG_IMG YUKLENDI | Bershka crop top | src=http://10.0.2.2:3001/uploads/….png | sayfa=http://localhost`
  `sayfa=` alanı şema düzeltmesinin APK'ya girip girmediğini de doğrular. Sorun teyit
  edildikten sonra bu fonksiyon ve iki çağrı yeri kaldırılabilir.
- **Not:** `capacitor.config.json` değişikliği APK'ya ancak **yeniden derlemeyle** girer;
  `npx cap sync` tek başına yetmez (sync yalnızca dosyayı `assets/` altına kopyalar),
  Android Studio'da Run/Rebuild gerekir.

### 2026-08-19 — Kıyafet fotoğrafı yükleme (multer + Capacitor Camera)
- **Backend:** `multer` ile `POST /clothing-items/:id/image` ve
  `DELETE /clothing-items/:id/image`. Auth middleware'in arkasında; **sahiplik ihlalinde
  403** döner (diğer uçlardaki 404 kalıbından bilinçli sapma, `utils/errors.js`'te not edildi).
- Dosyalar `backend/uploads/` altına **rastgele UUID** adıyla yazılır — orijinal ad
  kullanılmaz (path traversal + çakışma riski). Klasör `.gitignore`'da, `.gitkeep` ile
  repoda kalır.
- **Doğrulama:** yalnızca jpg/png/webp, en fazla 5 MB. Multer hataları route katmanında
  yakalanıp **400**'e çevrilir (varsayılan davranış 500'dü).
- **`image_url` göreli yol saklar** (`/uploads/abc.png`). Tam URL yazmak web (`localhost`)
  ile Android (`10.0.2.2`) arasında birini kırardı; host'u istemcide `resolveImageUrl()`
  ekler. `/uploads` `express.static` ile token'sız servis edilir.
- **Dosya yaşam döngüsü:** fotoğraf değişince eskisi, kıyafet soft delete edilince
  fotoğrafı diskten silinir. Yükleme sonrası bir hata olursa yeni yazılan dosya geri
  alınır — öksüz dosya kalmaz. Silme işlemleri idempotenttir (`ENOENT` yutulur).
- **Frontend:** `PhotoPicker` bileşeni platforma göre ayrışır — web'de `<input type="file">`,
  native'de Capacitor Camera ile **Fotoğraf Çek / Galeriden Seç**. Seçilen dosya
  `URL.createObjectURL` ile anında önizlenir (ve `revokeObjectURL` ile serbest bırakılır).
- **Kısmi başarısızlık açıkça bildirilir:** QuickAddModal önce kıyafeti oluşturur, sonra
  fotoğrafı yükler. Fotoğraf yüklenemezse **kıyafet kaydı geri alınmaz**; kullanıcıya
  "Kıyafet eklendi ama fotoğraf yüklenemedi: … detay sayfasından ekleyebilirsin" denir.
- `ClothingCard` ve `ClothingDetail` fotoğrafı `object-cover` ile gösterir (masonry
  yükseklikleri bozulmaz); `onError` ile bozuk/silinmiş dosyada placeholder'a düşülür.
  Detay sayfasına "Fotoğrafı Değiştir" ve "Fotoğrafı Kaldır" eklendi.
- **Android:** `@capacitor/camera` kuruldu; manifest'e `CAMERA` ve `READ_MEDIA_IMAGES`
  (Android 13+) izinleri, eski sürümler için `maxSdkVersion=32` ile `READ_EXTERNAL_STORAGE`
  eklendi. `uses-feature camera required=false` — kamerasız cihazlarda da kurulabilsin.
  İzin reddi yakalanır ve anlaşılır Türkçe mesaja çevrilir, uygulama çökmez.
  Capacitor base64 döndürdüğü için `File` nesnesine çevrilip multipart olarak gönderilir.
- Kamera modülü **dinamik import** edilir; web derlemesinde ayrı bir chunk'a düşer.
- Yeni test: `test-scripts/test-image-upload.js` (29 kontrol — tip/boyut, 403, eski dosya
  silme, kıyafet silinince temizlik, öksüz dosya kalmaması).

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
