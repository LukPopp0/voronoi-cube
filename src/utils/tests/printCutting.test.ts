import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import {
  cutInnerCubeFromCell,
  prepareForPrint,
  conformEdgesToPool,
  rotateForSafeFan,
  VertexPool,
} from '../printCutting';
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

// --- conformEdgesToPool: T-junction elimination unit tests ------------------
// Hand-built cases, independent of the cutting pipeline: one face keeps a
// whole edge while a sibling face has that same physical edge split by a
// mid-edge vertex (as `subtractCubeFromFace` produces when a later cut
// subdivides one side of a shared edge but not the other).
describe('conformEdgesToPool (T-junction elimination)', () => {
  it('splices a mid-edge vertex from another face into a face whose edge spans it', () => {
    const pool = new VertexPool();
    const i0 = pool.getOrAdd(new Vector3(0, 0, 0));
    const i1 = pool.getOrAdd(new Vector3(2, 0, 0));
    const i2 = pool.getOrAdd(new Vector3(1, 0, 0)); // midpoint of i0->i1
    const i3 = pool.getOrAdd(new Vector3(0, 1, 0));
    const i4 = pool.getOrAdd(new Vector3(1, 1, 0));

    // Face A: whole long edge (i0 -> i1) - unsplit side of the shared edge.
    const faceA = [i0, i1, i3];
    // Face B: same physical edge, already split into i0 -> i2 -> i1 by a
    // sibling cut.
    const faceB = [i0, i2, i1, i4];

    const [confA, confB] = conformEdgesToPool([faceA, faceB], pool);

    expect(confA).toEqual([i0, i2, i1, i3]);
    expect(confB).toEqual([i0, i2, i1, i4]); // already conforms, unchanged
  });

  it('does not insert vertices that are off the segment line', () => {
    const pool = new VertexPool();
    const i0 = pool.getOrAdd(new Vector3(0, 0, 0));
    const i1 = pool.getOrAdd(new Vector3(2, 0, 0));
    const i2 = pool.getOrAdd(new Vector3(1, 1, 0)); // not collinear with i0->i1

    const face = [i0, i1, i2];
    const [conformed] = conformEdgesToPool([face], pool);

    expect(conformed).toEqual(face);
  });

  it('orders multiple inserted vertices along the edge by their position, not pool order', () => {
    const pool = new VertexPool();
    const i0 = pool.getOrAdd(new Vector3(0, 0, 0));
    const i1 = pool.getOrAdd(new Vector3(3, 0, 0));
    const iApex = pool.getOrAdd(new Vector3(0, 5, 0));
    const iFar = pool.getOrAdd(new Vector3(2, 0, 0)); // t=2/3, added to the pool first
    const iNear = pool.getOrAdd(new Vector3(1, 0, 0)); // t=1/3, added to the pool second

    const face = [i0, i1, iApex];
    const [conformed] = conformEdgesToPool([face], pool);

    expect(conformed).toEqual([i0, iNear, iFar, i1, iApex]);
  });

  it('does not splice a vertex within ON_PLANE_TOL of a short edge endpoint (a dimensionless t cutoff alone would admit it)', () => {
    const pool = new VertexPool();
    const i0 = pool.getOrAdd(new Vector3(0, 0, 0));
    const i1 = pool.getOrAdd(new Vector3(1e-6, 0, 0)); // short edge, length 1e-6
    const i2 = pool.getOrAdd(new Vector3(0, 1, 0));
    // t = 0.05 along the edge -> physical offset from i0 is 5e-8, well
    // under ON_PLANE_TOL (1e-7). A fixed t-threshold like the old 1e-9
    // would have accepted t=0.05 and spliced this near-endpoint vertex in,
    // producing a near-zero-length edge.
    const iNear = pool.getOrAdd(new Vector3(5e-8, 0, 0));

    const face = [i0, i1, i2];
    const [conformed] = conformEdgesToPool([face], pool);

    expect(conformed).toEqual(face);
  });
});

