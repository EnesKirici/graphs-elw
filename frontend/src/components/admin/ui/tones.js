// Admin paneli accent paleti — CANLI ama YUMUŞAK (neon değil, soluk da değil).
// Hedef: gözü yormayan, zengin/mücevher tonları (Tokyo Night / premium dashboard
// hissi). Navy zemin (#0c111f) üzerinde okunur ve canlı dururlar.
// NOT: bu paleti ileride ana siteye de taşıyacağız → tek kaynak burası.
//
// fg   → değer/metin rengi (canlı ama okunur)
// bar  → accent şeridi / dağılım barı (biraz daha doygun)
// bg   → hafif dolgu (chip/tint)
// bd   → kenarlık
// dot  → küçük gösterge noktası

export const TONES = {
  neutral: { fg: "#e7ecf4", bar: "#58627a", bg: "rgba(255,255,255,0.05)", bd: "rgba(255,255,255,0.10)", dot: "#868fa2" },
  azure:   { fg: "#8ab4f8", bar: "#5b8def", bg: "rgba(91,141,239,0.14)", bd: "rgba(91,141,239,0.32)", dot: "#6f9bf0" },
  mint:    { fg: "#5fd3a0", bar: "#34b382", bg: "rgba(63,191,135,0.14)", bd: "rgba(63,191,135,0.30)", dot: "#45c592" },
  rose:    { fg: "#ef8ba0", bar: "#db6a83", bg: "rgba(232,107,131,0.14)", bd: "rgba(232,107,131,0.32)", dot: "#e8748c" },
  gold:    { fg: "#e6b968", bar: "#cb9540", bg: "rgba(217,162,78,0.14)", bd: "rgba(217,162,78,0.30)", dot: "#dba24e" },
  violet:  { fg: "#b79df5", bar: "#8f6fe0", bg: "rgba(143,111,224,0.14)", bd: "rgba(143,111,224,0.30)", dot: "#a084ef" },
};

export const toneOf = (t) => TONES[t] || TONES.neutral;
