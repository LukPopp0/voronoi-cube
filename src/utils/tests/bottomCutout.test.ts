import { describe, it, expect, beforeAll } from 'vitest';
import {
  buildBottomCutoutRegion,
  subtractRegionFromCell,
  cutInnerCubeFromCell,
  prepareForPrint,
} from '../printCutting';
import { buildBottomPlug } from '../plugGeometry';
import { cutCellCore, triangulateCellData } from '../cellCuttingAlgorithm';
import { polygonToTriangles } from '../geometryHelper';
import { checkCutCellData, checkTriangulated, polygonVolume } from './helpers/meshInvariants';
import { makeBoxCell } from './helpers/syntheticCells';
import { generateRealCells } from './helpers/realCellFixtures';
import type { CutCellData } from '../../workers/types/workerOutput';

/**
 * Bottom cutout (hex frustum) test suite.
 *
 * Frustum spec: 6 side planes each containing the cube center and one edge
 * of the base hexagon (apex-at-center taper), one top plane at the inner-
 * cavity floor (y = -innerCubeHalf). Region is unbounded below (the cell's
 * own bottom face clip punches the base hexagon hole). Plane order contract:
 * indices 0..5 = sides, index 6 = top. "Width" = hexagon extent across
 * corners (2 * circumradius) as a fraction of cube size.
 */

// Cube of size 2 centered at origin: half = 1.
const CUBE = 2;
const HALF = CUBE / 2;
const INNER_RATIO = 0.5; // innerCubeHalf = 0.5
const INNER_HALF = (CUBE * INNER_RATIO) / 2;
const BASE_W = 0.8; // base circumradius R = 0.8
const R = (BASE_W * CUBE) / 2;

const hexArea = (circumRadius: number): number =>
  ((3 * Math.sqrt(3)) / 2) * circumRadius * circumRadius;

// Hex pyramid with apex at the cube center: volume of the slice between the
// cube bottom face (y=-HALF, hexagon circumradius R) and the cavity floor
// (y=-INNER_HALF, circumradius scaled by INNER_HALF/HALF).
const pyramidVol = (baseR: number, height: number): number => (hexArea(baseR) * height) / 3;
const frustumVol =
  pyramidVol(R, HALF) - pyramidVol(R * (INNER_HALF / HALF), INNER_HALF);

const WHOLE_CUBE: [number, number, number] = [-1, -1, -1];
const WHOLE_CUBE_MAX: [number, number, number] = [1, 1, 1];

const triangulateAndCheck = (result: CutCellData) => {
  const tri = triangulateCellData(result);
  return checkTriangulated({
    positions: Array.from(tri.positions),
    normals: Array.from(tri.normals),
    indices: Array.from(tri.indices),
  });
};

// --- Region construction ------------------------------------------------------

describe('buildBottomCutoutRegion', () => {
  const region = buildBottomCutoutRegion(CUBE, INNER_RATIO, BASE_W, false, 0, 0, 0);

  it('has 7 planes (6 sides + top) with the contracted cap mask', () => {
    expect(region.planes.length).toBe(7);
    expect(region.capMask).toEqual([true, true, true, true, true, true, false]);
  });

  it('capTop=true caps the top plane', () => {
    const capped = buildBottomCutoutRegion(CUBE, INNER_RATIO, BASE_W, true, 0, 0, 0);
    expect(capped.capMask[6]).toBe(true);
  });

  it('has the 6 top-hexagon corners, each on 2 side planes + the top plane', () => {
    expect(region.corners.length).toBe(6);
    for (const corner of region.corners) {
      expect(corner.planeIndices.length).toBe(3);
      expect(corner.planeIndices).toContain(6);
      // On each listed plane (within tolerance), inside all others.
      for (let pi = 0; pi < region.planes.length; pi++) {
        const d =
          region.planes[pi].normal.dot(corner.position) - region.planes[pi].distance;
        if (corner.planeIndices.includes(pi)) {
          expect(Math.abs(d)).toBeLessThan(1e-9);
        } else {
          expect(d).toBeLessThan(1e-9);
        }
      }
      // Top-hexagon geometry: at the cavity floor, scaled circumradius.
      expect(corner.position.y).toBeCloseTo(-INNER_HALF, 9);
      const radial = Math.hypot(corner.position.x, corner.position.z);
      expect(radial).toBeCloseTo(R * (INNER_HALF / HALF), 9);
    }
  });

  it('side planes pass through the cube center (apex-at-center taper)', () => {
    for (let pi = 0; pi < 6; pi++) {
      // Cell at origin: cube center is the local origin -> distance 0.
      expect(region.planes[pi].distance).toBeCloseTo(0, 9);
    }
  });
});

