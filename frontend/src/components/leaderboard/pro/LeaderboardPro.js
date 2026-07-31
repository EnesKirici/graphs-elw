"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Flame, Zap, Shield } from "lucide-react";
import Tooltip from "@/components/shared/Tooltip";
import { rankBadgeUrl, miniCrestUrl } from "@/components/summoner/pro/rankUtils";

/* 2026-07-31 tamamen yeniden yazıldı, sonra dört tur genişletildi — tier list /
   Tüm Şampiyonlar ile aynı dil (.glass panel, max-w-7xl sayfa kapsayıcısı,
   .tl-view segment anahtarı).

   5. tur (ince ayar — "gereksiz animasyon", "neon kutu", "boş kalmış"):
   - Podyum portrelerindeki madalya-renkli DIŞ GLOW kaldırıldı (kullanıcı:
     "gereksiz animasyon" — statikti ama öyle okunuyordu). Cam parlaması + alt
     gradyan + ustalık rozeti (beğenildi) kaldı.
   - Rozet kutusu artık NÖTR pill (siyah/yarı-saydam + ince kenarlık) — canlı
     maçtaki StreakBadge ile AYNI dolgu, önceki renkli/"neon" arka plan atıldı.
   - hotStreak artık StreakBadge'in KENDİ parçacık animasyonunu kullanıyor
     (`.streak-fx`/`.ember`, globals.css'te zaten global — kopyalanmadı, aynı
     class'lar). Riot'un hotStreak bayrağı sayı vermiyor, o yüzden sayı YOK,
     yalnız canlı maçtaki "3+ seri" animasyonunun kendisi.
   - Podyumun LP/galibiyet/mağlubiyet/WR satırı "boş kalmış" (kullanıcı) —
     3 hücreli değer+etiket şeridine dönüştürüldü, LP rozeti büyüdü.
   - LP yanındaki derece rozeti: filtre satırında BÜYÜK .webp (rankBadgeUrl,
     4. turda karar verildi) kalıyor, ama LP SAYISININ yanında (tablo + podyum)
     `miniCrestUrl()`'e (aynı rankUtils.js, CommunityDragon SVG) geri dönüldü —
     kullanıcı o dar bağlamda büyük detaylı rozetin "yapay" durduğunu belirtti;
     bu zaten `LivePlayerCard.js`'in "LP yanında" için kullandığı varlık.

   4. tur: derece filtresi büyük .webp'e döndü (site konvansiyonu, rankUtils.js),
   tablo içerikleri büyüdü, rozetler lucide-react ikonlarına geçti.
   3. tur: podyuma koridor/rozet satırı + şampiyon portreleri 46×62→68×92.
   2. tur: derece pilleri ikon-only (10 derece, Diamond altı kilitli — prod key
   bekliyor, bkz. docs/plans/LEADERBOARD_DIVISIONS_PLAN.md), ilk 3 ayrı podyum,
   yeşil YOK (profil WR konvansiyonu: cyan/mavi/mor/kırmızı 60/50/44). */

// Canlı maçtaki seri parçacık animasyonu (LivePlayerCard.js) — AYNI koordinatlar,
// globals.css'teki .streak-fx/.ember class'ları site genelinde zaten yüklü.
const STREAK_PARTS = [
  { x: 36, y: 42, dx: -3 }, { x: 52, y: 26, dx: 0 }, { x: 66, y: 44, dx: 3 },
  { x: 44, y: 60, dx: -2 }, { x: 58, y: 56, dx: 2 }, { x: 50, y: 72, dx: 0 },
];

