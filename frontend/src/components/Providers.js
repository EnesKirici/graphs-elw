"use client";

/*
  Providers - Tüm client-side provider'ları saran wrapper.

  Neden ayrı dosya?
  layout.js = Server Component (varsayılan).
  BackgroundProvider = Client Component ("use client").

  Server Component içinde direkt Client provider kullanamıyoruz.
  Bu yüzden ayrı bir "use client" dosyasında sarıyoruz.
*/

import { BackgroundProvider } from "@/context/BackgroundContext";

export default function Providers({ children }) {
  return <BackgroundProvider>{children}</BackgroundProvider>;
}
