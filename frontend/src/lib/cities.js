// Şehir listesi bilinçli olarak sınırlı: serbest metin girişi OpenWeatherMap'in
// tanımadığı adlarla dolar ve hava durumu sessizce hep "bilinmiyor" dönerdi.
//
// `value` veritabanına yazılan ve API'ye gönderilen ASCII biçimdir; `label`
// arayüzde gösterilen Türkçe addır. Ayrım gerekli çünkü OpenWeatherMap sorgusu
// "İstanbul" gibi Türkçe karakterlerle güvenilir eşleşmiyor.
export const TURKISH_CITIES = [
  { value: 'Istanbul', label: 'İstanbul', locative: "İstanbul'da" },
  { value: 'Ankara', label: 'Ankara', locative: "Ankara'da" },
  { value: 'Izmir', label: 'İzmir', locative: "İzmir'de" },
  { value: 'Bursa', label: 'Bursa', locative: "Bursa'da" },
  { value: 'Antalya', label: 'Antalya', locative: "Antalya'da" },
  { value: 'Adana', label: 'Adana', locative: "Adana'da" },
  { value: 'Konya', label: 'Konya', locative: "Konya'da" },
  { value: 'Gaziantep', label: 'Gaziantep', locative: "Gaziantep'te" },
  { value: 'Mersin', label: 'Mersin', locative: "Mersin'de" },
  { value: 'Kayseri', label: 'Kayseri', locative: "Kayseri'de" },
  { value: 'Eskisehir', label: 'Eskişehir', locative: "Eskişehir'de" },
  { value: 'Samsun', label: 'Samsun', locative: "Samsun'da" },
  { value: 'Denizli', label: 'Denizli', locative: "Denizli'de" },
  { value: 'Trabzon', label: 'Trabzon', locative: "Trabzon'da" },
  { value: 'Erzurum', label: 'Erzurum', locative: "Erzurum'da" },
  { value: 'Diyarbakir', label: 'Diyarbakır', locative: "Diyarbakır'da" },
  { value: 'Sanliurfa', label: 'Şanlıurfa', locative: "Şanlıurfa'da" },
  { value: 'Mugla', label: 'Muğla', locative: "Muğla'da" },
  { value: 'Balikesir', label: 'Balıkesir', locative: "Balıkesir'de" },
  { value: 'Sakarya', label: 'Sakarya', locative: "Sakarya'da" },
]

// Kayıtlı değer listede yoksa (elle girilmiş ya da liste değişmiş) ham değer
// gösterilir — kullanıcı en azından ne kayıtlı olduğunu görür.
export function cityLabel(value) {
  if (!value) return ''
  return TURKISH_CITIES.find((city) => city.value === value)?.label ?? value
}

// Hava durumu notu için bulunma hâli ("İstanbul'da", "İzmir'de", "Gaziantep'te").
// Ek TÜRKÇE ÜNLÜ UYUMUNA tabi olduğu için kural yerine VERİ olarak tutuluyor:
// tek bir "'da" eki listenin yarısında yanlış olurdu.
// Liste dışı bir değer için "'da" ile yaklaşık bir sonuç üretilir; arayüz yalnızca
// listedeki değerleri kaydettiği için pratikte bu yola düşülmez.
export function cityLocative(value) {
  if (!value) return ''

  const city = TURKISH_CITIES.find((option) => option.value === value)
  return city?.locative ?? `${cityLabel(value)}'da`
}
