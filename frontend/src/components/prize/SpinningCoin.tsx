import './prize.css';

const EDGE_LAYERS = 11;

/**
 * 3D coin spinning on its vertical axis: OCC round logo on the front, OCC box logo on the back.
 * Stacked layers between both faces give it thickness.
 */
export function SpinningCoin() {
  return (
    <div className="spinning-coin" aria-hidden="true">
      <div>
        <div className="spinning-coin-back" />
        {Array.from({ length: EDGE_LAYERS }, (_, index) => (
          <i key={index} />
        ))}
        <em />
        <em />
        <div className="spinning-coin-front" />
      </div>
    </div>
  );
}
