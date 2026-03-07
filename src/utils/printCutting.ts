import { Vector3 } from 'three';
import { CutCellData } from '../workers/types/workerOutput';

const EPSILON = 1e-9;

/**
 * A half-plane: normal . p <= distance defines the "inside".
 */
interface ClipPlane {
  normal: Vector3;
  distance: number;
}

// --- Polygon type used internally (arrays of Vector3) -----------------------

type Polygon = Vector3[];

// --- Sutherland-Hodgman single-plane clip -----------------------------------

/**
 * Clip a convex polygon by a single half-plane, keeping the "inside" portion
 * (where normal . p <= distance).
 * Returns the clipped polygon, or an empty array if fully outside.
 */
const clipPolygonByPlane = (polygon: Polygon, plane: ClipPlane): Polygon => {
  if (polygon.length === 0) return [];

  const output: Vector3[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];

    const dCurrent = plane.normal.dot(current) - plane.distance;
    const dNext = plane.normal.dot(next) - plane.distance;

    const currentInside = dCurrent <= EPSILON;
    const nextInside = dNext <= EPSILON;

    if (currentInside && nextInside) {
      // Both inside -> keep next
      output.push(next);
    } else if (currentInside && !nextInside) {
      // Leaving -> add intersection
      const t = dCurrent / (dCurrent - dNext);
      output.push(current.clone().lerp(next, t));
    } else if (!currentInside && nextInside) {
      // Entering -> add intersection, then next
      const t = dCurrent / (dCurrent - dNext);
      output.push(current.clone().lerp(next, t));
      output.push(next);
    }
    // Both outside -> skip
  }

  return output;
};

// --- Recursive cube subtraction for a single face --------------------------

/**
 * Given a convex polygon (a cell face), subtract the inner cube defined by
 * `cubePlanes` (each plane's "inside" half-space; the cube interior is the
 * intersection of all six half-spaces).
 *
 * Returns an array of convex polygons that represent the parts of the face
 * that are OUTSIDE the inner cube.
 *
 * Algorithm (BSP-style recursive partition):
 *   For plane[0]:
 *     outsidePart = clip(polygon, outside of plane[0])  -> definitely outside cube
 *     insidePart  = clip(polygon, inside of plane[0])   -> might still be outside
 *   Recurse on insidePart with remaining planes.
 *   If no planes remain, insidePart is fully inside the cube -> discard.
 */
const subtractCubeFromFace = (polygon: Polygon, cubePlanes: ClipPlane[]): Polygon[] => {
  if (polygon.length < 3) return [];

  if (cubePlanes.length === 0) {
    // Polygon is inside all cube planes -> inside the cube -> discard
    return [];
  }

  const plane = cubePlanes[0];
  const remaining = cubePlanes.slice(1);

  // "inside" this plane = normal.p <= distance (toward cube interior for this plane)
  const insidePart = clipPolygonByPlane(polygon, plane);

  // "outside" this plane = flip the plane
  const flipped: ClipPlane = {
    normal: plane.normal.clone().negate(),
    distance: -plane.distance,
  };
  const outsidePart = clipPolygonByPlane(polygon, flipped);

  const result: Polygon[] = [];

  // outsidePart is definitely outside the cube (outside at least this plane)
  if (outsidePart.length >= 3) {
    result.push(outsidePart);
  }

  // insidePart might still be outside the cube via other planes
  if (insidePart.length >= 3) {
    result.push(...subtractCubeFromFace(insidePart, remaining));
  }

  return result;
};

// --- Vertex pool helper -----------------------------------------------------

class VertexPool {
  vertices: number[] = [];
  private map = new Map<string, number>();

  getOrAdd(v: Vector3): number {
    const key = `${v.x.toFixed(9)}_${v.y.toFixed(9)}_${v.z.toFixed(9)}`;
    const existing = this.map.get(key);
    if (existing !== undefined) return existing;
    const idx = this.vertices.length / 3;
    this.vertices.push(v.x, v.y, v.z);
    this.map.set(key, idx);
    return idx;
  }

  getVertex(index: number): Vector3 {
    return new Vector3(
      this.vertices[index * 3],
      this.vertices[index * 3 + 1],
      this.vertices[index * 3 + 2],
    );
  }
}

// --- Sort polygon vertices (for cap faces) ----------------------------------

const sortPolygonVertices = (vertices: Vector3[], normal: Vector3): Vector3[] => {
  if (vertices.length < 3) return vertices;

  // Compute centroid
  const center = new Vector3(0, 0, 0);
  for (const v of vertices) center.add(v);
  center.divideScalar(vertices.length);

  // Build orthonormal basis on the plane
  let refVec = new Vector3(1, 0, 0);
  if (Math.abs(normal.dot(refVec)) > 0.9) refVec = new Vector3(0, 1, 0);

  const u = refVec
    .clone()
    .sub(normal.clone().multiplyScalar(normal.dot(refVec)))
    .normalize();
  const v = normal.clone().cross(u);

  return vertices
    .map(vertex => {
      const rel = vertex.clone().sub(center);
      return { vertex, angle: Math.atan2(rel.dot(v), rel.dot(u)) };
    })
    .sort((a, b) => a.angle - b.angle)
    .map(va => va.vertex);
};

