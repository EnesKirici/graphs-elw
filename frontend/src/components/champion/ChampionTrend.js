"use client";

import { useRef, useState } from "react";

/*
  Son 30 günün gidişatı: kazanma / seçim / yasaklanma oranı.

  Kütüphane YOK — üç küçük çizgi için recharts/d3 eklemek paketi kabartırdı; ihtiyaç
  duyulan tek şey bir polyline. SVG viewBox ile ölçeklenir, stroke `non-scaling` olduğu
  için genişlik değişince çizgi kalınlığı bozulmaz.

  Ölçek her grafikte KENDİ min/max'ine göre kurulur (0'dan başlamaz): kazanma oranı
  %46-53 bandında gezerken 0-100 ekseni çizilirse eğri düz bir çizgiye dönüşür ve
  hiçbir şey anlatmaz. Bunun karşılığında eksen etiketleri her zaman gösterilir —
  okuyucu hangi aralığa baktığını bilsin.

  Her nokta backend'de SON 3 GÜNÜN TOPLAMINDAN hesaplanır; tooltip bunu ve pencereye
  giren maç sayısını açıkça yazar (kaç maçtan çıktığı görünmeyen orana güvenilmez).

  Kart çerçevesi burada DEĞİL: üç grafik, üstündeki özet şeridiyle aynı kartın içinde
  yaşar (ayrı kartlar sayfayı parçalıyordu) — bu yüzden component yalnız ayraçlı
  sütunları döndürür.
*/

/*
  banRate'in KENDİ serisi var (allTrend): yasaklama seçim ekranında, kimin hangi
  koridoru oynayacağı belli değilken yapılır — rolü yoktur. Rol serisiyle çizilince
  Mid'de 16 günlük, Top'ta 6 günlük pencere çıkıyor ve son noktalar farklı güne
  denk gelip "ban oranı role göre değişiyor" izlenimi veriyordu (kullanıcı sordu).
*/
const CHARTS = [
  { field: "winRate", label: "Kazanma Oranı", color: "#60a5fa" },
  { field: "pickRate", label: "Seçim Oranı", color: "#a78bfa" },
  { field: "banRate", label: "Yasaklanma Oranı", color: "#f87171", allRoles: true },
];

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function fmtDay(iso) {
  const [, m, d] = String(iso).split("-");
  return `${Number(d)} ${AYLAR[Number(m) - 1] || ""}`;
}

export default function ChampionTrend({ trend, allTrend }) {
  // 3 günden kısa seri "trend" değildir — çizmek yanıltır.
  if (!trend || trend.length < 3) return null;

  return (
    <div className="border-t border-edge/40 grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-edge/40">
      {CHARTS.map((c) => {
        const series = c.allRoles && allTrend?.length >= 3 ? allTrend : trend;
        return <TrendChart key={c.field} trend={series} {...c} />;
      })}
    </div>
  );
}

