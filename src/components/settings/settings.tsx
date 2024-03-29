import { useEffect, useState } from 'react';
import { useVoronoiStore } from '../../store/store';
import { DownloadButton } from './downloadButton';
import './settings.scss';

let bufferTimer: ReturnType<typeof setTimeout>;
const bufferTime = 50;

export const Settings = () => {
  const pointDistribution = useVoronoiStore(state => state.pointDistribution);
  const setPointDistribution = useVoronoiStore(state => state.setPointDistribution);
  const gapSize = useVoronoiStore(state => state.gapSize);
  const setGapSize = useVoronoiStore(state => state.setGapSize);

  const [nPointsLoc, setNPointsLoc] = useState<number>(pointDistribution.nPoints);

  useEffect(() => {
    if (nPointsLoc < 0 || isNaN(nPointsLoc)) return;
    setPointDistribution({ nPoints: nPointsLoc });
  }, [nPointsLoc, setPointDistribution]);

  return (
    <div className="settings-container">
      <div className="preference">
        <label htmlFor="distribution">Distribution Function</label>
        <select
          name="distribution"
          value={pointDistribution.distribution}
          onChange={e =>
            setPointDistribution({
              distribution: e.target.value === 'fibonacci' ? 'fibonacci' : 'simple',
            })
          }
        >
          <option value="fibonacci">Fibonacci</option>
          <option value="simple">Simple</option>
        </select>
      </div>
      <div className="preference">
        <label htmlFor="nPoints">Number of points</label>
        <input
          name="nPoints"
          type="number"
          min={2}
          max={1000}
          value={nPointsLoc}
          onChange={e => {
            setNPointsLoc(Number.parseInt(e.target.value));
          }}
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
      {pointDistribution.distribution !== 'fibonacci' && (
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
              onChange={e =>
                setPointDistribution({ restriction: Number.parseFloat(e.target.value) })
              }
            />
          </div>
        </div>
      )}{' '}
      <div className="preference">
        <label htmlFor="gapSize">Gap Size</label>
        <div>
          <input
            name="gapSize"
            type="range"
            min={0}
            max={1}
            step={0.05}
            defaultValue={gapSize}
            onChange={e => {
              if (bufferTimer) clearTimeout(bufferTimer);
              bufferTimer = setTimeout(
                () => setGapSize(Number.parseFloat(e.target.value)),
                bufferTime
              );
            }}
          />
        </div>
      </div>
      <div>
        <DownloadButton />
      </div>
    </div>
  );
};
