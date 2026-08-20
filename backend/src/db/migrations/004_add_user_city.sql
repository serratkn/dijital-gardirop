-- Kullanıcının şehri. Kombin Öner sayfası hava durumunu bu şehre göre çeker;
-- boşsa hava durumu hiç sorgulanmaz ve öneri eskisi gibi (yalnızca temiz/kirli
-- filtresiyle) üretilir.
--
-- Nullable ve varsayılansız: şehir zorunlu bir alan DEĞİL. Mevcut kullanıcılar
-- ve şehir girmek istemeyenler NULL kalır, bu tamamen geçerli bir durumdur.
--
-- Saklanan değer OpenWeatherMap'in tanıdığı ASCII biçimdir ("Istanbul"),
-- arayüzde gösterilen Türkçe etiket değil ("İstanbul") — bkz. frontend/src/lib/cities.js
ALTER TABLE users
    ADD COLUMN city VARCHAR(100);

-- NOT: clothing_items.season VARCHAR(20) 001_initial_schema.sql ile ZATEN mevcut,
-- bu yüzden burada eklenmiyor. Bu migration'dan önce tüm kayıtlarda NULL'du;
-- NULL sezon "her mevsim uygun" sayılır (bkz. frontend/src/lib/seasons.js).
