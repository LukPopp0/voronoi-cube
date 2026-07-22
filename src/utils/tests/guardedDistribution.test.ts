import { describe, it, expect } from 'vitest';
import { Voro3D } from 'voro3d';
import type { VoroCell } from 'voro3d';
import {
  cubeDistribution,
  fibonacciDistributionGuarded,
  computeGuardCount,
  computePhiG,
  type GuardRingOptions,
} from '../randomDistributions';
import { cutCellCore, triangulateCellData } from '../cellCuttingAlgorithm';
import { prepareForPrint } from '../printCutting';
import { polygonToTriangles } from '../geometryHelper';
import { checkCutCellData, checkTriangulated, holeCount } from './helpers/meshInvariants';

/**
 * Verifies the guard-ring distribution (fibonacciDistributionGuarded):
 * - guard sites are seed-independent (a consistent-looking bottom),
 * - the guard ring is a correct, evenly spaced N-gon at the chosen angle,
 * - random sites are shielded above the exclusion band,
 * - the guard ring consistently borders the pole cell across seeds,
 * - the print pipeline stays watertight in the safe regime.
 * NOT a determinism guarantee - see the notes on the voro3d blocks below.
 */

const SIZE = 15;
const HALF = SIZE / 2;
const GAP_SIZE = 0.5;
const INNER_RATIO = 0.85;

// Fixed guard angle (~34 deg) so every guard site projects onto the cube
// bottom face - keeps the ring-geometry assertions simple.
const makeOpts = (partial: Partial<GuardRingOptions> = {}): GuardRingOptions => ({
  guardCountMode: 'auto',
  guardCountPct: 0.25,
  guardCount: 8,
  phiGMode: 'manual',
  minPhiG: 0.1,
  phiG: 0.6,
  guardRotation: 0,
  marginFactor: 0.5,
  cutoutWidth: 0.85,
  ...partial,
});

// beta = angle up from the south pole (-Y) for a point on the sphere.
const betaFromPole = (p: [number, number, number], radius: number) =>
  Math.acos(Math.min(1, Math.max(-1, -p[1] / radius)));

// Generate real voro3d cells from guarded points, mirroring the app pattern
// (myScene.tsx -> voronoiCube.tsx).
const generateGuardedCells = async (
  n: number,
  seed: number,
  opts: GuardRingOptions,
): Promise<VoroCell[]> => {
  const s = SIZE - 0.0001;
  const points = cubeDistribution(n, s, seed + n, fibonacciDistributionGuarded, [opts]).flat();
  const grid = Math.max(2, Math.floor(points.length / 10));
  const container = await Voro3D.create(-HALF, HALF, -HALF, HALF, -HALF, HALF, grid, grid, grid);
  return container.computeCells(points);
};

describe('computeGuardCount', () => {
  it('auto: scales with n, multiple of 4, clamped to [4, n-1]', () => {
    expect(computeGuardCount(30, makeOpts())).toBe(8); // round(7.5/4)*4 = 8
    expect(computeGuardCount(60, makeOpts())).toBe(16); // round(15/4)*4 = 16
    expect(computeGuardCount(8, makeOpts())).toBe(4); // round(2/4)*4 = 0 -> clamp 4
  });

  it('respects manual mode and the n-1 upper clamp', () => {
    expect(computeGuardCount(30, makeOpts({ guardCountMode: 'manual', guardCount: 12 }))).toBe(12);
    expect(computeGuardCount(5, makeOpts({ guardCountMode: 'manual', guardCount: 40 }))).toBe(4);
  });

  it('too few points to form a min-4 ring: all non-pole sites become the ring', () => {
    expect(computeGuardCount(4, makeOpts())).toBe(3);
    expect(computeGuardCount(1, makeOpts())).toBe(0);
  });
});

