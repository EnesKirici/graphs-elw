// Site accent paleti — CANLI ama YUMUŞAK (neon değil, soluk da değil).
// Hedef: gözü yormayan, zengin/mücevher tonları (premium dashboard hissi).
// Koyu zemin üzerinde okunur ve canlı dururlar.
//
// TEK KAYNAK burasıdır: admin paneli (components/admin/ui/tones.js) buradan
// re-export eder; ana site (tier list vb.) doğrudan buradan alır.
//
// fg   → değer/metin rengi (canlı ama okunur)
// mut  → fg'nin MAT türevi: geniş alanlarda / yan yana çok rozette fg parlak
//        durabiliyor; doygunluğu düşük bu ton "neon" hissi vermez
// bar  → accent şeridi / dağılım barı (biraz daha doygun)
// bg   → hafif dolgu (chip/tint)
// bd   → kenarlık
// dot  → küçük gösterge noktası

export const TONES = {
  neutral: { fg: "#e7ecf4", mut: "#929bab", bar: "#58627a", bg: "rgba(255,255,255,0.05)", bd: "rgba(255,255,255,0.10)", dot: "#868fa2" },
  azure:   { fg: "#8ab4f8", mut: "#82a3d6", bar: "#5b8def", bg: "rgba(91,141,239,0.14)", bd: "rgba(91,141,239,0.32)", dot: "#6f9bf0" },
  mint:    { fg: "#5fd3a0", mut: "#5cb28c", bar: "#34b382", bg: "rgba(63,191,135,0.14)", bd: "rgba(63,191,135,0.30)", dot: "#45c592" },
  rose:    { fg: "#ef8ba0", mut: "#cf8494", bar: "#db6a83", bg: "rgba(232,107,131,0.14)", bd: "rgba(232,107,131,0.32)", dot: "#e8748c" },
  gold:    { fg: "#e6b968", mut: "#c5a066", bar: "#cb9540", bg: "rgba(217,162,78,0.14)", bd: "rgba(217,162,78,0.30)", dot: "#dba24e" },
  violet:  { fg: "#b79df5", mut: "#9c8bc9", bar: "#8f6fe0", bg: "rgba(143,111,224,0.14)", bd: "rgba(143,111,224,0.30)", dot: "#a084ef" },
};

export const toneOf = (t) => TONES[t] || TONES.neutral;
