import { create } from 'zustand';
import { updateURLParameter } from '../utils/urlEdit';

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
}

export const useVoronoiStore = create<IVoronoiSettings>(set => {
  const urlParams = new URL(window.location.href).searchParams;
  const defaults = {
    distribution: urlParams.get('distributionFunction'),
    nPoints: urlParams.get('nPoints'),
    seed: urlParams.get('seed'),
    restriction: urlParams.get('restriction'),
  };
  return {
    darkMode: true,
    setDarkMode: (darkMode: boolean) => set({ darkMode }),
    pointDistribution: {
      distribution: defaults.distribution ? defaults.distribution : 'fibonacci',
      nPoints: defaults.nPoints ? Number(defaults.nPoints) : 18,
      size: 10,
      seed: defaults.seed ? Number(defaults.seed) : 1,
      restriction: defaults.restriction ? Number(defaults.restriction) : 0.6,
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
    explosionAmount: 1.1,
    setExplosionAmount: (explosionAmount: number) => set({ explosionAmount }),
    displayStyle: 'solid',
    setDisplayStyle: (displayStyle: 'wireframe' | 'solid') => set({ displayStyle }),
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
