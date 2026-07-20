import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { VoroCell } from 'voro3d';
import { CellDataInput } from '../workers/types/workerInput';
import { CutCellData } from '../workers/types/workerOutput';
import { EPSILON, PLANE_TOL, ON_PLANE_TOL, KEY_PRECISION } from './geometryConstants';

/**
 * Represents a plane in 3D space using the equation: normal . p = distance
 */
interface Plane {
  normal: Vector3;
  distance: number;
  faceIndex: number; // Track which original face this plane belongs to
}

/**
 * Get a vertex from the vertices array by index
 */
const getVertex = (vertices: number[], index: number): Vector3 => {
  return new Vector3(vertices[3 * index + 0], vertices[3 * index + 1], vertices[3 * index + 2]);
};

/**
 * Compute the plane equation for a face.
 * Returns the outward-pointing normal and the signed distance from origin.
 */
const computeFacePlane = (
  faceIndices: number[],
  vertices: number[],
  cellCenter: Vector3,
): Plane & { center: Vector3 } => {
  if (faceIndices.length < 3) {
    throw new Error('Face must have at least 3 vertices');
  }

  const v0 = getVertex(vertices, faceIndices[0]);
  const v1 = getVertex(vertices, faceIndices[1]);
  const v2 = getVertex(vertices, faceIndices[2]);

  // Compute normal using cross product
  const edge1 = v1.clone().sub(v0);
  const edge2 = v2.clone().sub(v0);
  const normal = edge1.cross(edge2).normalize();

  // Compute face center
  const center = new Vector3(0, 0, 0);
  for (const idx of faceIndices) {
    center.add(getVertex(vertices, idx));
  }
  center.divideScalar(faceIndices.length);

  // Ensure normal points outward (away from cell center)
  const toCenter = cellCenter.clone().sub(center);
  if (normal.dot(toCenter) > 0) {
    normal.negate();
  }

  // Distance from origin: d = normal . point_on_plane
  const distance = normal.dot(center);

  return { normal, distance, center, faceIndex: -1 };
};

/**
 * Find the intersection point of three planes.
 * Returns null if planes are parallel or nearly parallel.
 */
const threePlaneIntersection = (p1: Plane, p2: Plane, p3: Plane): Vector3 | null => {
  const n1 = p1.normal;
  const n2 = p2.normal;
  const n3 = p3.normal;

  const n2CrossN3 = n2.clone().cross(n3);
  const det = n1.dot(n2CrossN3);

  // If determinant is near zero, planes are parallel or coplanar
  if (Math.abs(det) < EPSILON) {
    return null;
  }

  // Intersection point formula:
  // p = (d1 * (n2 x n3) + d2 * (n3 x n1) + d3 * (n1 x n2)) / det
  const n3CrossN1 = n3.clone().cross(n1);
  const n1CrossN2 = n1.clone().cross(n2);

  const point = new Vector3(0, 0, 0);
  point.add(n2CrossN3.multiplyScalar(p1.distance));
  point.add(n3CrossN1.multiplyScalar(p2.distance));
  point.add(n1CrossN2.multiplyScalar(p3.distance));
  point.divideScalar(det);

  return point;
};

/**
 * Check if a point is inside or on all half-spaces defined by the planes.
 * A point p is inside plane i if: normal_i . p <= distance_i + epsilon
 */
const isPointInsideAllPlanes = (
  point: Vector3,
  planes: Plane[],
  tolerance: number = PLANE_TOL,
): boolean => {
  for (const plane of planes) {
    const signedDist = plane.normal.dot(point) - plane.distance;
    if (signedDist > tolerance) {
      return false;
    }
  }
  return true;
};

/**
 * Sort vertices of a face in counter-clockwise order when viewed from outside.
 */
const sortFaceVertices = (vertices: Vector3[], normal: Vector3, center: Vector3): Vector3[] => {
  if (vertices.length < 3) return vertices;

  // Create a local 2D coordinate system on the face plane
  let refVec = new Vector3(1, 0, 0);
  if (Math.abs(normal.dot(refVec)) > 0.9) {
    refVec = new Vector3(0, 1, 0);
  }

  // Create orthonormal basis on the plane
  const u = refVec
    .clone()
    .sub(normal.clone().multiplyScalar(normal.dot(refVec)))
    .normalize();
  const v = normal.clone().cross(u);

  // Compute angle for each vertex relative to center
  const verticesWithAngles = vertices.map(vertex => {
    const rel = vertex.clone().sub(center);
    const x = rel.dot(u);
    const y = rel.dot(v);
    const angle = Math.atan2(y, x);
    return { vertex, angle };
  });

  // Sort by angle (counter-clockwise)
  verticesWithAngles.sort((a, b) => a.angle - b.angle);

  return verticesWithAngles.map(va => va.vertex);
};

