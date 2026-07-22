import { useEffect, useRef, useState } from 'react';
import { useVoronoiStore } from '../../store/store';
import { DownloadButton } from './downloadButton';
import { DebugMenu } from './debugMenu';
import './settings.scss';

const bufferTimeMs = 20;

export const Settings = () => {
  const pointDistribution = useVoronoiStore(state => state.pointDistribution);
  const setPointDistribution = useVoronoiStore(state => state.setPointDistribution);
  const gapSize = useVoronoiStore(state => state.gapSize);
  const setGapSize = useVoronoiStore(state => state.setGapSize);
  const cutInnerCube = useVoronoiStore(state => state.cutInnerCube);
  const setCutInnerCube = useVoronoiStore(state => state.setCutInnerCube);
  const cutBottomHole = useVoronoiStore(state => state.cutBottomHole);
  const setCutBottomHole = useVoronoiStore(state => state.setCutBottomHole);
  const bottomCutoutWidth = useVoronoiStore(state => state.bottomCutoutWidth);
  const setBottomCutoutWidth = useVoronoiStore(state => state.setBottomCutoutWidth);

  const bufferTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [nPointsLoc, setNPointsLoc] = useState<number>(pointDistribution.nPoints);
  const [gapSizeLoc, setGapSizeLoc] = useState<number>(gapSize);

  useEffect(() => {
    if (nPointsLoc < 0 || isNaN(nPointsLoc)) return;
    setPointDistribution({ nPoints: nPointsLoc });
  }, [nPointsLoc, setPointDistribution]);

  useEffect(() => {
    setGapSizeLoc(gapSize);
  }, [gapSize]);

  useEffect(() => {
    return () => {
      if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
    };
  }, []);

  return (
    <div className="settings-container">
      <div className="preference">
        <label htmlFor="distribution">Distribution Function</label>
        <select
          id="distribution"
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
          id="nPoints"
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
          id="seed"
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
              id="restriction"
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
      )}
      <div className="preference">
        <label htmlFor="gapSize">Gap Size</label>
        <div>
          <input
            id="gapSize"
            name="gapSize"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={gapSizeLoc}
            onChange={e => {
              const next = Number.parseFloat(e.target.value);
              setGapSizeLoc(next);

              if (bufferTimerRef.current) clearTimeout(bufferTimerRef.current);
              bufferTimerRef.current = setTimeout(() => setGapSize(next), bufferTimeMs);
            }}
          />
        </div>
      </div>
      <div className="preference">
        <label htmlFor="cutInnerCube">Cut Inner Cube</label>
        <input
          id="cutInnerCube"
          name="cutInnerCube"
          type="checkbox"
          checked={cutInnerCube}
          onChange={e => setCutInnerCube(e.target.checked)}
        />
      </div>
      <div className="preference">
        <label htmlFor="cutBottomHole">Bottom Cutout</label>
        <input
          id="cutBottomHole"
          name="cutBottomHole"
          type="checkbox"
          checked={cutBottomHole}
          onChange={e => setCutBottomHole(e.target.checked)}
        />
      </div>
      {cutBottomHole && (
        <div className="preference">
          <label htmlFor="bottomCutoutWidth">Cutout Width</label>
          <div>
            <input
              id="bottomCutoutWidth"
              name="bottomCutoutWidth"
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={bottomCutoutWidth}
              onChange={e => setBottomCutoutWidth(Number.parseFloat(e.target.value))}
            />
          </div>
        </div>
      )}
      <div>
        <DownloadButton />
      </div>
      <DebugMenu />
    </div>
  );
};
