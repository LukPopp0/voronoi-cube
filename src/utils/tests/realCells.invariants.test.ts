import { describe, it, expect, beforeAll } from 'vitest';
import { cutCellCore, triangulateCellData } from '../cellCuttingAlgorithm';
import { prepareForPrint, cutInnerCubeFromCell } from '../printCutting';
import { polygonToTriangles } from '../geometryHelper';
import { checkCutCellData, checkTriangulated, polygonVolume, meshStats } from './helpers/meshInvariants';
import { generateRealCells } from './helpers/realCellFixtures';
import type { CutCellData } from '../../workers/types/workerOutput';
import realCellFixture87 from './fixtures/realCell-n100-seed1-particle87.json';
import realCellFixture90 from './fixtures/realCell-n100-seed1-particle90.json';

/**
 * Full-pipeline invariant sweep against REAL voro3d-computed Voronoi cells
 * (production geometry), replicating the app's exact call pattern end to
 * end: point generation -> voro3d.computeCells -> cutCellCore (gap cut) ->
 * prepareForPrint (inner-cube cut) -> triangulateCellData.
 *
 * This closes the last verification gap left by the synthetic-cell suite
 * (cellCuttingAlgorithm.test.ts, printCutting.test.ts, meshInvariants.test.ts,
 * syntheticCells.test.ts - all hand-built axis-aligned box cells) and gives
 * cutCellCore its first DIRECT test coverage (previously only exercised
 * indirectly through triangulateCellData - see Task 4's tolerance change,
 * PLANE_TOL/KEY_PRECISION loosened 1e-8/toFixed(9) -> 1e-7/toFixed(7)).
 *
 * Matrix: nPoints in {8, 30, 100} x innerCubeRatio in {0.5, 0.85, 0.95} x
 * one gapSize (app default) x 2 seeds. Kept intentionally small (voro3d/WASM
 * + O(faces^3) cutCellCore plane-intersection cost per cell) - see the
 * measured runtime note in the task report.
 */

// --- App defaults, mirrored from src/store/store.ts -------------------------
const SIZE = 15; // pointDistribution.size
const GAP_SIZE = 0.5; // gapSize
const DEFAULT_INNER_CUBE_RATIO = 0.85; // innerCubeSize (used as a ratio of SIZE)

const N_POINTS_LIST = [8, 30, 100];
const SEEDS = [1, 2];
const INNER_CUBE_RATIOS = [0.5, 0.85, 0.95];

// Volume-comparison slack at cube-size-15 scale (coordinates up to 7.5,
// volumes up to ~3375 for the full cube). Double-precision noise from
// dozens of cross/dot products per vertex is well under 1e-6 at this scale;
// this tolerance is generous headroom, not a defect mask.
const PER_CELL_VOL_TOL = 1e-4;
// Aggregate tolerance sums per-cell slack over up to ~100 cells per config.
const AGGREGATE_VOL_TOL = 1e-2;

// DEFECT D6 (found by this sweep, FIXED - see cutInnerCubeFromCell in
// printCutting.ts): cutInnerCubeFromCell used to produce a triangular
// topology hole (3 unpaired directed edges with zero reverse edges - a
// missing cap triangle) for these two specific real voro3d cells, at
// nPoints=100 seed=1 innerCubeRatio=0.5. Root cause: the "all vertices
// outside the cube -> keep face unchanged" fast path kept a face's edge
// whole even when that edge (between two outside vertices) dipped through
// the convex inner cube's interior - unlike "all vertices inside", "all
// vertices outside" is not itself a convex condition. Fixed by removing that
// unsound shortcut (always routing through subtractCubeFromFace unless the
// face is provably fully inside). No carve-out needed anymore - the sweep
// below is fully strict for every cell.

interface ConfigData {
  nPoints: number;
  seed: number;
  gapCutCells: CutCellData[];
}

const configs: ConfigData[] = [];
// Cache of prepareForPrint results per (config index, innerCubeRatio), so the
// stats-baseline section (Step 3) reuses the ratio=0.85 sweep results instead
// of recomputing them.
const preparedCache = new Map<string, CutCellData[]>();

