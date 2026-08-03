/*
  Son 30 gün trend grafikleri: kazanma / seçim / yasaklanma oranı.

  Kütüphane YOK — üç küçük çizgi için recharts/d3 eklemek paketi kabartırdı; ihtiyaç
  duyulan tek şey bir polyline. SVG viewBox ile ölçeklenir, stroke `non-scaling` olduğu
  için genişlik değişince çizgi kalınlığı bozulmaz.

  Ölçek her grafikte KENDİ min/max'ine göre kurulur (0'dan başlamaz): kazanma oranı
  %46-53 bandında gezerken 0-100 ekseni çizilirse eğri düz bir çizgiye dönüşür ve
  hiçbir şey anlatmaz. Bunun karşılığında eksen etiketleri her zaman gösterilir —
  okuyucu hangi aralığa baktığını bilsin.

  Veri: build.trend (champion_daily_stats sayaçları). Günlük maç sayısı eşiğin altında
  kalan günler backend'de zaten eleniyor, burada gelen her nokta anlamlı kabul edilir.
*/

const CHARTS = [
  { field: "winRate", label: "Kazanma Oranı", color: "#60a5fa" },
  { field: "pickRate", label: "Seçim Oranı", color: "#a78bfa" },
  { field: "banRate", label: "Yasaklanma Oranı", color: "#f87171" },
];

const AYLAR = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function fmtDay(iso) {
  const [, m, d] = String(iso).split("-");
  return `${Number(d)} ${AYLAR[Number(m) - 1] || ""}`;
}

export default function ChampionTrend({ trend }) {
  // 3 günden kısa seri "trend" değildir — çizmek yanıltır.
  if (!trend || trend.length < 3) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {CHARTS.map((c) => (
        <TrendCard key={c.field} trend={trend} {...c} />
      ))}
    </div>
  );
}

function TrendCard({ trend, field, label, color }) {
  const vals = trend.map((d) => Number(d[field]) || 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const last = vals[vals.length - 1];
  const delta = Math.round((last - vals[0]) * 10) / 10;

  // Ölçek payı: düz seride (min===max) sıfıra bölmemek için taban pay bırakılır.
  const pad = (max - min) * 0.2 || Math.max(max * 0.1, 1);
  const lo = Math.max(0, min - pad);
  const hi = max + pad;

  const W = 100;
  const H = 42;
  const px = (i) => (i / (vals.length - 1)) * W;
  const py = (v) => H - ((v - lo) / (hi - lo || 1)) * H;

  const pts = vals.map((v, i) => `${px(i).toFixed(2)},${py(v).toFixed(2)}`).join(" ");
  const area = `0,${H} ${pts} ${W},${H}`;

  return (
    <div className="glass rounded-xl p-4">
      <div className="flex items-center justify-between mb-2.5">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{label}</h3>
        <span className="text-[10px] text-gray-600">son {trend.length} gün</span>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-xl font-bold tabular-nums" style={{ color }}>%{last}</span>
        <span
          className={`text-[11px] tabular-nums ${delta > 0 ? "text-blue-300" : delta < 0 ? "text-red-400" : "text-gray-500"}`}
          title="Serinin ilk gününe göre değişim"
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

        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full h-[62px] pl-8"
          role="img"
          aria-label={`${label} son ${trend.length} gün`}
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
          {/* Son nokta vurgusu — "şu an neredeyiz" */}
          <circle cx={px(vals.length - 1)} cy={py(last)} r="1.6" fill={color} vectorEffect="non-scaling-stroke" />
        </svg>
      </div>

      <div className="flex justify-between text-[9px] text-gray-600 mt-1 pl-8">
        <span>{fmtDay(trend[0].day)}</span>
        <span>{fmtDay(trend[trend.length - 1].day)}</span>
      </div>
    </div>
  );
}
