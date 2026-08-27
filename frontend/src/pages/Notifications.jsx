import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, WashingMachine, Snowflake, Sparkles } from 'lucide-react'
import { fetchCategories, fetchClothingItems, fetchMe, fetchWeather } from '../lib/api'
import { toCategoryNameMap, toClothingItems } from '../lib/transformers'
import { cityLocative } from '../lib/cities'
import { COLD_WEATHER_STATUS } from '../lib/seasons'

// Gerçek "push" bildirimi (tarayıcı/native) DEĞİLDİR — Service Worker/VAPID/FCM
// gibi bir altyapı bu depoda hiç yoktur ve tek bir sayfa için kurmak "hemen
// kazanç" ilkesiyle çelişirdi. Bunun yerine sayfa AÇILDIĞINDA var olan veriden
// (temiz/kirli durumu + güncel hava durumu) GERÇEK, o an doğru olan bir özet
// hesaplanır — WeatherService/GeminiService'teki "isteğe bağlı zenginleştirme"
// ilkesiyle aynı ruh: veri yoksa/hesaplanamıyorsa bölüm sessizce görünmez.

// "Kaç gündür kirli" gibi bir tarih iddiası BİLEREK YOK. `updated_at` yalnızca
// "son düzenleme" anını tutar — bir parçanın ismi/rengi değiştirilse bile bu
// alan güncellenir, dolayısıyla "temiz/kirli işaretlenme anı" için güvenilir
// bir kaynak DEĞİLDİR. Ayrı bir "kirli_isaretlenme_tarihi" kolonu eklemek tek
// bir bildirim satırı için orantısız bir migration olurdu; bu yüzden liste
// yalnızca GERÇEKTEN bildiği şeyi söyler (hangi parçalar şu an kirli), uydurma
// bir gün sayısı göstermez.
function NotificationRow({ icon: Icon, tone = 'default', title, children }) {
  const toneClass =
    tone === 'cold'
      ? 'border-dusty-rose/40 bg-dusty-rose/10'
      : 'border-ink/10 bg-surface'

  return (
    <div className={`flex items-start gap-4 rounded-2xl border p-5 ${toneClass}`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm-gray">
        <Icon size={18} strokeWidth={1.5} className="text-accent-ink" />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <div className="mt-1 text-sm text-ink/60">{children}</div>
      </div>
    </div>
  )
}

function Notifications() {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [dirtyItems, setDirtyItems] = useState([])
  const [coldWeather, setColdWeather] = useState(null)

  useEffect(() => {
    let isStale = false

    async function load() {
      try {
        const [itemRows, categoryRows, me] = await Promise.all([
          fetchClothingItems(),
          fetchCategories(),
          fetchMe(),
        ])
        if (isStale) return

        const items = toClothingItems(itemRows, toCategoryNameMap(categoryRows))
        setDirtyItems(items.filter((item) => item.isClean === false))

        // Hava durumu İSTEĞE BAĞLI bir zenginleştirmedir (OutfitSuggestion.jsx
        // ile AYNI ilke): kendi try/catch'i var, hatası sayfanın geri kalanını
        // ETKİLEMEZ. Şehir tanımlı değilse istek hiç atılmaz.
        if (me?.city) {
          try {
            const weather = await fetchWeather(me.city)
            if (isStale) return
            if (weather?.status === COLD_WEATHER_STATUS) {
              setColdWeather({ ...weather, cityValue: me.city })
            }
          } catch (error) {
            if (isStale) return
            console.error('Hava durumu alınamadı:', error)
          }
        }
      } catch (error) {
        if (isStale) return
        console.error('Bildirimler yüklenemedi:', error)
        setHasError(true)
      } finally {
        if (!isStale) setIsLoading(false)
      }
    }

    load()
    return () => {
      isStale = true
    }
  }, [])

  const hasNothing = !isLoading && !hasError && dirtyItems.length === 0 && !coldWeather

  return (
    <div className="min-h-screen bg-ivory">
      <div className="mx-auto max-w-2xl px-6 pt-14 pb-16 sm:px-8">
        <Link
          to="/profil"
          className="inline-flex items-center gap-1 text-sm text-ink/50 transition-colors hover:text-accent-ink"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
          Profile Dön
        </Link>
        <h1 className="mt-6 font-display text-3xl italic text-ink sm:text-4xl">Bildirimler</h1>
        <div className="mt-3 h-px w-16 bg-dusty-rose" />

        <div className="mt-8 space-y-4">
          {isLoading && (
            <div className="space-y-4">
              <div className="h-20 animate-pulse rounded-2xl bg-warm-gray" />
              <div className="h-20 animate-pulse rounded-2xl bg-warm-gray" />
            </div>
          )}

          {hasError && (
            <p className="text-sm text-ink/50">
              Bildirimlerine şu an ulaşılamıyor. Bağlantını kontrol edip sayfayı yenilemeyi dene.
            </p>
          )}

          {hasNothing && (
            <div className="flex flex-col items-center gap-3 py-24 text-center">
              <Sparkles size={22} strokeWidth={1.5} className="text-accent-ink" />
              <p className="text-sm text-ink/60">Her şey yolunda — yeni bir bildirim yok.</p>
            </div>
          )}

          {!isLoading && !hasError && coldWeather && (
            <NotificationRow icon={Snowflake} tone="cold" title="Bugün hava soğuk">
              {cityLocative(coldWeather.cityValue)} {coldWeather.temperature}°C — dışarı çıkarken
              bir dış giyim parçası eklemeyi unutma.
            </NotificationRow>
          )}

          {!isLoading && !hasError && dirtyItems.length > 0 && (
            <NotificationRow icon={WashingMachine} title="Çamaşır günü mü geldi?">
              <p>
                <span className="font-medium text-ink">{dirtyItems.length} parçan</span> şu an
                kirli olarak işaretli:
              </p>
              <ul className="mt-2 space-y-1">
                {dirtyItems.map((item) => (
                  <li key={item.id}>
                    <Link to={`/kiyafet/${item.id}`} className="underline transition-colors hover:text-accent-ink">
                      {item.name}
                    </Link>
                    {item.category && <span className="text-ink/40"> — {item.category}</span>}
                  </li>
                ))}
              </ul>
            </NotificationRow>
          )}
        </div>
      </div>
    </div>
  )
}

export default Notifications
