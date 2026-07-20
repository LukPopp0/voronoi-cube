import { describe, it, expect } from 'vitest';
import {
  checkCutCellData,
  checkTriangulated,
  signedVolume,
  polygonVolume,
  meshStats,
} from './helpers/meshInvariants';
import { triangulateCellData } from '../cellCuttingAlgorithm';
import type { CutCellData } from '../../workers/types/workerOutput';

// --- Hand-built cube fixture -------------------------------------------------
// Edge length 2 (from -1 to 1), 8 vertices, 6 quad faces, consistent outward
// CCW winding (verified numerically: raw cross(v1-v0,v2-v0) per face matches
// the expected outward axis direction, all directed edges pair up exactly
// once with their reverse, and the fan-triangulated signed volume is +8).
const cubeVertices = [
  -1, -1, -1, // 0
  1, -1, -1, // 1
  1, 1, -1, // 2
  -1, 1, -1, // 3
  -1, -1, 1, // 4
  1, -1, 1, // 5
  1, 1, 1, // 6
  -1, 1, 1, // 7
];

const cubeFaces = [
  [0, 3, 2, 1], // bottom z=-1, normal -z
  [4, 5, 6, 7], // top z=+1, normal +z
  [0, 1, 5, 4], // front y=-1, normal -y
  [3, 7, 6, 2], // back y=+1, normal +y
  [0, 4, 7, 3], // left x=-1, normal -x
  [1, 2, 6, 5], // right x=+1, normal +x
];

const buildCube = (): CutCellData => ({
  vertices: [...cubeVertices],
  faces: cubeFaces.map(f => [...f]),
  particleId: 0,
  x: 0,
  y: 0,
  z: 0,
});

describe('checkCutCellData', () => {
  it('reports zero violations for a correct closed cube', () => {
    const cube = buildCube();
    expect(checkCutCellData(cube)).toEqual([]);
  });

  it('polygonVolume of the cube equals edge^3 and is positive', () => {
    const cube = buildCube();
    expect(polygonVolume(cube)).toBeCloseTo(8, 9);
  });

  it('detects unpaired edges when one face winding is reversed', () => {
    const cube = buildCube();
    cube.faces[1] = [...cube.faces[1]].reverse(); // reverse top face winding
    const violations = checkCutCellData(cube);
    const unpaired = violations.filter(v => v.kind === 'unpaired-edge');
    expect(unpaired).toHaveLength(4);
  });

  it('detects unpaired edges when one face is removed', () => {
    const cube = buildCube();
    cube.faces.splice(1, 1); // remove top face entirely
    const violations = checkCutCellData(cube);
    const unpaired = violations.filter(v => v.kind === 'unpaired-edge');
    expect(unpaired).toHaveLength(4);
  });

  it('detects unpaired edges for a T-junction (split face vs whole edge)', () => {
    // Watertight tetrahedron, verified numerically to have zero unpaired
    // edges when whole. One face is split into two by a midpoint vertex on
    // one of its edges, while the adjoining face keeps the original whole
    // edge (missing the midpoint) - a classic T-junction.
    const p0 = [0, 0, 0];
    const p1 = [1, 0, 0];
    const p2 = [0, 1, 0];
    const p3 = [0, 0, 1];
    const m = [0, 0.5, 0.5]; // midpoint of p2-p3

    const tetraVertices = [...p0, ...p1, ...p2, ...p3, ...m];
    const cell: CutCellData = {
      vertices: tetraVertices,
      faces: [
        [0, 2, 1], // F1 base
        [0, 1, 3], // F2
        [1, 2, 4], // F3a (split part 1, uses midpoint 4)
        [1, 4, 3], // F3b (split part 2, uses midpoint 4)
        [0, 3, 2], // F4 (whole edge 3-2, unaware of split)
      ],
      particleId: 0,
      x: 0,
      y: 0,
      z: 0,
    };

    const violations = checkCutCellData(cell);
    const unpaired = violations.filter(v => v.kind === 'unpaired-edge');
    // Hand-verified: edges (2->4), (4->3), (3->2) each lack a reverse match.
    expect(unpaired).toHaveLength(3);
  });

  it('detects a degenerate/sliver face (zero-area collinear triangle)', () => {
    const cell: CutCellData = {
      vertices: [0, 0, 0, 1, 0, 0, 2, 0, 0],
      faces: [[0, 1, 2]],
      particleId: 0,
      x: 0,
      y: 0,
      z: 0,
    };
    const violations = checkCutCellData(cell);
    expect(violations.some(v => v.kind === 'degenerate-face')).toBe(true);
  });

  it('detects a non-convex L-shaped hexagon face', () => {
    const cell: CutCellData = {
      vertices: [0, 0, 0, 2, 0, 0, 2, 1, 0, 1, 1, 0, 1, 2, 0, 0, 2, 0],
      faces: [[0, 1, 2, 3, 4, 5]],
      particleId: 0,
      x: 0,
      y: 0,
      z: 0,
    };
    const violations = checkCutCellData(cell);
    expect(violations.some(v => v.kind === 'non-convex')).toBe(true);
  });

  it('detects a self-intersecting bowtie quad face', () => {
    // Planar quad A(0,0) B(4,0) C(5,3) D(1,4), but wound as A,C,B,D so edges
    // A-C and B-D (the two "diagonals" of the underlying convex quad) cross.
    // Net signed area is non-zero (2), so Newell's method still yields a
    // valid face normal and checkFaceShape's crossing test runs.
    const cell: CutCellData = {
      vertices: [0, 0, 0, 4, 0, 0, 5, 3, 0, 1, 4, 0],
      faces: [[0, 2, 1, 3]],
      particleId: 0,
      x: 0,
      y: 0,
      z: 0,
    };
    const violations = checkCutCellData(cell);
    expect(violations.some(v => v.kind === 'self-intersecting')).toBe(true);
  });

  it('detects duplicate pooled vertices', () => {
    const cell: CutCellData = {
      vertices: [0, 0, 0, 0, 0, 0, 5, 5, 5],
      faces: [],
      particleId: 0,
      x: 0,
      y: 0,
      z: 0,
    };
    const violations = checkCutCellData(cell);
    expect(violations).toEqual([
      expect.objectContaining({ kind: 'duplicate-vertex' }),
    ]);
  });
});