// --- Build 6 inner-cube clip planes (in cell-local coordinates) ------------

const buildInnerCubePlanes = (
  halfSize: number,
  cellX: number,
  cellY: number,
  cellZ: number,
): ClipPlane[] => {
  return [
    { normal: new Vector3(1, 0, 0), distance: halfSize - cellX },
    { normal: new Vector3(-1, 0, 0), distance: halfSize + cellX },
    { normal: new Vector3(0, 1, 0), distance: halfSize - cellY },
    { normal: new Vector3(0, -1, 0), distance: halfSize + cellY },
    { normal: new Vector3(0, 0, 1), distance: halfSize - cellZ },
    { normal: new Vector3(0, 0, -1), distance: halfSize + cellZ },
  ];
};

// --- Classify a point w.r.t. all cube planes -------------------------------

const isInsideCube = (point: Vector3, cubePlanes: ClipPlane[]): boolean => {
  for (const p of cubePlanes) {
    if (p.normal.dot(point) - p.distance > EPSILON) return false;
  }
  return true;
};

// --- Build cap faces from new intersection vertices -------------------------

/**
 * After clipping all faces, build cap faces on each inner-cube plane to close
 * the cell.  For each cube plane, collect all vertices that lie on it, sort
 * them into a polygon, and emit the face.
 *
 * We also check the 8 inner-cube corners — if a corner is inside the original
 * cell (satisfies all cell face planes), it becomes part of the cap face on
 * each of the 3 cube planes that meet at that corner.
 */
const buildCapFaces = (
  pool: VertexPool,
  cubePlanes: ClipPlane[],
  cellPlanes: ClipPlane[],
): number[][] => {
  const capFaces: number[][] = [];

  // Pre-compute which vertices lie on which cube planes
  const verticesOnPlane: Map<number, Set<number>> = new Map();
  for (let pi = 0; pi < 6; pi++) verticesOnPlane.set(pi, new Set());

  const nVerts = pool.vertices.length / 3;
  for (let vi = 0; vi < nVerts; vi++) {
    const v = pool.getVertex(vi);
    for (let pi = 0; pi < 6; pi++) {
      const d = cubePlanes[pi].normal.dot(v) - cubePlanes[pi].distance;
      if (Math.abs(d) < EPSILON * 100) {
        verticesOnPlane.get(pi)!.add(vi);
      }
    }
  }

  // Check inner-cube corners.  Each corner is the intersection of 3 axis-aligned planes.
  // Plane indices: 0=+x, 1=-x, 2=+y, 3=-y, 4=+z, 5=-z
  const cornerPlaneSets: [number, number, number][] = [
    [0, 2, 4],
    [0, 2, 5],
    [0, 3, 4],
    [0, 3, 5],
    [1, 2, 4],
    [1, 2, 5],
    [1, 3, 4],
    [1, 3, 5],
  ];

  for (const [a, b, c] of cornerPlaneSets) {
    // Corner position: solve n_a . p = d_a, n_b . p = d_b, n_c . p = d_c
    // Since normals are axis-aligned, this is trivial:
    const corner = new Vector3();
    // For plane with normal (+/-1,0,0): x = +/-distance
    corner.x =
      cubePlanes[a].normal.x !== 0
        ? cubePlanes[a].distance * cubePlanes[a].normal.x
        : cubePlanes[b].normal.x !== 0
          ? cubePlanes[b].distance * cubePlanes[b].normal.x
          : cubePlanes[c].distance * cubePlanes[c].normal.x;
    corner.y =
      cubePlanes[a].normal.y !== 0
        ? cubePlanes[a].distance * cubePlanes[a].normal.y
        : cubePlanes[b].normal.y !== 0
          ? cubePlanes[b].distance * cubePlanes[b].normal.y
          : cubePlanes[c].distance * cubePlanes[c].normal.y;
    corner.z =
      cubePlanes[a].normal.z !== 0
        ? cubePlanes[a].distance * cubePlanes[a].normal.z
        : cubePlanes[b].normal.z !== 0
          ? cubePlanes[b].distance * cubePlanes[b].normal.z
          : cubePlanes[c].distance * cubePlanes[c].normal.z;

    // Check if corner is inside the cell
    let insideCell = true;
    for (const cp of cellPlanes) {
      if (cp.normal.dot(corner) - cp.distance > EPSILON * 10) {
        insideCell = false;
        break;
      }
    }

    if (insideCell) {
      const vi = pool.getOrAdd(corner);
      verticesOnPlane.get(a)!.add(vi);
      verticesOnPlane.get(b)!.add(vi);
      verticesOnPlane.get(c)!.add(vi);
    }
  }

  // Build a cap face for each cube plane that has >= 3 vertices
  for (let pi = 0; pi < 6; pi++) {
    const idxSet = verticesOnPlane.get(pi)!;
    if (idxSet.size < 3) continue;

    const verts = Array.from(idxSet).map(vi => pool.getVertex(vi));

    // Cap face normal points INTO the cube interior (away from cell material).
    // Cube plane normal points "inward" in our convention (n.p <= d is "inside cube").
    // The cap face outward normal (from cell material perspective) is -plane.normal
    // because the material is on the outside of the cube.
    const capNormal = cubePlanes[pi].normal.clone().negate();

    const sorted = sortPolygonVertices(verts, capNormal);

    // Map sorted vertices back to pool indices
    const faceIndices = sorted.map(v => pool.getOrAdd(v));
    capFaces.push(faceIndices);
  }

  return capFaces;
};

