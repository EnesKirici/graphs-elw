/**
 * Açık mavi zemin kartı — Şampiyonlar + Meta Tier List için ortak component
 * bg-blue-500/8: çok açık mavi (görsel arkada görünsün)
 * border-blue-500/20: hafif mavi kenarlık
 * backdrop-blur-sm: cam efekti (profesyonel)
 */
export default function Card({ children, className = "" }) {
  return (
    <div className={`rounded-xl border border-blue-500/20 bg-blue-500/8 backdrop-blur-sm shadow-lg ${className}`}>
      {children}
    </div>
  );
}
