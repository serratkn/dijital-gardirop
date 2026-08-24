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
| `docker-compose.yml` | PostgreSQL 16 + ChromaDB (yerel geliştirme) |

Kökteki `package.json` yalnızca artık Capacitor bağımlılıkları içerir, script'i yoktur —
**yok sayın**. Gerçek Capacitor yapılandırması `frontend/capacitor.config.json` içindedir
(`appId: com.serra.digitalgardirop`).

### Frontend

React 19, Vite 8, Tailwind v4, react-router-dom 7, lucide-react (ikonlar),
html-to-image (kombin paylaşım görseli), Capacitor 8 (Android paketleme).
Lint: **oxlint** (depodaki tek otomatik kontrol).

### Backend

Express 4, `pg` (PostgreSQL sürücüsü), `cors`, `dotenv`, `@google/genai`
(Gemini: görsel analizi + embedding), `chromadb` (vektör veritabanı istemcisi),
`bcrypt`, `jsonwebtoken`, `multer`. CommonJS (`require`).

### Veritabanı

PostgreSQL 16, Docker Compose ile ayağa kalkar. Container adı: `dijitalgardirop-db-1`.
Kalıcılık `postgres_data` adlı named volume ile sağlanır.

**İKİNCİ BİR DEPO VAR: ChromaDB** (vektör veritabanı, Aşama 3). Aynı Compose
dosyasında `chromadb` servisi olarak tanımlıdır (container: `dijitalgardirop-chromadb-1`,
port `8000`, volume `chroma_data`). Kıyafet analizlerinin embedding'lerini tutar.
**Postgres tek doğru kaynaktır**; Chroma türetilmiş veridir ve her zaman
yeniden üretilebilir (`test-scripts/create-embeddings.js`).

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
- **Kombin Öner (RAG)** — rastgele bir "başlangıç parçası" seçilir, ChromaDB'den o
  parçaya en yakın adaylar DİĞER kategorilerden çekilir ve kombin bunlardan kurulur.
  Temiz/kirli ve hava durumu filtreleri adaylara da uygulanır; bir kategoride vektör
  adayı yoksa **yalnızca o slot** sessizce rastgele seçime düşer. Vektör yolu
  kullanılabildiyse kartların üstünde **"Tarzına göre seçildi"** rozeti çıkar,
  rastgeleye düşüldüyse çıkmaz. Kalıcı kaydetme ve Ana Sayfa'daki hızlı kombin
  kartlarından doğrudan açılma aynen çalışır
- **İsteğe bağlı makyaj önerisi** — dört kombin kartının altında, **kapalı başlayan**
  bir bölüm başlangıç parçasına vektör uzayında en yakın TEMİZ makyaj ürününü önerir.
  Bölüm yalnızca böyle bir ürün gerçekten bulunduğunda render edilir; makyajı olmayan
  ya da Chroma'ya ulaşılamayan kullanıcı düğmeyi bile görmez. **Bu kategoride rastgele
  geri düşüş YOKTUR.** Bölüm açıkken kaydedilen kombine makyaj da dahil edilir,
  kapalıyken dört parça kaydedilir
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
- **Vektör veritabanı** — analiz tamamlanınca parçanın özeti Gemini embedding'ine
  çevrilip ChromaDB'ye yazılır. İki okuma ucu da artık ÜRÜN AKIŞINDA:
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
- **Backend** — 6 kaynak için tam CRUD, transaction'lı kombin yazımı, tipli hata yönetimi,
  alan uzunluğu ve foreign key doğrulamaları

### Eksikler ve bilinen sınırlamalar

