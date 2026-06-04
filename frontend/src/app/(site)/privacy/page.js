export const metadata = {
  title: "Gizlilik Politikası",
  description: "ELW Graphs gizlilik politikası.",
};

const UPDATED = "4 Haziran 2026";

export default function PrivacyPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-extrabold text-white">Gizlilik Politikası</h1>
      <p className="text-sm text-gray-500 mt-1">Son güncelleme: {UPDATED}</p>

      <div className="mt-8 space-y-7 text-sm text-gray-300 leading-relaxed">
        <Section title="1. Genel Bakış">
          <p>
            ELW Graphs, gizliliğinize önem verir. Bu politika, sitenin hangi verileri topladığını,
            nasıl kullandığını ve koruduğunu açıklar. Siteyi kullanarak bu politikayı kabul etmiş olursunuz.
          </p>
        </Section>

        <Section title="2. Topladığımız Veriler">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>
              <span className="text-gray-200">Aranan oyuncu bilgileri:</span> Bir Riot ID arattığınızda, o
              oyuncuya ait Riot Games tarafından <span className="text-gray-200">herkese açık</span> sunulan
              oyun verilerini (ranked istatistik, maç geçmişi, şampiyon ustalığı vb.) çekeriz.
            </li>
            <li>
              <span className="text-gray-200">Önbellek (cache):</span> Performans için bu herkese açık oyun
              verilerini geçici olarak kendi veritabanımızda saklarız.
            </li>
            <li>
              <span className="text-gray-200">Anonim kullanım verisi:</span> Hangi sayfaların görüntülendiği
              gibi temel, kimliğe bağlı olmayan kullanım istatistikleri tutulabilir.
            </li>
          </ul>
        </Section>

        <Section title="3. Toplamadığımız Veriler">
          <p>
            Site, Riot hesabınıza <span className="text-gray-200">giriş yapmanızı istemez</span>. Şifre,
            e-posta veya kişisel hesap kimlik bilgisi toplamayız. Yalnızca herkese açık oyun verisini gösteririz.
          </p>
        </Section>

        <Section title="4. Verilerin Kullanımı">
          <p>
            Toplanan veriler yalnızca sitenin işlevini sağlamak (profil ve istatistik gösterimi,
            performans iyileştirme) için kullanılır. Verilerinizi satmayız.
          </p>
        </Section>

        <Section title="5. Üçüncü Taraflar">
          <p>
            Oyun verileri Riot Games’in resmî API’lerinden gelir ve Riot’un kendi gizlilik/şartlarına tabidir.
            Site, çerez kullanan üçüncü taraf analiz veya reklam servisleri kullanırsa bu bölüm güncellenecektir.
          </p>
        </Section>

        <Section title="6. Veri Saklama">
          <p>
            Önbelleğe alınan oyun verileri güncelliğini koruması için periyodik olarak yenilenir veya silinir.
            Kalıcı kişisel veri saklamayız.
          </p>
        </Section>

        <Section title="7. Haklarınız">
          <p>
            Sitede sizinle ilgili gösterilen bir herkese açık veriye dair talebiniz olursa bizimle iletişime
            geçebilirsiniz.
          </p>
        </Section>

        <Section title="8. İletişim">
          <p>
            Gizlilikle ilgili sorularınız için: <span className="text-blue-400">isavond18@gmail.com</span>
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
