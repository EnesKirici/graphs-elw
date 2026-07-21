/*
  DataDragon asset tabanları.

  DD_ASSETS: küçük ikonlar (item, şampiyon karesi, yetenek, rün, sihirdar büyüsü).
  Prod'da NEXT_PUBLIC_DD_ASSETS=/dd ile backend'in assets:sync aynasından (same-origin)
  servis edilir; ayarsızsa doğrudan ddragon'a düşer (local dev ayna gerektirmez).

  DD_CDN: büyük görseller (splash/centered/loading) + veri JSON'ları — her zaman
  ddragon'dan gelir, ayna bunları BİLEREK içermez (yüzlerce MB).
*/
export const DD_ASSETS = process.env.NEXT_PUBLIC_DD_ASSETS || "https://ddragon.leagueoflegends.com";
export const DD_CDN = "https://ddragon.leagueoflegends.com";