describe('computePhiG', () => {
  it('clamps to minPhiG and the equatorial max', () => {
    expect(computePhiG(30, makeOpts({ phiGMode: 'manual', phiG: 0.01, minPhiG: 0.2 }))).toBeCloseTo(
      0.2,
    );
    expect(computePhiG(30, makeOpts({ phiGMode: 'manual', phiG: 3.0 }))).toBeCloseTo(0.45 * Math.PI);
  });

  it('cutout mode scales linearly: width 1.0 -> 45 deg, 0.5 -> 22.5 deg', () => {
    expect(computePhiG(30, makeOpts({ phiGMode: 'cutout', cutoutWidth: 1.0, minPhiG: 0.05 }))).toBeCloseTo(
      Math.PI / 4,
    );
    expect(computePhiG(30, makeOpts({ phiGMode: 'cutout', cutoutWidth: 0.5, minPhiG: 0.05 }))).toBeCloseTo(
      Math.PI / 8,
    );
  });
});

describe('guard ring geometry', () => {
  const n = 30;
  const opts = makeOpts();
  const radius = (SIZE - 0.0001) / 2;
  const G = computeGuardCount(n, opts);
  const phiG = computePhiG(n, opts);

  it('first site is the south pole', () => {
    const pts = fibonacciDistributionGuarded(n, radius, 1, opts);
    expect(pts[0]).toEqual([0, -radius, 0]);
  });

  it('exactly G guard sites, all at beta = phiG, evenly spaced in theta', () => {
    const pts = fibonacciDistributionGuarded(n, radius, 1, opts);
    const guard = pts.slice(1, 1 + G);
    expect(guard.length).toBe(G);
    for (const g of guard) expect(betaFromPole(g, radius)).toBeCloseTo(phiG, 5);

    const angles = guard.map(g => Math.atan2(g[2], g[0])).map(a => (a < 0 ? a + 2 * Math.PI : a));
    angles.sort((a, b) => a - b);
    for (let k = 1; k < angles.length; k++) {
      expect(angles[k] - angles[k - 1]).toBeCloseTo((2 * Math.PI) / G, 5);
    }
  });

  it('guard sites are seed-independent (only the random field moves)', () => {
    const a = fibonacciDistributionGuarded(n, radius, 1, opts);
    const b = fibonacciDistributionGuarded(n, radius, 999, opts);
    for (let i = 0; i <= G; i++) expect(a[i]).toEqual(b[i]); // pole + guard ring
    // The random field differs between seeds (sanity: at least one point moved).
    const moved = a.slice(1 + G).some((p, idx) => p[0] !== b[1 + G + idx][0]);
    expect(moved).toBe(true);
  });

  it('shielding: no random site sits below the exclusion band', () => {
    const pts = fibonacciDistributionGuarded(n, radius, 1, opts);
    const phiExclude = phiG * (1 + opts.marginFactor);
    for (const p of pts.slice(1 + G)) {
      expect(betaFromPole(p, radius)).toBeGreaterThanOrEqual(phiExclude - 1e-9);
    }
  });
});

// The guard ring rings the pole consistently regardless of seed: for every
// seed the pole cell borders all G guard sites (the visible-bottom arrangement
// is seed-independent). The FULL pole cell is intentionally NOT deterministic -
// a lone ring leaves an uncapped central "chimney" that reaches the random
// field - but that is fine here: the wide cutout consumes the pole cell anyway,
// and the goal is a consistent-looking bottom, not bit-exact geometry.
describe('guard ring borders the pole cell for every seed (voro3d)', () => {
  const opts = makeOpts({ phiG: Math.PI / 4 });

  it.each([30, 60])('n=%i: all guard sites are neighbors of the pole cell', async n => {
    const G = computeGuardCount(n, opts);
    for (const seed of [1, 2, 3]) {
      const cells = await generateGuardedCells(n, seed, opts);
      const pole = cells.find(c => c.particleID === 0)!;
      const neighbors = new Set(pole.neighbors);
      for (let g = 1; g <= G; g++) {
        expect(neighbors.has(g), `n=${n} seed=${seed} missing guard ${g}`).toBe(true);
      }
    }
  }, 60000);
});