// --- Compute cell face planes (for cube-corner-inside-cell test) ------------

const computeCellFacePlanes = (cellData: CutCellData): ClipPlane[] => {
  const planes: ClipPlane[] = [];
  const verts = cellData.vertices;

  for (const face of cellData.faces) {
    if (face.length < 3) continue;

    const v0 = new Vector3(verts[face[0] * 3], verts[face[0] * 3 + 1], verts[face[0] * 3 + 2]);
    const v1 = new Vector3(verts[face[1] * 3], verts[face[1] * 3 + 1], verts[face[1] * 3 + 2]);
    const v2 = new Vector3(verts[face[2] * 3], verts[face[2] * 3 + 1], verts[face[2] * 3 + 2]);

    const edge1 = v1.clone().sub(v0);
    const edge2 = v2.clone().sub(v0);
    const normal = edge1.cross(edge2).normalize();

    // Face center
    const center = new Vector3(0, 0, 0);
    for (const idx of face) {
      center.add(new Vector3(verts[idx * 3], verts[idx * 3 + 1], verts[idx * 3 + 2]));
    }
    center.divideScalar(face.length);

    // Ensure outward-pointing (away from cell center = origin)
    if (normal.dot(center) < 0) {
      normal.negate();
    }

    const distance = normal.dot(center);
    planes.push({ normal, distance });
  }

  return planes;
};

/**
 * Cut the inner cube out of a single cell.
 * Returns a new CutCellData with the inner cube subtracted.
 */
export const cutInnerCubeFromCell = (
  cellData: CutCellData,
  innerCubeHalfSize: number,
): CutCellData => {
  const cubePlanes = buildInnerCubePlanes(innerCubeHalfSize, cellData.x, cellData.y, cellData.z);

  const pool = new VertexPool();
  const newFaces: number[][] = [];
  const verts = cellData.vertices;

  // Process each face of the cell
  for (const face of cellData.faces) {
    if (face.length < 3) continue;

    // Convert face vertex indices to Vector3 polygon
    const polygon: Polygon = face.map(
      idx => new Vector3(verts[idx * 3], verts[idx * 3 + 1], verts[idx * 3 + 2]),
    );

    // Early return: Are all vertices outside or inside the cube?
    const insideFlags = polygon.map(v => isInsideCube(v, cubePlanes));
    const allOutside = insideFlags.every(f => !f);
    const allInside = insideFlags.every(f => f);

    // Face is entirely outside the cube -> keep as is
    if (allOutside) {
      const faceIndices = polygon.map(v => pool.getOrAdd(v));
      newFaces.push(faceIndices);
      continue;
    }

    // Face is entirely inside the cube -> discard
    if (allInside) {
      continue;
    }

    const resultPolygons = subtractCubeFromFace(polygon, cubePlanes);

    for (const poly of resultPolygons) {
      if (poly.length < 3) continue;
      const faceIndices = poly.map(v => pool.getOrAdd(v));
      newFaces.push(faceIndices);
    }
  }

  // Build cap faces to close the cell
  const cellPlanes = computeCellFacePlanes(cellData);
  const capFaces = buildCapFaces(pool, cubePlanes, cellPlanes);
  newFaces.push(...capFaces);

  return {
    vertices: pool.vertices,
    faces: newFaces,
    particleId: cellData.particleId,
    x: cellData.x,
    y: cellData.y,
    z: cellData.z,
  };
};

/**
 * Process all cells: subtract the inner cube from each one.
 * Returns an array of CutCellData, one per cell, with the inner cube removed.
 */
export const prepareForPrint = (
  cells: CutCellData[],
  cubeSize: number,
  innerCubeRatio: number,
): CutCellData[] => {
  const innerCubeHalfSize = (cubeSize * innerCubeRatio) / 2;

  return cells
    .map(cell => cutInnerCubeFromCell(cell, innerCubeHalfSize))
    .filter(cell => cell.faces.length > 0);
};
