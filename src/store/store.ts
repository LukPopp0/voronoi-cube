import create from 'zustand';

interface IPointDistribution {
  nPoints: number;
  size: number;
  seed: number;
  minDistance: number;
}

interface IVoronoiSettings {
  pointDistribution: IPointDistribution;
}

export const useVoronoiStore = create<IVoronoiSettings>(set => ({
  pointDistribution: {
    nPoints: 12,
    size: 10,
    seed: 0,
    minDistance: 0,
  },
  setPointDistribution: (data: IPointDistribution) =>
    set(state => ({
      ...state,
      pointDistribution: {
        ...state.pointDistribution,
        ...data,
      },
    })),
}));
