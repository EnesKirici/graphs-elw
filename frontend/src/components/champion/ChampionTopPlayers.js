"use client";

import Link from "next/link";
import { profileIcon } from "@/lib/buildData";

/*
  Şampiyonun en iyi oyuncuları — İKİ AYRI SIRALAMA (ustalık / ladder).

  TASARIM NOTLARI (hepsi düzeltilmiş hatalardan):
  - İKİ PANEL DE TABLO. Biri liste biri tablo olunca satır yükseklikleri tutmuyor
    ve kartlar farklı boyda bitiyordu; aynı iskelet = aynı hiza.
  - KONTRAST: `text-gray-600` KULLANILMAZ. Tema gri rampasını aynalıyor
    (globals.css html.light) → gray-600 açık temada #94a3b8 oluyor ve beyaz kart
    üzerinde okunmuyor; koyu temada da zemine yakın. İkincil metin en fazla
    gray-400, asıl değerler gray-200/100.
  - Lig rozeti ve etiketi İKİ TABLODA DA aynı boyut/hizada (farklı boyutlar
    "ranklar farklı farklı" görüntüsü veriyordu).
  - Örnek veri uyarısı GERÇEK tooltip'te: `title` özniteliği tarayıcıya bağlı,
    geç çıkıyor ve stilsiz — kullanıcı görmedi bile.

  ⚠ İKİ TABLO DA ŞU AN TAMAMEN ÖRNEK VERİ SAYILIR. Ustalık puanı ve lig derecesi
  zaten üretiliyor (dev anahtar kotası); ama SIRALAMANIN KENDİSİ de gerçeği
  yansıtmıyor: oyuncu havuzu yalnız bizim taradığımız maçlardan geliyor, TR'nin
  tamamı taranmadı. Bu yüzden ipuçlarında "oyuncular gerçek" demiyoruz — kısmen
  gerçek veriyi "gerçek sıralama" diye sunmak, tümüyle sahte veri sunmaktan daha
  yanıltıcı olurdu. Gerçeğe geçerken mockMastery/mockRank + ipuçları silinir.
*/

const MEDAL = ["text-amber-300", "text-slate-300", "text-orange-400"];

const TIERS = [
  { key: "CHALLENGER", label: "Challenger", color: "text-amber-400", min: 1200 },
  { key: "GRANDMASTER", label: "Grandmaster", color: "text-red-400", min: 900 },
  { key: "MASTER", label: "Master", color: "text-fuchsia-400", min: 600 },
  { key: "DIAMOND", label: "Diamond", color: "text-sky-400", min: 400 },
  { key: "EMERALD", label: "Emerald", color: "text-emerald-400", min: 0 },
];

const DIVISIONS = ["I", "II", "III", "IV"];

/** Aynı oyuncu her yenilemede aynı sayıyı görsün diye isimden türeyen sabit hash. */
function hash(name) {
  let h = 0;
  for (let i = 0; i < String(name).length; i++) h = (h * 31 + String(name).charCodeAt(i)) >>> 0;
  return h;
}

/*
  Ustalık puanı: maç başına ~60.000 puan. Bir OTP'nin toplam ustalığı gerçekte
  milyonlarla ölçülür (30 maçlık bir sezon dilimi o şampiyonla geçmiş tüm
  oynanışın küçük bir parçasıdır) — ilk sürümdeki 20-60 bin bandı gerçekçi
  değildi.
*/
function mockMastery(name, games) {
  const spread = 0.6 + ((hash(name) % 1000) / 1000) * 1.8; // 0.6x - 2.4x
  return Math.round(((games || 1) * 60000 * spread) / 1000) * 1000;
}

/* Puan TAM yazılır (5.412.000), kısaltılmaz: "5,4M" hem yuvarlıyor hem
   sıralamayı okunmaz kılıyordu (5,4M ile 5,4M arasında hangisi önde belli olmuyor). */
const fmtMastery = (n) => n.toLocaleString("tr-TR");

/** Örnek lig verisi: havuz Emerald+ olduğu için taban Emerald, tavan Challenger. */
function mockRank(name, games, winRate) {
  const h = hash(name + "|rank");
  const base = (games || 1) * 4 + (winRate - 50) * 8 + (h % 600);
  const lp = Math.max(0, Math.round(base));
  const tier = TIERS.find((t) => lp >= t.min) || TIERS[TIERS.length - 1];
  const division = tier.min >= 600 ? null : DIVISIONS[h % 4];
  return { tier, division, lp: tier.min >= 600 ? lp : lp % 100, sort: lp };
}

