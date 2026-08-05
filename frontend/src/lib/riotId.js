/*
  Riot ID temizliği — YAPIŞTIRILAN isimler görünmez karakter taşır.

  LoL istemcisi (ve çoğu istatistik sitesi) oyuncu adını iki yönlü metin
  algoritmasından korumak için etrafına Unicode "isolate" işaretleri koyar.
  Bu işaretler ekranda hiçbir iz bırakmaz ama kopyalanınca metne yapışır:

      "Balçovalı<U+2069> #<U+2066>İZMİR"   →   ekranda "Balçovalı #İZMİR"

  Riot'un Account-V1 ucu bu karakterleri isimde kabul etmez → 404 → sitede
  "Oyuncu Bulunamadı". Kullanıcı kendi hesabını doğru yazdığı hâlde bulunamıyor
  ve ekranda yanlışı gösteren bir şey OLMADIĞI için neyi düzelteceğini de
  göremiyor. 2026-08-05'te canlıda tam olarak bu yaşandı (Balçovalı#İZMİR —
  oyuncu gerçekte VAR, Platin I).

  Silinenler yalnız GÖRÜNMEZ biçim karakterleridir; harflere (İ, ç, ı, ğ)
  dokunulmaz — Türkçe isimler bozulmadan geçer.
*/

// Cf (format) sınıfının Riot ID'de asla meşru olmayan üyeleri.
// Karakterin KENDİSİ değil \u kaçışı yazılır: görünmez karakteri kaynak koda
// gömmek, düzeltmeye çalıştığımız hatanın aynısını üretirdi.
//   00AD yumuşak tire · 180E moğol ünlü ayracı
//   200B-200F sıfır-genişlik + LRM/RLM · 202A-202E gömme/geçersiz kılma
//   2060-2064 görünmez operatörler · 2066-206F isolate + eski biçim (ASIL SUÇLU)
//   FEFF bayt sırası işareti
const INVISIBLE = /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u206F\uFEFF]/g;

// Kırılmaz boşluklar — göze normal boşluk gibi görünür, Riot'a farklı gider.
const ODD_SPACE = /[\u00A0\u2007\u202F\u3000]/g;

/** Tek bir Riot ID parçasını (isim veya tag) güvenli hâle getirir. */
export function cleanRiotPart(value) {
  if (typeof value !== "string") return "";
  return value.replace(INVISIBLE, "").replace(ODD_SPACE, " ").trim();
}

/**
 * "isim#tag" metnini parçalar ve her iki parçayı temizler.
 * İLK '#' esas alınır — tag'de '#' olamaz, isimde de olamaz; kirli bir
 * yapıştırmada araya bir şey kaçarsa isim tarafı bütün kalsın.
 */
export function parseRiotId(query) {
  const raw = typeof query === "string" ? query : "";
  const hash = raw.indexOf("#");
  if (hash === -1) return { name: cleanRiotPart(raw), tag: "" };
  return {
    name: cleanRiotPart(raw.slice(0, hash)),
    tag: cleanRiotPart(raw.slice(hash + 1)),
  };
}

/** Profil yolu — her zaman temizlenmiş parçalarla kurulur. */
export function summonerPath(name, tag, suffix = "") {
  return `/summoner/${encodeURIComponent(cleanRiotPart(name))}/${encodeURIComponent(cleanRiotPart(tag))}${suffix}`;
}

/** URL'den gelen parça kirli mi? (kirliyse temiz adrese yönlendiriyoruz) */
export function needsCleaning(name, tag) {
  return cleanRiotPart(name) !== name || cleanRiotPart(tag) !== tag;
}
