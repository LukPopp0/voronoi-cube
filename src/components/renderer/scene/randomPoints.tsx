import { useEffect, useMemo, useState } from 'react';
import {
  cubeDistributionRestricted,
  sphereDistributionRestricted,
} from '../../../utils/randomDistributions';
import { Voro3D } from 'voro3d';
import { BufferGeomPoints } from '../../geometries/bufferGeomPoints';
import { Cell } from '../../voronoi/Cell';

type RandomPointsProps = {
  nPoints?: number;
  size?: number;
  seed?: number;
  restriction?: number;
};

export const RandomPoints = ({
  nPoints = 12,
  size = 5,
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

  const [container, setContainer] = useState<Voro3D>();

  useEffect(() => {
    (async () => {
      const res = await Voro3D.create(
        -size / 2,
        size / 2,
        -size / 2,
        size / 2,
        -size / 2,
        size / 2,
        2,
        2,
        2
      );
      setContainer(res);
    })();
  }, [size]);

  const voronoiCells: JSX.Element[] = useMemo(() => {
    if (!container) return [];
    console.log('\nCREATING VORONOI\n', pointsCubeRestricted);
    const cells = container.computeCells(pointsCubeRestricted);
    console.log({ container, cells });
    const cellElements = cells.map((c, i) => <Cell key={i} cell={c} />);
    console.log({ cellElements });

    // const c = {
    //   particleID: 0,
    //   x: 0,
    //   y: 0,
    //   z: 0,
    //   nFaces: 2,
    //   vertices: [0.0, 0.0, 0.0, 5.0, 0.0, 0.0, 0.0, 0.0, 5.0, 0.0, 5.0, 0.0],
    //   faces: [
    //     [0, 1, 2],
    //     [0, 1, 3],
    //   ],
    // };
    // return [<Cell key={0} cell={c} />];

    return cellElements;
  }, [pointsCubeRestricted, container]);

  return (
    <>
      <BufferGeomPoints positions={typedPointsSphereArray}>
        <pointsMaterial color={'#00ffff'} />
      </BufferGeomPoints>
      <BufferGeomPoints positions={typedPointsCubeArray}>
        <pointsMaterial color={'#ffff00'} />
      </BufferGeomPoints>
      {voronoiCells}
    </>
  );
};