| Konu | Durum |
|---|---|
| **Token localStorage'da** | XSS durumunda okunabilir. httpOnly cookie daha güvenli olurdu ama Capacitor WebView'de oturum yönetimini karmaşıklaştırır; bilinçli ödünleşme. |
| **Şifre sıfırlama yok** | "Şifremi unuttum" akışı (e-posta ile sıfırlama bağlantısı) yoktur; kullanıcı şifresini yalnızca giriş yapmışken değiştirebilir. |
| **E-posta doğrulama yok** | `email_verified` kolonu var ama hep `false`; doğrulama akışı kurulmadı. |
| **Token yenileme yok** | Tek bir access token (varsayılan 7 gün) kullanılır; refresh token yoktur, süre dolunca yeniden giriş gerekir. |
| **Fotoğraflar yerel diskte** | `backend/uploads/` altında tutulur; çok sunuculu bir kurulumda paylaşılan depolamaya (S3 vb.) taşınması gerekir. Dosyalar `/uploads` yolundan **token'sız** servis edilir — ad tahmin edilemez UUID olduğu için kabul edilebilir sayıldı. |
| **Fotoğraf boyutlandırma yok** | Yüklenen görsel olduğu gibi saklanır; küçük resim (thumbnail) üretilmez. Native tarafta Capacitor `width: 1600` ile ön küçültme yapar, web'de böyle bir sınır yoktur. |
| **Bildirimler / Yardım & Destek** | "Yakında" sayfalarıdır, işlevleri yoktur. |
| **Paylaşım indirmesi mobilde denenmedi** | Görsel üretimi platformdan bağımsızdır ama indirme `<a download>` ile yapılır; Android WebView'de çalışmazsa Capacitor Filesystem/Share eklentisine geçilmelidir. Hata hâlinde kullanıcıya mesaj gösterilir, uygulama çökmez. |
| **Gemini ücretsiz kotası günde 20 istek** | Ölçüldü (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`, limit 20, `gemini-3.6-flash`). Kota dolduğunda analiz sessizce atlanır ve parça analizsiz kalır; **kendiliğinden yeniden deneyen bir mekanizma yoktur** — `analyze-existing-items.js --uygula` ertesi gün elle çalıştırılır. Gerçek kullanım ücretli plan ister. |
| **Fotoğraf değişince analiz KENDİLİĞİNDEN güncellenmez** | Maliyet koruması "dolu `ai_analysis` varsa tekrar analiz etme" der. Artık **elle tetiklenebiliyor**: Kıyafet Detay'daki "Yeniden Analiz Et" düğmesi (`POST /clothing-items/:id/analyze`) ve fotoğraf değiştirildiğinde çıkan hatırlatma. Otomatik yapılmıyor çünkü her çağrı gerçek para harcıyor. |
| **`/gemini/test-analyze` hâlâ duruyor** | Aşama 1'den kalan teşhis ucudur; ürün akışı artık otomatik analizdir. Kaldırılmadı çünkü `test-gemini.js` bağlantı/anahtar yollarını bunun üzerinden doğruluyor. |
| **Öneri kalitesi indekslenmiş parça sayısına bağlı** | Vektör eşleştirmesi yalnızca `ai_analysis` (dolayısıyla fotoğrafı) olan parçalar için çalışır. Analizsiz bir gardıropta Kombin Öner sessizce eskisi gibi rastgele seçim yapar ve rozet hiç görünmez — hatalı değil ama "akıllı" da değildir. Toplu doldurma `analyze-existing-items.js` + `create-embeddings.js` ile elle yapılır. |
| **Durum (occasion) vektör aramasına GİRMİYOR** | "Üniversite" ile "Özel Davet" aynı adayları getirir; durum yalnızca kaydedilen kombinin etiketidir. Başlangıç parçası rastgele seçildiği için sonuç yine de her seferinde değişir. Durumu prompt'a/sorguya katmak ayrı bir aşamanın işi. |
| **Chroma ile Postgres arasında işlem bütünlüğü yok** | İki ayrı depo, dağıtık işlem yok. Kıyafet silinince vektörü de silinir ama bu çağrı başarısız olursa öksüz vektör kalır. `/similar` bunu okurken filtreler (silinmiş parça yanıta düşmez) ve `cleanup.js` öksüzleri toplu siler. |
| **Embedding modeli değişirse koleksiyon geçersiz olur** | Farklı modellerin vektörleri aynı uzayda değildir. Model değiştirildiğinde `create-embeddings.js --sifirla --uygula` çalıştırılmalıdır; bunu hatırlatan otomatik bir kontrol yok. |
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
| `skin_tone_analysis` | JSONB | Gemini ten tonu analizi. **NULL = kullanıcı selfie yüklemedi** (özellik isteğe bağlı). `SAFE_COLUMNS` DIŞINDA |
| `skin_tone_photo_url` | VARCHAR(500) | Selfie yolu (göreli). **HASSAS** — yalnızca sahibine, yalnızca kendi ucundan döner. `SAFE_COLUMNS` DIŞINDA |
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
| `name`, `color`, `brand`, `image_url` | VARCHAR | |
| `season` | VARCHAR(20) | `Yaz` \| `Kış` \| `İlkbahar-Sonbahar` \| `Tüm Sezon`. **NULL = her mevsim uygun** |
| `is_favorite` | BOOLEAN | `false` |
| `is_clean` | BOOLEAN | **NOT NULL**, `true` — kombin önerisi yalnızca `true` olanlardan seçer |
| `is_deleted` | BOOLEAN | `false` — **soft delete**, her okuma filtreler |
| `ai_analysis` | JSONB | Gemini otomatik analizi. **NULL = henüz analiz edilmedi veya analiz başarısız oldu** — kıyafet akışı buna hiç bağlı değildir |
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

### Gemini

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

**Otomatik analizin AYRI BİR UCU YOKTUR.** Aşama 2'de analiz, mevcut fotoğraf
yükleme ucunun (`POST /clothing-items/:id/image`) **yan etkisi** olarak arka
planda çalışır: yanıt önce gönderilir, analiz sonra yapılır ve tamamlandığında
`ai_analysis` kolonuna yazılır. İstemci sonucu `GET /clothing-items/:id`
yoklayarak öğrenir. Ayrı bir uç, kullanıcıyı bekletmeden aynı işi yapan ikinci
bir çağrı demekti; tetikleyici zaten fotoğrafın kendisidir.

| Metod | Yol | Açıklama |
|---|---|---|
| `POST` | `/gemini/test-analyze` | **multipart/form-data**, alan adı `image`. Görseli Gemini'ye analiz ettirir |

**Bu uç bir TEŞHİS aracıdır, ürün akışı değildir.** Aşama 1'den kalmıştır ve
`test-gemini.js` anahtar/bağlantı yollarını bunun üzerinden doğrular.
Korumalıdır (token ister) — aksi hâlde API anahtarımız herkese açık bir Gemini
vekiline dönüşürdü.

Dosya kısıtları fotoğraf yüklemeyle aynıdır (jpg/png/webp, en fazla 5 MB) ama
görsel **diske YAZILMAZ**: `uploadImageToMemory` kullanılır ve tampon doğrudan
base64'e çevrilip gönderilir. `uploadImage` (diskStorage) kullanılsaydı analiz
edilen her görsel `uploads/` altında hiçbir kaydın referans vermediği öksüz bir
dosya olarak kalırdı.

```json
{"model":"gemini-3.6-flash",
 "analysis":{"kategori":"Crop Top","renk":"Pembe","stil":"Günlük"},
 "raw":"{
  \"kategori\": \"Crop Top\", …"}
```

`raw` teşhis içindir: modelin ne döndürdüğünü görmeden hata ayıklamak zordur.

**Hatalar 500 değil `503` döner** (`ServiceUnavailableError`) ve mesaj açıklayıcıdır:
anahtar yok, anahtar geçersiz, kota doldu, model bulunamadı, zaman aşımı, JSON
çözümlenemedi. Ham SDK hatası asla dışarı sızmaz — yığın izi ve anahtar parçası
içerebilir.

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

- **KATEGORİ BAŞINA AYRI SORGU atılır.** Tek bir büyük sorgu (`nResults=50`)
  istatistiksel olarak çok parçalı bir kategoriyi öne alır ve az parçalı
  kategoriden hiç sonuç döndürmeyebilirdi; kombin ise her slotu doldurmak zorunda.
- **Başlangıç parçasının KENDİ kategorisi hedeflerden düşer** (kombin slotu başka
  bir kategoriye ait). Geriye hedef kalmazsa `400`.
- **`is_clean` ve `season` yanıtta döner ama BACKEND FİLTRELEMEZ.** Temiz/kirli ve
  hava durumu kuralları istemcide (`lib/outfitBuilder.js`) uygulanır — kombin kurma
  mantığının tek sahibi orası. Değişken durum daima Postgres'ten okunur, Chroma
  metadata'sından değil.
- **Chroma erişilemezse `503` döner, boş liste değil.** Uç "dürüst"tür; *sessizce
  rastgeleye düşme* kararı istemcinindir. Uç boş dönseydi arayüz akıllı olmayan bir
  öneriyi akıllı sanar ve rozeti haksız yere gösterirdi.
- **Öneri başına Gemini çağrısı YOKTUR:** başlangıç parçasının vektörü Chroma'da
  zaten var, oradan okunur. Her öneri gerçek para harcasaydı özellik kullanılamazdı.
- **Zaman aşımı 3 sn** (`COMPANION_TIMEOUT_MS`). `VectorRepository`'nin 10 sn'lik
  sınırı burada fazla uzun: kullanıcı öneri ekranına bakıp bekliyor.
- Sorgu daima `user_id` ile filtrelenir ve sonuçlar Postgres'ten doğrulanır
  (silinmiş/başkasına ait parça yanıta sızmaz). Bozuk biçimli id `400`.
- Henüz indekslenmemiş başlangıç parçası hata değildir:
  `{"indekslendi": false, "sebep": "analiz-yok", "adaylar": {}}`.

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
- **ChromaDB erişilemezse `503` döner**, boş liste değil. Sessizce boş dönmek
  "benzer parçan yok" gibi YANLIŞ bir cevap olurdu. (Yazma yolu tam tersi:
  sessizce atlanır — bkz. §8.)
- **Sorgu daima `user_id` ile filtrelenir.** Filtresiz bir vektör sorgusu başka
  kullanıcıların gardıroplarından sonuç döndürürdü; test bunu ayrıca doğrular.
- Parçanın kendisi sonuçlardan **elenir** (kendine mesafesi daima 0'dır);
  bu yüzden Chroma'dan bir fazla komşu istenir.
- Sonuçlar **Postgres'ten zenginleştirilir** (ad, kategori, fotoğraf). Bu sırada
  silinmiş parçalar düşer, yani Chroma'da bayat bir kayıt kalsa bile yanıta sızmaz.
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
| `POST` | `/clothing-items` | `{ userId*, categoryId*, name*, color, brand, season, imageUrl, isClean }` → `201` |
| `PUT` | `/clothing-items/:id` | `{ categoryId*, name*, color, brand, season, isClean }` — **fotoğraf bu ucun işi değildir** |
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
| `POST` | `/outfits` | `{ userId*, occasion, clothingItemIds*[] }` → `201` |
| `PUT` | `/outfits/:id` | `{ occasion, clothingItemIds }` — `clothingItemIds` verilmezse parçalara dokunulmaz |
| `DELETE` | `/outfits/:id` | Hard delete → `204` |
| `PATCH` | `/outfits/:id/favorite` | Favori toggle |
| `PATCH` | `/outfits/:id/worn` | `times_worn` +1 |

`clothingItemIds` en az bir parça içermeli, tekrar barındıramaz ve **yalnızca o kullanıcıya
ait, silinmemiş** parçalar olabilir — aksi hâlde `400`.

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
# 1) Veritabanları (depo kökünden)
docker compose up -d                 # postgres 16 (:5432) + chromadb (:8000)
docker compose ps                    # chromadb "healthy" olmalı
docker compose down                  # durdur (postgres_data ve chroma_data volume'leri korunur)

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

# Kimlik doğrulama + yetkilendirme (48 kontrol). En kritik bölüm: bir kullanıcının
# BAŞKASININ verisine erişememesi.
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

# RAG ile Kombin Öner — Gemini Aşama 4 (69 kontrol: 36 birim + 21 uçtan uca + 12 Chromasız).
# --birim: yalnızca birim bölümü (Chroma, anahtar ve kota GEREKTİRMEZ)
# Bölüm 3 Chroma'sı ÖLÜ BİR PORTA bakan ikinci bir sunucu açar (:3197).
node test-scripts/test-outfit-rag.js
node test-scripts/test-outfit-rag.js --birim
node test-scripts/test-outfit-rag.js --cleanup

# Vektör veritabanı — Gemini Aşama 3 (82 kontrol: 46 birim + 4 bağlantı + 32 uçtan uca).
# --birim: yalnızca birim bölümü (Chroma, anahtar ve kota GEREKTİRMEZ)
# Bölüm 3 ai_analysis'i ELLE yazar (sentetik): "iki beyaz üst yakın çıkmalı"
# iddiası ancak girdi kontrol edilirse deterministik sınanabilir.
node test-scripts/test-vector.js
node test-scripts/test-vector.js --birim
node test-scripts/test-vector.js --cleanup

# Analizi olan ama embedding'i olmayan parçalar için toplu embedding üretimi.
# VARSAYILAN SALT OKUNURDUR. --sifirla koleksiyonu siler (model değişince gerekir).
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

# Gemini Aşama 1 (20 kontrol). Birinci bölüm GEÇERLİ ANAHTAR OLMADAN da çalışır
# (eksik/geçersiz anahtar yolları); analiz bölümü anahtar ve görsel ister.
node test-scripts/test-gemini.js
node test-scripts/test-gemini.js --image ../yol/kiyafet.jpg

# Test artıklarını temizler (test kayıtları + Chroma öksüz vektörleri +
# uploads/ öksüz dosyaları — üçü de aynı çalıştırmada temizlenir)
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
test kullanıcıları `@example.com` deseniyle tanınır. **`cleanup.js` ayrıca ChromaDB'deki
ÖKSÜZ VEKTÖRLERİ de siler** (Postgres'te karşılığı kalmayanlar) — doğrudan SQL ile
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
aynı rol), `GeminiService` görseli gönderip JSON yanıtı çözer, `GeminiController`
ince adaptördür. Repository yoktur: kalıcı veri yok, yalnızca dış çağrı.

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

**Vektör katmanı (Aşama 3).** `config/chroma.js` istemciyi kurar (database.js /
gemini.js ile aynı rol), `VectorRepository` yalnızca ChromaDB ile konuşur ve
**fırlatır**, `VectorService` iş mantığını taşır. Zincir depodaki desene birebir
uyar; tek fark, "veritabanı" burada Postgres değil Chroma.

`VectorService`'in **iki ayrı sözleşmesi** var ve bu bilinçlidir:

- **YAZMA (`indexItem` / `indexItems` / `removeItem`): ASLA FIRLATMAZ.**
  Embedding, kıyafet akışının parçası değil üstüne konan bir zenginleştirmedir.
  Chroma kapalıysa, kota dolduysa veya ağ düştüyse kıyafet kaydı ve analizi
  yerinde durur, kullanıcı hiçbir şey görmez.
- **OKUMA (`findSimilar` / `findCompanions`): FIRLATIR.** Sessizce boş liste
  dönmek "benzer parça yok" gibi YANLIŞ bir cevap olurdu. Erişilemeyen servis
  `503` ile bildirilir. **Aşama 4 bu kuralı değiştirmedi:** Kombin Öner'in
  rastgeleye düşmesi gerekiyor ama bu kararı İSTEMCİ verir — API dürüst kalır,
  yoksa arayüz rastgele bir öneriyi "akıllı" sanıp rozeti haksız yere gösterirdi.

`findCompanions` (Aşama 4) `findSimilar`'dan üç noktada ayrılır: **kategori
başına AYRI sorgu** atar (tek büyük sorgu az parçalı kategoriyi hiç
döndürmeyebilirdi), sonuçları **kategoriye göre gruplanmış** verir ve
**3 sn'lik kendi zaman aşımı** vardır (`COMPANION_TIMEOUT_MS`) — repository'nin
10 sn'si öneri ekranında bekleyen kullanıcı için fazla uzun. Zenginleştirme tek
sorguda yapılır (`ClothingItemRepository.findByIds`): kategori başına N aday için
ayrı ayrı `findById` atmak veritabanına onlarca tur demekti.

**Bozuk biçimli id her iki okuma yolunda da `assertUuid` ile `400`'e çevrilir.**
Doğrudan Postgres'e gitseydi `22P02` ile `500` dönerdi — `GET /outfits?clothingItemId=`
filtresinde yaşanan tuzağın aynısı.

Aynı ayrım GeminiService ↔ WeatherService arasında da var ve aynı ölçüte
dayanıyor: **o anda cevap bekleyen bir kullanıcı var mı, yok mu.**

Servisin dokunulmaması gereken kuralları (ClothingAnalysisService ile aynı aile):

- **In-flight işareti İLK `await`'ten ÖNCE konur** — sonra konsaydı iki
  eşzamanlı tetikleme de muhafızı geçerdi (Aşama 2'de bu hata yaşandı).
- **Vektörü olan parça yeniden embed EDİLMEZ** (`force` hariç). Maliyet koruması.
- **Chroma erişilemiyorsa embedding HİÇ ÜRETİLMEZ.** Kontrol sırası bilinçlidir:
  önce "zaten var mı" diye Chroma'ya sorulur, sonra Gemini'ye gidilir. Ters
  sırada olsaydı Chroma kapalıyken her denemede para harcanır ve sonuç
  yazılamadan atılırdı.
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
sinyali. Üretilen metin Chroma'da `document` olarak da saklanır, yani neyin
embed edildiği sonradan okunabilir.

**Metadata yalnızca DEĞİŞMEYEN alanlardan seçilir** (`user_id`, `category_id`,
`sema`, `embedding_modeli`, `olusturma`). `is_clean` veya `is_favorite` buraya
konsaydı kullanıcı her toggle'da Chroma'yı da güncellemek zorunda kalırdı;
güncellemeseydi filtre bayat veriyle çalışırdı. **Değişken durum her zaman
Postgres'ten okunur.**

**Chroma'nın kendi embedding fonksiyonu DEVRE DIŞI.** Koleksiyona, çağrıldığında
hata fırlatan açık bir fonksiyon veriliyor (`config/chroma.js`); her yazma ve
sorgu vektörü açıkça taşımak zorunda. Varsayılan bırakılsaydı istemci her
koleksiyon açılışında "@chroma-core/default-embed kurun" uyarısı basıyordu ve
bir gün gerçekten metinden embedding üretmeye kalkışabilirdi — o da bizim
modelimizle uyumsuz vektör demekti.

**Tetikleme yine CONTROLLER'da.** `ClothingAnalysisService` analizi yazdıktan
SONRA `vectorService.indexItemInBackground(...)` çağırır ve **await etmez**;
sıra önemlidir çünkü embedding'in kaynağı `ai_analysis` kolonudur. Silme ise
`ClothingItemController.delete` içinde, `res` gönderildikten sonra tetiklenir.
Her iki bağımlılık da **opsiyoneldir**: verilmezse akış eskisi gibi çalışır.

**İki depo arasında işlem bütünlüğü YOKTUR.** Postgres tek doğru kaynaktır;
Chroma türetilmiş veridir ve her zaman yeniden üretilebilir. Bu yüzden
tutarsızlık bir hata değil, beklenen bir durumdur ve üç yerde karşılanır:
`findSimilar` sonuçları Postgres'ten doğrular (silinmiş parça yanıta düşmez),
`cleanup.js` öksüz vektörleri toplar, `create-embeddings.js` eksikleri doldurur.

**Auth katmanı.** `server.js` tek bir `AuthService` ve ondan türetilen tek bir
`authenticate` middleware kurar (token'ı imzalayan ve doğrulayan aynı örnek olmalı).
`authRoutes` bu yüzden diğerlerinden farklı olarak bir **fabrikadır**
(`createAuthRoutes(authService, authenticate)`). Yeni korumalı bir kaynak eklerken
`app.use('/api', authenticate, yeniRoutes)` deyip controller'da `req.userId` kullanın.

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
`temizleOksuzDosyalar()` var — Chroma'nın `temizleOksuzVektorler()`'iyle birebir aynı
desen, yalnızca "referans" kümesi `clothing_items.image_url` + `users.skin_tone_photo_url`
birleşimi. `is_deleted` fark etmez: hem soft-delete edilmiş hem canlı satırların
referansları korunur, yalnızca DİSKTE OLUP hiçbir satırdan işaret edilmeyen dosyalar silinir.

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
   **her hatası yutulur** (Chroma kapalı, zaman aşımı, ağ hatası, indekslenmemiş
   parça): sonuç `null` olur ve akış rastgele seçime döner.
3. **`buildOutfitFromCandidates`** — adayları önce TEMİZ olanlara indirger, sonra
   sezon önceliğini uygular. **Vektör benzerliği bu filtreleri atlamaz.** Bir
   kategoride aday kalmazsa YALNIZCA O SLOT `buildRandomOutfit` mantığına düşer.

**İsteğe bağlı makyaj bölümü (`pickMakeupItem`).** Makyaj, `OUTFIT_CATEGORIES`'e
**bilerek eklenmedi**: kombinin slotu değil, üstüne konan bir öneri. Bunun yerine
`CANDIDATE_CATEGORIES` (= kombin kategorileri + `Makyaj`) sorgulanır; ızgarayı kuran
`buildOutfitFromCandidates` yalnızca `OUTFIT_CATEGORIES` üzerinde gezdiği için makyaj
dört kartlık ızgaraya **yapısal olarak** giremez.

Bu bölümün diğerlerinden ayrılan üç kuralı var:

1. **GERİ DÜŞÜŞ YOK.** Diğer slotlarda rastgele bir parça göstermek "kombin eksik
   kalmasın" diye değerliydi; makyaj isteğe bağlı bir ek. Vektör bir şey
   söyleyemiyorsa (embedding yok, Chroma kapalı, hepsi kirli) doğru davranış
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

**Kalıcı durum:** `src/lib/onboarding.js` `dg_` önekli localStorage anahtarlarının
tek sahibidir (onboarding bayrağı, `dg_user_id`, kullanıcı profili, anket cevapları).
**İki istisna:** `dg_token` `lib/auth.js`'e, `dg_theme` `lib/theme.js`'e aittir.
Tema bir OTURUM verisi değil CİHAZ tercihidir — bu yüzden çıkışta `clearOnboardingState()`
ile silinmez, kullanıcı çıkış yapınca teması korunur.
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

`api.js` içindeki `logImageOutcome()` **geçicidir**: Android'de hangi `<img src>`
denendiğini ve yüklenip yüklenmediğini Logcat'ten görmek için eklendi
(`adb logcat | grep DG_IMG`). `ClothingCard` ve `ClothingDetail` içinden çağrılır;
fotoğraf sorunu teyit edildikten sonra üç yerden de kaldırılabilir.

`pages/Wardrobe.jsx` içinde boş durumları önizlemek için `DEV_FORCE_EMPTY` ve
`DEV_FORCE_EMPTY_CATEGORY` sabitleri bulunuyordu; API'ye geçişte kaldırıldılar
(boş durum artık gerçek veriyle veya ağ mock'uyla test edilir).
`Navbar`'daki `RotateCcw` butonu onboarding'i yeniden tetikler — **geçicidir**.

---

## 9. Değişiklik Günlüğü

> Bundan sonraki her çalışma buraya tarihiyle işlenir: eklenen özellikler, düzeltilen
> hatalar, alınan mimari kararlar. En yeni kayıt en üstte.

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
