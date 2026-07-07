/*
  Özelleştirilmiş "couple" profilleri — belirli hesap çiftlerine özel tema
  (kalpli arka plan, kalp cursor, pembe vurgu + partnere bağlantı).
  Key: "isim#tag" (küçük harf). Yeni çift eklemek için buraya bir satır ekle.
*/
export const COUPLE_PROFILES = {
  "nurayore#amare": { partnerName: "elwyore", partnerTag: "amare", theme: "pink" },
  "elwyore#amare":  { partnerName: "nurayore", partnerTag: "amare", theme: "pink" },
};

export function getCoupleProfile(name, tag) {
  const key = `${(name || "").toLowerCase()}#${(tag || "").toLowerCase()}`;
  return COUPLE_PROFILES[key] || null;
}
