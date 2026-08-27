// Backend `config/plans.js > FREE_LIMITS` ile BİREBİR AYNI tutulmalıdır —
// paylaşılan bir modül olmadığı için senkronizasyon ELLE yapılır
// (OUTFIT_REQUEST_CATEGORIES ↔ lib/occasions.js arasındaki senkronizasyonla
// AYNI desen). Buradaki değer yalnızca GÖSTERİM amaçlıdır ("ne kadar kaldı");
// gerçek sınır sunucuda (`ClothingItemService`/`OutfitService`) uygulanır —
// burası ezilse bile hiçbir güvenlik/iş kuralı bozulmaz.
export const FREE_LIMITS = {
  clothingItems: 30,
  outfits: 10,
}
