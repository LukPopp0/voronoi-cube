import { useVoronoiStore } from '../../store/store';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;
const toDeg = (rad: number) => Math.round(rad * RAD2DEG);

/**
 * Developer / tuning panel (collapsible). Surfaces the guard-ring distribution
 * knobs plus the formerly UI-less print/render dev values, all from the store's
 * `debugSettings` slice. Angles are stored in radians, shown here in degrees.
 */
export const DebugMenu = () => {
  const debug = useVoronoiStore(s => s.debug);
  const setDebug = useVoronoiStore(s => s.setDebug);
  const d = useVoronoiStore(s => s.debugSettings);
  const set = useVoronoiStore(s => s.setDebugSettings);

  return (
    <details className="debug-menu">
      <summary>Debug</summary>

      <div className="preference">
        <label htmlFor="debug">Debug view</label>
        <input
          id="debug"
          type="checkbox"
          checked={debug}
          onChange={e => setDebug(e.target.checked)}
        />
      </div>

      <div className="preference">
        <label htmlFor="guardCountMode">Guard count mode</label>
        <select
          id="guardCountMode"
          value={d.guardCountMode}
          onChange={e => set({ guardCountMode: e.target.value === 'manual' ? 'manual' : 'auto' })}
        >
          <option value="auto">Auto (% of points)</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      {d.guardCountMode === 'auto' ? (
        <div className="preference">
          <label htmlFor="guardCountPct">Guard count ({Math.round(d.guardCountPct * 100)}%)</label>
          <div>
            <input
              id="guardCountPct"
              type="range"
              min={0.05}
              max={0.5}
              step={0.01}
              value={d.guardCountPct}
              onChange={e => set({ guardCountPct: Number.parseFloat(e.target.value) })}
            />
          </div>
        </div>
      ) : (
        <div className="preference">
          <label htmlFor="guardCount">Guard count</label>
          <input
            id="guardCount"
            type="number"
            min={4}
            step={4}
            value={d.guardCount}
            onChange={e => set({ guardCount: Number.parseInt(e.target.value) })}
          />
        </div>
      )}

      <div className="preference">
        <label htmlFor="phiGMode">Guard ring angle mode</label>
        <select
          id="phiGMode"
          value={d.phiGMode}
          onChange={e => {
            const v = e.target.value;
            set({ phiGMode: v === 'density' ? 'density' : v === 'manual' ? 'manual' : 'cutout' });
          }}
        >
          <option value="cutout">Fit cutout</option>
          <option value="density">Match density</option>
          <option value="manual">Manual</option>
        </select>
      </div>

      <div className="preference">
        <label htmlFor="minPhiG">Min ring angle ({toDeg(d.minPhiG)} deg)</label>
        <div>
          <input
            id="minPhiG"
            type="range"
            min={1}
            max={80}
            step={1}
            value={toDeg(d.minPhiG)}
            onChange={e => set({ minPhiG: Number.parseFloat(e.target.value) * DEG2RAD })}
          />
        </div>
      </div>

      {d.phiGMode === 'manual' && (
        <div className="preference">
          <label htmlFor="phiG">Ring angle ({toDeg(d.phiG)} deg)</label>
          <div>
            <input
              id="phiG"
              type="range"
              min={1}
              max={80}
              step={1}
              value={toDeg(d.phiG)}
              onChange={e => set({ phiG: Number.parseFloat(e.target.value) * DEG2RAD })}
            />
          </div>
        </div>
      )}

      <div className="preference">
        <label htmlFor="guardRotation">Ring rotation ({toDeg(d.guardRotation)} deg)</label>
        <div>
          <input
            id="guardRotation"
            type="range"
            min={0}
            max={360}
            step={1}
            value={toDeg(d.guardRotation)}
            onChange={e => set({ guardRotation: Number.parseFloat(e.target.value) * DEG2RAD })}
          />
        </div>
      </div>

      <div className="preference">
        <label htmlFor="marginFactor">Exclusion margin ({d.marginFactor.toFixed(2)})</label>
        <div>
          <input
            id="marginFactor"
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={d.marginFactor}
            onChange={e => set({ marginFactor: Number.parseFloat(e.target.value) })}
          />
        </div>
      </div>

      <div className="preference">
        <label htmlFor="innerCubeSize">Inner cube size</label>
        <div>
          <input
            id="innerCubeSize"
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={d.innerCubeSize}
            onChange={e => set({ innerCubeSize: Number.parseFloat(e.target.value) })}
          />
        </div>
      </div>

      <div className="preference">
        <label htmlFor="bottomCutoutSides">Cutout sides</label>
        <input
          id="bottomCutoutSides"
          type="number"
          min={3}
          max={16}
          step={1}
          value={d.bottomCutoutSides}
          onChange={e => set({ bottomCutoutSides: Number.parseInt(e.target.value) })}
        />
      </div>

      <div className="preference">
        <label htmlFor="explosionAmount">Explosion amount</label>
        <div>
          <input
            id="explosionAmount"
            type="range"
            min={0}
            max={3}
            step={0.05}
            value={d.explosionAmount}
            onChange={e => set({ explosionAmount: Number.parseFloat(e.target.value) })}
          />
        </div>
      </div>
    </details>
  );
};
