"use client";

/*
  Hata ekranı (404 / 500) — LoL "recall" temalı.
  - Şampiyon ikonu etrafında dönen recall halkası (oyundaki kanal animasyonu gibi)
  - Otomatik geri sayım → ana sayfaya yönlendirir (recall tamamlanır)
  - B tuşu = anında recall (oyundaki gibi)
  Laravel karşılığı: resources/views/errors/404.blade.php gibi ama tek ortak component.
*/

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DD = "https://ddragon.leagueoflegends.com/cdn";
const DD_VER = "16.13.1"; // ikon görselleri patch'ler arası stabil — pinli sürüm yeterli

const RECALL_SECONDS = 12;

export default function ErrorScreen({ code, title, desc, champion = "Amumu", quote, onRetry }) {
  const router = useRouter();
  const [left, setLeft] = useState(RECALL_SECONDS);

  // Geri sayım — 0'a inince base'e (ana sayfa) recall
  useEffect(() => {
    if (left <= 0) { router.push("/"); return; }
    const id = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [left, router]);

  // Oyundaki gibi: B tuşu → anında recall
  useEffect(() => {
    function onKey(e) {
      if (e.key === "b" || e.key === "B") router.push("/");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <div className="err-wrap bg-base">
      {/* Arka plan: şampiyon splash (loş) */}
      <div
        className="err-bg"
        style={{ backgroundImage: `url(${DD}/img/champion/splash/${champion}_0.jpg)` }}
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        {/* Recall halkası + şampiyon */}
        <div className="err-ring err-float">
          <img
            src={`${DD}/${DD_VER}/img/champion/${champion}.png`}
            alt=""
            width={104}
            height={104}
            className="rounded-full border border-edge"
          />
        </div>

        <p className="err-code" aria-hidden="true">{code}</p>
        <h1 className="text-xl font-bold text-gray-100 -mt-1">{title}</h1>
        <p className="text-sm text-gray-400 leading-relaxed mt-2">{desc}</p>
        {quote && <p className="text-xs italic text-gray-500 mt-3">“{quote}”</p>}

        {/* Recall kanal çubuğu — geri sayımla dolar */}
        <div className="w-full mt-7">
          <div className="err-recall-bar">
            <div className="err-recall-fill" style={{ animationDuration: `${RECALL_SECONDS}s` }} />
          </div>
          <p className="text-[11px] text-gray-500 mt-2 tabular-nums" suppressHydrationWarning>
            Otomatik recall: <span className="text-gray-300 font-semibold">{left} sn</span>
            <span className="hidden sm:inline"> · İpucu: <kbd className="err-kbd">B</kbd> tuşu anında ışınlar</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 mt-5">
          <Link href="/" className="btn btn-primary">Base&apos;e Dön</Link>
          {onRetry && (
            <button onClick={onRetry} className="btn btn-ghost">Tekrar Dene</button>
          )}
        </div>
      </div>
    </div>
  );
}
