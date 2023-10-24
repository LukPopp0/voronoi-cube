import { useVoronoiStore } from '../../store/store';
import './settings.scss';

export const Settings = () => {
  const pointDistribution = useVoronoiStore(state => state.pointDistribution);
  const setPointDistribution = useVoronoiStore(state => state.setPointDistribution);
  const explosionAmount = useVoronoiStore(state => state.explosionAmount);
  const setExplosionAmount = useVoronoiStore(state => state.setExplosionAmount);
  return (
    <div className="settings-container">
      <div className="preference">
        <label htmlFor="nPoints">Number of points</label>
        <input
          name="nPoints"
          type="number"
          value={pointDistribution.nPoints}
          onChange={e => setPointDistribution({ nPoints: Number.parseInt(e.target.value) })}
        />
      </div>
      <div className="preference">
        <label htmlFor="seed">Seed</label>
        <input
          name="seed"
          type="number"
          value={pointDistribution.seed}
          onChange={e => setPointDistribution({ seed: Number.parseInt(e.target.value) })}
        />
      </div>
      <div className="preference">
        <label htmlFor="restriction">Restriction</label>
        <div>
          <input
            name="restriction"
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={pointDistribution.restriction}
            onChange={e => setPointDistribution({ restriction: Number.parseFloat(e.target.value) })}
          />
        </div>
      </div>
      <div className="preference">
        <label htmlFor="restriction">Explosion Amount</label>
        <div>
          <input
            name="explosionAmount"
            type="range"
            min={1}
            max={2}
            step={0.05}
            value={explosionAmount}
            onChange={e => setExplosionAmount(Number.parseFloat(e.target.value))}
          />
        </div>
      </div>
    </div>
  );
};
