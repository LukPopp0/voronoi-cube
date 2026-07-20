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

interface IVoronoiSettings {
  debug: boolean;
  setDebug: (debug: boolean) => void;
  innerCubeSize: number;
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
  explosionAmount: number;
  setExplosionAmount: (newAmount: number) => void;
  displayStyle: 'wireframe' | 'solid';
  setDisplayStyle: (displayStyle: 'wireframe' | 'solid') => void;
  gapSize: number;
  setGapSize: (gapSize: number) => void;
  cutCells: Map<number, CutCellData>;
  registerCutCell: (cellData: CutCellData) => void;
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
    innerCubeSize: 0.85,
    cutInnerCube: true,
    setCutInnerCube: (cutInnerCube: boolean) => set({ cutInnerCube }),
    cutBottomHole: true,
    setCutBottomHole: (cutBottomHole: boolean) => set({ cutBottomHole }),
    bottomCutoutWidth: 0.3,
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
    explosionAmount: 1.0,
    setExplosionAmount: (explosionAmount: number) => set({ explosionAmount }),
    displayStyle: 'solid',
    setDisplayStyle: (displayStyle: 'wireframe' | 'solid') => set({ displayStyle }),
    gapSize: 0.5,
    setGapSize: (gapSize: number) => set({ gapSize: gapSize }),
    cutCells: new Map<number, CutCellData>(),
    registerCutCell: (cellData: CutCellData) =>
      set(state => {
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
