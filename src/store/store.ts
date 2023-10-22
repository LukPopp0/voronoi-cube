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
