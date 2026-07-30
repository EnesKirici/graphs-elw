"use client";

import { useEffect, useMemo, useState } from "react";
import TierToolbar from "./tier/TierToolbar";
import FeaturedStrip from "./tier/FeaturedStrip";
import TierBand from "./tier/TierBand";
import TierTable from "./tier/TierTable";
import { TIER_ORDER, TIER_OPEN_DEFAULT, championsInRole } from "@/lib/tierData";

const VIEW_KEY = "elw-tierlist-view";

// Arama eşleşmesi: noktalama ve boşluk yok sayılır ("kaisa" → Kai'Sa).
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function TierList({ data }) {
  const champions = data?.champions || [];
  const version = data?.version || data?.patch;

  const [role, setRole] = useState("ALL");
  const [query, setQuery] = useState("");
  const [view, setView] = useState("board");
  const [openTiers, setOpenTiers] = useState(TIER_OPEN_DEFAULT);
  // null = "henüz dokunulmadı" → o koridorun en üst derecesi gösterilir. Kullanıcı
  // bir çipe basar basmaz dizi olur ve seçim tamamen ona geçer (boş dizi = hepsi).
  const [tierFilter, setTierFilter] = useState(null);

  // Görünüm tercihi kalıcı — okuma mount sonrası (sunucu/istemci ilk render aynı kalsın).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "board" || saved === "table") setView(saved);
    } catch {}
  }, []);

  function changeView(v) {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  }

  // Koridor değişince derece seçimi sıfırlanır → yeni koridorun en üst derecesi açılır.
  function changeRole(r) {
    setRole(r);
    setTierFilter(null);
  }

  const inRole = useMemo(() => championsInRole(champions, role), [champions, role]);

  const searching = query.trim().length > 0;
  const filtered = useMemo(() => {
    if (!searching) return inRole;
    const q = norm(query);
    return inRole.filter((c) => norm(c.name).includes(q));
  }, [inRole, query, searching]);

  // Derece filtresinin çipleri: bu koridorda kaç şampiyon var (0 ise çip çizilmez).
  const tierCounts = useMemo(() => {
    const acc = {};
    for (const c of inRole) acc[c.rs.tier] = (acc[c.rs.tier] || 0) + 1;
    return acc;
  }, [inRole]);

  /* Açılışta yalnız EN ÜST derece gösterilir: koridorda S+ varsa o, yoksa S, yoksa
     sıradaki. Böylece sayfa "yamanın en güçlüleri" ile açılıyor; alt dereceler
     çiplerden bir tıkla ekleniyor. Arama yapılırken filtre devre dışı — aranan
     şampiyon hangi derecede olursa olsun bulunmalı. */
  const topTier = useMemo(() => TIER_ORDER.find((t) => tierCounts[t]) || null, [tierCounts]);
  const activeTiers = useMemo(() => {
    if (searching) return [];
    if (tierFilter === null) return topTier ? [topTier] : [];
    return tierFilter;
  }, [searching, tierFilter, topTier]);

  // Derece bölümleri — boş dereceler ve filtre dışı dereceler hiç çizilmez.
  const groups = useMemo(
    () =>
      TIER_ORDER.filter((tier) => activeTiers.length === 0 || activeTiers.includes(tier))
        .map((tier) => ({ tier, champs: filtered.filter((c) => c.rs.tier === tier) }))
        .filter((g) => g.champs.length > 0),
    [filtered, activeTiers]
  );

  // Tabloda da derece filtresi geçerli olsun (iki görünüm aynı kapsamı göstersin).
  const tableRows = useMemo(
    () => (activeTiers.length === 0 ? filtered : filtered.filter((c) => activeTiers.includes(c.rs.tier))),
    [filtered, activeTiers]
  );

  function toggleTierFilter(tier) {
    setTierFilter((prev) => {
      // İlk tıklama (prev henüz null — kullanıcı hiç dokunmadı, sadece topTier
      // görünürde "seçili" duruyordu): farklı bir dereceye tıklarsa TEK BAŞINA o
      // seçili olsun, görünmez varsayılanla birleşmesin. Önceden burada varsayılan
      // her zaman tıklanana EKLENİYORDU → "B'ye bastım ama S+ hâlâ açık" gibi
      // şaşırtıcı bir sonuç çıkıyordu (kullanıcı bildirdi, doğrulandı). Zaten
      // varsayılan olan dereceye basmak (S+'a tekrar gibi) onu kapatır → hepsi görünür.
      if (prev === null) return tier === topTier ? [] : [tier];
      return prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier];
    });
  }

  // Öne çıkanlar: en üstteki iki derece; hiç yoksa listenin başı.
  const featuredPool = useMemo(() => {
    const top = inRole.filter((c) => c.rs.tier === "S+" || c.rs.tier === "S");
    return (top.length ? top : inRole).slice(0, 6);
  }, [inRole]);

  function toggleTier(tier) {
    setOpenTiers((prev) => ({ ...prev, [tier]: !prev[tier] }));
  }

  // Her şey TEK panelin içinde: araç çubuğu, öne çıkanlar ve dereceler ayrı kartlar
  // değil, aynı yüzeyin ince ayraçlarla bölünmüş satırları.
  return (
    <div className="tl-panel glass">
      <TierToolbar
        role={role}
        onRole={changeRole}
        tiers={activeTiers}
        onTier={toggleTierFilter}
        counts={tierCounts}
        query={query}
        onQuery={setQuery}
        view={view}
        onView={changeView}
      />

      {view === "board" && !searching && featuredPool.length > 0 && (
        <FeaturedStrip pool={featuredPool} role={role} version={version} />
      )}

      {view === "board" ? (
        groups.length > 0 ? (
          groups.map((g) => (
            <TierBand
              key={`${g.tier}-${role}`}
              tier={g.tier}
              champs={g.champs}
              role={role}
              open={!!openTiers[g.tier]}
              onToggle={() => toggleTier(g.tier)}
              forceOpen={searching}
            />
          ))
        ) : (
          <p className="tl-empty">
            {searching ? `“${query}” bu koridorda listede değil.` : "Bu koridor için henüz yeterli maç verisi yok."}
          </p>
        )
      ) : (
        <TierTable champs={tableRows} role={role} />
      )}
    </div>
  );
}
