import { describe, it, expect } from 'vitest';
import { cutInnerCubeFromCell, prepareForPrint } from '../printCutting';
import { triangulateCellData } from '../cellCuttingAlgorithm';
import {
  checkCutCellData,
  checkTriangulated,
  polygonVolume,
  meshStats,
} from './helpers/meshInvariants';
import { makeBoxCell, boxVolume, boxIntersectionVolume } from './helpers/syntheticCells';
import type { CutCellData } from '../../workers/types/workerOutput';

// Inner cube half-size used throughout: h = 0.5, centered at world origin.
const H = 0.5;
const INNER_MIN: [number, number, number] = [-H, -H, -H];
const INNER_MAX: [number, number, number] = [H, H, H];

type Box = [[number, number, number], [number, number, number]];

// --- Fixtures (world-space boxes), per task brief ---------------------------
const F1: Box = [
  [-1, -1, -1],
  [1, 1, 1],
]; // concentric, straddles all 6 planes
const F2: Box = [
  [0.2, -0.3, -0.3],
  [1.0, 0.3, 0.3],
]; // one face (+x), opening within face extent
const F3: Box = [
  [0.2, 0.2, -0.3],
  [1.0, 1.0, 0.3],
]; // edge: crosses +x and +y, contains cube edge x=y=0.5
const F4: Box = [
  [0.2, 0.2, 0.2],
  [1.0, 1.0, 1.0],
]; // corner: contains cube corner (0.5,0.5,0.5)
const F5: Box = [
  [-0.3, -0.3, -0.3],
  [0.3, 0.3, 0.3],
]; // fully inside inner cube
const F6: Box = [
  [0.6, 0.6, 0.6],
  [0.9, 0.9, 0.9],
]; // fully outside inner cube
const F7: Box = [
  [-0.3, -0.3, -0.3],
  [0.5, 0.3, 0.3],
]; // coplanar: +x face exactly on cube plane x=0.5

const expectedVolume = (box: Box): number =>
  boxVolume(box[0], box[1]) - boxIntersectionVolume(box[0], box[1], INNER_MIN, INNER_MAX);

const cutFixture = (box: Box): CutCellData => cutInnerCubeFromCell(makeBoxCell(...box), H);

const triangulateAndCheck = (result: CutCellData) => {
  const tri = triangulateCellData(result);
  return checkTriangulated({
    positions: Array.from(tri.positions),
    normals: Array.from(tri.normals),
    indices: Array.from(tri.indices),
  });
};

// --- F1 concentric: straddles all 6 cube planes, no single edge/corner ------
describe('F1 concentric', () => {
  it('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutFixture(F1))).toEqual([]);
  });

  // DEFECT D2 fixed: buildCapFaces now orients each cap polygon's winding to
  // match its intended cap normal (Newell's method vs. capNormal), and
  // triangulateCellData derives face normals purely from fan winding (no
  // "away from center" flip). Winding is the single source of truth end to
  // end, so cap-face triangles no longer disagree with their stored normal.
  it('checkTriangulated reports zero violations', () => {
    expect(triangulateAndCheck(cutFixture(F1))).toEqual([]);
  });

  it('volume matches boxVolume(F1) - innerCubeVolume', () => {
    expect(polygonVolume(cutFixture(F1))).toBeCloseTo(expectedVolume(F1), 6);
  });

  it('exactly 6 cap faces added (12 faces total)', () => {
    expect(cutFixture(F1).faces.length).toBe(12);
  });

  it('volume = 8 - 1 = 7', () => {
    expect(polygonVolume(cutFixture(F1))).toBeCloseTo(7, 6);
  });
});

// --- F2 one face: opening entirely within the +x face extent ---------------
describe('F2 one face', () => {
  it('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutFixture(F2))).toEqual([]);
  });

  it('checkTriangulated reports zero violations', () => {
    expect(triangulateAndCheck(cutFixture(F2))).toEqual([]);
  });

  it('volume matches boxVolume(F2) - innerCubeVolume', () => {
    expect(polygonVolume(cutFixture(F2))).toBeCloseTo(expectedVolume(F2), 6);
  });
});

// --- F3 edge: straddles the +x/+y cube edge ---------------------------------
describe('F3 edge', () => {
  // DEFECT D1 confirmed: box straddles the inner-cube edge x=y=0.5, so
  // buildCapFaces sweeps clip vertices on the x=0.5 plane that lie outside
  // that face's y-extent (and vice versa for the y=0.5 plane) into the cap
  // polygon via a plain radial angle sort, producing an oversized/self-
  // overlapping cap that no longer matches the true cavity boundary.
  // Observed: 14 'unpaired-edge' violations across faces built from the
  // subtraction + cap step (e.g. "directed edge (0 -> 1) occurs 1 time(s),
  // reverse occurs 0 time(s)").
  it.fails('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutFixture(F3))).toEqual([]);
  });

  // Triangulation of already-broken (D1) polygon data; documented separately
  // since checkTriangulated exercises a different code path (triangulateCellData)
  // and could in principle diverge from checkCutCellData's diagnosis.
  it.fails('checkTriangulated reports zero violations', () => {
    expect(triangulateAndCheck(cutFixture(F3))).toEqual([]);
  });

  // DEFECT D1 confirmed (volume symptom): the over-collected/overlapping cap
  // adds spurious extra volume on top of the correct shape. Observed:
  // polygonVolume = 0.34 vs expected 0.33 (excess = 0.01).
  it.fails('volume matches boxVolume(F3) - innerCubeVolume', () => {
    expect(polygonVolume(cutFixture(F3))).toBeCloseTo(expectedVolume(F3), 6);
  });
});