// --- Whole-cube cell: inner cube + frustum (the real print pipeline) ---------

describe('whole-cube cell: inner cube cut then frustum cut', () => {
  const cutBoth = (): CutCellData => {
    const cell = makeBoxCell(WHOLE_CUBE, WHOLE_CUBE_MAX);
    const cavityCut = cutInnerCubeFromCell(cell, INNER_HALF);
    const region = buildBottomCutoutRegion(
      CUBE,
      INNER_RATIO,
      BASE_W,
      false,
      cavityCut.x,
      cavityCut.y,
      cavityCut.z,
    );
    return subtractRegionFromCell(cavityCut, region);
  };

  it('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutBoth())).toEqual([]);
  });

  it('checkTriangulated reports zero violations', () => {
    expect(triangulateAndCheck(cutBoth())).toEqual([]);
  });

  it('volume = cube - inner cube - frustum', () => {
    const expected = 8 - Math.pow(2 * INNER_HALF, 3) - frustumVol;
    expect(polygonVolume(cutBoth())).toBeCloseTo(expected, 6);
  });
});

// --- Blind pocket: frustum cut without inner cube (capTop=true) --------------

describe('blind pocket: frustum only, capped top', () => {
  const cutPocket = (): CutCellData => {
    const cell = makeBoxCell(WHOLE_CUBE, WHOLE_CUBE_MAX);
    const region = buildBottomCutoutRegion(CUBE, INNER_RATIO, BASE_W, true, cell.x, cell.y, cell.z);
    return subtractRegionFromCell(cell, region);
  };

  it('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutPocket())).toEqual([]);
  });

  it('checkTriangulated reports zero violations', () => {
    expect(triangulateAndCheck(cutPocket())).toEqual([]);
  });

  it('volume = cube - frustum', () => {
    expect(polygonVolume(cutPocket())).toBeCloseTo(8 - frustumVol, 6);
  });
});

// --- Two half cells: frustum axis on the shared x=0 plane --------------------
// Hard straddle case: each half sees only part of the hexagon. Volume
// conservation across the pair needs no per-piece analytic formula.

describe('two half cells straddling the frustum', () => {
  const halves = (): CutCellData[] => {
    const left = makeBoxCell([-1, -1, -1], [0, 1, 1], 0);
    const right = makeBoxCell([0, -1, -1], [1, 1, 1], 1);
    return [left, right].map(cell => {
      const region = buildBottomCutoutRegion(
        CUBE,
        INNER_RATIO,
        BASE_W,
        true,
        cell.x,
        cell.y,
        cell.z,
      );
      return subtractRegionFromCell(cell, region);
    });
  };

  it('both halves pass checkCutCellData and checkTriangulated', () => {
    for (const half of halves()) {
      expect(checkCutCellData(half)).toEqual([]);
      expect(triangulateAndCheck(half)).toEqual([]);
    }
  });

  it('summed volume = cube - frustum', () => {
    const total = halves().reduce((sum, half) => sum + polygonVolume(half), 0);
    expect(total).toBeCloseTo(8 - frustumVol, 6);
  });
});

// --- Parameterized side count -------------------------------------------------
// General N-gon: area = (n/2) * r^2 * sin(2*pi/n); same apex-at-center frustum.

