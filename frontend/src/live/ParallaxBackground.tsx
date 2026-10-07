import { useEffect, useRef } from 'react';

interface ParallaxBackgroundProps {
  image: string;
  /** Max shift (px) caused by the pointer, in each direction. */
  pointerShift?: number;
  /** How much the background follows the page scroll (0 = fixed, 1 = scrolls with the content). */
  scrollFactor?: number;
}

const EASING = 0.06;
const IDLE_DRIFT = 0.35;
/** Extra size of the layer beyond the screen (keep in sync with .parallax-bg-layer in global.css). */
const OVERSCAN_PX = 60;
const SCROLL_OVERSCAN_PX = 220;

/** Touch screens get a plain CSS drift instead (see .parallax-bg-layer in global.css). */
const TOUCH_SCREEN = '(hover: none), (pointer: coarse)';

/**
 * Full-screen background that reacts to the pointer and to the page scroll (parallax), and
 * drifts slowly on its own so the projector never looks frozen. Respects "reduce motion".
 * On phones it only drifts: following the scroll from a script cannot keep up with the finger.
 */
export function ParallaxBackground({ image, pointerShift = 30, scrollFactor = 0.25 }: ParallaxBackgroundProps) {
  const layerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia(TOUCH_SCREEN).matches) return;

    let target = { x: 0, y: 0 };
    let current = { x: 0, y: 0 };
    let frame = 0;

    const onPointerMove = (event: PointerEvent) => {
      // -1..1 from the center of the screen.
      target = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      };
    };
    const onPointerLeave = () => {
      target = { x: 0, y: 0 };
    };

    const render = (time: number) => {
      current = { x: current.x + (target.x - current.x) * EASING, y: current.y + (target.y - current.y) * EASING };
      const driftX = Math.sin(time / 7000) * IDLE_DRIFT;
      const driftY = Math.cos(time / 9000) * IDLE_DRIFT;
      // The layer only overflows the screen by a few pixels, so the scroll offset is capped to never show its edge.
      const maxScroll = SCROLL_OVERSCAN_PX - OVERSCAN_PX;
      const scroll = Math.min(window.scrollY * scrollFactor, maxScroll);

      const x = -(current.x + driftX) * pointerShift;
      const y = -(current.y + driftY) * pointerShift - scroll;
      layer.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      frame = requestAnimationFrame(render);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onPointerLeave);
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('pointerleave', onPointerLeave);
    };
  }, [pointerShift, scrollFactor]);

  return (
    <div className="parallax-bg" aria-hidden="true">
      <div ref={layerRef} className="parallax-bg-layer" style={{ backgroundImage: `url(${image})` }} />
      <div className="parallax-bg-shade" />
    </div>
  );
}
