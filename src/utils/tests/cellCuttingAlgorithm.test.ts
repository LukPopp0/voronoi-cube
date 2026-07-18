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

  // DEFECT D2 confirmed: cap-face triangles carry a stored normal that
  // opposes their geometric winding normal. triangulateCellData computes the
  // fan normal from raw winding then flips it "away from cell center" for
  // caps (whose vertices are near the world/cell origin on the cavity
  // boundary) without re-winding the fan indices to match, so the geometric
  // cross-product normal of each cap triangle disagrees with the stored one.
  // Observed: all 12 cap triangles (of 24 total) report
  // 'normal-winding-mismatch'; overall signedVolume stays positive (net
  // effect is a normal-direction bug, not a sign flip of the whole solid).
  it.fails("reports 'normal-winding-mismatch' violations for cap faces", () => {
    const box = makeBoxCell([-1, -1, -1], [1, 1, 1]);
    const cut = cutInnerCubeFromCell(box, H);
    const tri = triangulateCellData(cut);
    const mesh = {
      positions: Array.from(tri.positions),
      normals: Array.from(tri.normals),
      indices: Array.from(tri.indices),
    };
    // Asserting the "healthy" expectation here (per NEVER-weaken-assertions
    // convention) - it.fails documents that this currently does NOT hold.
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
