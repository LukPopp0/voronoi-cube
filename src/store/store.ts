import create from 'zustand';

interface IPointDistribution {
  nPoints: number;
  size: number;
  seed: number;
  restriction: number;
}

interface IVoronoiSettings {
  pointDistribution: IPointDistribution;
  setPointDistribution: (data: Partial<IPointDistribution>) => void;
  explosionAmount: number;
  setExplosionAmount: (newAmount: number) => void;
  displayStyle: 'wireframe' | 'solid';
  setDisplayStyle: (displayStyle: 'wireframe' | 'solid') => void;
}

export const useVoronoiStore = create<IVoronoiSettings>(set => ({
  pointDistribution: {
    nPoints: 12,
    size: 10,
    seed: 0,
    restriction: 1,
  },
  setPointDistribution: (data: Partial<IPointDistribution>) =>
    set(state => ({
      ...state,
      pointDistribution: {
        ...state.pointDistribution,
        ...data,
      },
    })),
  explosionAmount: 1.2,
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
