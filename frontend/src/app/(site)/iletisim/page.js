export const metadata = {
  title: "İletişim",
  description: "ElwGraphs ile iletişim ve LP takip talebi.",
};

const EMAIL = "isavond18@gmail.com";

export default function ContactPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-extrabold text-white">İletişim</h1>
      <p className="text-sm text-gray-500 mt-1">Soru, öneri ve LP takip talepleri için</p>

      <div className="mt-8 space-y-7 text-sm text-gray-300 leading-relaxed">
        <Section title="LP Takip Talebi">
          <p>
            Profilinizin <span className="text-gray-100">organik LP takibine</span> (maç maç gerçek LP
            değişimi, kesintisiz derece grafiği) alınmasını isterseniz Riot ID'nizle{" "}
            <span className="text-gray-100">isim#tag</span> bize ulaşın; hesabınızı takip listesine ekleyelim.
          </p>
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-[var(--tag-amber-bd)] bg-amber-500/10 px-4 py-3">
            <span className="text-[var(--tag-amber-text)] flex-shrink-0" aria-hidden>⚠️</span>
            <p className="text-[var(--tag-amber-text)] text-[13px] leading-relaxed">
              Bu adım şu an <span className="font-semibold">geçici</span>: takip listesi manuel yönetiliyor.
              Sistem geliştirmesi tamamlandığında takip otomatik olacak ve bunun için iletişime geçmenize
              gerek kalmayacak.
            </p>
          </div>
        </Section>

        <Section title="E-posta">
          <p>
            Her türlü soru, hata bildirimi ve öneri için:{" "}
            <a href={`mailto:${EMAIL}`} className="text-blue-400 hover:underline">{EMAIL}</a>
          </p>
        </Section>

        <Section title="Not">
          <p>
            ElwGraphs bağımsız bir topluluk projesidir; Riot Games Inc. ile resmî bir bağlantısı yoktur.
            Tüm oyun verileri Riot'un herkese açık API'lerinden gelir.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-white mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
