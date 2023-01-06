import create from 'zustand';

interface IPointDistribution {
  nPoints: number;
  size: number;
  seed: number;
  minDistance: number;
}

interface IVoronoiSettings {
  pointDistribution: IPointDistribution;
  setPointDistribution: (data: Partial<IPointDistribution>) => void;
}

export const useVoronoiStore = create<IVoronoiSettings>(set => ({
  pointDistribution: {
    nPoints: 12,
    size: 10,
    seed: 4,
    minDistance: 4,
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
