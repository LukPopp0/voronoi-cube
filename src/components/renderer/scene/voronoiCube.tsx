import { useEffect, useMemo, useState } from 'react';
import { Voro3D } from 'voro3d';
import { Cell } from '../../voronoi/Cell';

type VoronoiCubeProps = {
  points: number[];
  size?: number;
};

export const VoronoiCube = ({ points = [], size = 10 }: VoronoiCubeProps) => {
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
    console.log(`\nCREATING VORONOI (${points.length / 3} points)\n`);
    let cells;

    try {
      cells = container.computeCells(points);
    } catch {
      window.location.reload();
      return [];
    }

    const cellElements = cells.map((c, i) => <Cell key={i} cell={c} />);
    return cellElements;
  }, [points, container]);

  return <group name="voronoiCube">{voronoiCells}</group>;
};
