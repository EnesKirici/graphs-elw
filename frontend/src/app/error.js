"use client"; // Hata sınırları Client Component olmak zorunda (React Error Boundary)

/*
  Global hata sınırı (500 tarzı runtime hataları) — kök layout'un altındaki her
  segmenti sarar; sayfa render'ında beklenmedik hata olursa bu ekran gösterilir.
  NOT: Bu Next sürümünde retry prop'unun adı `reset` DEĞİL `unstable_retry`
  (node_modules/next/dist/docs/.../error.md). Segmenti yeniden çekip render eder.
*/

import { useEffect } from "react";
import ErrorScreen from "@/components/shared/ErrorScreen";

export default function Error({ error, unstable_retry }) {
  useEffect(() => {
    // Prod'da mesaj generic gelir (digest ile sunucu logu eşleştirilir) — konsola bas yeter
    console.error(error);
  }, [error]);

  return (
    <ErrorScreen
      code="500"
      title="Bir şeyler patladı"
      desc="Sunucu tarafında beklenmedik bir hata oldu — muhtemelen Ziggs'in bombalarından biri. Tekrar deneyebilir ya da base'e dönebilirsin."
      champion="Ziggs"
      quote="Bombaya bak! — Ziggs"
      onRetry={unstable_retry}
    />
  );
}
