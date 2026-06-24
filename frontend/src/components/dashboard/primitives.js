/*
  Dashboard paylaşılan sunum bileşenleri (hook'suz → server component).
  design_handoff_dashboard/components.jsx referans alındı; gerçek Data Dragon
  görselleri (champion.image) + ELW token'larıyla.
*/

import { roleLabels, ROLE_ICONS } from "@/lib/roles";

const TIER_COLORS = { S: "#ff5470", A: "#e8b44a", B: "#4f8cff", C: "#6b7282", D: "#4b5563" };

// İsimden deterministik hue (placeholder portre renkleri için)
export function hueOf(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
}

export function initialsOf(name = "") {
  return name
    .replace(/[^A-Za-zÇĞİÖŞÜçğıöşü' ]/g, "")
    .split(/[ ']/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
}

// Türkçe kompakt sayı: 4,8M / 312B
export function compactTR(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".", ",") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "B";
  return Math.round(n).toLocaleString("tr-TR");
}

// Yüzdeyi TR formatına: 57.9 -> "57,9%"
export function pctTR(v) {
  return Number(v).toFixed(1).replace(".", ",") + "%";
}

/* Şampiyon/oyuncu portresi — gerçek görsel varsa img, yoksa baş-harf placeholder */
export function ChampPortrait({ name = "", image, size = 40, round = false, initials }) {
  const label = initials ?? initialsOf(name);
  return (
    <div
      className={"portrait" + (round ? " round" : "")}
      style={{ width: size, height: size, "--h": hueOf(name), fontSize: size * 0.34 }}
      title={name}
    >
      {image ? <img src={image} alt={name} loading="lazy" /> : label}
    </div>
  );
}

/* Rol rozeti — lane ikon(lar)ı. Çoklu koridor için ayrı ikonlar (max 2). */
export function RoleBadge({ role, max = 2 }) {
  const labels = roleLabels(role, max);
  if (!labels.length) return null;
  return (
    <span className="role-badge">
      {labels.map((l) => (
        <img key={l} src={ROLE_ICONS[l]} alt={l} title={l} width={15} height={15} />
      ))}
    </span>
  );
}

/* Tier rozeti (S+ -> S'e indirgenir) */
export function TierBadge({ tier, size = 26 }) {
  const t = tier === "S+" ? "S" : tier;
  const color = TIER_COLORS[t] || TIER_COLORS.C;
  return (
    <span
      className="tier-badge num"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.5,
        color,
        borderColor: color + "66",
        background: color + "1a",
      }}
    >
      {t}
    </span>
  );
}

/* Patch değişim çipi: ▲ +2,9% / ▼ -3,0% */
export function ChangeChip({ value, showArrow = true }) {
  const up = value >= 0;
  return (
    <span className={"change-chip num " + (up ? "up" : "down")}>
      {showArrow && (up ? "▲" : "▼")} {up ? "+" : ""}
      {Number(value).toFixed(1).replace(".", ",")}%
    </span>
  );
}

/* Oran bar'ı — genişlik daima hedefte (CSS transition'la dolar) */
export function StatBar({ pct, color = "var(--accent)", max = 100, height = 7 }) {
  const w = Math.max(2, Math.min(100, (parseFloat(pct) / max) * 100));
  return (
    <div className="statbar" style={{ height }}>
      <div className="statbar-fill" style={{ width: w + "%", background: color, boxShadow: `0 0 10px ${color}55` }} />
    </div>
  );
}

/* Sıralı satır: #, portre, isim+rol, değer + bar */
export function RankRow({ rank, champ, value, color, href }) {
  const role = champ.role || champ.positions;
  const Inner = (
    <>
      <span className="rank-no num">{rank}</span>
      <ChampPortrait name={champ.name} image={champ.image} size={34} />
      <div className="rank-meta">
        <b>{champ.name}</b>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <RoleBadge role={role} />
          {champ.sampleSize ? (
            <small style={{ color: "var(--txt-3)", fontSize: 10, whiteSpace: "nowrap" }}>
              {champ.sampleSize} maç
            </small>
          ) : null}
        </span>
      </div>
      <div className="rank-val">
        <span className="num" style={{ color }}>{value}</span>
        <StatBar pct={value} color={color} />
      </div>
    </>
  );
  return href ? (
    <a className="rank-row" href={href}>{Inner}</a>
  ) : (
    <div className="rank-row">{Inner}</div>
  );
}