// --- rotateForSafeFan: fallback contract -------------------------------------
describe('rotateForSafeFan fallback', () => {
  it('returns the input cycle unchanged when every vertex triple is collinear (no safe rotation exists)', () => {
    const pool = new VertexPool();
    const i0 = pool.getOrAdd(new Vector3(0, 0, 0));
    const i1 = pool.getOrAdd(new Vector3(1, 0, 0));
    const i2 = pool.getOrAdd(new Vector3(2, 0, 0));
    const i3 = pool.getOrAdd(new Vector3(3, 0, 0));
    // Hand-built degenerate "face": all 4 vertices lie on one straight
    // line. Every consecutive triple around this cycle is exactly
    // collinear, so no start vertex has two non-degenerate flanking
    // triangles - rotateForSafeFan's loop exhausts all n candidates and
    // falls through to the "no safe rotation" fallback, returning the
    // input order unchanged. This documents the fallback contract with a
    // guaranteed trigger, rather than a realistic cell face (real cell
    // faces from the cutting pipeline aren't fully collinear).
    const face = [i0, i1, i2, i3];

    expect(rotateForSafeFan(face, pool)).toEqual(face);
  });

  // Complementary check: a valid, non-degenerate convex polygon with EVERY
  // edge subdivided by a T-junction-style midpoint (the actual shape
  // conformEdgesToPool produces) still finds a safe rotation - starting
  // from any midpoint vertex works, since a midpoint's neighbors are a
  // real corner and the corner always breaks collinearity on the far side.
  // So for genuine pipeline output, the fallback above is unreachable;
  // this is a dead-code path documented for the "every edge got a
  // T-junction" scenario only.
  it('finds a safe rotation for a fully-subdivided square (midpoint on every edge) - fallback is dead code for valid convex input', () => {
    const pool = new VertexPool();
    const c0 = pool.getOrAdd(new Vector3(0, 0, 0));
    const m01 = pool.getOrAdd(new Vector3(1, 0, 0));
    const c1 = pool.getOrAdd(new Vector3(2, 0, 0));
    const m12 = pool.getOrAdd(new Vector3(2, 1, 0));
    const c2 = pool.getOrAdd(new Vector3(2, 2, 0));
    const m23 = pool.getOrAdd(new Vector3(1, 2, 0));
    const c3 = pool.getOrAdd(new Vector3(0, 2, 0));
    const m30 = pool.getOrAdd(new Vector3(0, 1, 0));
    const face = [c0, m01, c1, m12, c2, m23, c3, m30];

    const rotated = rotateForSafeFan(face, pool);

    // Same cycle, just possibly rotated - not the untouched fallback.
    const doubled = face.concat(face);
    const startIdx = doubled.indexOf(rotated[0]);
    expect(doubled.slice(startIdx, startIdx + face.length)).toEqual(rotated);
  });
});

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
  // DEFECT D1 fixed (two parts, see printCutting.ts): (1) buildCapFaces now
  // only admits a vertex into a cube plane's cap polygon if it also lies
  // inside-or-on the cube w.r.t. every other cube plane (i.e. within that
  // face's square extent) - box straddles the inner-cube edge x=y=0.5, so
  // vertices beyond the adjacent face's extent are correctly excluded from
  // the cap. (2) conformEdgesToPool then splices any remaining T-junction
  // vertices (from subtractCubeFromFace emitting one side of a shared edge
  // pre-split, the other not) into every face's edges, so directed-edge
  // pairing holds everywhere.
  it('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutFixture(F3))).toEqual([]);
  });

  it('checkTriangulated reports zero violations', () => {
    expect(triangulateAndCheck(cutFixture(F3))).toEqual([]);
  });

  it('volume matches boxVolume(F3) - innerCubeVolume', () => {
    expect(polygonVolume(cutFixture(F3))).toBeCloseTo(expectedVolume(F3), 6);
  });
});

// --- F4 corner: contains the inner-cube corner (0.5,0.5,0.5) ----------------
describe('F4 corner', () => {
  // DEFECT D1 fixed: same cap-vertex filter + edge-conformity pass as F3,
  // corner case (three straddled planes).
  it('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutFixture(F4))).toEqual([]);
  });

  it('checkTriangulated reports zero violations', () => {
    expect(triangulateAndCheck(cutFixture(F4))).toEqual([]);
  });

  it('volume matches boxVolume(F4) - innerCubeVolume', () => {
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
  // DEFECT D4, FIXED (task 7): the box's +x face lies exactly on the
  // cube's x=0.5 plane. Because that face itself straddles the +y plane
  // (its own y-extent is [0.2,1.0]), it does not classify as
  // allInside/allOutside at the top level and used to go through
  // subtractCubeFromFace's generic split like any other face. For a face
  // EXACTLY coplanar with a cube plane, clipPolygonByPlane's inclusive
  // "<= PLANE_TOL" test classified the whole polygon as "inside" against
  // BOTH the plane and its flipped copy, so the generic split pushed a
  // spurious unclipped duplicate of the whole face as "definitely outside"
  // while the recursed insidePart ALSO kept the true (y-clipped) remnant -
  // a duplicated, overlapping copy of the face's material.
  //
  // Fix: subtractCubeFromFace now detects, at each recursion level, when NO
  // vertex of the (sub-)polygon clears PLANE_TOL strictly beyond the plane
  // being tested (covers both full coplanarity and the related case of a
  // polygon merely touching the plane along one edge/vertex) and skips
  // splitting on it entirely, recursing the polygon unchanged on the
  // remaining planes instead. Such a polygon is neither "definitely inside"
  // nor "definitely outside" for that one plane - whether it survives is
  // decided by the other 5 planes exactly as for any interior cross-section.
  // No changes to buildCapFaces were needed: the existing D1
  // within-face-extent filter already excludes the retained y>0.5 remnant's
  // vertices from being swept into the +x cap (they fail the +y plane's
  // extent check), so no spurious cap forms there and the cap the fixture
  // does need - closing the y=0.5 opening - forms correctly from genuine
  // clip vertices.
  it('checkCutCellData reports zero violations', () => {
    expect(checkCutCellData(cutFixture(F7_COPLANAR_WITH_REMAINDER))).toEqual([]);
  });

  it('checkTriangulated reports zero violations', () => {
    expect(triangulateAndCheck(cutFixture(F7_COPLANAR_WITH_REMAINDER))).toEqual([]);
  });

  it('volume matches expected (0.27)', () => {
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