const wrCls = (wr) => (wr >= 52 ? "text-blue-300" : wr >= 49 ? "text-gray-200" : "text-red-400");

/* Profil ikonu olmayan oyuncular (cached_players'ta kaydı yok) boş gri kutuydu —
   listede delik gibi duruyordu. Adın baş harfi + isimden türeyen sabit renk. */
const AVATAR_TONES = [
  "from-blue-500/30 to-blue-500/10 text-blue-200",
  "from-violet-500/30 to-violet-500/10 text-violet-200",
  "from-emerald-500/30 to-emerald-500/10 text-emerald-200",
  "from-amber-500/30 to-amber-500/10 text-amber-200",
  "from-rose-500/30 to-rose-500/10 text-rose-200",
];

function Avatar({ p, version, size = 34 }) {
  if (p.profileIconId != null) {
    return (
      <img
        src={profileIcon(version, p.profileIconId)}
        alt=""
        width={size}
        height={size}
        className="rounded-lg border border-edge shrink-0"
        onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
      />
    );
  }
  const tone = AVATAR_TONES[hash(p.name) % AVATAR_TONES.length];
  return (
    <span
      className={`rounded-lg border border-edge shrink-0 flex items-center justify-center font-bold bg-gradient-to-br ${tone}`}
      style={{ width: size, height: size, fontSize: size * 0.44 }}
    >
      {String(p.name).trim().charAt(0).toUpperCase()}
    </span>
  );
}

/*
  Gerçek tooltip — `title` özniteliği değil. Native title ~1sn gecikmeyle çıkıyor,
  tema dışı görünüyor ve dokunmatikte hiç çıkmıyor; kullanıcı uyarıyı fark etmedi.
*/
function InfoTip({ children }) {
  return (
    <span className="relative inline-flex group/tip">
      <span
        className="w-4 h-4 rounded-full border border-amber-400/50 bg-amber-500/15 text-amber-300 text-[10px] font-bold flex items-center justify-center cursor-help select-none"
        aria-hidden
      >
        ?
      </span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-64 -translate-x-1/2 rounded-lg border border-edge bg-card px-3 py-2 text-[11px] leading-relaxed text-gray-200 opacity-0 shadow-xl transition-opacity duration-150 group-hover/tip:opacity-100"
      >
        {children}
      </span>
    </span>
  );
}

/** İki tablonun ortak başlığı — aynı yükseklik, aynı hiza. */
function PanelHead({ title, tip, right }) {
  return (
    <div className="px-5 h-[52px] border-b border-edge/40 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-gray-200 uppercase tracking-wider">{title}</h3>
        <InfoTip>{tip}</InfoTip>
      </div>
      <span className="text-[11px] text-gray-400">{right}</span>
    </div>
  );
}

function RankCell({ i }) {
  return (
    <td className="py-2.5 pl-4 pr-1 w-9">
      <span className={`text-sm font-extrabold tabular-nums ${MEDAL[i] || "text-gray-300"}`}>{i + 1}</span>
    </td>
  );
}

function PlayerCell({ p, version }) {
  return (
    <td className="py-2.5 pr-2">
      <Link
        href={`/summoner/${encodeURIComponent(p.name)}/${encodeURIComponent(p.tag || "")}`}
        className="flex items-center gap-2.5 min-w-0 group/row"
        title={`${p.name}#${p.tag}`}
      >
        <Avatar p={p} version={version} />
        <span className="text-sm text-gray-100 truncate group-hover/row:text-white transition-colors">{p.name}</span>
      </Link>
    </td>
  );
}

/** Lig hücresi — İKİ TABLODA DA birebir aynı (rozet 26px + etiket text-xs). */
function TierCell({ ladder }) {
  return (
    <td className="py-2.5 pr-2 hidden sm:table-cell">
      <div className="flex items-center gap-1.5">
        <img
          src={`/ranks/badges/${ladder.tier.key.toLowerCase()}.webp`}
          alt=""
          width={26}
          height={26}
          className="shrink-0"
          onError={(e) => { e.currentTarget.style.display = "none"; }}
        />
        <span className={`text-xs font-semibold whitespace-nowrap ${ladder.tier.color}`}>
          {ladder.tier.label}
          {ladder.division ? ` ${ladder.division}` : ""}
        </span>
      </div>
    </td>
  );
}

