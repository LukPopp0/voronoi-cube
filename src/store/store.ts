import create from 'zustand';

interface IPointDistribution {
  distributionFunction: 'simple' | 'fibonacci';
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

export const useVoronoiStore = create<IVoronoiSettings>(set => ({
  darkMode: true,
  setDarkMode: (darkMode: boolean) => set({ darkMode }),
  pointDistribution: {
    distributionFunction: 'fibonacci',
    nPoints: 18,
    size: 10,
    seed: 1,
    restriction: 0.6,
  },
  setPointDistribution: (data: Partial<IPointDistribution>) =>
    set(state => ({
      ...state,
      pointDistribution: {
        ...state.pointDistribution,
        ...data,
      },
    })),
  explosionAmount: 1.1,
  setExplosionAmount: (explosionAmount: number) => set({ explosionAmount }),
  displayStyle: 'solid',
  setDisplayStyle: (displayStyle: 'wireframe' | 'solid') => set({ displayStyle }),
}));

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