// Watertightness is non-negotiable for printing. Asserts manifoldness at a
// representative config (ring 45 deg, width 0.85). Low ring angles - which the
// default 'cutout' mapping produces for narrow cutouts - are covered by the
// low-angle hole test above (~30-45 deg, both cuts); all watertight since the
// negative-zero vertex-key fix in printCutting.ts.
describe('watertight after print cuts in the safe regime (voro3d)', () => {
  const opts = makeOpts({ phiG: Math.PI / 4, cutoutWidth: 0.85 });

  it.each([20, 40])('n=%i: every cell stays manifold through gap-cut + prepareForPrint', async n => {
    for (const seed of [1, 2, 3]) {
      const cells = await generateGuardedCells(n, seed, opts);
      const gapCut = cells.map(cell => {
        const tri = cell.faces.map(polygonToTriangles).flat().flat();
        const cut = cutCellCore(cell, tri, GAP_SIZE, SIZE);
        cut.particleId = cell.particleID;
        return cut;
      });

      const prepared = prepareForPrint(gapCut, SIZE, INNER_RATIO, {
        cutInnerCube: true,
        cutBottomHole: true,
        bottomCutoutWidth: opts.cutoutWidth,
        bottomCutoutSides: 8,
      });

      for (const cell of prepared) {
        const label = `n=${n} seed=${seed} particleId=${cell.particleId}`;
        expect(checkCutCellData(cell), label).toEqual([]);
        const tri = triangulateCellData(cell);
        expect(
          checkTriangulated({
            positions: Array.from(tri.positions),
            normals: Array.from(tri.normals),
            indices: Array.from(tri.indices),
          }),
          label,
        ).toEqual([]);
      }
    }
  }, 60000);
});

// FIXED (negative-zero vertex-key collision): at low guard-ring angles the
// bottom cut used to leave genuine holes (directed-edge imbalance) on all seeds
// incl. the app default. Holes only appeared when BOTH cuts ran, at world
// y = -innerCubeHalf (the inner-cube cavity floor / frustum top). Root cause was
// NOT the coincident plane per se: clipping a face through the frustum apex/axis
// (side planes meet at coordinate ~0) yields a component of IEEE -0, and
// VertexPool keyed vertices with toFixed(7) - "-0.0000000" != "0.0000000" - so a
// single apex vertex split into two pool entries, leaving unpaired edges exactly
// there. Symmetric geometry (the full-cube box fixture) produced consistent +0
// and stayed clean, which is why it manifested only on irregular voro3d cells.
// Fixed by normalizing the sign of zero in VertexPool's coordinate key
// (printCutting.ts `coordKey`).
describe('bottom cut leaves no real holes at low ring angles (voro3d)', () => {
  it('n=18 width 0.85 ring ~30-38 deg: every exported cell has zero holes', async () => {
    for (const phiG of [0.55, 0.67]) {
      // ~31.5 deg, ~38.4 deg
      const opts = makeOpts({ phiG, cutoutWidth: 0.85 });
      for (const seed of [1, 2, 3]) {
        const cells = await generateGuardedCells(18, seed, opts);
        const gapCut = cells.map(cell => {
          const tri = cell.faces.map(polygonToTriangles).flat().flat();
          const cut = cutCellCore(cell, tri, GAP_SIZE, SIZE);
          cut.particleId = cell.particleID;
          return cut;
        });
        const prepared = prepareForPrint(gapCut, SIZE, INNER_RATIO, {
          cutInnerCube: true,
          cutBottomHole: true,
          bottomCutoutWidth: opts.cutoutWidth,
          bottomCutoutSides: 8,
        });
        for (const cell of prepared) {
          const tri = triangulateCellData(cell);
          expect(
            holeCount({
              positions: Array.from(tri.positions),
              normals: Array.from(tri.normals),
              indices: Array.from(tri.indices),
            }),
            `phiG=${phiG} seed=${seed} particleId=${cell.particleId}`,
          ).toBe(0);
        }
      }
    }
  }, 60000);
});
