const PARTICLE_COUNT = 8;

/** Eight floating sparks; their positions and timings live in prize.css (nth-of-type). */
export function Particles() {
  return (
    <>
      {Array.from({ length: PARTICLE_COUNT }, (_, index) => (
        <i key={index} aria-hidden="true" />
      ))}
    </>
  );
}
