import { Vector3 } from 'three';

export const getFaceNormal = (indices: number[], vertices: number[]): Vector3 => {
  if (indices.length < 3) throw new Error('Not enough vertices passed.');

  // Only 3 points necessary
  const v0 = new Vector3(
    vertices[3 * indices[0] + 0],
    vertices[3 * indices[0] + 1],
    vertices[3 * indices[0] + 2]
  );
  const v1 = new Vector3(
    vertices[3 * indices[1] + 0],
    vertices[3 * indices[1] + 1],
    vertices[3 * indices[1] + 2]
  );
  const v2 = new Vector3(
    vertices[3 * indices[2] + 0],
    vertices[3 * indices[2] + 1],
    vertices[3 * indices[2] + 2]
  );

  return v0.clone().sub(v1).cross(v0.sub(v2)).normalize();
};

export const getFaceCenter = (indices: number[], vertices: number[]): Vector3 => {
  const sumVec = [0, 0, 0];
  for (let i = 0; i < indices.length; ++i) {
    sumVec[0] += vertices[3 * indices[i] + 0];
    sumVec[1] += vertices[3 * indices[i] + 1];
    sumVec[2] += vertices[3 * indices[i] + 2];
  }
  return new Vector3(
    sumVec[0] / indices.length,
    sumVec[1] / indices.length,
    sumVec[2] / indices.length
  );
};

export const polygonToTriangles = (indices: number[]): number[][] => {
  const tris = new Array(indices.length - 2);
  for (let fvi = 1; fvi < indices.length - 1; ++fvi) {
    tris[fvi - 1] = [indices[0], indices[fvi + 1], indices[fvi]];
  }
  return tris;
};
