"use client";

import { useEffect, useMemo, useState } from "react";
import TierToolbar from "./tier/TierToolbar";
import FeaturedStrip from "./tier/FeaturedStrip";
import TierBand from "./tier/TierBand";
import TierTable from "./tier/TierTable";
import { TIER_ORDER, TIER_OPEN_DEFAULT, championsInRole } from "@/lib/tierData";
import { trackEvent } from "@/lib/analytics";

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
  // Boş dizi = filtre yok → BÜTÜN dereceler görünür. Sayfa hep böyle açılır.
  const [tierFilter, setTierFilter] = useState([]);
  // Dışarıdan gelen sıralama isteği (?sort=wr|pick|ban) — ana sayfadaki
  // "En Yüksek Win Rate → Tümünü Gör" gibi bağlantılar buraya düşer.
  const [urlSort, setUrlSort] = useState(null);

  // Görünüm tercihi kalıcı — okuma mount sonrası (sunucu/istemci ilk render aynı kalsın).
  // URL'deki ?sort= kayıtlı tercihi EZER: kullanıcı belirli bir sıralamayı görmek
  // için tıkladıysa, daha önce "board" seçmiş olması onu engellememeli.
  useEffect(() => {
    const sort = new URLSearchParams(window.location.search).get("sort");
    if (sort && ["wr", "pick", "ban", "games", "tier"].includes(sort)) {
      setUrlSort(sort);
      setView("table");
      return;
    }
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "board" || saved === "table") setView(saved);
    } catch {}
  }, []);

  function changeView(v) {
    // Tahta mı tablo mu tercih ediliyor — hangisinin varsayılan olacağını belirler.
    trackEvent("tierlist_gorunum", { gorunum: v });
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch {}
  }

  // Koridor değişince derece seçimi sıfırlanır → yeni koridor tam listeyle açılır.
  function changeRole(r) {
    trackEvent("tierlist_rol", { rol: r });
    setRole(r);
    setTierFilter([]);
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

  /* Açılışta LİSTENİN TAMAMI görünür — derece filtresi sadece kullanıcı bir çipe
     bastığında devreye girer. Önceden sayfa otomatik olarak yalnız en üst dereceyle
     (pratikte S+) açılıyordu; "tier list" beklentisi tam liste olduğu için bu
     şaşırtıcıydı ve alt dereceler gizli kalıyordu (kullanıcı bildirdi).
     Arama yapılırken filtre devre dışı — aranan şampiyon hangi derecede olursa
     olsun bulunmalı. */
  const activeTiers = useMemo(() => (searching ? [] : tierFilter), [searching, tierFilter]);

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

  // Çipler çoklu seçim: basılan derece listeye girer/çıkar. Hepsi kapanınca
  // filtre kalkar (boş dizi) ve liste yine tam görünür.
  function toggleTierFilter(tier) {
    setTierFilter((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]));
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
        <TierTable champs={tableRows} role={role} initialSort={urlSort} />
      )}
    </div>
  );
}
