/**
 * Açık mavi zemin kartı — Şampiyonlar + Meta Tier List için ortak component
 * 
 * Site-wide kullanımı:
 * - AllChampionsContent (Şampiyonlar sekmesi tablosu)
 * - RecentChampionsCard (Profil "Son Maçlar Özeti")
 * - TierList (Meta Tier List kartları)
 * 
 * Renk: bg-blue-500/15 (açık mavi, profesyonel) + backdrop-blur
 */
export default function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-blue-500/25 bg-blue-500/15 backdrop-blur-sm shadow-lg ${className}`}>
      {children}
    </div>
  );
}