const label = (cfg: ConfigData, extra?: string): string =>
  `nPoints=${cfg.nPoints} seed=${cfg.seed}${extra ? ` ${extra}` : ''}`;

beforeAll(async () => {
  for (const nPoints of N_POINTS_LIST) {
    for (const seed of SEEDS) {
      const cells = await generateRealCells(nPoints, seed, SIZE);

      const gapCutCells = cells.map(cell => {
        const triangleIndices = cell.faces.map(polygonToTriangles).flat().flat();
        const cutCellData = cutCellCore(cell, triangleIndices, GAP_SIZE, SIZE);
        // Mirror cellCuttingWorker.ts: cutCellCore always returns
        // particleId=-1, the caller stamps the real id afterward.
        cutCellData.particleId = cell.particleID;
        return cutCellData;
      });

      configs.push({ nPoints, seed, gapCutCells });
    }
  }
}, 60000);

describe('cutCellCore direct coverage: raw gap-cut output on real voro3d cells', () => {
  it('checkCutCellData reports zero violations for every cell, every config', () => {
    for (const cfg of configs) {
      for (const cell of cfg.gapCutCells) {
        const violations = checkCutCellData(cell);
        expect(violations, `${label(cfg, `particleId=${cell.particleId}`)}: ${JSON.stringify(violations)}`).toEqual(
          [],
        );
      }
    }
  });
});

describe.each(INNER_CUBE_RATIOS)('prepareForPrint sweep: innerCubeRatio=%s', innerCubeRatio => {
  it('checkCutCellData + checkTriangulated report zero violations, per-cell and aggregate volume bounds hold', () => {
    const innerCubeVolume = Math.pow(SIZE * innerCubeRatio, 3);

    for (const cfg of configs) {
      const prepared = prepareForPrint(cfg.gapCutCells, SIZE, innerCubeRatio);
      preparedCache.set(`${cfg.nPoints}:${cfg.seed}:${innerCubeRatio}`, prepared);

      const preparedById = new Map(prepared.map(c => [c.particleId, c]));
      let removedSum = 0;

      for (const gapCell of cfg.gapCutCells) {
        const gapCellVolume = polygonVolume(gapCell);
        const preparedCell = preparedById.get(gapCell.particleId);
        const cutVolume = preparedCell ? polygonVolume(preparedCell) : 0;
        const cellLabel = label(cfg, `particleId=${gapCell.particleId} ratio=${innerCubeRatio}`);

        expect(cutVolume, cellLabel).toBeGreaterThanOrEqual(-PER_CELL_VOL_TOL);
        expect(cutVolume, cellLabel).toBeLessThanOrEqual(gapCellVolume + PER_CELL_VOL_TOL);

        if (preparedCell) {
          expect(checkCutCellData(preparedCell), cellLabel).toEqual([]);

          const tri = triangulateCellData(preparedCell);
          const triMesh = {
            positions: Array.from(tri.positions),
            normals: Array.from(tri.normals),
            indices: Array.from(tri.indices),
          };
          expect(checkTriangulated(triMesh), cellLabel).toEqual([]);
        }

        removedSum += gapCellVolume - cutVolume;
      }

      // Removed material cannot exceed the inner cube's own volume.
      expect(removedSum, label(cfg, `ratio=${innerCubeRatio} total removed`)).toBeLessThanOrEqual(
        innerCubeVolume + AGGREGATE_VOL_TOL,
      );
    }
  });
});

