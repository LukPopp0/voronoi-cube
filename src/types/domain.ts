/**
 * Core domain data contracts for the geometry pipeline. These are the currency
 * types threaded through cutting -> print -> plug -> triangulate -> STL export,
 * independent of the worker transport layer (WorkerInput/Output live in
 * src/workers/types/).
 */

/** Raw voronoi cell fed into the gap-cut (polygon faces as vertex-index lists). */
export interface CellDataInput {
  x: number;
  y: number;
  z: number;
  vertices: number[];
  faces: number[][];
}

/** Polygon-level cut cell (faces as vertex-index polygons). */
export interface CutCellData {
  vertices: number[]; // flat [x,y,z, x,y,z, ...]
  faces: number[][]; // each face is an array of vertex indices
  particleId: number;
  x: number;
  y: number;
  z: number;
}
