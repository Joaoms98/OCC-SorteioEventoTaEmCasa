import './prize.css';

/** Light burst behind the reward (CSS only: no external animation files, CSP friendly). */
export function RewardBurst() {
  return (
    <div className="reward-burst" aria-hidden="true">
      <span className="reward-burst-rays" />
      <span className="reward-burst-ring" />
      <span className="reward-burst-ring" />
    </div>
  );
}