const TIERS = [
  { key: "challenger", label: "Challenger", tier: "#e6b968", enabled: true },
  { key: "grandmaster", label: "Grandmaster", tier: "#ef8ba0", enabled: true },
  { key: "master", label: "Master", tier: "#b79df5", enabled: true },
  { key: "diamond", label: "Diamond", tier: "#5b8def", enabled: false },
  { key: "emerald", label: "Emerald", tier: "#2d9e6e", enabled: false },
  { key: "platinum", label: "Platinum", tier: "#4d95a0", enabled: false },
  { key: "gold", label: "Gold", tier: "#c89b3c", enabled: false },
  { key: "silver", label: "Silver", tier: "#80939e", enabled: false },
  { key: "bronze", label: "Bronze", tier: "#a9765a", enabled: false },
  { key: "iron", label: "Iron", tier: "#5c5a57", enabled: false },
];

const QUEUES = [
  { key: "RANKED_SOLO_5x5", label: "Solo/Duo" },
  { key: "RANKED_FLEX_SR", label: "Flex" },
];

const ROLE_ICONS = {
  Top: "/roles/top.svg", Mid: "/roles/mid.svg", Jungle: "/roles/jungle.svg",
  ADC: "/roles/bot.svg", Support: "/roles/support.svg",
};

const MEDALS = ["#e6b968", "#c7cdd8", "#c98a4b"];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

// Kazanma rengi — SİTENİN PROFİL KONVANSİYONU (ChampPerfListPro/Last30Panel ile
// birebir aynı eşikler): leaderboard tek oyuncu verisi, tier list'in agrega
// eşiğiyle (54/51/48) karıştırılmaz.
function wrTone(wr) {
  if (wr >= 60) return "#22d3ee";
  if (wr >= 50) return "#60a5fa";
  if (wr >= 44) return "#c084fc";
  return "#f87171";
}

// 6. tur: "maç oynama rozeti" — 400+ oyunla apex derecede zaten sık rastlanıyor,
// gerçek eşik tüm derecelerin verisi gelince (ladder:crawl sonrası) kalibre
// edilmeli (WR eşiklerinde yaptığımız gibi) — şimdilik makul bir başlangıç.
const MARATHON_GAMES = 600;

// Rozetler — hotStreak/freshBlood/veteran: LeaderboardClassic'in zaten kullandığı
// ikon eşlemesiyle AYNI (Flame/Zap/Shield). Kutu NÖTR (canlı maçtaki StreakBadge
// ile aynı dolgu) — renkli/"neon" arka plan yok, yalnız ikon renkli.
// marathon: kullanıcının ChatGPT ile ürettiği görsel (public/badges/marathon.png).
const BADGES = {
  hotStreak: { Icon: Flame, fg: "#f0a94e", label: "Galibiyet Serisi", desc: "Son maçlarını üst üste kazanmış" },
  freshBlood: { Icon: Zap, fg: "#8ab4f8", label: "Yeni Giriş", desc: "Bu lige yeni yükselmiş" },
  veteran: { Icon: Shield, fg: "#b79df5", label: "Veteran", desc: "Bu ligde 100+ maç oynamış" },
  marathon: { img: "/badges/marathon.png", fg: "#f0a94e", label: "Maraton", desc: `Bu sezon ${MARATHON_GAMES}+ maç oynamış` },
};

function BadgeIcon({ type, active, size = 15 }) {
  const [anchor, setAnchor] = useState(null);
  if (!active) return null;
  const b = BADGES[type];
  const Icon = b.Icon;
  // Riot'un hotStreak bayrağı boolean (sayı vermiyor) — canlı maçtaki 3+ seri
  // animasyonunu (kıvılcım parçacıkları) sayı göstermeden, doğrudan uyguluyoruz.
  const isHot = type === "hotStreak";
  return (
    <>
      <span className="lb-badge" onMouseEnter={(e) => setAnchor(e.currentTarget)} onMouseLeave={() => setAnchor(null)}>
        {b.img ? (
          <img src={b.img} alt="" width={size + 6} height={size + 6} className="lb-badge-img" />
        ) : (
          <span className="relative inline-flex">
            {isHot && (
              <span className="streak-fx" aria-hidden="true">
                {STREAK_PARTS.map((pt, n) => (
                  <i key={n} className="ember" style={{ left: `${pt.x}%`, top: `${pt.y}%`, "--dx": `${pt.dx}px`, animationDelay: `${n * 0.12}s` }} />
                ))}
              </span>
            )}
            <Icon size={size} strokeWidth={2.4} color={b.fg} fill={isHot ? b.fg : "none"} className="relative" />
          </span>
        )}
      </span>
      {anchor && (
        <Tooltip anchorEl={anchor}>
          <div className="tl-tip" style={{ minWidth: 0 }}>
            <b style={{ display: "block", fontSize: 13, fontWeight: 700, color: b.fg }}>{b.label}</b>
            <span style={{ fontSize: 11.5, color: "#9aa2b1" }}>{b.desc}</span>
          </div>
        </Tooltip>
      )}
    </>
  );
}