// --- F4 corner: contains the inner-cube corner (0.5,0.5,0.5) ----------------
describe('F4 corner', () => {
  // DEFECT D1 confirmed (corner case): same over-collection mechanism as F3,
  // amplified - vertices from three straddled planes all land in overlapping
  // cap polygons. Observed: 'non-convex' (1x, reflex vertex, cross sign
  // value=-1.600e-1) plus 24 'unpaired-edge' violations.
  it.fails('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutFixture(F4))).toEqual([]);
  });

  it.fails('checkTriangulated reports zero violations', () => {
    expect(triangulateAndCheck(cutFixture(F4))).toEqual([]);
  });

  // DEFECT D1 confirmed (volume symptom): same excess-volume symptom as F3.
  // Observed: polygonVolume = 0.4925 vs expected 0.485 (excess = 0.0075).
  it.fails('volume matches boxVolume(F4) - innerCubeVolume', () => {
    expect(polygonVolume(cutFixture(F4))).toBeCloseTo(expectedVolume(F4), 6);
  });
});

// --- F5 fully inside the inner cube: entire cell should be consumed --------
describe('F5 fully inside', () => {
  it('cutInnerCubeFromCell yields 0 faces', () => {
    expect(cutFixture(F5).faces.length).toBe(0);
  });

  it('prepareForPrint filters the cell out', () => {
    const cell = makeBoxCell(...F5);
    // cubeSize=1, innerCubeRatio=1 -> innerCubeHalfSize = 0.5 = H
    const filtered = prepareForPrint([cell], 1, 1);
    expect(filtered.length).toBe(0);
  });
});

// --- F6 fully outside the inner cube: geometry should be untouched ---------
describe('F6 fully outside', () => {
  it('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutFixture(F6))).toEqual([]);
  });

  it('volume is unchanged from the original box', () => {
    expect(polygonVolume(cutFixture(F6))).toBeCloseTo(boxVolume(...F6), 9);
  });
});

// --- F7 coplanar: +x face exactly on the cube plane x=0.5 -------------------
// NOTE on F7 as literally specified in the brief ([-0.3,-0.3,-0.3]..[0.5,0.3,0.3]):
// verified by hand (and by boxIntersectionVolume) that this box is entirely
// CONTAINED in the inner cube (all of x in [-0.3,0.5] subset [-0.5,0.5], y/z
// well inside too) - it merely touches the +x cube plane from the inside,
// it does not straddle it. expectedVolume(F7) = boxVolume - intersection =
// 0.288 - 0.288 = 0 exactly. So this fixture behaves like F5 (fully
// consumed) rather than exercising a "coplanar face with remaining
// material" scenario - it is NOT a meaningful D4 probe on its own. Kept
// here as specified, plus a supplementary fixture below that actually
// creates a coplanar face with remaining volume elsewhere.
describe('F7 coplanar (as literally specified - degenerates to fully-swallowed)', () => {
  it('checkCutCellData reports zero violations (trivially, 0 faces)', () => {
    expect(checkCutCellData(cutFixture(F7))).toEqual([]);
  });

  it('cutInnerCubeFromCell yields 0 faces (box is entirely inside the inner cube)', () => {
    expect(cutFixture(F7).faces.length).toBe(0);
  });

  it('volume is 0 (box fully consumed, matches expectedVolume)', () => {
    expect(polygonVolume(cutFixture(F7))).toBeCloseTo(expectedVolume(F7), 9);
    expect(expectedVolume(F7)).toBeCloseTo(0, 9);
  });
});

// Supplementary fixture: a genuine coplanar-face-with-remaining-volume case.
// +x face sits exactly on the cube's x=0.5 plane but the box does not
// extend past it (x in [-0.4, 0.5], entirely <= h so the x-plane removes
// nothing on its own); meanwhile the box crosses only the +y plane (y in
// [0.2, 1.0], single-plane case like F2). z stays fully inside (z in
// [-0.3, 0.3]). This isolates "one whole cell face flush with a cube
// plane" from any edge/corner straddling (D1's trigger condition).
const F7_COPLANAR_WITH_REMAINDER: Box = [
  [-0.4, 0.2, -0.3],
  [0.5, 1.0, 0.3],
];

