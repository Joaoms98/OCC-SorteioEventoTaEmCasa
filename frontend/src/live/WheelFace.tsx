import { Gift } from 'lucide-react';
import type { HTMLAttributes, RefObject } from 'react';
import { assetUrl } from '../api/httpClient';
import { conicGradient, type WheelSegment } from './wheelLayout';
import './wheel.css';

const MIN_LABEL_SPAN = 13;
const MIN_ICON_SPAN = 8;

interface WheelFaceProps {
  segments: WheelSegment[];
  /** Slice lit up once the wheel has stopped on it. */
  highlightedKey: string | null;
  spinning: boolean;
  description: string;
  /** The rotating disc: whoever animates the wheel writes its rotation here. */
  discRef: RefObject<HTMLDivElement | null>;
  className?: string;
  /** Handlers for wheels the visitor turns by hand. */
  rimProps?: HTMLAttributes<HTMLDivElement>;
}

/**
 * Roulette drawn in CSS (conic-gradient), modeled after assets/roulette-reference.jpg: pointer,
 * rim, slices with their labels and the stand. It does not move by itself.
 */
export function WheelFace({ segments, highlightedKey, spinning, description, discRef, className = '', rimProps }: WheelFaceProps) {
  const background = segments.length > 0 ? conicGradient(segments) : undefined;
  return (
    <div className={`wheel ${spinning ? 'wheel-spinning' : ''} ${className}`} role="img" aria-label={description}>
      <div className="wheel-pointer" aria-hidden="true" />
      <div className="wheel-rim" {...rimProps}>
        <div ref={discRef} className={`wheel-disc ${segments.length === 0 ? 'wheel-disc-empty' : ''}`} style={{ background }}>
          {segments.map((segment) => (
            <WheelLabel key={segment.key} segment={segment} highlighted={highlightedKey === segment.key} />
          ))}
        </div>
        <div className="wheel-hub" aria-hidden="true" />
      </div>
      <div className="wheel-stand" aria-hidden="true">
        <span className="wheel-stand-neck" />
        <span className="wheel-stand-base" />
      </div>
    </div>
  );
}

function WheelLabel({ segment, highlighted }: { segment: WheelSegment; highlighted: boolean }) {
  const span = segment.end - segment.start;
  const middle = segment.start + span / 2;
  // Labels on the left half are turned around so they never read upside down.
  const flipped = middle > 180;
  return (
    <>
      {highlighted && (
        <div
          className="wheel-highlight"
          style={{
            background: `conic-gradient(transparent ${segment.start}deg, rgb(251 248 204 / 38%) ${segment.start}deg ${segment.end}deg, transparent ${segment.end}deg)`,
          }}
        />
      )}
      <div className="wheel-label" style={{ transform: `rotate(${middle - 90}deg)` }}>
        <div
          className={`wheel-label-content ${flipped ? 'wheel-label-flipped' : ''}`}
          style={{ color: segment.color.text, fontSize: `calc(var(--wheel-size) * ${labelScale(span, segment.label)})` }}
        >
          {span >= MIN_LABEL_SPAN && (
            <span className={`wheel-label-text ${segment.label.length > LONG_LABEL ? 'wheel-label-text-long' : ''}`}>{segment.label}</span>
          )}
          {segment.kind === 'prize' &&
            span >= MIN_ICON_SPAN &&
            (segment.imageUrl ? (
              <img className="wheel-label-image" src={assetUrl(segment.imageUrl)} alt="" draggable={false} />
            ) : (
              <Gift className="wheel-label-icon" aria-hidden="true" />
            ))}
        </div>
      </div>
    </>
  );
}

const LONG_LABEL = 22;

/**
 * Font size (fraction of the wheel size): smaller on narrow slices so neighbors do not collide,
 * and on long names, which also get a third line (see .wheel-label-text-long) instead of being cut.
 */
function labelScale(span: number, label: string): number {
  const bySlice = Math.min(0.036, Math.max(0.024, span * 0.0014));
  return label.length > LONG_LABEL ? Math.max(0.022, bySlice * 0.8) : bySlice;
}
