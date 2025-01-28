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
import { BufferGeomPoints } from '../../geometries/bufferGeomPoints';

export const MyScene = () => {
  const { nPoints, size, seed, restriction, distribution } = useVoronoiStore(
    state => state.pointDistribution
  );
  const debug = useVoronoiStore(state => state.debug);

  const pointDistribution: number[][] = useMemo(() => {
    if (nPoints < 2) return [[0, 0, 0]];
    const s = size - 0.0001;
    // return [
    //   [0, -0.49, 0],
    //   [0, 0.49, 0],
    // ];
    switch (distribution) {
      case 'fibonacci':
        return cubeDistribution(nPoints, s, seed + nPoints, fibonacciDistributionRestricted);
      case 'simple':
        return cubeDistribution(nPoints, s, seed + nPoints, sphereDistributionRestricted, [
          restriction,
        ]);
    }
    return [];
  }, [nPoints, distribution, size, seed, restriction]);

  return (
    <>
      <Lighting />
      <Controls />
      <ModelGroup>
        <VoronoiCube points={pointDistribution.flat()} size={size} />
        <InnerCube size={size} />
      </ModelGroup>
      {debug && (
        <>
          <axesHelper args={[size / 2]} />
          <BufferGeomPoints positions={new Float32Array(pointDistribution.flat())}>
            <pointsMaterial color={'#00ffff'} />
          </BufferGeomPoints>
        </>
      )}
    </>
  );
};
