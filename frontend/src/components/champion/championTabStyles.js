// Şampiyon sayfası tab stilleri — PLAIN modül ("use client" YOK) → hem client
// (ChampionTabs) hem server (counter page.js) import edebilir.
//
// Site dili (ProfileHeader ile tutarlı): alt-çizgi (underline) tablar — aktif tab
// beyaz metin + mavi alt çizgi, pasif gri. Segment-pill DEĞİL (o yabancı duruyordu).
// Şampiyon sayfasında biraz daha büyük (text-[15px], py-3.5).
export const CHAMP_TABBAR_WRAP = "border-b border-white/10";
export const CHAMP_TABBAR_INNER = "max-w-7xl mx-auto px-6 flex items-center gap-1";
export const CHAMP_TAB = "px-5 py-3.5 text-[15px] font-semibold border-b-2 -mb-px transition-colors cursor-pointer whitespace-nowrap";
export const CHAMP_TAB_ACTIVE = "border-blue-400 text-white";
export const CHAMP_TAB_INACTIVE = "border-transparent text-gray-400 hover:text-gray-200";
