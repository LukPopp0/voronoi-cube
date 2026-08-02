import {
  cubeDistribution,
  fibonacciDistributionGuarded,
  sphereDistributionRestricted,
  type GuardRingOptions,
} from './randomDistributions';

interface BaseParams {
  nPoints: number;
  size: number;
  seed: number;
  restriction: number;
  distribution: string;
}

/**
 * Select and run the point distribution for the current settings. Returns the
 * seed sites (as [x,y,z] triples) fed into voro3d. `guardRing` supplies the
 * guard-ring knobs (the debug settings structurally satisfy it); `cutoutWidth`
 * scales the ring angle in the fibonacci path.
 */
export const generatePoints = (
  params: BaseParams,
  guardRing: Omit<GuardRingOptions, 'cutoutWidth'>,
  cutoutWidth: number,
): number[][] => {
  const { nPoints, size, seed, restriction, distribution } = params;
  if (nPoints < 2) return [[0, 0, 0]];

  const s = size - 0.0001;
  switch (distribution) {
    case 'fibonacci': {
      const guardOpts: GuardRingOptions = { ...guardRing, cutoutWidth };
      return cubeDistribution(nPoints, s, seed + nPoints, fibonacciDistributionGuarded, [guardOpts]);
    }
    case 'simple':
      return cubeDistribution(nPoints, s, seed + nPoints, sphereDistributionRestricted, [restriction]);
  }
  return [];
};