describe('parameterized side count (8-sided cutout + plug)', () => {
  const SIDES = 8;
  const ngonArea = (n: number, r: number): number => (n / 2) * r * r * Math.sin((2 * Math.PI) / n);
  const ngonPyramidVol = (n: number, baseR: number, height: number): number =>
    (ngonArea(n, baseR) * height) / 3;
  const octFrustumVol =
    ngonPyramidVol(SIDES, R, HALF) - ngonPyramidVol(SIDES, R * (INNER_HALF / HALF), INNER_HALF);

  it('region has n+1 planes, n corners, contracted cap mask', () => {
    const region = buildBottomCutoutRegion(CUBE, INNER_RATIO, BASE_W, false, 0, 0, 0, SIDES);
    expect(region.planes.length).toBe(SIDES + 1);
    expect(region.capMask).toEqual([...Array(SIDES).fill(true), false]);
    expect(region.corners.length).toBe(SIDES);
    for (const corner of region.corners) {
      expect(corner.planeIndices).toContain(SIDES);
    }
  });

  it('whole-cube cell: inner cube + 8-sided frustum, watertight and volume-correct', () => {
    const cell = makeBoxCell(WHOLE_CUBE, WHOLE_CUBE_MAX);
    const cavityCut = cutInnerCubeFromCell(cell, INNER_HALF);
    const region = buildBottomCutoutRegion(
      CUBE,
      INNER_RATIO,
      BASE_W,
      false,
      cavityCut.x,
      cavityCut.y,
      cavityCut.z,
      SIDES,
    );
    const cut = subtractRegionFromCell(cavityCut, region);
    expect(checkCutCellData(cut)).toEqual([]);
    expect(triangulateAndCheck(cut)).toEqual([]);
    expect(polygonVolume(cut)).toBeCloseTo(8 - 1 - octFrustumVol, 6);
  });

  it('8-sided plug: 2n verts, n+2 faces, gap=0 exactly fills the hole', () => {
    const plug = buildBottomPlug(CUBE, INNER_RATIO, BASE_W, 0, SIDES);
    expect(plug.vertices.length / 3).toBe(2 * SIDES);
    expect(plug.faces.length).toBe(SIDES + 2);
    expect(checkCutCellData(plug)).toEqual([]);
    expect(triangulateAndCheck(plug)).toEqual([]);
    expect(polygonVolume(plug)).toBeCloseTo(octFrustumVol, 9);
  });

  it('prepareForPrint passes bottomCutoutSides through', () => {
    const [prepared] = prepareForPrint([makeBoxCell(WHOLE_CUBE, WHOLE_CUBE_MAX)], CUBE, INNER_RATIO, {
      cutInnerCube: true,
      cutBottomHole: true,
      bottomCutoutWidth: BASE_W,
      bottomCutoutSides: SIDES,
    });
    expect(polygonVolume(prepared)).toBeCloseTo(8 - 1 - octFrustumVol, 6);
  });
});

// --- Max width 1.0: base hexagon inscribed in the bottom face -----------------
// Corners touch the bottom-face edge midpoints (point tangency); top hexagon
// corners touch the cavity-floor square edges. Both cuts must stay watertight.

describe('width 1.0 (hexagon inscribed in bottom face)', () => {
  const MAX_W = 1.0;
  const maxR = (MAX_W * CUBE) / 2;
  const maxFrustumVol =
    pyramidVol(maxR, HALF) - pyramidVol(maxR * (INNER_HALF / HALF), INNER_HALF);

  it('inner cube + frustum: watertight, volume-correct', () => {
    const cell = makeBoxCell(WHOLE_CUBE, WHOLE_CUBE_MAX);
    const cavityCut = cutInnerCubeFromCell(cell, INNER_HALF);
    const region = buildBottomCutoutRegion(
      CUBE,
      INNER_RATIO,
      MAX_W,
      false,
      cavityCut.x,
      cavityCut.y,
      cavityCut.z,
    );
    const cut = subtractRegionFromCell(cavityCut, region);
    expect(checkCutCellData(cut)).toEqual([]);
    expect(triangulateAndCheck(cut)).toEqual([]);
    expect(polygonVolume(cut)).toBeCloseTo(8 - 1 - maxFrustumVol, 6);
  });

  it('plug at width 1.0 stays valid', () => {
    const plug = buildBottomPlug(CUBE, INNER_RATIO, MAX_W, 0.05);
    expect(checkCutCellData(plug)).toEqual([]);
    expect(triangulateAndCheck(plug)).toEqual([]);
    expect(polygonVolume(plug)).toBeLessThan(maxFrustumVol);
  });
});