describe('checkTriangulated + signedVolume', () => {
  it('a triangulated cube has zero violations and signedVolume matches polygonVolume', () => {
    const cube = buildCube();
    const tri = triangulateCellData(cube);
    const mesh = {
      positions: Array.from(tri.positions),
      normals: Array.from(tri.normals),
      indices: Array.from(tri.indices),
    };

    expect(checkTriangulated(mesh)).toEqual([]);
    const vol = signedVolume(mesh);
    expect(vol).toBeGreaterThan(0);
    expect(vol).toBeCloseTo(polygonVolume(cube), 3);
  });

  it('detects normal-winding-mismatch when a triangle normal is flipped', () => {
    const cube = buildCube();
    const tri = triangulateCellData(cube);
    const positions = Array.from(tri.positions);
    const normals = Array.from(tri.normals);
    const indices = Array.from(tri.indices);

    // Flip the stored normal for the 3 vertices used by the first triangle.
    const i0 = indices[0];
    const i1 = indices[1];
    const i2 = indices[2];
    for (const i of [i0, i1, i2]) {
      normals[i * 3] *= -1;
      normals[i * 3 + 1] *= -1;
      normals[i * 3 + 2] *= -1;
    }

    const violations = checkTriangulated({ positions, normals, indices });
    expect(violations.some(v => v.kind === 'normal-winding-mismatch')).toBe(true);
  });
});

describe('meshStats', () => {
  it('reports stats consistent with a clean triangulated cube', () => {
    const cube = buildCube();
    const tri = triangulateCellData(cube);
    const mesh = {
      positions: Array.from(tri.positions),
      normals: Array.from(tri.normals),
      indices: Array.from(tri.indices),
    };
    const stats = meshStats(cube, mesh);
    expect(stats.faceCount).toBe(6);
    expect(stats.triangleCount).toBe(12);
    expect(stats.sliverTriangles).toBe(0);
    expect(stats.duplicateVertexPairs).toBe(0);
    expect(stats.unpairedEdges).toBe(0);
    expect(stats.minAspectQuality).toBeGreaterThan(0);
    expect(stats.minAspectQuality).toBeLessThanOrEqual(1);
  });

  it('increments its dirty-input counters for a hand-built dirty mesh', () => {
    // cell.vertices holds a duplicate pair (indices 0 and 1 coincide) -
    // exercises duplicateVertexPairs independently of the mesh below.
    const dirtyCell: CutCellData = {
      vertices: [0, 0, 0, 0, 0, 0, 5, 5, 5],
      faces: [],
      particleId: 0,
      x: 0,
      y: 0,
      z: 0,
    };

    // Two disconnected, unclosed triangles: the second is collinear (a
    // sliver, zero area). Neither triangle's edges have a reverse match
    // anywhere else in the mesh, so every edge is unpaired.
    const dirtyMesh = {
      positions: [
        0, 0, 0, 1, 0, 0, 0, 1, 0, // triangle 1 (valid, open)
        0, 0, 0, 1, 0, 0, 2, 0, 0, // triangle 2 (collinear, sliver)
      ],
      normals: [
        0, 0, 1, 0, 0, 1, 0, 0, 1,
        0, 0, 1, 0, 0, 1, 0, 0, 1,
      ],
      indices: [0, 1, 2, 3, 4, 5],
    };

    const stats = meshStats(dirtyCell, dirtyMesh);
    expect(stats.sliverTriangles).toBeGreaterThan(0);
    expect(stats.duplicateVertexPairs).toBeGreaterThan(0);
    expect(stats.unpairedEdges).toBeGreaterThan(0);
  });
});