/**
 * Check if a face is at the boundary of the cube.
 */
const isBorderFace = (
  faceCenter: Vector3,
  cellPosition: Vector3,
  cubeSize: number,
  epsilon: number = 0.005,
): boolean => {
  const worldCenter = faceCenter.clone().add(cellPosition);
  const halfSize = cubeSize / 2;

  return (
    halfSize - Math.abs(worldCenter.x) < epsilon ||
    halfSize - Math.abs(worldCenter.y) < epsilon ||
    halfSize - Math.abs(worldCenter.z) < epsilon
  );
};

/**
 * Core algorithm that shrinks a Voronoi cell by moving each face inward.
 * Returns polygon-level cell data (vertices + face index arrays).
 */
export const cutCellCore = (
  cell: CellDataInput,
  triangleIndices: number[],
  destructionParameter: number,
  cubeSize: number,
): CutCellData => {
  // If no shrinking needed, return original cell data
  if (destructionParameter <= 0) {
    return {
      vertices: Array.from(cell.vertices),
      faces: cell.faces.map(f => [...f]),
      particleId: -1,
      x: cell.x,
      y: cell.y,
      z: cell.z,
    };
  }

  const cellCenter = new Vector3(0, 0, 0);
  const cellPosition = new Vector3(cell.x, cell.y, cell.z);

  // Step 1: Compute plane equations for all faces
  const planes: Plane[] = [];

  for (let fi = 0; fi < cell.faces.length; fi++) {
    const faceIndices = cell.faces[fi];
    const planeData = computeFacePlane(faceIndices, cell.vertices, cellCenter);
    planeData.faceIndex = fi;

    const isBorder = isBorderFace(planeData.center, cellPosition, cubeSize);

    // Step 2: Offset plane inward (reduce distance) - only for non-border faces
    const offsetPlane: Plane = {
      normal: planeData.normal.clone(),
      distance: isBorder ? planeData.distance : planeData.distance - destructionParameter,
      faceIndex: fi,
    };
    planes.push(offsetPlane);
  }

  // Step 3: Find all valid vertices by intersecting combinations of 3 planes
  const newVertices: Vector3[] = [];
  const vertexToPlanes: Map<number, Set<number>> = new Map();

  const numPlanes = planes.length;
  for (let i = 0; i < numPlanes; i++) {
    for (let j = i + 1; j < numPlanes; j++) {
      for (let k = j + 1; k < numPlanes; k++) {
        const intersection = threePlaneIntersection(planes[i], planes[j], planes[k]);

        if (intersection === null) continue;

        // Step 4: Filter valid vertices
        // A vertex is valid only if it lies on the inside of all half-spaces
        if (!isPointInsideAllPlanes(intersection, planes, PLANE_TOL)) {
          continue;
        }

        // Check for duplicate vertices
        let isDuplicate = false;
        let existingIndex = -1;
        for (let vi = 0; vi < newVertices.length; vi++) {
          if (newVertices[vi].distanceTo(intersection) < ON_PLANE_TOL) {
            isDuplicate = true;
            existingIndex = vi;
            break;
          }
        }

        if (!isDuplicate) {
          existingIndex = newVertices.length;
          newVertices.push(intersection);
          vertexToPlanes.set(existingIndex, new Set());
        }

        // Track which planes this vertex belongs to
        vertexToPlanes.get(existingIndex)!.add(i);
        vertexToPlanes.get(existingIndex)!.add(j);
        vertexToPlanes.get(existingIndex)!.add(k);
      }
    }
  }

  // If no valid vertices found (cell completely collapsed), return empty geometry
  if (newVertices.length < 4) {
    return {
      vertices: [],
      faces: [],
      particleId: -1,
      x: cell.x,
      y: cell.y,
      z: cell.z,
    };
  }

  // Step 5: Reconstruct faces
  // For each plane, collect the vertices that lie on it, and sort them
  // in proper winding order to form the new face polygon.
  // If a face has fewer than 3 valid vertices after shrinking, it has collapsed.
  const newFaces: Vector3[][] = [];
  const newFaceNormals: Vector3[] = [];

  for (let pi = 0; pi < planes.length; pi++) {
    const faceVertices: Vector3[] = [];

    // Find all vertices that lie on this plane
    for (let vi = 0; vi < newVertices.length; vi++) {
      const vertexPlanes = vertexToPlanes.get(vi);
      if (vertexPlanes && vertexPlanes.has(pi)) {
        faceVertices.push(newVertices[vi].clone());
      }
    }

    if (faceVertices.length < 3) continue;

    // Compute face center for sorting
    const faceCenter = new Vector3(0, 0, 0);
    for (const v of faceVertices) {
      faceCenter.add(v);
    }
    faceCenter.divideScalar(faceVertices.length);

    // Sort vertices in proper winding order
    const sortedVertices = sortFaceVertices(faceVertices, planes[pi].normal, faceCenter);

    newFaces.push(sortedVertices);
    newFaceNormals.push(planes[pi].normal.clone());
  }

  // Step 6: Build polygon-level cell data with shared vertex pool
  const vertexPool: number[] = [];
  const faceIndexArrays: number[][] = [];
  const vertexMap = new Map<string, number>();

  const getOrAddPoolVertex = (v: Vector3): number => {
    const key = `${v.x.toFixed(KEY_PRECISION)}_${v.y.toFixed(KEY_PRECISION)}_${v.z.toFixed(KEY_PRECISION)}`;
    if (vertexMap.has(key)) return vertexMap.get(key)!;
    const idx = vertexPool.length / 3;
    vertexPool.push(v.x, v.y, v.z);
    vertexMap.set(key, idx);
    return idx;
  };

  for (const face of newFaces) {
    const indices = face.map(v => getOrAddPoolVertex(v));
    faceIndexArrays.push(indices);
  }

  return {
    vertices: vertexPool,
    faces: faceIndexArrays,
    particleId: -1,
    x: cell.x,
    y: cell.y,
    z: cell.z,
  };
};

