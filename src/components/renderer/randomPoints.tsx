import { Points } from '@react-three/drei';
import { useMemo } from 'react';
import { distributePointsOnCube, distributePointsOnSphere } from '../../utils/randomDistributions';

type RandomPointsProps = {
  nPoints?: number;
  size?: number;
  seed?: number;
};

export const RandomPoints = ({ nPoints = 12, size = 10, seed = 1 }: RandomPointsProps) => {
  const pointsSphere = useMemo(
    () => new Float32Array(distributePointsOnSphere(nPoints, size / 2, seed).flat()),
    [nPoints, seed, size]
  );
  const pointsCube = useMemo(
    () => new Float32Array(distributePointsOnCube(nPoints, size, seed).flat()),
    [nPoints, seed, size]
  );

  return (
    <>
      <Points positions={pointsSphere}>
        <pointsMaterial color={'#22dd22'} />
      </Points>
      <Points positions={pointsCube}>
        <pointsMaterial color={'#dd2222'} />
      </Points>
    </>
  );
};
