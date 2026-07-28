/*
  Şampiyon sayfası arka planı — splash görselini TAM EKRAN (fixed, tüm viewport)
  kaplar; içerik üstünde akar. Okunurluk için genel karartma + alta doğru koyulaşma
  (op.gg/dpm'den farklı: "karakter = sayfa duvar kağıdı" hissi, kullanıcı isteği).

  Sabit (fixed) → kaydırınca da ekranı doldurur; sağlam okunurluk için yeterince koyu.
  Sayfa içeriği `relative z-10` ile bunun üstünde.
*/
export default function ChampionBg({ splash }) {
  return (
    <div className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden" aria-hidden="true">
      <img src={splash} alt="" className="w-full h-full object-cover object-[center_18%]" />
      {/* Genel karartma — her yerde metin okunur olsun */}
      <div className="absolute inset-0 bg-base/60" />
      {/* Üstte biraz net (karakter görünsün), alta doğru koyulaş */}
      <div className="absolute inset-0 bg-gradient-to-b from-base/0 via-base/40 to-base/90" />
      {/* Sol karart (başlık okunurluğu) */}
      <div className="absolute inset-0 bg-gradient-to-r from-base/55 via-transparent to-transparent" />
    </div>
  );
}