/**
 * Triangulate CutCellData into positions/normals/indices arrays for rendering.
 */
export const triangulateCellData = (
  cellData: CutCellData,
): { positions: Float32Array; normals: Float32Array; indices: Uint32Array } => {
  if (cellData.vertices.length === 0 || cellData.faces.length === 0) {
    return {
      positions: new Float32Array([]),
      normals: new Float32Array([]),
      indices: new Uint32Array([]),
    };
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const vertexIndexMap = new Map<string, number>();

  const getOrAddVertex = (v: Vector3, n: Vector3): number => {
    const key = `${v.x.toFixed(6)}_${v.y.toFixed(6)}_${v.z.toFixed(6)}_${n.x.toFixed(6)}_${n.y.toFixed(6)}_${n.z.toFixed(6)}`;
    if (vertexIndexMap.has(key)) return vertexIndexMap.get(key)!;
    const index = positions.length / 3;
    positions.push(v.x, v.y, v.z);
    normals.push(n.x, n.y, n.z);
    vertexIndexMap.set(key, index);
    return index;
  };

  const verts = cellData.vertices;

  for (const face of cellData.faces) {
    if (face.length < 3) continue;

    // Compute face normal
    const v0 = new Vector3(verts[face[0] * 3], verts[face[0] * 3 + 1], verts[face[0] * 3 + 2]);
    const v1 = new Vector3(verts[face[1] * 3], verts[face[1] * 3 + 1], verts[face[1] * 3 + 2]);
    const v2 = new Vector3(verts[face[2] * 3], verts[face[2] * 3 + 1], verts[face[2] * 3 + 2]);

    // Normal is derived purely from vertex winding (fan order) - winding is
    // the single source of truth, no "away from center" heuristic. This must
    // match the winding produced upstream (sortFaceVertices / buildCapFaces),
    // whichever emitted this face.
    const edge1 = v1.clone().sub(v0);
    const edge2 = v2.clone().sub(v0);
    const normal = edge1.cross(edge2).normalize();

    // Fan triangulation (works for convex faces)
    for (let i = 1; i < face.length - 1; i++) {
      const fv0 = new Vector3(verts[face[0] * 3], verts[face[0] * 3 + 1], verts[face[0] * 3 + 2]);
      const fv1 = new Vector3(verts[face[i] * 3], verts[face[i] * 3 + 1], verts[face[i] * 3 + 2]);
      const fv2 = new Vector3(
        verts[face[i + 1] * 3],
        verts[face[i + 1] * 3 + 1],
        verts[face[i + 1] * 3 + 2],
      );

      const i0 = getOrAddVertex(fv0, normal);
      const i1 = getOrAddVertex(fv1, normal);
      const i2 = getOrAddVertex(fv2, normal);

      indices.push(i0, i1, i2);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
};

/**
 * Shrink a Voronoi cell by moving each face inward by the destruction parameter.
 * Uses the half-space intersection method for clean, watertight results.
 * Returns a BufferGeometry for direct use in Three.js.
 */
export const cutCell = (
  cell: VoroCell,
  triangleIndices: number[],
  destructionParameter: number,
  cubeSize: number,
): BufferGeometry => {
  const cellData = cutCellCore(cell, triangleIndices, destructionParameter, cubeSize);
  const result = triangulateCellData(cellData);

  const bg = new BufferGeometry();
  if (result.positions.length > 0) {
    bg.setAttribute('position', new BufferAttribute(result.positions, 3));
    bg.setAttribute('normal', new BufferAttribute(result.normals, 3));
    bg.setIndex(new BufferAttribute(result.indices, 1));
  }

  return bg;
};
