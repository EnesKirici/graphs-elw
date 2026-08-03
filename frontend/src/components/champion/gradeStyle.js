/*
  Derece (tier) renkleri — TEK kaynak.

  Aynı derece hem stat şeridinde (büyük "S" harfi) hem şampiyon ikonunun çerçevesinde
  kullanılıyor; iki yerde ayrı ayrı tanımlanırsa er geç birbirinden kayar.

  Bu dosya bilerek "use client" DEĞİL: hem sunucu (ChampionHero) hem istemci
  (ChampionBuild) tarafından import ediliyor. "use client" bir modüle konursa
  sabitler sunucu bileşeninde string değil "client reference" olarak gelir
  (2026-07-28'de tab sınıflarında tam olarak bu yaşandı).

  Palet site diliyle aynı: mavi/cyan iyi → gri nötr → amber/kırmızı zayıf. Yeşil YOK.
*/

export const GRADE_TEXT = {
  "S+": "text-cyan-300",
  S: "text-blue-300",
  A: "text-sky-400",
  B: "text-gray-200",
  C: "text-amber-400",
  D: "text-red-400",
};

/** Tailwind sınıfı (metin rengi). Bilinmeyen/boş derece → sönük gri. */
export const gradeCls = (g) => GRADE_TEXT[g] || "text-gray-500";

/** Ham renk — inline style gerektiren yerler için (çerçeve, gölge). */
export const GRADE_COLOR = {
  "S+": "#67e8f9",
  S: "#93c5fd",
  A: "#38bdf8",
  B: "#e5e7eb",
  C: "#fbbf24",
  D: "#f87171",
};

export const gradeColor = (g) => GRADE_COLOR[g] || null;
