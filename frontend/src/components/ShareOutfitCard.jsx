import { forwardRef } from 'react'
import { CARD_HEIGHT, CARD_WIDTH, SHARE_PALETTE as C } from '../lib/shareCard'

// Paylaşılan görselin kendisi. Ekranda GÖRÜNMEZ: sayfanın dışında konumlanır
// ve yalnızca PNG'ye çevrilmek için DOM'da durur.
//
// TÜM STİLLER SATIR İÇİ ve SABİT HEX. Tailwind sınıfı kullanılmamasının iki
// sebebi var:
//   1) Token'lar (`bg-ivory` vb.) karanlık modda koyu değere döner — paylaşım
//      görseli ise daima açık mod olmalı. Sabit hex bunu yapısal olarak garanti eder.
//   2) Tailwind v4 saydamlık için `color-mix(in oklab, …)` üretir; satır içi
//      düz renkler serileştirmede en güvenli yoldur.

// 'Dış Giyim' Üst'ün hemen ardından gelir: giyim mantığında üst parçanın
// üstüne giyilen katman budur (bkz. outfitBuilder.js > OUTERWEAR_CATEGORY).
const CATEGORY_ORDER = ['Üst', 'Dış Giyim', 'Elbise', 'Alt', 'Ayakkabı', 'Çanta', 'Makyaj']

// Parçalar giyim sırasına göre dizilir (üstten aşağı), API sırasına göre değil:
// kolajın bir kıyafeti anlatması için sıralamanın anlamlı olması gerekir.
function sortItems(items) {
  return [...items].sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a.category)
    const bi = CATEGORY_ORDER.indexOf(b.category)
    return (ai === -1 ? CATEGORY_ORDER.length : ai) - (bi === -1 ? CATEGORY_ORDER.length : bi)
  })
}

function ItemTile({ item, span }) {
  return (
    <div
      style={{
        gridColumn: span ? 'span 2' : 'span 1',
        borderRadius: 14,
        overflow: 'hidden',
        backgroundColor: C.surface,
        border: `1px solid ${C.warmGray}`,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          backgroundColor: C.warmGray,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {item.dataUri ? (
          <img
            src={item.dataUri}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          // Fotoğrafı olmayan parça: uygulamadaki yer tutucu diliyle aynı —
          // warm-gray zemin üstünde soluk kategori adı.
          <span
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 15,
              color: '#8d8880',
              padding: '0 8px',
              textAlign: 'center',
            }}
          >
            {item.category || 'Parça'}
          </span>
        )}
      </div>

      <p
        style={{
          margin: 0,
          padding: '7px 9px 8px',
          fontFamily: "'Inter', system-ui, sans-serif",
          fontSize: 10.5,
          lineHeight: 1.25,
          color: '#4a4640',
          backgroundColor: C.surface,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {item.name}
      </p>
    </div>
  )
}

const ShareOutfitCard = forwardRef(function ShareOutfitCard({ occasion, items, dateLabel }, ref) {
  const sorted = sortItems(items)

  // Izgara 2 sütun. Tek sayıda parçada SON parça iki sütuna yayılır —
  // yoksa sağ altta boş bir hücre kalır ve kolaj yarım görünür.
  // Tek parçalı kombinde de aynı kural geçerli (tam genişlik).
  const isOdd = sorted.length % 2 === 1
  const rowCount = Math.ceil(sorted.length / 2)

  return (
    <div
      ref={ref}
      style={{
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        backgroundColor: C.ivory,
        display: 'flex',
        flexDirection: 'column',
        padding: '30px 26px 26px',
        boxSizing: 'border-box',
        // DİKKAT: bu düğüm STATİK konumlanmalıdır. Ekran dışına taşıma işi
        // ShareButton'daki SARMALAYICIYA aittir — çünkü html-to-image, yakalanan
        // düğümün hesaplanmış stillerini <foreignObject> içindeki klona da
        // kopyalar. Kartın kendisinde `position:fixed; left:-10000px` olsaydı
        // klon da oraya konumlanır ve PNG bomboş çıkardı (yaşandı).
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* --- Marka --- */}
      <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
        <p
          style={{
            margin: 0,
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 23,
            letterSpacing: '0.01em',
            color: C.ink,
          }}
        >
          Dijital Gardırop
        </p>
        <span
          style={{
            display: 'block',
            width: 46,
            height: 1,
            margin: '11px auto 0',
            backgroundColor: C.dustyRose,
          }}
        />
      </div>

      {/* --- Kolaj --- */}
      <div
        style={{
          flex: '1 1 auto',
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: `repeat(${rowCount}, minmax(0, 1fr))`,
          gap: 11,
          margin: '22px 0',
          alignContent: 'stretch',
        }}
      >
        {sorted.map((item, index) => (
          <ItemTile key={item.id} item={item} span={isOdd && index === sorted.length - 1} />
        ))}
      </div>

      {/* --- Durum --- */}
      <div style={{ textAlign: 'center', flex: '0 0 auto' }}>
        <p
          style={{
            margin: 0,
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: 9.5,
            fontWeight: 500,
            textTransform: 'uppercase',
            letterSpacing: '0.19em',
            color: C.accentInk,
          }}
        >
          Günün Kombini
        </p>
        <p
          style={{
            margin: '8px 0 0',
            fontFamily: "'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 27,
            lineHeight: 1.15,
            color: C.ink,
          }}
        >
          {occasion ? `${occasion} Kombini` : 'Kombin'}
        </p>
        {dateLabel && (
          <p
            style={{
              margin: '9px 0 0',
              fontFamily: "'Inter', system-ui, sans-serif",
              fontSize: 10.5,
              color: '#6d675f',
            }}
          >
            {dateLabel}
          </p>
        )}
      </div>
    </div>
  )
})

export default ShareOutfitCard
