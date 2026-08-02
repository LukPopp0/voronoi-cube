import { CellDataInput } from '@/types/domain';

export interface WorkerPreview {
  cutInnerCube: boolean;
  cutBottomHole: boolean;
  innerCubeRatio: number;
  bottomCutoutWidth: number;
  bottomCutoutSides: number;
}

export interface WorkerInput {
  cell: CellDataInput;
  destructionParameter: number;
  cubeSize: number;
  particleId: number;
  // Monotonic per-cell request id; echoed back so the hook can ignore results
  // superseded by a newer cut request.
  requestId: number;
  // When set, the display geometry is the print-prepped cell; the raw gap-cut
  // cellData is still returned unchanged for the store/export.
  preview?: WorkerPreview;
}
