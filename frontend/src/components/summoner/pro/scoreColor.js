// ELW skoru (0-10) → SÜREKLI gradient renk. Yeşil YOK; MOR dahil (sayfa fazla mavi
// kalmasın + sarı→mavi arası muddy kahverengi olmasın):
// koyu kırmızı → kırmızı → gül → MOR → indigo → mavi → cyan.
// Düşük = kırmızı, orta (~5.7) = mor, üst-orta (~7.2) mordan maviye, yüksek = mavi/cyan.
const STOPS = [
  [0.0,  [122, 31, 43]],   // #7a1f2b koyu kırmızı
  [2.5,  [232, 69, 69]],   // #e84545 kırmızı
  [4.5,  [201, 77, 114]],  // #c94d72 gül
  [5.7,  [157, 92, 219]],  // #9d5cdb mor
  [7.2,  [109, 108, 232]], // #6d6ce8 indigo (mordan maviye)
  [8.5,  [61, 141, 240]],  // #3d8df0 mavi
  [10.0, [44, 201, 230]],  // #2cc9e6 cyan
];

const lerp = (a, b, t) => Math.round(a + (b - a) * t);

export function scoreColor(s) {
  if (s == null) return "#6b7280";
  const x = Math.max(0, Math.min(10, s));
  let lo = STOPS[0], hi = STOPS[STOPS.length - 1];
  for (let i = 0; i < STOPS.length - 1; i++) {
    if (x >= STOPS[i][0] && x <= STOPS[i + 1][0]) { lo = STOPS[i]; hi = STOPS[i + 1]; break; }
  }
  const span = hi[0] - lo[0];
  const t = span === 0 ? 0 : (x - lo[0]) / span;
  const [r, g, b] = [0, 1, 2].map((k) => lerp(lo[1][k], hi[1][k], t));
  return `rgb(${r}, ${g}, ${b})`;
}
