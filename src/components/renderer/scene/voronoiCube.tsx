import { useEffect, useMemo } from 'react';
import { Voro3D } from 'voro3d';
import { Cell } from '../../voronoi/Cell';

type VoronoiCubeProps = {
  points: number[];
  size?: number;
};

const voroContainer = await Voro3D.create(-1, 1, -1, 1, -1, 1, 2, 2, 2);

export const VoronoiCube = ({ points = [], size = 10 }: VoronoiCubeProps) => {
  useEffect(() => {
    voroContainer.xMin = -size / 2;
    voroContainer.xMax = size / 2;
    voroContainer.yMin = -size / 2;
    voroContainer.yMax = size / 2;
    voroContainer.zMin = -size / 2;
    voroContainer.zMax = size / 2;
  }, [size]);

  useEffect(() => {
    voroContainer.nX = Math.max(2, Math.floor(points.length / 10));
    voroContainer.nY = Math.max(2, Math.floor(points.length / 10));
    voroContainer.nZ = Math.max(2, Math.floor(points.length / 10));
  }, [points.length]);

  const voronoiCells: JSX.Element[] = useMemo(() => {
    if (!voroContainer) return [];
    console.log(`\nCREATING VORONOI (${points.length / 3} points)\n`);
    let cells;

    try {
      cells = voroContainer.computeCells(points);
    } catch {
      console.log('Creating voronoi cells failed. Reloading.');
      window.location.reload();
      return [];
    }

    const cellElements = cells.map((c, i) => (
      <Cell key={i} userData={{ particleID: c.particleID }} cell={c} />
    ));
    // const cellElements = [
    //   <Cell key={1} userData={{ particleID: cells[0].particleID }} cell={cells[0]} />,
    // ];
    return cellElements;
  }, [points]);

  return <group name="voronoiCube">{voronoiCells}</group>;
};
