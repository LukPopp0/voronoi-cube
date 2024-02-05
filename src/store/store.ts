import { create } from 'zustand';
import { updateURLParameter } from '../utils/urlEdit';
import { clamp } from 'three/src/math/MathUtils';

interface IPointDistribution {
  distribution: 'simple' | 'fibonacci' | string;
  nPoints: number;
  size: number;
  seed: number;
  restriction: number;
}

interface IVoronoiSettings {
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
  pointDistribution: IPointDistribution;
  setPointDistribution: (data: Partial<IPointDistribution>) => void;
  explosionAmount: number;
  setExplosionAmount: (newAmount: number) => void;
  displayStyle: 'wireframe' | 'solid';
  setDisplayStyle: (displayStyle: 'wireframe' | 'solid') => void;
  crackSize: number;
  setCrackSize: (crackSize: number) => void;
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
    darkMode: true,
    setDarkMode: (darkMode: boolean) => set({ darkMode }),
    pointDistribution: {
      distribution: defaults.distribution,
      nPoints: clamp(Number(defaults.nPoints), 2, 1000),
      size: 10,
      seed: Number(defaults.seed),
      restriction: clamp(Number(defaults.restriction), 0, 1),
    },
    setPointDistribution: (data: Partial<IPointDistribution>) =>
      set(state => {
        for (const p in data) {
          window.history.replaceState(
            '',
            '',
            updateURLParameter(window.location.href, p, (data as Record<string, any>)[p])
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
    crackSize: 0.9,
    setCrackSize: (crackSize: number) => set({ crackSize }),
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
