/*
  Global 404 — eşleşmeyen TÜM URL'ler + notFound() çağrıları buraya düşer.
  (Kök app/not-found.js: Next bunu tüm uygulama için kullanır; (site) layout'u
  olmadan render edilir → ErrorScreen kendi tam-ekran tasarımını taşır.)
*/

import ErrorScreen from "@/components/shared/ErrorScreen";

export const metadata = {
  title: "404 — Sayfa Bulunamadı",
  description: "Aradığın sayfa bulunamadı.",
};

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Bu koridor bomboş"
      desc="Aradığın sayfa haritada yok — belki Baron çaldı, belki hiç var olmadı. Recall atıp base'den devam edebilirsin."
      champion="Amumu"
      quote="Arkadaşım olur musun? — Amumu"
    />
  );
}
