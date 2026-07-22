import { create } from 'zustand';
import { updateURLParameter } from '../utils/urlEdit';
import { clamp } from 'three/src/math/MathUtils';
import { CutCellData } from '../workers/types/workerOutput';

interface IPointDistribution {
  distribution: 'simple' | 'fibonacci' | string;
  nPoints: number;
  size: number;
  seed: number;
  restriction: number;
}

/**
 * Developer / tuning values, surfaced only in the debug menu (no URL sync).
 * Groups the guard-ring distribution knobs with the formerly UI-less print/
 * render dev values (innerCubeSize, bottomCutoutSides, explosionAmount).
 */
interface IDebugSettings {
  // Guard-ring distribution (fibonacciDistributionGuarded). Angles in radians.
  guardCountMode: 'auto' | 'manual';
  guardCountPct: number;
  guardCount: number;
  phiGMode: 'cutout' | 'density' | 'manual';
  minPhiG: number;
  phiG: number;
  guardRotation: number;
  marginFactor: number;
  // Relocated dev knobs (previously top-level, no UI).
  innerCubeSize: number;
  bottomCutoutSides: number;
  explosionAmount: number;
  // Render the viewport cells as they will export (inner cube + bottom hole).
  previewPrintCuts: boolean;
}

interface IVoronoiSettings {
  debug: boolean;
  setDebug: (debug: boolean) => void;
  cutInnerCube: boolean;
  setCutInnerCube: (cutInnerCube: boolean) => void;
  cutBottomHole: boolean;
  setCutBottomHole: (cutBottomHole: boolean) => void;
  bottomCutoutWidth: number;
  setBottomCutoutWidth: (bottomCutoutWidth: number) => void;
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
  pointDistribution: IPointDistribution;
  setPointDistribution: (data: Partial<IPointDistribution>) => void;
  debugSettings: IDebugSettings;
  setDebugSettings: (data: Partial<IDebugSettings>) => void;
  displayStyle: 'wireframe' | 'solid';
  setDisplayStyle: (displayStyle: 'wireframe' | 'solid') => void;
  gapSize: number;
  setGapSize: (gapSize: number) => void;
  cutCells: Map<number, CutCellData>;
  cutCellsGeneration: number;
  registerCutCell: (cellData: CutCellData, generation: number) => void;
  clearCutCells: () => void;
}

export const useVoronoiStore = create<IVoronoiSettings>(set => {
  const urlParams = new URL(window.location.href).searchParams;
  const defaults = {
    distribution: urlParams.get('distribution') || 'fibonacci',
    nPoints: urlParams.get('nPoints') || 18,
    seed: urlParams.get('seed') || 1,
    restriction: urlParams.get('restriction') || 0.6,
  };

  return {
    debug: false,
    setDebug: (debug: boolean) => set({ debug }),
    cutInnerCube: true,
    setCutInnerCube: (cutInnerCube: boolean) => set({ cutInnerCube }),
    cutBottomHole: true,
    setCutBottomHole: (cutBottomHole: boolean) => set({ cutBottomHole }),
    bottomCutoutWidth: 0.85,
    setBottomCutoutWidth: (bottomCutoutWidth: number) =>
      set({ bottomCutoutWidth: clamp(bottomCutoutWidth, 0.05, 1) }),
    darkMode: true,
    setDarkMode: (darkMode: boolean) => set({ darkMode }),
    pointDistribution: {
      distribution: defaults.distribution,
      nPoints: clamp(Number(defaults.nPoints), 2, 1000),
      size: 15,
      seed: Number(defaults.seed),
      restriction: clamp(Number(defaults.restriction), 0, 1),
    },
    setPointDistribution: (data: Partial<IPointDistribution>) =>
      set(state => {
        for (const p in data) {
          window.history.replaceState(
            '',
            '',
            updateURLParameter(window.location.href, p, (data as Record<string, any>)[p]),
          );
        }

        return {
          ...state,
          pointDistribution: {
            ...state.pointDistribution,
            ...data,
          },
        };
      }),
    debugSettings: {
      guardCountMode: 'auto',
      guardCountPct: 0.25,
      guardCount: 8,
      phiGMode: 'cutout',
      minPhiG: 0.15, // ~8.6 deg floor
      phiG: Math.PI / 4, // 45 deg (manual-mode fallback value)
      guardRotation: 0,
      marginFactor: 0.5,
      innerCubeSize: 0.85,
      bottomCutoutSides: 8,
      explosionAmount: 1.0,
      previewPrintCuts: false,
    },
    setDebugSettings: (data: Partial<IDebugSettings>) =>
      set(state => ({
        ...state,
        debugSettings: { ...state.debugSettings, ...data },
      })),
    displayStyle: 'solid',
    setDisplayStyle: (displayStyle: 'wireframe' | 'solid') => set({ displayStyle }),
    gapSize: 0.5,
    setGapSize: (gapSize: number) => set({ gapSize: gapSize }),
    cutCells: new Map<number, CutCellData>(),
    cutCellsGeneration: 0,
    // Cells register asynchronously as their workers finish. `generation` bumps
    // on every recompute (see voronoiCube.tsx); a newer generation resets the
    // map so it only ever holds the current computation's cells (no stale ghosts
    // in the export), and stale stragglers from an older generation are ignored.
    registerCutCell: (cellData: CutCellData, generation: number) =>
      set(state => {
        if (generation < state.cutCellsGeneration) return {};
        if (generation > state.cutCellsGeneration) {
          const newMap = new Map<number, CutCellData>();
          newMap.set(cellData.particleId, cellData);
          return { cutCells: newMap, cutCellsGeneration: generation };
        }
        const newMap = new Map(state.cutCells);
        newMap.set(cellData.particleId, cellData);
        return { cutCells: newMap };
      }),
    clearCutCells: () => set({ cutCells: new Map<number, CutCellData>() }),
  };
});

// Connect zustand store with Redux Devtools Browser extension
if ((window as any).__REDUX_DEVTOOLS_EXTENSION__) {
  const connection = (window as any).__REDUX_DEVTOOLS_EXTENSION__.connect({
    name: 'Voronoi Settings',
  });
  connection.init(useVoronoiStore.getState());
  useVoronoiStore.subscribe(newState => {
    connection.send('State', newState);
  });
}
