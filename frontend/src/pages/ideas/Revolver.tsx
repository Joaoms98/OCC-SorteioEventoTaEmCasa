/**
 * The revolver seen down the muzzle. The anatomy is what sells the angle: the barrel sits high,
 * in front, hiding the chamber that is about to fire; the cylinder is behind and lower, so the
 * remaining chambers fan out around its bottom; the grip falls away from the viewer.
 * Drawn as SVG in the OCC sticker look — brown outlines, flat shapes, wooden grip.
 */

const CHAMBERS = 6;
const CYLINDER = { x: 110, y: 134 };
const RING_RADIUS = 44;
/** The bore, where the smoke and the flash are anchored. */
export const BORE = { x: 110, y: 96, r: 28 };

export function Revolver({ spent, position }: { spent: readonly number[]; position: number }) {
  // The cylinder turns so the chamber about to fire hides behind the barrel, at the top.
  const turn = { transform: `rotate(${-position * (360 / CHAMBERS)}deg)` };

  return (
    <svg className="revolver-art" viewBox="0 0 220 252" role="img" aria-label="Revólver apontado para você">
      <defs>
        <linearGradient id="revolver-grip" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5a4126" />
          <stop offset="55%" stopColor="#3a2a1b" />
          <stop offset="100%" stopColor="#241a10" />
        </linearGradient>
        <radialGradient id="revolver-cylinder" cx="34%" cy="26%" r="84%">
          <stop offset="0%" stopColor="#99a1aa" />
          <stop offset="52%" stopColor="#6a717a" />
          <stop offset="100%" stopColor="#363b42" />
        </radialGradient>
        <radialGradient id="revolver-barrel" cx="32%" cy="24%" r="80%">
          <stop offset="0%" stopColor="#c2cad3" />
          <stop offset="45%" stopColor="#848c96" />
          <stop offset="100%" stopColor="#3c424a" />
        </radialGradient>
        <radialGradient id="revolver-bore" cx="50%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#120e0a" />
          <stop offset="68%" stopColor="#070605" />
          <stop offset="100%" stopColor="#2b241c" />
        </radialGradient>
      </defs>

      {/* Grip, falling away from the viewer: narrower at the bottom. */}
      <path
        d="M88 176 h44 q6 0 7 7 l6 56 q1 9 -8 9 h-54 q-9 0 -8 -9 l6 -56 q1 -7 7 -7 z"
        fill="url(#revolver-grip)"
        stroke="#2e2419"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M96 196 h28 M94 212 h32 M92 228 h36" stroke="#2e2419" strokeWidth="3" opacity="0.5" strokeLinecap="round" />

      {/* Cylinder: behind the barrel and lower, so the chambers fan around its bottom. */}
      <circle cx={CYLINDER.x} cy={CYLINDER.y} r="66" fill="url(#revolver-cylinder)" stroke="#2e2419" strokeWidth="5" />
      <circle cx={CYLINDER.x} cy={CYLINDER.y} r="57" fill="none" stroke="#2e2419" strokeWidth="2" opacity="0.35" />

      <g className="revolver-chambers" style={turn}>
        {Array.from({ length: CHAMBERS }, (_, index) => {
          const angle = (index / CHAMBERS) * Math.PI * 2 - Math.PI / 2;
          const cx = CYLINDER.x + Math.cos(angle) * RING_RADIUS;
          const cy = CYLINDER.y + Math.sin(angle) * RING_RADIUS;
          return (
            <g key={index}>
              <circle cx={cx} cy={cy} r="15" fill="#1d2126" stroke="#2e2419" strokeWidth="3" />
              <circle cx={cx} cy={cy - 2} r="11" fill="#0d1013" />
              {spent.includes(index) ? (
                <circle cx={cx} cy={cy} r="7" fill="#e8611f" stroke="#2e2419" strokeWidth="2.5" />
              ) : null}
            </g>
          );
        })}
      </g>

      {/* Frame: top strap running back over the cylinder, with the hammer spur behind it. */}
      <path
        d="M96 40 h28 q7 0 7 7 v86 q0 7 -7 7 h-28 q-7 0 -7 -7 v-86 q0 -7 7 -7 z"
        fill="#565d66"
        stroke="#2e2419"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M100 46 h20 l-3 14 h-14 z" fill="#3f454c" stroke="#2e2419" strokeWidth="3" strokeLinejoin="round" />

      {/* Barrel in front, hiding the chamber that is about to fire. */}
      <circle cx={BORE.x} cy={BORE.y} r="52" fill="url(#revolver-barrel)" stroke="#2e2419" strokeWidth="5" />
      <circle cx={BORE.x} cy={BORE.y} r="41" fill="none" stroke="#2e2419" strokeWidth="2" opacity="0.4" />
      <circle cx={BORE.x} cy={BORE.y} r={BORE.r} fill="url(#revolver-bore)" stroke="#2e2419" strokeWidth="3.5" />

      {/* Rifling grooves around the bore. */}
      {Array.from({ length: 6 }, (_, index) => {
        const angle = (index / 6) * Math.PI * 2 + Math.PI / 12;
        return (
          <line
            key={index}
            x1={BORE.x + Math.cos(angle) * 15}
            y1={BORE.y + Math.sin(angle) * 15}
            x2={BORE.x + Math.cos(angle) * 25}
            y2={BORE.y + Math.sin(angle) * 25}
            stroke="#463c32"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        );
      })}

      {/* A highlight on the barrel's rim, so it reads as metal pointing at you. */}
      <path
        d="M76 68 a52 52 0 0 1 38 -22"
        fill="none"
        stroke="#e4e9ef"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.55"
      />

      {/* Front sight. */}
      <path d="M101 52 h18 l-4 -16 h-10 z" fill="#5b626b" stroke="#2e2419" strokeWidth="3.5" strokeLinejoin="round" />
    </svg>
  );
}