const TH = "text-[10px] font-medium text-gray-400 uppercase tracking-wider pb-2";

export default function ChampionTopPlayers({ players, version, championName }) {
  if (!players?.length) {
    return (
      <div className="glass rounded-xl p-6 text-center">
        <p className="text-[11px] text-gray-400">Bu şampiyon için henüz yeterli oyuncu verisi toplanmadı.</p>
      </div>
    );
  }

  const rows = players.map((p) => ({
    ...p,
    mastery: mockMastery(p.name, p.games),
    ladder: mockRank(p.name, p.games, p.winRate),
  }));

  const byMastery = [...rows].sort((a, b) => b.mastery - a.mastery).slice(0, 10);
  const byLadder = [...rows].sort((a, b) => b.ladder.sort - a.ladder.sort).slice(0, 10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      {/* USTALIK */}
      <div className="glass rounded-xl overflow-hidden">
        <PanelHead
          title="Ustalık Sıralaması"
          right="Ustalık puanı"
          tip={
            <>
              <b className="text-amber-300">Bu tablo şu an tamamen örnek veridir.</b> Ustalık puanları üretilmiştir;
              üstelik oyuncu listesi de yalnız taradığımız maçlardan geldiği için TR&apos;nin gerçek ustalık
              sıralaması değildir. Prod anahtarla gerçek veriye bağlanacak.
            </>
          }
        />
        <div className="px-1 pb-1">
          <table className="w-full">
            <thead>
              <tr>
                <th className={`${TH} text-left pl-4`}>#</th>
                <th className={`${TH} text-left`}>Oyuncu</th>
                <th className={`${TH} text-left hidden sm:table-cell`}>Derece</th>
                <th className={`${TH} text-right pr-4`}>Ustalık</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/25">
              {byMastery.map((p, i) => (
                <tr key={`m-${p.name}-${p.tag}`} className="hover:bg-hover transition-colors">
                  <RankCell i={i} />
                  <PlayerCell p={p} version={version} />
                  <TierCell ladder={p.ladder} />
                  <td className="py-2.5 pr-4 text-right">
                    <span className="text-sm font-bold text-violet-300 tabular-nums whitespace-nowrap">
                      {fmtMastery(p.mastery)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* LADDER */}
      <div className="glass rounded-xl overflow-hidden">
        <PanelHead
          title="TR Sıralaması"
          right={`${championName} ile`}
          tip={
            <>
              <b className="text-amber-300">Bu tablo şu an tamamen örnek veridir.</b> Lig dereceleri ve LP
              üretilmiştir; oyuncu listesi de yalnız taradığımız maçlardan geldiği için TR sıralamasını
              temsil etmez. Prod anahtarla gerçek veriye bağlanacak.
            </>
          }
        />
        <div className="px-1 pb-1">
          <table className="w-full">
            <thead>
              <tr>
                <th className={`${TH} text-left pl-4`}>#</th>
                <th className={`${TH} text-left`}>Oyuncu</th>
                <th className={`${TH} text-left hidden sm:table-cell`}>Derece</th>
                <th className={`${TH} text-right px-2`}>LP</th>
                <th className={`${TH} text-right px-2`}>Maç</th>
                <th className={`${TH} text-right pr-4 pl-2`}>Kazanma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-edge/25">
              {byLadder.map((p, i) => (
                <tr key={`l-${p.name}-${p.tag}`} className="hover:bg-hover transition-colors">
                  <RankCell i={i} />
                  <PlayerCell p={p} version={version} />
                  <TierCell ladder={p.ladder} />
                  <td className="py-2.5 px-2 text-right text-sm text-gray-200 tabular-nums">{p.ladder.lp}</td>
                  <td className="py-2.5 px-2 text-right text-sm text-gray-200 tabular-nums">{p.games}</td>
                  <td className={`py-2.5 pr-4 pl-2 text-right text-sm font-bold tabular-nums ${wrCls(p.winRate)}`}>
                    {p.winRate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
