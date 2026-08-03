/*
  Counter sayfası SSS bölümü — hem kullanıcı hem arama motoru için.

  NEDEN: counter sayfaları Google'da GÖSTERİLİYOR ama tık almıyordu (Locke 365
  gösterim / 0 tık). Sebeplerden biri sayfanın yalnızca bir listeden ibaret olması:
  "ince içerik" sinyali. Buradaki sorular VERİDEN üretilir → her şampiyonda farklı
  metin çıkar (171 sayfada aynı şablon = kopya içerik olurdu).

  Ayrıca arama verisi soru formunda geliyor: "warwick nasıl yenilir", "who counters
  jarvan", "best counter to fizz", "ww ne demek". Bunlar birebir başlık olarak burada.

  TÜRKÇE EK NOTU: şampiyon adları yabancı olduğu için "-'yı/-'ya" ekleri sık yanlış
  düşüyor (Warwick'ya ❌). Cümleler bilerek EK GEREKTİRMEYECEK şekilde kuruldu:
  "X karşısında", "X için", "X ile oynarken".
*/

const POS_LONG = {
  TOP: "Üst Koridor", JUNGLE: "Orman", MIDDLE: "Orta Koridor",
  BOTTOM: "Alt Koridor (ADC)", UTILITY: "Destek", SUPPORT: "Destek",
};

/**
 * Veriden SSS üretir. Boş dizi dönerse bölüm hiç render edilmez (uydurma içerik yok).
 * @returns {Array<{q: string, a: string}>}
 */
export function buildCounterFaq({ name, alias, counters, id }) {
  const primary = counters?.primaryPosition;
  const data = primary && counters?.byPosition?.[primary];
  if (!data) return [];

  const posLong = POS_LONG[primary] || primary;
  const patch = counters?.patches?.[0];
  const patchNote = patch ? `Patch ${patch}` : "güncel yama";
  const faq = [];

  const fmt = (m) => `${m.name} (%${m.winRate}, ${m.games} maç)`;
  const hard = (data.counters || []).slice(0, 4);
  const easy = (data.strongInto || []).slice(0, 4);

  if (hard.length) {
    faq.push({
      q: `${name} counter kimdir? En zorlu rakipler hangileri?`,
      a: `${posLong} rolünde ${name} karşısında en avantajlı şampiyonlar: ${hard.map(fmt).join(", ")}. ` +
         `Parantez içindeki oran, ${name} tarafının o eşleşmedeki kazanma yüzdesidir — yani oran ne kadar düşükse rakip o kadar güçlüdür. ` +
         `Veriler Emerald+ dereceli maçlardan, ${patchNote}.`,
    });
  }

  if (easy.length) {
    faq.push({
      q: `${name} kime karşı güçlü?`,
      a: `${name} en yüksek kazanma oranını şu eşleşmelerde yakalıyor: ${easy.map(fmt).join(", ")}. ` +
         `Bu şampiyonlar karşısında koridor avantajı ${name} tarafında.`,
    });
  }

  // "warwick nasıl yenilir" / "how to beat X" tipi sorgu — @15 verisi varsa somut cevap.
  const withLane = (data.counters || []).find((m) => m.lane15 && m.lane15.n >= 5);
  if (hard.length) {
    const lanePart = withLane
      ? ` Örneğin ${withLane.name} eşleşmesinde ${name} tarafı 15. dakikada ortalama ` +
        `${withLane.lane15.gd15 >= 0 ? "+" : ""}${withLane.lane15.gd15} gold farkla oynuyor — ` +
        `koridor fazı bu eşleşmenin belirleyici bölümü.`
      : "";
    faq.push({
      q: `${name} nasıl yenilir?`,
      a: `En pratik yol karşı seçim (counter pick) yapmak: ${hard.slice(0, 3).map((m) => m.name).join(", ")} ` +
         `gibi şampiyonlar ${name} karşısında istatistiksel olarak öne çıkıyor.${lanePart} ` +
         `Sıralama yalnızca kazanma oranına değil, maç sayısına göre de ağırlıklandırılır; ` +
         `az örneklemli uç oranlar listeyi yanıltmaz.`,
    });
  }

  if (alias) {
    faq.push({
      q: `${alias} ne demek? "${alias.toLowerCase()} ct" ne anlama gelir?`,
      a: `${alias}, oyuncular arasında ${name} için kullanılan kısaltmadır. ` +
         `"ct" ise counter kelimesinin kısaltmasıdır; "${alias.toLowerCase()} ct" araması ` +
         `${name} karşısında güçlü şampiyonları bulmak için yapılır. Bu sayfa tam olarak onu listeler.`,
    });
  }

  const posList = (counters?.positions || []).filter((p) => p.games > 0);
  if (posList.length > 1) {
    faq.push({
      q: `${name} hangi rollerde oynanıyor?`,
      a: `${posList.map((p) => `${POS_LONG[p.position] || p.position} (%${p.share} oranında, %${p.winRate} kazanma)`).join(", ")}. ` +
         `Counter listeleri role göre değişir — yukarıdaki rol sekmelerinden karşılaştırabilirsiniz.`,
    });
  }

  return faq;
}

/** JSON-LD (FAQPage) — arama motorunun soru-cevabı anlaması için. */
export function faqJsonLd(faq) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export default function CounterFaq({ faq }) {
  if (!faq?.length) return null;

  return (
    <section className="mt-8">
      <h2 className="text-base font-bold text-white mb-3">Sık Sorulan Sorular</h2>
      <div className="glass rounded-xl divide-y divide-edge/25">
        {faq.map((f) => (
          <details key={f.q} className="group px-5 py-4">
            <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-sm font-medium text-gray-100 hover:text-white transition-colors">
              <h3 className="text-sm font-medium">{f.q}</h3>
              <svg
                className="w-4 h-4 text-gray-500 shrink-0 transition-transform group-open:rotate-180"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <p className="text-xs text-gray-400 leading-relaxed mt-2.5">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
