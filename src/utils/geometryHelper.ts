import { Vector3 } from 'three';
import { PLANE_TOL, KEY_PRECISION, EPSILON } from './geometryConstants';

// ===========================================================================
// Shared convex-geometry primitives used by both the gap-cutting
// (cellCuttingAlgorithm.ts) and print-prep (printCutting.ts) pipelines.
// Single source of truth - see geometryConstants.ts for the tolerances.
// ===========================================================================

/** A half-space: `normal . p <= distance` defines the "inside". */
export interface ClipPlane {
  normal: Vector3;
  distance: number;
}

/** A polygon is an ordered ring of coplanar points. */
export type Polygon = Vector3[];

/** Signed distance of a point from a plane: >0 outside, <=0 inside. */
export const signedPlaneDistance = (plane: ClipPlane, p: Vector3): number =>
  plane.normal.dot(p) - plane.distance;

/**
 * Clip a convex polygon by a single half-plane, keeping the "inside" portion
 * (where `normal . p <= distance`). Returns the clipped polygon, or an empty
 * array if fully outside.
 */
export const clipPolygonByPlane = (polygon: Polygon, plane: ClipPlane): Polygon => {
  if (polygon.length === 0) return [];

  const output: Vector3[] = [];

  for (let i = 0; i < polygon.length; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % polygon.length];

    const dCurrent = plane.normal.dot(current) - plane.distance;
    const dNext = plane.normal.dot(next) - plane.distance;

    const currentInside = dCurrent <= PLANE_TOL;
    const nextInside = dNext <= PLANE_TOL;

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

  // Drop consecutive (incl. wrap-around) duplicates: a vertex lying exactly
  // ON the clip plane gets emitted twice - once by the "inside" case and
  // once as the computed intersection point (t=0/t=1 lerp reproduces the
  // endpoint). Happens whenever a polygon crosses the plane through one of
  // its own vertices, e.g. a cell face passing through the frustum apex
  // where all six side planes meet.
  const deduped: Vector3[] = [];
  for (const v of output) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.distanceTo(v) < EPSILON) continue;
    deduped.push(v);
  }
  while (deduped.length > 1 && deduped[0].distanceTo(deduped[deduped.length - 1]) < EPSILON) {
    deduped.pop();
  }

  return deduped;
};

/**
 * Rounded coordinate string for vertex-dedup keys, with IEEE negative zero
 * collapsed to positive zero. Clipping a face through a point where side
 * planes all meet (coordinate ~0) can yield a component of -0;
 * `(-0).toFixed(n)` is "-0.000..." which would hash DIFFERENTLY from
 * "0.000...", splitting a single vertex into two pool entries and leaving
 * unpaired edges (holes). Normalizing the sign of zero merges them.
 */
export const coordKey = (n: number): string => {
  const s = n.toFixed(KEY_PRECISION);
  return s[0] === '-' && Number(s) === 0 ? s.slice(1) : s;
};

/** Dedups Vector3s into a flat number[] pool by rounded, sign-of-zero-safe key. */
export class VertexPool {
  vertices: number[] = [];
  private map = new Map<string, number>();

  getOrAdd(v: Vector3): number {
    const key = `${coordKey(v.x)}_${coordKey(v.y)}_${coordKey(v.z)}`;
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

/**
 * Sort coplanar polygon vertices into CCW order around their centroid, viewed
 * along `normal`. Does NOT guarantee winding matches the normal's sign - callers
 * that need deterministic winding must correct against a Newell normal afterward.
 */
export const sortPolygonVertices = (vertices: Vector3[], normal: Vector3): Vector3[] => {
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

/**
 * Unnormalized Newell normal: sums a contribution from every edge, so unlike
 * a single vertex-triple cross product it stays well-conditioned even when
 * some individual triple happens to be collinear. Its length is 2x the
 * polygon's area for a planar polygon, near-zero iff the whole polygon is
 * degenerate (collinear/coincident vertices).
 */
export const computeNewellNormalRaw = (polygon: Polygon): Vector3 => {
  const normal = new Vector3(0, 0, 0);
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % n];
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  return normal;
};

export const computeNewellNormal = (polygon: Polygon): Vector3 =>
  computeNewellNormalRaw(polygon).normalize();

/** Polygon area from the Newell normal's magnitude (exact for planar polygons). */
export const computePolygonArea = (polygon: Polygon): number =>
  computeNewellNormalRaw(polygon).length() / 2;

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
