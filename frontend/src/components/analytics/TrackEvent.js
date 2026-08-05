"use client";

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics";

/*
  Sunucuda render edilen bir DURUMU olay olarak bildirir (hiçbir şey çizmez).

  Neden gerekli: "Oyuncu Bulunamadı" ekranı server component'te üretiliyor ve
  HTTP 200 dönüyor — Rybbit için sıradan bir sayfa görüntülemesi. Yani hata
  ekranı ile başarılı profil panelde AYNI görünüyordu. 2026-08-05'te görünmez
  Unicode karakteri yüzünden oturumların %7,5'i bu ekrana düştü ve fark
  edilmesi günler aldı; bu bileşen o kör noktayı kapatıyor.

  Kullanım:  <TrackEvent name="arama_sonucsuz" props={{ sorgu: "x#TR1" }} />
*/
export default function TrackEvent({ name, props }) {
  const gonderildi = useRef(false);

  useEffect(() => {
    // props her render'da yeni bir nesne referansı olur; ref olmadan aynı
    // durum için tekrar tekrar olay gönderirdik.
    if (gonderildi.current) return;
    gonderildi.current = true;
    trackEvent(name, props);
  }, [name, props]);

  return null;
}
