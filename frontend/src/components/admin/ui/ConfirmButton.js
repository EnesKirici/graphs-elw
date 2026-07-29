"use client";

// İki adımlı onay butonu (özellikle yıkıcı işlemler için). Idle → "Emin misin?" +
// Evet/Vazgeç. Retention "Eski Maçları Sil" gibi geri alınamaz aksiyonların tek kalıbı.

import { useState } from "react";
import Button from "./Button";

export default function ConfirmButton({
  label,
  confirmLabel = "Evet, sil",
  busyLabel = "Siliniyor...",
  question = "Emin misin? Geri alınamaz.",
  onConfirm,
  busy = false,
  disabled = false,
  variant = "danger",
  idleVariant = "dangerGhost",
  size = "sm",
  icon,
}) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant={idleVariant} size={size} icon={icon} disabled={disabled} onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[#ccb487]">{question}</span>
      <Button variant={variant} size={size} disabled={busy} onClick={onConfirm}>
        {busy ? busyLabel : confirmLabel}
      </Button>
      <Button variant="neutral" size={size} disabled={busy} onClick={() => setConfirming(false)}>
        Vazgeç
      </Button>
    </div>
  );
}