/* Podyum kartı — ilk 3 için. Kompakt tablodan farkı: koridor + rozet burada da
   var, şampiyon portreleri madalya rengiyle parlayan "gösterişli" kartlar
   (cam parlaması + alt gradyan + ustalık rozeti).
   7. tur: LP başlık satırının sağında "kötü durdu" (kullanıcı) — koridor ile
   rozetin ARASINA, kartın daha "ortasına" taşındı; LP'nin eski yerine (başlık
   satırının sağı) artık koridor ikonları geçti — ikisi yer değiştirdi. LP'ye
   "LP" birimi geri eklendi (kullanıcı: "yanında LP yazmıyor"). */
function PodiumCard({ entry, tierInfo, medal }) {
  const noBadges = !entry.hotStreak && !entry.freshBlood && !entry.veteran && entry.games < MARATHON_GAMES;
  return (
    <div className="lb-pod-card" style={{ "--medal": medal }}>
      <div className="lb-pod-head">
        <span className="lb-pod-rank">{entry.rank}</span>
        {entry.profileIcon ? (
          <img src={entry.profileIcon} alt="" className="lb-pod-avatar" />
        ) : (
          <span className="lb-pod-avatar-ph" />
        )}
        <div className="lb-pod-id">
          {entry.name?.gameName ? (
            <Link href={`/summoner/${encodeURIComponent(entry.name.gameName)}/${encodeURIComponent(entry.name.tagLine)}`} className="lb-pod-name">
              {entry.name.gameName}
              <span>#{entry.name.tagLine}</span>
            </Link>
          ) : (
            <span className="lb-name-ph">Oyuncu #{entry.rank}</span>
          )}
        </div>
        {/* LP'nin eski yeri — artık koridor ikonları (küçük, etiketsiz) */}
        <div className="lb-pod-head-roles">
          {entry.topRoles ? entry.topRoles.map((r, ri) => (
            <img key={ri} src={ROLE_ICONS[r.role] || ""} alt={r.role} title={r.role} />
          )) : null}
        </div>
      </div>

      {/* Değer+etiket şeridi — önceki hâli tek satır ince yazıydı, "boş kalmış"
          geri bildirimi (kullanıcı) — 3 hücreli kutuya dönüştürüldü. */}
      <div className="lb-pod-stats">
        <div className="lb-pod-stat"><b className="w">{entry.wins}</b><span>Galibiyet</span></div>
        <div className="lb-pod-stat"><b className="l">{entry.losses}</b><span>Mağlubiyet</span></div>
        <div className="lb-pod-stat"><b style={{ color: wrTone(entry.winRate) }}>%{entry.winRate}</b><span>Kazanma</span></div>
      </div>

      {/* Koridor + LP + rozet — LP artık kartın ortasında, koridor ile rozetin
          arasında. .lb-roles/.lb-badges kompakt tablodakiyle AYNI sınıf. */}
      <div className="lb-pod-meta">
        <div className="lb-pod-meta-group">
          <span className="lb-pod-meta-label">Koridor</span>
          <div className="lb-roles">
            {entry.topRoles ? entry.topRoles.map((r, ri) => (
              <img key={ri} src={ROLE_ICONS[r.role] || ""} alt={r.role} title={r.role} />
            )) : <span className="lb-empty-cell">—</span>}
          </div>
        </div>
        <div className="lb-pod-meta-lp">
          <img src={miniCrestUrl(tierInfo?.key)} alt="" title={tierInfo?.label} />
          <b>{entry.lp.toLocaleString()}</b><span>LP</span>
        </div>
        <div className="lb-pod-meta-group">
          <span className="lb-pod-meta-label">Rozet</span>
          <div className="lb-badges">
            <BadgeIcon type="hotStreak" active={entry.hotStreak} size={14} />
            <BadgeIcon type="freshBlood" active={entry.freshBlood} size={14} />
            <BadgeIcon type="veteran" active={entry.veteran} size={14} />
            <BadgeIcon type="marathon" active={entry.games >= MARATHON_GAMES} size={14} />
            {noBadges && <span className="lb-badges-empty">—</span>}
          </div>
        </div>
      </div>

      <div className="lb-pod-champs">
        {entry.topChamps ? entry.topChamps.slice(0, 4).map((c, ci) => (
          <span key={ci} className="lb-pod-champ" title={`${c.name} · Ustalık ${c.level}`}>
            <img src={c.splash || c.image} alt={c.name} loading="lazy" />
            <em className="lb-pod-champ-lvl">M{c.level}</em>
          </span>
        )) : <span className="lb-champs-empty">Şampiyon verisi yok</span>}
      </div>
    </div>
  );
}

