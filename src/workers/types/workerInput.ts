export interface CellDataInput {
  x: number;
  y: number;
  z: number;
  vertices: number[];
  faces: number[][];
}

export interface WorkerPreview {
  cutInnerCube: boolean;
  cutBottomHole: boolean;
  innerCubeRatio: number;
  bottomCutoutWidth: number;
  bottomCutoutSides: number;
}

export interface WorkerInput {
  cell: CellDataInput;
  triangleIndices: number[];
  destructionParameter: number;
  cubeSize: number;
  particleId: number;
  // When set, the display geometry is the print-prepped cell; the raw gap-cut
  // cellData is still returned unchanged for the store/export.
  preview?: WorkerPreview;
}
