import { describe, it, expect, beforeAll } from 'vitest';
import type { VoroCell } from 'voro3d';
import { cutCellCore, triangulateCellData } from '@/utils/cutting/cellCutting';
import { generateRealCells } from './helpers/realCellFixtures';
import {
  checkCutCellData,
  checkTriangulated,
  polygonVolume,
  meshStats,
  TriangulatedMesh,
} from './helpers/meshInvariants';

/**
 * Gap-cut (cutCellCore) invariants across a gapSize sweep, on real voro3d
 * cells. Complements realCells.invariants.test.ts (which only exercises gap
 * 0.5) and guards the half-space clipping rewrite: every cut cell must stay
 * watertight/manifold and shrink (0 < volume <= original) as the gap grows.
 */

const SIZE = 15;
const CONFIGS: { nPoints: number; seed: number }[] = [
  { nPoints: 12, seed: 1 },
  { nPoints: 30, seed: 2 },
];
const GAP_SWEEP = [0.1, 0.3, 0.5, 0.8];

const toMesh = (cellData: ReturnType<typeof cutCellCore>): TriangulatedMesh => {
  const t = triangulateCellData(cellData);
  return {
    positions: Array.from(t.positions),
    normals: Array.from(t.normals),
    indices: Array.from(t.indices),
  };
};

const rawCellVolume = (cell: VoroCell): number =>
  Math.abs(
    polygonVolume({
      vertices: cell.vertices,
      faces: cell.faces,
      particleId: -1,
      x: cell.x,
      y: cell.y,
      z: cell.z,
    }),
  );

describe('cutCellCore gap-cut invariants (real cells)', () => {
  const cellsByConfig = new Map<string, VoroCell[]>();

  beforeAll(async () => {
    for (const { nPoints, seed } of CONFIGS) {
      cellsByConfig.set(`${nPoints}-${seed}`, await generateRealCells(nPoints, seed, SIZE));
    }
  }, 60000);

  for (const { nPoints, seed } of CONFIGS) {
    for (const gap of GAP_SWEEP) {
      it(`n=${nPoints} seed=${seed} gap=${gap}: watertight and shrinking`, () => {
        const cells = cellsByConfig.get(`${nPoints}-${seed}`)!;

        for (const cell of cells) {
          const cut = cutCellCore(cell, gap, SIZE);

          // Watertight/manifold at the polygon level.
          expect(checkCutCellData(cut)).toEqual([]);

          if (cut.faces.length === 0) continue; // fully consumed by the gap

          const mesh = toMesh(cut);
          expect(checkTriangulated(mesh)).toEqual([]);
          const stats = meshStats(cut, mesh);
          expect(stats.unpairedEdges).toBe(0);
          expect(stats.duplicateVertexPairs).toBe(0);

          // The cut cell shrinks: positive volume, never larger than the
          // original (gaps only remove material, never add).
          const vol = polygonVolume(cut);
          expect(vol).toBeGreaterThan(0);
          expect(vol).toBeLessThanOrEqual(rawCellVolume(cell) + 1e-6);
        }
      });
    }
  }
});
