// Kombin Öner sayfasındaki hazır durumlar. Ana Sayfa'daki "Hızlı Kombin Öner"
// kartları da buradan besleniyor — iki yer aynı kelimeleri kullanmak zorunda,
// çünkü karttan gelen occasion değeri sayfada aktif pill olarak işaretleniyor.
export const OCCASIONS = ['Üniversite', 'İş', 'Akşam Yemeği', 'Buluşma', 'Spor', 'Özel Davet']

// Kombin Öner sayfasına "şu durum için hemen öneri üret" demek için kullanılan
// router state anahtarı. Tek yerde tanımlı ki gönderen ve okuyan taraf ayrışmasın.
export const OCCASION_STATE_KEY = 'occasion'
