/**
 * Polygon-level cell data (faces as vertex-index polygons).
 */
export interface CutCellData {
  vertices: number[]; // flat [x,y,z, x,y,z, ...]
  faces: number[][]; // each face is an array of vertex indices
  particleId: number;
  x: number;
  y: number;
  z: number;
}

/**
 * Full worker output: triangulated geometry for rendering + polygon face data for print cutting.
 */
export interface WorkerOutput {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
  cellData: CutCellData;
}
