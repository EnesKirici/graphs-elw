/*
  Riot ID temizliği — YAPIŞTIRILAN isimler görünmez karakter taşır.

  LoL istemcisi (ve çoğu istatistik sitesi) oyuncu adını iki yönlü metin
  algoritmasından korumak için etrafına Unicode "isolate" işaretleri koyar.
  Bu işaretler ekranda hiçbir iz bırakmaz ama kopyalanınca metne yapışır:

      "Balçovalı⁩ #⁦İZMİR"   →   ekranda "Balçovalı #İZMİR"

  Riot'un Account-V1 ucu bu karakterleri isimde kabul etmez → 404 → sitede
  "Oyuncu Bulunamadı". Kullanıcı kendi hesabını doğru yazdığı hâlde bulunamıyor
  ve ekranda hata gösteren bir şey OLMADIĞI için neyi yanlış yaptığını da
  göremiyor. 2026-08-05'te canlıda tam olarak bu yaşandı (Balçovalı#İZMİR —
  oyuncu gerçekte VAR, Platin I).

  Silinenler yalnız GÖRÜNMEZ biçim karakterleridir; harflere (İ, ç, ı, ğ)
  dokunulmaz — Türkçe isimler bozulmadan geçer.
*/

// Cf (format) sınıfının Riot ID'de asla meşru olmayan üyeleri.
// ⁦-⁯: isolate + eski biçimlendirme işaretleri (asıl suçlu bunlar).
const INVISIBLE = /[­᠎​-‏‪-‮⁠-⁤⁦-⁯﻿]/g;

// Kırılmaz boşluklar — göze normal boşluk gibi görünür, Riot'a farklı gider.
const ODD_SPACE = /[    　]/g;

/** Tek bir Riot ID parçasını (isim veya tag) güvenli hâle getirir. */
export function cleanRiotPart(value) {
  if (typeof value !== "string") return "";
  return value.replace(INVISIBLE, "").replace(ODD_SPACE, " ").trim();
}

/**
 * "isim#tag" metnini parçalar ve her iki parçayı temizler.
 * İLK '#' esas alınır: tag'de '#' olamaz, isimde de olamaz — ama kirli
 * yapıştırmada araya kaçan bir şey olursa isim tarafı bütün kalsın.
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
