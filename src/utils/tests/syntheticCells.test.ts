import { describe, it, expect } from 'vitest';
import { makeBoxCell, boxVolume, boxIntersectionVolume } from './helpers/syntheticCells';
import { checkCutCellData, polygonVolume } from './helpers/meshInvariants';

// Sanity checks for the fixture builder itself - a broken fixture would
// poison every conclusion drawn from the defect-confirmation tests that
// depend on it, so these must pass cleanly before trusting anything else.

describe('makeBoxCell', () => {
  it('produces a closed, watertight box with zero checkCutCellData violations', () => {
    const cell = makeBoxCell([-1, -2, -3], [2, 1, 4]);
    expect(checkCutCellData(cell)).toEqual([]);
  });

  it('sets x/y/z to the world-space box center', () => {
    const cell = makeBoxCell([0, 0, 0], [2, 4, 6]);
    expect(cell.x).toBeCloseTo(1, 9);
    expect(cell.y).toBeCloseTo(2, 9);
    expect(cell.z).toBeCloseTo(3, 9);
  });

  it('stores vertices in cell-local (center-relative) coordinates', () => {
    const cell = makeBoxCell([0, 0, 0], [2, 4, 6]);
    for (let i = 0; i < cell.vertices.length; i += 3) {
      expect(Math.abs(cell.vertices[i])).toBeCloseTo(1, 9);
      expect(Math.abs(cell.vertices[i + 1])).toBeCloseTo(2, 9);
      expect(Math.abs(cell.vertices[i + 2])).toBeCloseTo(3, 9);
    }
  });

  it('polygonVolume matches boxVolume for an arbitrary box', () => {
    const min: [number, number, number] = [-1, -2, -3];
    const max: [number, number, number] = [2, 1, 4];
    const cell = makeBoxCell(min, max);
    expect(polygonVolume(cell)).toBeCloseTo(boxVolume(min, max), 9);
    expect(boxVolume(min, max)).toBeCloseTo(3 * 3 * 7, 9);
  });
});

describe('boxIntersectionVolume', () => {
  it('computes the overlap volume of two overlapping boxes', () => {
    const vol = boxIntersectionVolume([-1, -1, -1], [1, 1, 1], [-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]);
    expect(vol).toBeCloseTo(1, 9);
  });

  it('returns 0 for disjoint boxes', () => {
    const vol = boxIntersectionVolume([0, 0, 0], [1, 1, 1], [2, 2, 2], [3, 3, 3]);
    expect(vol).toBe(0);
  });

  it('handles partial overlap on a single axis', () => {
    const vol = boxIntersectionVolume(
      [0.2, -0.3, -0.3],
      [1.0, 0.3, 0.3],
      [-0.5, -0.5, -0.5],
      [0.5, 0.5, 0.5],
    );
    // overlap: x in [0.2, 0.5] (0.3), y in [-0.3, 0.3] (0.6), z in [-0.3, 0.3] (0.6)
    expect(vol).toBeCloseTo(0.3 * 0.6 * 0.6, 9);
  });
});
