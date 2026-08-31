import { Link } from 'react-router-dom'
import { ChevronLeft, Mail } from 'lucide-react'

// Canlı destek/chatbot altyapısı bu depoda YOKTUR (Service Worker/gerçek zamanlı
// destek hattı kurmak "hemen kazanç" ilkesiyle çelişir — CLAUDE.md'deki
// Bildirimler sayfasıyla AYNI gerekçe). Bunun yerine sık sorulan sorular +
// gerçek bir iletişim yolu (e-posta) sunulur; bu, `ComingSoon`'un boş
// "yakında" durumundan BİLEREK farklıdır — burada gösterilecek gerçek bilgi var.
const FAQ_ITEMS = [
  {
    question: 'Gardırobuma nasıl parça eklerim?',
    answer:
      'Gardırop sayfasındaki "+" düğmesiyle yeni bir parça oluşturabilirsin. İsim, kategori ve renk zorunlu; fotoğraf, marka, sezon ve satın alma fiyatı isteğe bağlıdır. Fotoğraf eklediğinde yapay zekâ arka planda parçayı otomatik analiz eder.',
  },
  {
    question: 'Kombin Öner nasıl çalışıyor?',
    answer:
      'Gardırobundaki analiz edilmiş parçalar arasında vektör benzerliğine göre eşleştirme yapılır; sonuçlar her zaman temiz/kirli durumuna ve (şehrini eklediysen) güncel hava durumuna göre süzülür. Yeterince parça analiz edilmediyse öneri rastgele seçime döner — bu bir hata değildir, gardırobun büyüdükçe öneriler daha isabetli hâle gelir.',
  },
  {
    question: 'Ten tonu analizi için yüklediğim selfie güvende mi?',
    answer:
      'Selfie\'n yalnızca sana özel, token\'lı bir uçtan servis edilir; kombin kartlarında, paylaşım görsellerinde ya da başka hiçbir listede görünmez. Profil > Ten Tonu Analizim\'den istediğin an analizi ve fotoğrafı kalıcı olarak silebilirsin.',
  },
  {
    question: 'Ücretsiz planın sınırları neler?',
    answer:
      'Ücretsiz planda en fazla 30 kıyafet parçası ve 10 kombin saklayabilirsin. Bu sınıra ulaştığında Profil > Premium Abonelik üzerinden mevcut kullanımını görebilirsin.',
  },
  {
    question: 'Şifremi unuttum, ne yapmalıyım?',
    answer: (
      <>
        Giriş ekranındaki{' '}
        <Link to="/sifremi-unuttum" className="text-accent-ink underline underline-offset-2">
          "Şifremi Unuttum?"
        </Link>{' '}
        bağlantısına tıklayıp e-posta adresini girmen yeterli — kayıtlı bir hesapsa sıfırlama
        bağlantısı gönderilir.
      </>
    ),
  },
]

function FaqRow({ question, answer }) {
  return (
    <details className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-ink">
        {question}
        <ChevronLeft
          size={16}
          strokeWidth={1.75}
          className="shrink-0 -rotate-90 text-ink/30 transition-transform group-open:rotate-90"
        />
      </summary>
      <p className="mt-2 text-sm leading-relaxed text-ink/60">{answer}</p>
    </details>
  )
}

function HelpSupport() {
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
        <h1 className="mt-6 font-display text-3xl italic text-ink sm:text-4xl">Yardım & Destek</h1>
        <div className="mt-3 h-px w-16 bg-dusty-rose" />
        <p className="mt-6 text-sm text-ink/60">
          Sık sorulan sorulara göz atabilir ya da bize doğrudan yazabilirsin.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-ink/10 bg-surface divide-y divide-ink/10">
          {FAQ_ITEMS.map((item) => (
            <FaqRow key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>

        <a
          href="mailto:serratekin1110@gmail.com?subject=Dijital%20Gard%C4%B1rop%20-%20Destek"
          className="mt-6 flex items-center gap-4 rounded-2xl border border-ink/10 bg-surface p-5 transition-colors hover:border-dusty-rose"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm-gray">
            <Mail size={18} strokeWidth={1.5} className="text-accent-ink" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink">Bize Ulaş</p>
            <p className="mt-1 text-sm text-ink/60">
              Sorunun burada yanıtlanmadıysa e-posta gönder: serratekin1110@gmail.com
            </p>
          </div>
        </a>
      </div>
    </div>
  )
}

export default HelpSupport