// --- No spurious fragmentation of faces the frustum never touches ------------
// The side planes are infinite, so a face can straddle several of them while
// its intersection with the region is still empty (the region is only the
// area inside ALL planes). Such faces must be kept whole, not BSP-fragmented.

describe('faces not intersecting the frustum stay unfragmented', () => {
  it('whole-cube blind pocket keeps each far face as a single quad', () => {
    const cell = makeBoxCell(WHOLE_CUBE, WHOLE_CUBE_MAX);
    const region = buildBottomCutoutRegion(CUBE, INNER_RATIO, BASE_W, true, cell.x, cell.y, cell.z);
    const cut = subtractRegionFromCell(cell, region);

    // The frustum (max radial extent R=0.8 at the bottom) never reaches the
    // cube side faces or the top face - each must survive as ONE face (the
    // edge-conformity pass may still splice collinear T-junction vertices
    // from neighboring bottom-face fragments into its border, so the vertex
    // count is not asserted).
    const facesOnPlane = (axis: 0 | 1 | 2, value: number) =>
      cut.faces.filter(face =>
        face.every(vi => Math.abs(cut.vertices[vi * 3 + axis] - value) < 1e-9),
      );

    for (const [axis, value] of [
      [0, 1],
      [0, -1],
      [1, 1],
      [2, 1],
      [2, -1],
    ] as [0 | 1 | 2, number][]) {
      const faces = facesOnPlane(axis, value);
      expect(faces.length, `axis=${axis} value=${value}`).toBe(1);
    }
  });
});

// --- Cell away from the frustum: untouched -----------------------------------

describe('cell not touching the frustum', () => {
  it('geometry and volume unchanged', () => {
    const cell = makeBoxCell([0.1, 0.2, 0.1], [0.9, 0.9, 0.9]);
    const region = buildBottomCutoutRegion(CUBE, INNER_RATIO, BASE_W, true, cell.x, cell.y, cell.z);
    const cut = subtractRegionFromCell(cell, region);
    expect(checkCutCellData(cut)).toEqual([]);
    expect(polygonVolume(cut)).toBeCloseTo(0.8 * 0.7 * 0.8, 9);
  });
});

// --- prepareForPrint options ---------------------------------------------------

describe('prepareForPrint options', () => {
  const cell = () => makeBoxCell(WHOLE_CUBE, WHOLE_CUBE_MAX);

  it('default options keep the existing inner-cube-only behavior', () => {
    const [prepared] = prepareForPrint([cell()], CUBE, INNER_RATIO);
    expect(polygonVolume(prepared)).toBeCloseTo(8 - 1, 6);
  });

  it('cutInnerCube + cutBottomHole applies both cuts', () => {
    const [prepared] = prepareForPrint([cell()], CUBE, INNER_RATIO, {
      cutInnerCube: true,
      cutBottomHole: true,
      bottomCutoutWidth: BASE_W,
    });
    expect(polygonVolume(prepared)).toBeCloseTo(8 - 1 - frustumVol, 6);
    expect(checkCutCellData(prepared)).toEqual([]);
    expect(triangulateAndCheck(prepared)).toEqual([]);
  });

  it('cutBottomHole without cutInnerCube produces the capped blind pocket', () => {
    const [prepared] = prepareForPrint([cell()], CUBE, INNER_RATIO, {
      cutInnerCube: false,
      cutBottomHole: true,
      bottomCutoutWidth: BASE_W,
    });
    expect(polygonVolume(prepared)).toBeCloseTo(8 - frustumVol, 6);
    expect(checkCutCellData(prepared)).toEqual([]);
  });

  it('both cuts disabled returns cells unchanged', () => {
    const [prepared] = prepareForPrint([cell()], CUBE, INNER_RATIO, {
      cutInnerCube: false,
      cutBottomHole: false,
    });
    expect(polygonVolume(prepared)).toBeCloseTo(8, 9);
  });
});

// --- Plug ----------------------------------------------------------------------

