/**
 * Ortak kart component'i — profil (dpm-scope) navy kart diliyle BİREBİR aynı.
 *
 * Site-wide kullanımı:
 * - AllChampionsContent (Şampiyonlar sekmesi tablosu)
 * - RecentChampionsCard (Profil "Son Maçlar Özeti")
 *
 * Renk: .glass yüzeyi → dpm-scope içinde navy (var(--glass-bg)). Böylece tüm
 * sayfalardaki kartlarla tek tip görünür (ana sayfa hariç, o kendi siyah .card'ı).
 */
export default function Card({ children, className = "" }) {
  return (
    <div className={`glass rounded-xl shadow-lg ${className}`}>
      {children}
    </div>
  );
}
