import { describe, it, expect } from 'vitest';
import { prepareForPrint } from '@/utils/print/printCutting';
import { triangulateCellData } from '@/utils/cutting/cellCutting';

describe('printCutting', () => {
  it('prepareForPrint returns empty array for empty input', () => {
    const result = prepareForPrint([], 1, 0.5);
    expect(result).toEqual([]);
  });
});

describe('cellCuttingAlgorithm', () => {
  it('triangulateCellData import succeeds (type-only voro3d import works)', () => {
    expect(triangulateCellData).toBeDefined();
    expect(typeof triangulateCellData).toBe('function');
  });
});
