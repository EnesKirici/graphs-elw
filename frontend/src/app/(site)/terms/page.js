export const metadata = {
  title: "Kullanım Koşulları",
  description: "ELW Graphs kullanım koşulları.",
};

const UPDATED = "4 Haziran 2026";

export default function TermsPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-extrabold text-white">Kullanım Koşulları</h1>
      <p className="text-sm text-gray-500 mt-1">Son güncelleme: {UPDATED}</p>

      <div className="mt-8 space-y-7 text-sm text-gray-300 leading-relaxed">
        <Section title="1. Hizmet Hakkında">
          <p>
            ELW Graphs (“site”), League of Legends oyununa ait herkese açık istatistikleri
            görüntülemeye ve analiz etmeye yarayan bir web uygulamasıdır. Site; oyuncu profilleri,
            maç geçmişi, şampiyon istatistikleri, meta tier list ve build önerileri gibi içerikler sunar.
            Hizmet ücretsizdir ve “olduğu gibi” sağlanır.
          </p>
        </Section>

        <Section title="2. Riot Games ile İlişki">
          <p>
            ELW Graphs, Riot Games tarafından desteklenmemektedir ve Riot Games’in ya da Riot Games
            ürünlerinin üretiminde veya yönetiminde resmî olarak yer alan kişilerin görüşlerini yansıtmaz.
            League of Legends ve Riot Games ile ilgili tüm markalar Riot Games, Inc. şirketinin tescilli
            ticari markalarıdır.
          </p>
          <p className="text-gray-500 italic">
            ELW Graphs isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot
            Games or anyone officially involved in producing or managing Riot Games properties. Riot Games,
            and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
          </p>
        </Section>

        <Section title="3. Veri Kaynağı">
          <p>
            Site, verilerini Riot Games’in resmî API’lerinden ve Data Dragon servisinden alır. Gösterilen
            tüm oyun verileri Riot tarafından herkese açık olarak sunulan verilerdir. Tier list, build ve
            şampiyon istatistikleri gibi bazı içerikler, maç verilerinin tarafımızca toplanıp işlenmesiyle
            üretilir; bunlar tahminî/istatistiksel değerlerdir ve kesin doğruluk garantisi vermez.
          </p>
        </Section>

        <Section title="4. Kullanıcı Sorumluluğu">
          <p>
            Siteyi yasalara uygun şekilde kullanmayı kabul edersiniz. Siteye otomatik/aşırı istek
            göndermek, hizmeti aksatmak, tersine mühendislik yapmak veya verileri izinsiz ticari amaçla
            kopyalamak yasaktır.
          </p>
        </Section>

        <Section title="5. Sorumluluk Reddi">
          <p>
            Site içeriği bilgilendirme amaçlıdır. Verilerin güncelliği, doğruluğu veya kesintisizliği
            konusunda garanti verilmez. Sitenin kullanımından doğan dolaylı veya doğrudan zararlardan
            ELW Graphs sorumlu tutulamaz.
          </p>
        </Section>

        <Section title="6. Değişiklikler">
          <p>
            Bu koşullar zaman zaman güncellenebilir. Güncel sürüm her zaman bu sayfada yayınlanır;
            önemli değişikliklerde tarih güncellenir.
          </p>
        </Section>

        <Section title="7. İletişim">
          <p>
            Sorularınız için: <span className="text-blue-400">isavond18@gmail.com</span>
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
