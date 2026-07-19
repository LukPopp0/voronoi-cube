import { describe, it, expect } from 'vitest';
import { triangulateCellData } from '../cellCuttingAlgorithm';
import { cutInnerCubeFromCell } from '../printCutting';
import { checkTriangulated, signedVolume, polygonVolume } from './helpers/meshInvariants';
import { makeBoxCell } from './helpers/syntheticCells';

describe('triangulateCellData on a closed convex cell (no cutting involved)', () => {
  it('zero checkTriangulated violations, positive signedVolume equal to polygonVolume', () => {
    const box = makeBoxCell([-1, -1, -1], [1, 1, 1]);
    const tri = triangulateCellData(box);
    const mesh = {
      positions: Array.from(tri.positions),
      normals: Array.from(tri.normals),
      indices: Array.from(tri.indices),
    };

    expect(checkTriangulated(mesh)).toEqual([]);
    const vol = signedVolume(mesh);
    expect(vol).toBeGreaterThan(0);
    expect(vol).toBeCloseTo(polygonVolume(box), 9);
  });
});

describe('triangulateCellData on F1 cut result (D2 probe)', () => {
  // F1: concentric box [-1,-1,-1]..[1,1,1], inner cube half-size 0.5.
  const H = 0.5;

  // DEFECT D2 fixed: buildCapFaces orients cap-polygon winding to match the
  // intended cap normal, and triangulateCellData derives normals purely
  // from winding (no "away from center" flip). Stored normal and geometric
  // winding normal now agree for cap triangles as they already did for
  // original-face triangles.
  it('reports zero normal-winding-mismatch violations for cap faces (D2 fixed)', () => {
    const box = makeBoxCell([-1, -1, -1], [1, 1, 1]);
    const cut = cutInnerCubeFromCell(box, H);
    const tri = triangulateCellData(cut);
    const mesh = {
      positions: Array.from(tri.positions),
      normals: Array.from(tri.normals),
      indices: Array.from(tri.indices),
    };
    // D2 (cap winding/normal mismatch) is fixed: buildCapFaces now orients
    // cap-polygon winding to match the intended normal. Regression guard.
    expect(checkTriangulated(mesh).filter(v => v.kind === 'normal-winding-mismatch')).toEqual([]);
  });

  it('overall signedVolume is positive (net solid orientation is not flipped)', () => {
    const box = makeBoxCell([-1, -1, -1], [1, 1, 1]);
    const cut = cutInnerCubeFromCell(box, H);
    const tri = triangulateCellData(cut);
    const mesh = {
      positions: Array.from(tri.positions),
      normals: Array.from(tri.normals),
      indices: Array.from(tri.indices),
    };
    expect(signedVolume(mesh)).toBeGreaterThan(0);
  });
});