describe('F7-supplement: coplanar +x face + single +y crossing (no edge/corner)', () => {
  // DEFECT D4 confirmed: the box's +x face lies exactly on the cube's
  // x=0.5 plane. Because that face itself straddles the +y plane (its own
  // y-extent is [0.2,1.0]), it is not classified allInside/allOutside and
  // goes through subtractCubeFromFace like any other face - producing a
  // retained (y-clipped) remnant of that face whose vertices sit exactly
  // on the cube's x=0.5 plane (within EPSILON*100). buildCapFaces then
  // sweeps those SAME vertices into the +x cap-face polygon too (it scans
  // the whole vertex pool for anything near a cube plane, regardless of
  // origin), duplicating that face's geometry into the cap. Observed:
  // 'degenerate-face' violations including a 2-distinct-vertex "face" and
  // zero-length repeated-vertex edges, plus numerous 'unpaired-edge'
  // violations - despite the net volume still being numerically correct
  // (0.27, matching expectedVolume).
  it.fails('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutFixture(F7_COPLANAR_WITH_REMAINDER))).toEqual([]);
  });

  it('volume matches expected (0.27) despite the corrupted topology', () => {
    expect(polygonVolume(cutFixture(F7_COPLANAR_WITH_REMAINDER))).toBeCloseTo(
      expectedVolume(F7_COPLANAR_WITH_REMAINDER),
      6,
    );
  });
});

// --- D3 epsilon boundary probe -----------------------------------------------
// Box crosses only the +x cube plane; push the max-x corner `delta` beyond
// the plane (0.5 + delta) to probe the EPSILON (1e-9, clip) vs EPSILON*100
// (1e-7, cap collection) vs EPSILON*10 (1e-8, corner test) inconsistency.
describe('D3 epsilon boundary probe', () => {
  const boxWithDelta = (delta: number): Box => [
    [0.2, -0.3, -0.3],
    [0.5 + delta, 0.3, 0.3],
  ];

  // Tolerances are unified via geometryConstants.ts (PLANE_TOL / ON_PLANE_TOL):
  // clipping, inside-cube, and cap-plane vertex collection now all classify
  // "on which side of the plane" the same way, so delta=1e-8 and 1e-7 no
  // longer produce unpaired edges.
  it('delta=1e-8: checkCutCellData reports zero violations', () => {
    const box = boxWithDelta(1e-8);
    expect(checkCutCellData(cutFixture(box))).toEqual([]);
  });

  it('delta=1e-7: checkCutCellData reports zero violations', () => {
    const box = boxWithDelta(1e-7);
    expect(checkCutCellData(cutFixture(box))).toEqual([]);
  });

  it('delta=1e-6: checkCutCellData reports zero violations', () => {
    const box = boxWithDelta(1e-6);
    expect(checkCutCellData(cutFixture(box))).toEqual([]);
  });

  it('delta=1e-6: volume matches expected', () => {
    const box = boxWithDelta(1e-6);
    expect(polygonVolume(cutFixture(box))).toBeCloseTo(expectedVolume(box), 6);
  });
});

// --- D5 degenerate/sliver outputs --------------------------------------------
// delta=1e-6 is clean per checkCutCellData/checkTriangulated (no unpaired
// edges, no area-based degenerate-face flags - area tolerance is 1e-9 and
// these triangles are far larger in area than that). But the near-tangent
// cut produces needle-thin triangles: no code path guards against poor
// triangle *aspect ratio* (as opposed to raw area), only against near-zero
// area/length. A minAspectQuality this close to 0 means a razor-thin sliver
// triangle reached the final mesh - a real risk for slicer/printing
// robustness even though the mesh is topologically watertight.
describe('D5 degenerate/sliver outputs', () => {
  const boxWithDelta = (delta: number): Box => [
    [0.2, -0.3, -0.3],
    [0.5 + delta, 0.3, 0.3],
  ];

  // DEFECT D5 confirmed: no aspect-ratio guard anywhere in the cutting
  // pipeline. Observed for delta=1e-6 (a case that otherwise passes
  // checkCutCellData/checkTriangulated cleanly): minAspectQuality =
  // 2.88e-6 (a well-formed triangle is close to 1; a degenerate sliver is
  // close to 0). Equilateral-ish triangles are expected here (box faces /
  // caps), so a floor of 0.01 is a generous, non-flaky threshold.
  it.fails('delta=1e-6: minAspectQuality stays above a sane sliver-detection floor', () => {
    const box = boxWithDelta(1e-6);
    const cut = cutFixture(box);
    const tri = triangulateCellData(cut);
    const stats = meshStats(cut, {
      positions: Array.from(tri.positions),
      normals: Array.from(tri.normals),
      indices: Array.from(tri.indices),
    });
    expect(stats.minAspectQuality).toBeGreaterThan(0.01);
  });
});