function TrendChart({ trend, field, label, color, allRoles }) {
  const svgRef = useRef(null);
  const [hov, setHov] = useState(null);

  const vals = trend.map((d) => Number(d[field]) || 0);
  const n = vals.length;
  const min = Math.min(...vals);
  const max = Math.max(...vals);

  // Ölçek payı: düz seride (min===max) sıfıra bölmemek için taban pay bırakılır.
  const pad = (max - min) * 0.2 || Math.max(max * 0.1, 1);
  const lo = Math.max(0, min - pad);
  const hi = max + pad;

  const W = 100;
  const H = 42;
  const px = (i) => (i / (n - 1)) * W;
  const py = (v) => H - ((v - lo) / (hi - lo || 1)) * H;

  const pts = vals.map((v, i) => `${px(i).toFixed(2)},${py(v).toFixed(2)}`).join(" ");
  const area = `0,${H} ${pts} ${W},${H}`;

  // Pointer (mouse + dokunmatik) → en yakın veri noktası.
  const track = (e) => {
    const el = svgRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ratio = (e.clientX - r.left) / (r.width || 1);
    setHov(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))));
  };

  const active = hov != null ? hov : n - 1;
  const shownVal = vals[active];
  const point = trend[active];
  // Değişim SEÇİLİ noktaya göre: hover'da değer değişip delta sabit kalınca
  // ("%60 ▼2.3 puan") iki sayı birbiriyle çelişiyordu.
  const delta = Math.round((shownVal - vals[0]) * 10) / 10;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{label}</h3>
        <span
          className="text-[10px] text-gray-600"
          title={
            allRoles
              ? "Her nokta son 3 günün toplamından hesaplanır. Yasaklama seçim ekranında yapılır — koridordan bağımsızdır, rol değiştirince değişmez."
              : "Her nokta son 3 günün toplamından hesaplanır"
          }
        >
          son {n} gün · 3g ort.{allRoles ? " · tüm roller" : ""}
        </span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xl font-bold tabular-nums transition-colors" style={{ color }}>
          %{shownVal}
        </span>
        <span
          className={`text-[11px] tabular-nums ${delta > 0 ? "text-blue-300" : delta < 0 ? "text-red-400" : "text-gray-500"}`}
          title={`Serinin ilk gününe (${fmtDay(trend[0].day)}) göre değişim`}
        >
          {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)} puan
        </span>
      </div>

      <div className="relative">
        {/* Y ekseni etiketleri — hangi aralığa bakıldığı hep görünür olsun */}
        <div className="absolute inset-y-0 left-0 flex flex-col justify-between text-[9px] text-gray-600 tabular-nums pointer-events-none">
          <span>%{Math.round(hi * 10) / 10}</span>
          <span>%{Math.round(lo * 10) / 10}</span>
        </div>

        {/* ml-8 (padding DEĞİL): absolute tooltip'in kutusu SVG ile birebir aynı olsun,
            yoksa yüzde konumu eksen etiketleri kadar kayar. */}
        <div className="ml-8 relative">
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="w-full h-[62px] block cursor-crosshair"
            role="img"
            aria-label={`${label} son ${n} gün`}
            onPointerMove={track}
            onPointerDown={track}
            onPointerLeave={() => setHov(null)}
          >
            <polygon points={area} fill={color} opacity="0.12" />
            <polyline
              points={pts}
              fill="none"
              stroke={color}
              strokeWidth="1.4"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
            {hov != null && (
              <line
                x1={px(hov)}
                y1="0"
                x2={px(hov)}
                y2={H}
                stroke="currentColor"
                className="text-gray-500"
                strokeWidth="1"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/*
            Vurgu noktası SVG'de DEĞİL, HTML olarak çiziliyor: viewBox 100x42 ama
            kutu ~345x62 ve preserveAspectRatio="none" olduğu için x ekseni y'den
            ~2.3 kat fazla geriliyor — SVG içindeki <circle> ekranda ELİPS çıkıyordu
            (vectorEffect yalnız çizgi kalınlığına etki eder, dolguya değil).
          */}
          <span
            className="absolute rounded-full pointer-events-none transition-all duration-150"
            style={{
              left: `${(active / (n - 1)) * 100}%`,
              top: `${(py(shownVal) / H) * 100}%`,
              width: hov != null ? 9 : 6,
              height: hov != null ? 9 : 6,
              transform: "translate(-50%, -50%)",
              background: color,
              boxShadow: hov != null ? "0 0 0 2px #0a0e14" : "none",
            }}
          />

          {/* Kutu grafiğin İÇİNDE, imlecin karşı tarafında durur: yukarı taşırınca
              kartın başlık satırını örtüyordu, aşağı taşırınca kartın dışına çıkıyordu. */}
          {hov != null && (
            <div
              className="absolute top-0 z-20 pointer-events-none whitespace-nowrap rounded-lg border border-edge bg-base/90 px-2 py-1.5 shadow-xl backdrop-blur-sm"
              style={{
                left: `${(hov / (n - 1)) * 100}%`,
                transform: hov > (n - 1) / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)",
              }}
            >
              <div className="text-[10px] text-gray-400 leading-none">{fmtDay(point.day)}</div>
              <div className="text-sm font-bold tabular-nums leading-none mt-1" style={{ color }}>
                %{shownVal}
              </div>
              <div className="text-[9px] text-gray-500 leading-none mt-1 tabular-nums">
                {(point.games ?? 0).toLocaleString("tr-TR")} maç · 3 gün
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between text-[9px] text-gray-600 mt-1 ml-8">
        <span>{fmtDay(trend[0].day)}</span>
        <span>{fmtDay(trend[n - 1].day)}</span>
      </div>
    </div>
  );
}
