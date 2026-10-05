/** Gift box drawn in the OCC palette (orange box, cream ribbon, brown outline). */
export function GiftIcon({ size = 140 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label="Presente">
      <g stroke="#2e2419" strokeWidth="4" strokeLinejoin="round">
        <path d="M60 40C46 16 22 22 32 37c5 6 18 5 28 3Z" fill="#fbf8cc" />
        <path d="M60 40c14-24 38-18 28-3-5 6-18 5-28 3Z" fill="#fbf8cc" />
        <rect x="22" y="58" width="76" height="50" rx="6" fill="#e8611f" />
        <rect x="14" y="40" width="92" height="22" rx="6" fill="#f2843f" />
        <rect x="52" y="40" width="16" height="68" fill="#fbf8cc" />
      </g>
      <path d="M28 68h10M28 76h6" stroke="#fbf8cc" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}
