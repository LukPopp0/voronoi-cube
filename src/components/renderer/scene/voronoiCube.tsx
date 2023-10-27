import { cubeDistributionRestricted } from '../../../utils/randomDistributions';
import { useEffect, useMemo, useState } from 'react';
import { Voro3D } from 'voro3d';
import { Cell } from '../../voronoi/Cell';

type VoronoiCubeProps = {
  nPoints?: number;
  size?: number;
  seed?: number;
  restriction?: number;
};

export const VoronoiCube = ({
  nPoints = 12,
  size = 10,
  seed = 1,
  restriction: minDistance = 0,
}: VoronoiCubeProps) => {
  const [container, setContainer] = useState<Voro3D>();

  const pointsCubeRestricted = useMemo(() => {
    if (nPoints < 2) return [[0, 0, 0]];
    return cubeDistributionRestricted(nPoints, size - 0.0001, seed, minDistance);
  }, [minDistance, nPoints, seed, size]);

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

    return cellElements;
  }, [pointsCubeRestricted, container]);

  return <group name="voronoiCube">{voronoiCells}</group>;
};
