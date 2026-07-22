import { describe, it, expect, beforeAll } from 'vitest';
import type { CutCellData } from '../../workers/types/workerOutput';

/**
 * Regression for the "ghost cells in the exported STL" bug: `cutCells` used to be
 * an append/overwrite-only Map that was never cleared, so a recompute with fewer
 * (or reordered) particleIds left stale cells behind, and the download exported
 * them as overlapping ghosts. The generation stamp makes the map hold only the
 * current computation's cells.
 *
 * The store reads `window` at module load, so shim it for the node test env.
 */
beforeAll(() => {
  (globalThis as unknown as { window: unknown }).window = {
    location: { href: 'http://localhost/' },
    history: { replaceState() {} },
  };
});

const cell = (id: number) => ({ particleId: id }) as CutCellData;

describe('cutCells generation stamping', () => {
  it('newer generation resets the map; older-generation stragglers are ignored', async () => {
    const { useVoronoiStore } = await import('../../store/store');
    const { registerCutCell } = useVoronoiStore.getState();
    const keys = () => [...useVoronoiStore.getState().cutCells.keys()].sort((a, b) => a - b);

    // Generation 1: three cells.
    registerCutCell(cell(0), 1);
    registerCutCell(cell(1), 1);
    registerCutCell(cell(2), 1);
    expect(keys()).toEqual([0, 1, 2]);

    // Generation 2: fewer/different ids -> map resets, no stale keys survive.
    registerCutCell(cell(0), 2);
    registerCutCell(cell(1), 2);
    expect(keys()).toEqual([0, 1]);
    expect(useVoronoiStore.getState().cutCellsGeneration).toBe(2);

    // A late straggler from generation 1 must not resurrect a ghost.
    registerCutCell(cell(9), 1);
    expect(keys()).toEqual([0, 1]);
    expect(useVoronoiStore.getState().cutCellsGeneration).toBe(2);
  });
});