describe('stats baseline (innerCubeRatio=0.85, app default)', () => {
  // Measured baseline (see task-9-report.md for the full table): across all
  // 6 configs (3 nPoints x 2 seeds) at the app-default innerCubeRatio=0.85,
  // observed triangleCount per cell topped out well under this bound, and
  // observed minAspectQuality (documented, no hard floor - see D5 in
  // printCutting.test.ts) is recorded as a comment below after the measured
  // run, not asserted.
  // Measured baseline (2026-07-18, nPoints {8,30,100} x seeds {1,2} at ratio
  // 0.85): max triangleCount per cell = 50, min minAspectQuality = 8.928e-4.
  const TRIANGLE_COUNT_UPPER_BOUND = 500; // 10x margin over measured max of 50

  it('triangleCount stays under the documented upper bound; zero unpaired edges/duplicate vertices', () => {
    let maxTriangleCount = 0;
    let minAspectObserved = Infinity;

    for (const nPoints of N_POINTS_LIST) {
      for (const seed of SEEDS) {
        const cfg = configs.find(c => c.nPoints === nPoints && c.seed === seed)!;
        const prepared =
          preparedCache.get(`${nPoints}:${seed}:${DEFAULT_INNER_CUBE_RATIO}`) ??
          prepareForPrint(cfg.gapCutCells, SIZE, DEFAULT_INNER_CUBE_RATIO);

        for (const cell of prepared) {
          const tri = triangulateCellData(cell);
          const triMesh = {
            positions: Array.from(tri.positions),
            normals: Array.from(tri.normals),
            indices: Array.from(tri.indices),
          };
          const stats = meshStats(cell, triMesh);

          const cellLabel = `nPoints=${nPoints} seed=${seed} particleId=${cell.particleId}`;
          expect(stats.unpairedEdges, cellLabel).toBe(0);
          expect(stats.duplicateVertexPairs, cellLabel).toBe(0);
          expect(stats.triangleCount, cellLabel).toBeLessThanOrEqual(TRIANGLE_COUNT_UPPER_BOUND);

          if (stats.triangleCount > maxTriangleCount) maxTriangleCount = stats.triangleCount;
          if (stats.minAspectQuality < minAspectObserved) minAspectObserved = stats.minAspectQuality;
        }
      }
    }

    // Measured baseline (documented, see task-9-report.md): max triangleCount
    // and min minAspectQuality actually observed across the sweep at
    // innerCubeRatio=0.85. Logged for visibility; not re-asserted beyond the
    // loose bound above (minAspectQuality has no floor - D5 sliver limitation).
    console.log(
      `[real-cell stats baseline] max triangleCount=${maxTriangleCount}, min minAspectQuality=${minAspectObserved.toExponential(3)}`,
    );
  });
});

// --- D6 regression: inner-cube cut topology hole on real voro3d cells ------
//
// Found by the sweep above at nPoints=100, seed=1, innerCubeRatio=0.5,
// gapSize=0.5 (app default), SIZE=15. cutInnerCubeFromCell used to produce
// exactly 3 unpaired directed edges forming a closed triangular cycle with
// zero reverse edges for each - i.e. a missing triangular cap face - for
// these two cells. Root cause: cutInnerCubeFromCell's "all vertices outside
// the cube -> keep face unchanged" fast path is unsound - unlike "all
// vertices inside" (sound, since the inner cube is convex), two vertices
// both outside a convex region can still have the edge between them dip
// through its interior. On these real (non-axis-aligned) cells, a face had
// exactly such an edge, shared with a neighboring face that DID clip it;
// keeping it whole here left a gap the two cap faces couldn't close. Fixed
// by removing that shortcut in printCutting.ts (always routing through
// subtractCubeFromFace, which handles this case correctly, unless the face
// is provably fully inside).
//
// Fixtures are the post-gap-cut CutCellData (cutCellCore output, particleId
// stamped) for particleId 87 and 90 of the nPoints=100/seed=1 sweep,
// captured so this regression runs without the voro3d/WASM dependency.
// Both cells' RAW gap-cut output is clean (see "raw gap-cut" describe block
// above) - the defect was isolated to the inner-cube-cut path.
describe('D6 regression (fixed): cutInnerCubeFromCell topology hole (found by real-cell sweep)', () => {
  const INNER_HALF = (SIZE * 0.5) / 2;

  it('particleId 87 (nPoints=100 seed=1 ratio=0.5): checkCutCellData reports zero violations', () => {
    const cut = cutInnerCubeFromCell(realCellFixture87 as CutCellData, INNER_HALF);
    expect(checkCutCellData(cut)).toEqual([]);
  });

  it('particleId 90 (nPoints=100 seed=1 ratio=0.5): checkCutCellData reports zero violations', () => {
    const cut = cutInnerCubeFromCell(realCellFixture90 as CutCellData, INNER_HALF);
    expect(checkCutCellData(cut)).toEqual([]);
  });
});
