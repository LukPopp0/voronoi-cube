import { useMemo } from 'react';
import {
  cubeDistributionRestricted,
  sphereDistributionRestricted,
} from '../../../utils/randomDistributions';
import { VContainer } from '../../../utils/voronoi';
import { BufferGeomPoints } from '../../geometries/bufferGeomPoints';

type RandomPointsProps = {
  nPoints?: number;
  size?: number;
  seed?: number;
  restriction?: number;
};

export const RandomPoints = ({
  nPoints = 12,
  size = 10,
  seed = 1,
  restriction: minDistance = 0,
}: RandomPointsProps) => {
  const pointsSphereRestricted = useMemo(
    () => sphereDistributionRestricted(nPoints, size / 2, seed, minDistance),
    [minDistance, nPoints, seed, size]
  );
  const typedPointsSphereArray = useMemo(
    () => new Float32Array(pointsSphereRestricted.flat()),
    [pointsSphereRestricted]
  );
  const pointsCubeRestricted = useMemo(
    () => cubeDistributionRestricted(nPoints, size - 0.0001, seed, minDistance),
    [minDistance, nPoints, seed, size]
  );
  const typedPointsCubeArray = useMemo(
    () => new Float32Array(pointsCubeRestricted.flat()),
    [pointsCubeRestricted]
  );

  const voronoi = useMemo(() => {
    console.log('\nCREATING VORONOI\n');
    // Create points
    const half = size / 2;
    const container = new VContainer(-half, -half, -half, half, half, half, 2, 2, 2);
    console.log({ container });
    container.setParticles(pointsCubeRestricted);
    console.log('Set particles');
    const cells = container.getCells();
    console.log('Got Cells: ', cells);
  }, [pointsCubeRestricted, size]);

  return (
    <>
      <BufferGeomPoints positions={typedPointsSphereArray}>
        <pointsMaterial color={'#00ffff'} />
      </BufferGeomPoints>
      <BufferGeomPoints positions={typedPointsCubeArray}>
        <pointsMaterial color={'#ffff00'} />
      </BufferGeomPoints>
    </>
  );
};
