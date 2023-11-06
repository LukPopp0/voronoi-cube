import { useVoronoiStore } from '../../../store/store';
import { Controls } from './controls';
import { Lighting } from './lighting';
import { VoronoiCube } from './voronoiCube';
import { ModelGroup } from './modelGroup';
import { InnerCube } from './innerCube';
import { useMemo } from 'react';
import {
  cubeDistribution,
  fibonacciDistributionRestricted,
  sphereDistributionRestricted,
} from '../../../utils/randomDistributions';

export const MyScene = () => {
  const { nPoints, size, seed, restriction, distributionFunction } = useVoronoiStore(
    state => state.pointDistribution
  );

  const pointDistribution = useMemo(() => {
    if (nPoints < 2) return [[0, 0, 0]];
    const s = size - 0.0001;
    switch (distributionFunction) {
      case 'fibonacci':
        return cubeDistribution(nPoints, s, seed + nPoints, fibonacciDistributionRestricted);
      case 'simple':
        return cubeDistribution(nPoints, s, seed + nPoints, sphereDistributionRestricted, [
          restriction,
        ]);
    }
  }, [nPoints, distributionFunction, size, seed, restriction]);

  return (
    <>
      <Lighting />
      <Controls />
      <ModelGroup>
        <VoronoiCube points={pointDistribution.flat()} />
        <InnerCube />
        {/* <BufferGeomPoints positions={new Float32Array(pointDistribution.flat())}>
          <pointsMaterial color={'#00ffff'} />
        </BufferGeomPoints> */}
      </ModelGroup>
    </>
  );
};
