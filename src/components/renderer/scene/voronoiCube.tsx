import { useEffect, useMemo, useRef } from 'react';
import type { ReactElement } from 'react';
import { Voro3D } from 'voro3d';
import { Cell } from '../../voronoi/Cell';

type VoronoiCubeProps = {
  points: number[];
  size?: number;
};

const voroContainer = await Voro3D.create(-1, 1, -1, 1, -1, 1, 2, 2, 2);

export const VoronoiCube = ({ points = [], size = 10 }: VoronoiCubeProps) => {
  // Monotonic generation, bumped whenever `points` changes. Passed to each Cell
  // so the store's cutCells map resets per recompute (drops stale ghost cells
  // from the export). Derived in render (no effect/setState) so it is available
  // before the child Cells register their worker results.
  const genRef = useRef(0);
  const prevPoints = useRef<number[]>(points);
  if (prevPoints.current !== points) {
    prevPoints.current = points;
    genRef.current += 1;
  }
  const generation = genRef.current;

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

  const voronoiCells: ReactElement[] = useMemo(() => {
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
      <Cell key={i} userData={{ particleID: c.particleID }} cell={c} generation={generation} />
    ));
    return cellElements;
  }, [points, generation]);

  return <group name="voronoiCube">{voronoiCells}</group>;
};
