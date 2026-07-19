import { Voro3D } from 'voro3d';
import type { VoroCell } from 'voro3d';
import { cubeDistribution, fibonacciDistributionRestricted } from '../../randomDistributions';

/**
 * Generate real voro3d-computed Voronoi cells, mirroring the app's actual
 * call pattern (see src/components/renderer/scene/myScene.tsx and
 * voronoiCube.tsx) instead of synthetic box fixtures:
 * - points: fibonacci-restricted distribution projected onto a cube surface,
 *   `s = size - 0.0001` (myScene.tsx inset), seeded via `seed + nPoints`.
 * - container bounds: [-size/2, size/2] on every axis (voronoiCube.tsx).
 * - grid subdivisions: max(2, floor(flatPointCount / 10)) per axis
 *   (voronoiCube.tsx nX/nY/nZ effect).
 */
export const generateRealCells = async (
  nPoints: number,
  seed: number,
  size: number,
): Promise<VoroCell[]> => {
  const s = size - 0.0001;
  const points = cubeDistribution(nPoints, s, seed + nPoints, fibonacciDistributionRestricted).flat();

  const half = size / 2;
  const grid = Math.max(2, Math.floor(points.length / 10));
  const container = await Voro3D.create(-half, half, -half, half, -half, half, grid, grid, grid);

  return container.computeCells(points);
};
