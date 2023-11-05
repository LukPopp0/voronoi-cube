import { useVoronoiStore } from '../../../store/store';
import { Controls } from './controls';
import { Lighting } from './lighting';
import { VoronoiCube } from './voronoiCube';
import { ModelGroup } from './modelGroup';
import { InnerCube } from './innerCube';
import { useMemo } from 'react';
import {
  cubeDistributionRestricted,
  fibonacciDistributionCube,
} from '../../../utils/randomDistributions';

export const MyScene = () => {
  const { nPoints, size, seed, restriction, distributionFunction } = useVoronoiStore(
    state => state.pointDistribution
  );

  const pointDistribution = useMemo(() => {
    if (nPoints < 2) return [[0, 0, 0]];
    switch (distributionFunction) {
      case 'fibonacci':
        return fibonacciDistributionCube(nPoints, size - 0.0001, seed);
      case 'simple':
        return cubeDistributionRestricted(nPoints, size - 0.0001, seed, restriction);
    }
  }, [nPoints, distributionFunction, size, seed, restriction]);

  return (
    <>
      <Lighting />
      <Controls />
      <ModelGroup>
        <VoronoiCube points={pointDistribution.flat()} />
        <InnerCube />
      </ModelGroup>
    </>
  );
};
