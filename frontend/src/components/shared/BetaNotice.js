"use client";

import { useEffect, useState } from "react";

/*
  Beta duyurusu — sol altta, ziyaretçiye BİR KEZ.

  Neden modal değil: sayfayı kilitlemiyor. Ziyaretçi kartı okurken arama
  kutusunu kullanmaya devam edebiliyor; "anladım"a basmadan siteyi gezmesi
  engellenmiyor. Ana sayfadaki kalıcı "Beta sürüm" rozeti (HeroCarousel →
  /iletisim) yerinde kalır — bu kart onun ilk-ziyaret açıklaması.

  Neden (site) layout'una bağlı, root'a değil: /admin kendi layout ağacında.
  Panelde kendi duyurumuzu görmenin anlamı yok.

  localStorage'a bayrak değil SÜRÜM yazılır. Metin ya da tasarım değişip VERSION
  artınca duyuru herkese yeniden gösterilir — eskiden kapatmış olanlar dahil.
*/

const KEY = "elw-beta-notice";
const VERSION = "3"; // 3: alt iki satır büyüdü + rengi öne alındı (soluk okunuyordu)

export default function BetaNotice() {
  // "yok" → hiç basılmaz | "acik" → görünür | "kapaniyor" → çıkış animasyonu
  const [durum, setDurum] = useState("yok");

  useEffect(() => {
    let gerekli = false;
    try {
      gerekli = localStorage.getItem(KEY) !== VERSION;
    } catch {
      /*
        Depolama kapalıysa (gizli sekme / katı çerez ayarı) HİÇ gösterme.
        Kapatma tercihi saklanamayacağı için duyuru her sayfa geçişinde geri
        gelir; bir kez gösterilecek bilgi, kalıcı bir rahatsızlığa dönüşür.
      */
      gerekli = false;
    }
    if (!gerekli) return;

    // Sayfa yerleşene kadar bekle: ilk boyamada içerikle yarışmasın, göz önce
    // aradığı veriye gitsin.
    const t = setTimeout(() => setDurum("acik"), 900);
    return () => clearTimeout(t);
  }, []);

  function kapat() {
    try {
      localStorage.setItem(KEY, VERSION);
    } catch {
      // Yazamadıysak da kapat — bu oturumda tekrar açılmayacak.
    }
    setDurum("kapaniyor");
  }

  if (durum === "yok") return null;

  return (
    <div
      className={`beta-note${durum === "kapaniyor" ? " is-out" : ""}`}
      role="status"
      aria-live="polite"
      // Çıkış animasyonu bitince DOM'dan kaldır. Kartın KENDİ animasyonu
      // olmalı: içerideki nokta (devpulse) sonsuz döngü olduğu için zaten
      // animationend atmıyor, yine de hedef kontrolü bırakıldı.
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget && durum === "kapaniyor") setDurum("yok");
      }}
    >
      <div className="beta-note-head">
        <span className="beta-note-dot" />
        <span className="beta-note-title">Beta sürüm</span>
        <button
          type="button"
          className="beta-note-close"
          onClick={kapat}
          aria-label="Duyuruyu kapat"
        >
          ×
        </button>
      </div>

      <p className="beta-note-lead">
        ElwGraphs şu an beta sürümünde ve geliştirilmeye devam ediyor.
      </p>

      <div className="beta-note-row">
        <span className="beta-note-mark is-ok" aria-hidden />
        <p>
          <b>Kullanıma açık</b>
          Profil, Tier List, Tüm Şampiyonlar ve canlı maç analizi — maç
          verisinden üretilen sayfalar.
        </p>
      </div>

      <div className="beta-note-row">
        <span className="beta-note-mark is-wip" aria-hidden />
        <p>
          <b>Geliştirme aşamasında</b>
          Sıralama gibi bazı veriler henüz tamamlanmadı.
        </p>
      </div>

      <button type="button" className="beta-note-btn" onClick={kapat}>
        Anladım
      </button>
    </div>
  );
}