export default function LeaderboardPro() {
  const [tier, setTier] = useState("challenger");
  const [queue, setQueue] = useState("RANKED_SOLO_5x5");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/leaderboard?tier=${tier}&queue=${queue}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [tier, queue]);

  const tierInfo = TIERS.find((t) => t.key === tier);
  const podium = data?.entries?.slice(0, 3) || [];
  const rest = data?.entries?.slice(3) || [];

  return (
    <div className="dpm-scope soft-scope min-h-screen">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src={rankBadgeUrl(tier)} alt={tier} width={44} height={44} className="drop-shadow-[0_4px_14px_rgba(0,0,0,0.5)]" />
            <div>
              <h1 className="text-2xl font-extrabold text-white">Sıralama</h1>
              <p className="text-sm text-gray-500 mt-1">TR1 — {tierInfo?.label} — {data?.total || 0} oyuncu</p>
            </div>
          </div>
        </div>

        <div className="lb-panel glass">
          {/* Araç çubuğu — derece solda (ikon-only, kendi rengiyle), kuyruk sağda */}
          <div className="lb-toolbar">
            <div className="lb-tiers no-scrollbar" role="group" aria-label="Derece">
              {TIERS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="lb-tier"
                  data-on={tier === t.key ? "1" : "0"}
                  style={{ "--tier": t.tier, "--tier-fg": t.tier }}
                  onClick={() => t.enabled && setTier(t.key)}
                  disabled={!t.enabled}
                  title={t.enabled ? t.label : `${t.label} — prod key onayı bekleniyor`}
                >
                  <img src={rankBadgeUrl(t.key)} alt={t.label} />
                  {!t.enabled && (
                    <span className="lb-tier-lock">
                      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 018 0v4" />
                      </svg>
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="tl-view" role="group" aria-label="Kuyruk">
              {QUEUES.map((q) => (
                <button key={q.key} type="button" data-on={queue === q.key ? "1" : "0"} onClick={() => setQueue(q.key)}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="lb-loading">
              <div className="lb-spin" />
              Yükleniyor...
            </div>
          )}

          {/* Podyum — ilk 3, geniş kart + gerçekten görünür şampiyon portreleri */}
          {!loading && podium.length > 0 && (
            <div className="lb-podium">
              {podium.map((entry, i) => (
                <PodiumCard key={entry.puuid || i} entry={entry} tierInfo={tierInfo} medal={MEDALS[i]} />
              ))}
            </div>
          )}

          {/* Kolon başlıkları */}
          {!loading && rest.length > 0 && (
            <div className="lb-grid lb-thead">
              <span>#</span>
              <span>Oyuncu</span>
              <span className="lb-col-champs">Şampiyonlar</span>
              <span className="lb-col-roles">Koridor</span>
              <span style={{ textAlign: "center" }}>LP</span>
              <span className="lb-col-games" style={{ textAlign: "center" }}>Oyun</span>
              <span className="lb-col-wl" style={{ textAlign: "center" }}>G / M</span>
              <span style={{ textAlign: "center" }}>WR</span>
              <span className="lb-col-badges" style={{ textAlign: "center" }}>Rozet</span>
            </div>
          )}

          {!loading && rest.map((entry, i) => (
            <div key={entry.puuid || i} className="lb-grid lb-row">
              <span className="lb-rank">{entry.rank}</span>

              {/* Oyuncu — gerçek profil ikonu (varsa) */}
              <div className="lb-player">
                {entry.profileIcon ? (
                  <img src={entry.profileIcon} alt="" className="lb-avatar" />
                ) : (
                  <span className="lb-avatar-ph" />
                )}
                {entry.name?.gameName ? (
                  <Link href={`/summoner/${encodeURIComponent(entry.name.gameName)}/${encodeURIComponent(entry.name.tagLine)}`} className="lb-name">
                    {entry.name.gameName}<span>#{entry.name.tagLine}</span>
                  </Link>
                ) : (
                  <span className="lb-name-ph">Oyuncu #{entry.rank}</span>
                )}
              </div>

              {/* Şampiyonlar — küçük kare ikon (dar sütun, "3D" portre podyumda) */}
              <div className="lb-champs lb-col-champs">
                {entry.topChamps ? entry.topChamps.slice(0, 5).map((c, ci) => (
                  <img key={ci} src={c.image} alt={c.name} className="lb-champ" title={`${c.name} · Ustalık ${c.level}`} loading="lazy" />
                )) : <span className="lb-champs-empty">—</span>}
              </div>

              <div className="lb-roles lb-col-roles">
                {entry.topRoles ? entry.topRoles.map((r, ri) => (
                  <img key={ri} src={ROLE_ICONS[r.role] || ""} alt={r.role} title={r.role} />
                )) : <span className="lb-empty-cell">—</span>}
              </div>

              <div className="lb-lp">
                <img src={miniCrestUrl(tierInfo?.key)} alt="" title={tierInfo?.label} />
                <b>{entry.lp.toLocaleString()}</b>
              </div>

              <span className="lb-games lb-col-games">{entry.games}</span>

              <div className="lb-wl lb-col-wl">
                <b className="w">{entry.wins}G</b><i>·</i><b className="l">{entry.losses}M</b>
              </div>

              <span className="lb-wr" style={{ color: wrTone(entry.winRate) }}>%{entry.winRate}</span>

              <div className="lb-badges lb-col-badges">
                <BadgeIcon type="hotStreak" active={entry.hotStreak} />
                <BadgeIcon type="freshBlood" active={entry.freshBlood} />
                <BadgeIcon type="veteran" active={entry.veteran} />
                <BadgeIcon type="marathon" active={entry.games >= MARATHON_GAMES} />
                {!entry.hotStreak && !entry.freshBlood && !entry.veteran && entry.games < MARATHON_GAMES && <span className="lb-badges-empty">—</span>}
              </div>
            </div>
          ))}

          {!loading && (!data?.entries || data.entries.length === 0) && (
            <div className="lb-loading">Veri bulunamadı</div>
          )}
        </div>
      </div>
    </div>
  );
}
