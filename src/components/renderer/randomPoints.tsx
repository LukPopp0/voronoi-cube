import { Points } from '@react-three/drei';
import { useMemo } from 'react';
import {
  cubeDistributionRestricted,
  sphereDistributionRestricted,
} from '../../utils/randomDistributions';

type RandomPointsProps = {
  nPoints?: number;
  size?: number;
  seed?: number;
  minDistance?: number;
};

export const RandomPoints = ({
  nPoints = 12,
  size = 10,
  seed = 1,
  minDistance = 0,
}: RandomPointsProps) => {
  const pointsSphereRestricted = useMemo(
    () =>
      new Float32Array(sphereDistributionRestricted(nPoints, size / 2, seed, minDistance).flat()),
    [minDistance, nPoints, seed, size]
  );
  const pointsCubeRestricted = useMemo(
    () => new Float32Array(cubeDistributionRestricted(nPoints, size, seed, minDistance).flat()),
    [minDistance, nPoints, seed, size]
  );

  return (
    <>
      <Points positions={pointsSphereRestricted}>
        <pointsMaterial color={'#00ffff'} />
      </Points>
      <Points positions={pointsCubeRestricted}>
        <pointsMaterial color={'#ffff00'} />
      </Points>
    </>
  );
};