describe('buildBottomPlug', () => {
  it('gap=0 plug exactly fills the frustum hole', () => {
    const plug = buildBottomPlug(CUBE, INNER_RATIO, BASE_W, 0);
    expect(plug.vertices.length / 3).toBe(12);
    expect(plug.faces.length).toBe(8);
    expect(checkCutCellData(plug)).toEqual([]);
    expect(triangulateAndCheck(plug)).toEqual([]);
    expect(polygonVolume(plug)).toBeCloseTo(frustumVol, 9);
  });

  it('gap>0 plug is strictly smaller and stays clear of the hole walls by the gap', () => {
    const gap = 0.1;
    const plug = buildBottomPlug(CUBE, INNER_RATIO, BASE_W, gap);
    expect(checkCutCellData(plug)).toEqual([]);
    expect(triangulateAndCheck(plug)).toEqual([]);
    expect(polygonVolume(plug)).toBeLessThan(frustumVol);

    // Every vertex clears each hole side plane by >= gap and stays within
    // the vertical extent of the hole.
    const hole = buildBottomCutoutRegion(CUBE, INNER_RATIO, BASE_W, false, 0, 0, 0);
    const nVerts = plug.vertices.length / 3;
    for (let vi = 0; vi < nVerts; vi++) {
      const x = plug.vertices[vi * 3];
      const y = plug.vertices[vi * 3 + 1];
      const z = plug.vertices[vi * 3 + 2];
      for (let pi = 0; pi < 6; pi++) {
        const p = hole.planes[pi];
        const d = p.normal.x * x + p.normal.y * y + p.normal.z * z - p.distance;
        expect(d).toBeLessThanOrEqual(-gap + 1e-9);
      }
      expect(y).toBeGreaterThanOrEqual(-HALF - 1e-9);
      expect(y).toBeLessThanOrEqual(-INNER_HALF + 1e-9);
    }
  });

  it('plug is world-positioned (zero cell offset)', () => {
    const plug = buildBottomPlug(CUBE, INNER_RATIO, BASE_W, 0.1);
    expect(plug.x).toBe(0);
    expect(plug.y).toBe(0);
    expect(plug.z).toBe(0);
  });
});

// --- Real voro3d cells: full pipeline with the frustum stage -----------------

describe('real cells: gap cut -> inner cube -> frustum', () => {
  const SIZE = 15;
  const GAP_SIZE = 0.5;
  const RATIO = 0.85;
  const WIDTH = 0.3;

  let gapCutCells: CutCellData[] = [];

  beforeAll(async () => {
    const cells = await generateRealCells(100, 1, SIZE);
    gapCutCells = cells.map(cell => {
      const triangleIndices = cell.faces.map(polygonToTriangles).flat().flat();
      const cutCellData = cutCellCore(cell, triangleIndices, GAP_SIZE, SIZE);
      cutCellData.particleId = cell.particleID;
      return cutCellData;
    });
  }, 60000);

  it.each([WIDTH, 1.0])('every prepared cell is watertight and volume-bounded (width=%s)', width => {
    const prepared = prepareForPrint(gapCutCells, SIZE, RATIO, {
      cutInnerCube: true,
      cutBottomHole: true,
      bottomCutoutWidth: width,
    });
    expect(prepared.length).toBeGreaterThan(0);

    const originalById = new Map(gapCutCells.map(c => [c.particleId, c]));
    for (const cell of prepared) {
      const cellLabel = `width=${width} particleId=${cell.particleId}`;
      const violations = checkCutCellData(cell);
      expect(violations, `${cellLabel}: ${JSON.stringify(violations)}`).toEqual([]);
      const triViolations = triangulateAndCheck(cell);
      expect(triViolations, `${cellLabel}: ${JSON.stringify(triViolations)}`).toEqual([]);

      const original = originalById.get(cell.particleId)!;
      expect(polygonVolume(cell), cellLabel).toBeLessThanOrEqual(
        polygonVolume(original) + 1e-4,
      );
      expect(polygonVolume(cell), cellLabel).toBeGreaterThanOrEqual(-1e-4);
    }
  });
});
