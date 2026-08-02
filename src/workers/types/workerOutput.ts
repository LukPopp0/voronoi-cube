import { CutCellData } from '@/types/domain';

/**
 * Full worker output: triangulated geometry for rendering + polygon face data for print cutting.
 */
export interface WorkerOutput {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  cellData: CutCellData;
  // Echoes WorkerInput.requestId so the hook can drop superseded (stale) results
  // that finished after a newer cut was requested (e.g. during a gap-slider drag).
  requestId: number;
}
