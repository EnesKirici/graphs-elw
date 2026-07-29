// Tek tip buton. variant + size. Link olarak da kullanılabilir (href verilirse <a>).

import Link from "next/link";

// Muted/pastel variantlar — neon değil (bkz. tones.js felsefesi).
const VARIANTS = {
  primary: "bg-[#3c5a86] hover:bg-[#456a9d] text-white border border-[#4a6ea0]/40",
  danger: "bg-[#8f5555] hover:bg-[#a06464] text-[#f2e6e6] border border-[#a06464]/40",
  dangerGhost: "border border-[#a06d6d]/40 text-[#cfa5a5] hover:bg-[#a06d6d]/10",
  neutral: "border border-edge text-gray-300 hover:text-white hover:bg-hover",
  ghost: "text-gray-400 hover:text-white hover:bg-hover",
};

const SIZES = {
  sm: "text-xs px-3 py-1.5 rounded-lg gap-1.5",
  md: "text-[13px] px-4 py-2 rounded-xl gap-2",
};

export default function Button({
  children, variant = "neutral", size = "md", href, icon,
  disabled = false, className = "", ...rest
}) {
  const cls = `inline-flex items-center justify-center font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${VARIANTS[variant] || VARIANTS.neutral} ${SIZES[size] || SIZES.md} ${className}`;
  const inner = (
    <>
      {icon && (
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
      )}
      {children}
    </>
  );
  if (href && !disabled) {
    return <Link href={href} className={cls} {...rest}>{inner}</Link>;
  }
  return <button className={cls} disabled={disabled} {...rest}>{inner}</button>;
}
