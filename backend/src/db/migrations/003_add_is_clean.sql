-- Kıyafetlerin yıkanma durumu. Kombin önerisi yalnızca is_clean = true olan
-- parçalardan seçim yapar; kirli parçalar Gardırop listesinde görünmeye devam eder.
--
-- Varsayılan true: mevcut tüm kayıtlar "temiz" sayılır. false varsayılanı
-- bütün gardırobu bir anda öneri dışı bırakır, uygulama boş kombin üretirdi.
--
-- NOT NULL, tablodaki diğer boolean'lardan (is_favorite / is_deleted) bilinçli
-- bir sapmadır: null bir is_clean JavaScript tarafında falsy okunur ve parça
-- sessizce hiç önerilmez olurdu. Üç durumlu bir alan istemiyoruz.
ALTER TABLE clothing_items
    ADD COLUMN is_clean BOOLEAN NOT NULL DEFAULT true;
