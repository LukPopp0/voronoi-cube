import { useVoronoiStore } from '../../store/store';
import './settings.scss';

export const Settings = () => {
  const pointDistribution = useVoronoiStore(state => state.pointDistribution);
  const setPointDistribution = useVoronoiStore(state => state.setPointDistribution);
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
        <label htmlFor="size">Size</label>
        <input
          name="size"
          type="number"
          value={pointDistribution.size}
          onChange={e => setPointDistribution({ size: Number.parseInt(e.target.value) })}
        />
      </div>
      <div className="preference">
        <label htmlFor="minDistance">Minimum Point Distance</label>
        <input
          name="minDistance"
          type="number"
          value={pointDistribution.minDistance}
          onChange={e => setPointDistribution({ minDistance: Number.parseFloat(e.target.value) })}
        />
      </div>
    </div>
  );
};
