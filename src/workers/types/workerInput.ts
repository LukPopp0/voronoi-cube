export interface CellDataInput {
  x: number;
  y: number;
  z: number;
  vertices: number[];
  faces: number[][];
}

export interface WorkerInput {
  cell: CellDataInput;
  triangleIndices: number[];
  destructionParameter: number;
  cubeSize: number;
}
