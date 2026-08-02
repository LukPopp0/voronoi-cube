import { BufferAttribute, BufferGeometry } from 'three';

/** Triangulated mesh arrays (output of triangulateCellData). */
export interface TriangulatedGeometry {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint32Array;
}

/**
 * Build a Three BufferGeometry from triangulated position/normal/index arrays.
 * Empty input yields an empty geometry (no attributes set).
 */
export const toBufferGeometry = (tri: TriangulatedGeometry): BufferGeometry => {
  const bg = new BufferGeometry();
  if (tri.positions.length > 0) {
    bg.setAttribute('position', new BufferAttribute(tri.positions, 3));
    bg.setAttribute('normal', new BufferAttribute(tri.normals, 3));
    bg.setIndex(new BufferAttribute(tri.indices, 1));
  }
  return bg;
};
