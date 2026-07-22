import { Vector3 } from 'three';
import { CutCellData } from '../workers/types/workerOutput';
import { PLANE_TOL, ON_PLANE_TOL, KEY_PRECISION, EPSILON } from './geometryConstants';

/**
 * A half-plane: normal . p <= distance defines the "inside".
 */
export interface ClipPlane {
  normal: Vector3;
  distance: number;
}

/** A vertex of a convex cut region, with the indices of the planes it lies on. */
export interface RegionCorner {
  position: Vector3;
  planeIndices: number[];
}

/**
 * A convex region to subtract from cells: intersection of half-spaces
 * (normal . p <= distance is "inside"). `capMask[i]` controls whether cap
 * faces are built on plane i (false = leave that boundary open, e.g. the
 * frustum top opening into the inner cavity). `corners` are the region's
 * vertices, used to seed cap polygons where a region corner lies inside a
 * cell. All coordinates are CELL-LOCAL.
 */
export interface CutRegion {
  planes: ClipPlane[];
  capMask: boolean[];
  corners: RegionCorner[];
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

// --- Recursive region subtraction for a single face --------------------------

/**
 * Given a convex polygon (a cell face), subtract the convex region defined by
 * `cubePlanes` (each plane's "inside" half-space; the region interior is the
 * intersection of all half-spaces).
 *
 * Returns an array of convex polygons that represent the parts of the face
 * that are OUTSIDE the region.
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

  // Explicit coplanar handling (D4): outsidePart only means something if
  // the polygon actually has material STRICTLY beyond this plane. When no
  // vertex clears PLANE_TOL past the plane - either the whole polygon is
  // exactly coplanar with it (D4's original trigger, e.g. a cell face flush
  // with a cube face), or it merely touches the plane along one edge/vertex
  // while the rest sits on the inside - clipPolygonByPlane's inclusive
  // "<= PLANE_TOL" test classifies it as "inside" against BOTH this plane
  // AND its flipped copy (symmetric tolerance). The generic split below
  // would then manufacture a degenerate/duplicate "outsidePart" (a full or
  // sliver copy collapsing onto the plane) and push it as "definitely
  // outside" while the recursed insidePart ALSO keeps the true remnant -
  // see D4 in CLAUDE.md / task 6b's trace. Since clipPolygonByPlane against
  // `plane` is a no-op when nothing is strictly beyond it (every vertex
  // already satisfies the "inside" test, so the clip just returns the same
  // polygon, cyclically rotated), skip the split entirely and recurse the
  // untouched polygon on the remaining planes - they decide whether it
  // survives (real surface flush with the boundary) or is swallowed (base
  // case above, coincident with removed cavity material).
  const maxD = Math.max(...polygon.map(v => plane.normal.dot(v) - plane.distance));
  if (maxD <= PLANE_TOL) {
    return subtractCubeFromFace(polygon, remaining);
  }

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

/**
 * Rounded coordinate string for vertex-dedup keys, with IEEE negative zero
 * collapsed to positive zero. Clipping a face through the frustum apex/axis
 * (where the side planes all meet at a coordinate of ~0) can yield a component
 * of -0; `(-0).toFixed(n)` is "-0.000..." which would hash DIFFERENTLY from
 * "0.000...", splitting a single apex vertex into two pool entries and leaving
 * unpaired edges (holes) exactly at that plane. Normalizing the sign of zero
 * merges them.
 */
const coordKey = (n: number): string => {
  const s = n.toFixed(KEY_PRECISION);
  return s[0] === '-' && Number(s) === 0 ? s.slice(1) : s;
};

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

// --- Newell's method: robust polygon normal from winding --------------------

/**
 * Unnormalized Newell normal: sums a contribution from every edge, so unlike
 * a single vertex-triple cross product it stays well-conditioned even when
 * some individual triple happens to be collinear (e.g. a T-junction-spliced
 * vertex sitting on an existing edge). Its length is 2x the polygon's area
 * for a planar polygon, and near-zero iff the whole polygon is degenerate
 * (collinear/coincident vertices) - useful as a degeneracy test on its own.
 */
const computeNewellNormalRaw = (polygon: Polygon): Vector3 => {
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

const computeNewellNormal = (polygon: Polygon): Vector3 =>
  computeNewellNormalRaw(polygon).normalize();

/** Polygon area from the Newell normal's magnitude (exact for planar polygons). */
const computePolygonArea = (polygon: Polygon): number =>
  computeNewellNormalRaw(polygon).length() / 2;

// --- Build the inner-cube cut region (in cell-local coordinates) ------------

export const buildInnerCubeRegion = (
  halfSize: number,
  cellX: number,
  cellY: number,
  cellZ: number,
): CutRegion => {
  // Plane indices: 0=+x, 1=-x, 2=+y, 3=-y, 4=+z, 5=-z
  const planes: ClipPlane[] = [
    { normal: new Vector3(1, 0, 0), distance: halfSize - cellX },
    { normal: new Vector3(-1, 0, 0), distance: halfSize + cellX },
    { normal: new Vector3(0, 1, 0), distance: halfSize - cellY },
    { normal: new Vector3(0, -1, 0), distance: halfSize + cellY },
    { normal: new Vector3(0, 0, 1), distance: halfSize - cellZ },
    { normal: new Vector3(0, 0, -1), distance: halfSize + cellZ },
  ];

  // 8 cube corners, each on 3 planes.
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

  const corners: RegionCorner[] = cornerPlaneSets.map(([a, b, c]) => ({
    position: new Vector3(
      (a === 0 ? halfSize : -halfSize) - cellX,
      (b === 2 ? halfSize : -halfSize) - cellY,
      (c === 4 ? halfSize : -halfSize) - cellZ,
    ),
    planeIndices: [a, b, c],
  }));

  return { planes, capMask: planes.map(() => true), corners };
};

// --- Build the bottom-cutout (hex frustum) cut region ------------------------

/**
 * N-gon frustum for the bottom electronics feed-through, in cell-local
 * coordinates. `sides` side planes each contain the cube center and one edge
 * of the base polygon on the cube bottom face (apex-at-center taper); the top
 * plane sits at the inner-cavity floor (y = -innerCubeHalf). The region is
 * unbounded below - the cell's own bottom face clip punches the base
 * polygon hole. Plane order contract: 0..sides-1 = sides, sides = top.
 *
 * `baseWidthRatio` is the base polygon's extent across corners
 * (2 * circumradius) as a fraction of cube size. `capTop` closes the top
 * with a cap (blind pocket, for cutting without the inner cavity); when the
 * inner cube is also cut, leave it open so the hole connects to the cavity.
 */
export const buildBottomCutoutRegion = (
  cubeSize: number,
  innerCubeRatio: number,
  baseWidthRatio: number,
  capTop: boolean,
  cellX: number,
  cellY: number,
  cellZ: number,
  sides = 6,
): CutRegion => {
  const half = cubeSize / 2;
  const innerHalf = (cubeSize * innerCubeRatio) / 2;
  const circumRadius = (baseWidthRatio * cubeSize) / 2;
  const cellPos = new Vector3(cellX, cellY, cellZ);

  // Base polygon corners on the cube bottom face (world coordinates).
  const baseCorners: Vector3[] = [];
  for (let k = 0; k < sides; k++) {
    const theta = (k * 2 * Math.PI) / sides;
    baseCorners.push(
      new Vector3(circumRadius * Math.cos(theta), -half, circumRadius * Math.sin(theta)),
    );
  }

  const planes: ClipPlane[] = [];
  for (let k = 0; k < sides; k++) {
    // Side plane k through the cube center (world origin) and base edge
    // (corner k, corner k+1); world distance is therefore 0.
    const normal = baseCorners[k]
      .clone()
      .cross(baseCorners[(k + 1) % sides])
      .normalize();
    // Orient outward: the region interior (e.g. the base center (0,-half,0))
    // must satisfy normal . p <= 0, i.e. normal.y > 0.
    if (normal.y < 0) normal.negate();
    planes.push({ normal, distance: -normal.dot(cellPos) });
  }

  // Top plane: inside the region is y <= -innerHalf (below the cavity floor).
  const topNormal = new Vector3(0, 1, 0);
  planes.push({ normal: topNormal, distance: -innerHalf - topNormal.dot(cellPos) });

  // Top polygon corners: base corners scaled toward the apex (cube center)
  // onto the cavity floor. Corner k lies on side planes k-1 and k + the top.
  const scale = innerHalf / half;
  const corners: RegionCorner[] = baseCorners.map((base, k) => ({
    position: base.clone().multiplyScalar(scale).sub(cellPos),
    planeIndices: [(k + sides - 1) % sides, k, sides],
  }));

  return {
    planes,
    capMask: [...Array<boolean>(sides).fill(true), capTop],
    corners,
  };
};

// --- Classify a point w.r.t. all cube planes -------------------------------

const isInsideCube = (point: Vector3, cubePlanes: ClipPlane[]): boolean => {
  for (const p of cubePlanes) {
    if (p.normal.dot(point) - p.distance > PLANE_TOL) return false;
  }
  return true;
};

// --- Build cap faces from new intersection vertices -------------------------

/**
 * After clipping all faces, build cap faces on each region plane to close
 * the cell.  For each capped plane, collect all vertices that lie on it, sort
 * them into a polygon, and emit the face.
 *
 * We also check the region's corners — if a corner is inside the cell
 * (satisfies all cell face planes), it becomes part of the cap face on
 * each of the region planes that meet at that corner. Corners on planes with
 * capMask=false still feed adjacent capped planes' polygons (e.g. the frustum
 * top-hexagon corners belong to the open top plane AND two capped side
 * planes).
 */
const buildCapFaces = (
  pool: VertexPool,
  region: CutRegion,
  cellPlanes: ClipPlane[],
): number[][] => {
  const { planes: cubePlanes, capMask, corners } = region;
  const nPlanes = cubePlanes.length;
  const capFaces: number[][] = [];

  // Pre-compute which vertices lie on which region planes
  const verticesOnPlane: Map<number, Set<number>> = new Map();
  for (let pi = 0; pi < nPlanes; pi++) verticesOnPlane.set(pi, new Set());

  const nVerts = pool.vertices.length / 3;
  for (let vi = 0; vi < nVerts; vi++) {
    const v = pool.getVertex(vi);
    for (let pi = 0; pi < nPlanes; pi++) {
      const d = cubePlanes[pi].normal.dot(v) - cubePlanes[pi].distance;
      if (Math.abs(d) < ON_PLANE_TOL) {
        // A vertex on plane pi only belongs to that plane's cap if it also
        // lies inside-or-on the region w.r.t. every OTHER region plane - i.e.
        // within that face's extent. Without this, a vertex created
        // by clipping against an edge/corner-straddling cell face (which
        // lies on plane pi but beyond an adjacent plane) gets swept into
        // pi's cap polygon even though it belongs to kept solid geometry,
        // not the cavity boundary (D1).
        let withinFaceExtent = true;
        for (let qi = 0; qi < nPlanes; qi++) {
          if (qi === pi) continue;
          const dq = cubePlanes[qi].normal.dot(v) - cubePlanes[qi].distance;
          if (dq > ON_PLANE_TOL) {
            withinFaceExtent = false;
            break;
          }
        }
        if (withinFaceExtent) {
          verticesOnPlane.get(pi)!.add(vi);
        }
      }
    }
  }

  // Check region corners: a corner inside the cell seeds the cap polygons of
  // every plane it lies on.
  for (const { position: corner, planeIndices } of corners) {
    let insideCell = true;
    for (const cp of cellPlanes) {
      if (cp.normal.dot(corner) - cp.distance > PLANE_TOL) {
        insideCell = false;
        break;
      }
    }

    if (insideCell) {
      const vi = pool.getOrAdd(corner);
      for (const pi of planeIndices) {
        verticesOnPlane.get(pi)!.add(vi);
      }
    }
  }

  // Build a cap face for each capped region plane that has >= 3 vertices
  for (let pi = 0; pi < nPlanes; pi++) {
    if (!capMask[pi]) continue;
    const idxSet = verticesOnPlane.get(pi)!;
    if (idxSet.size < 3) continue;

    const verts = Array.from(idxSet).map(vi => pool.getVertex(vi));

    // Cap face normal points INTO the cube interior (away from cell material).
    // Cube plane normal points "inward" in our convention (n.p <= d is "inside cube").
    // The cap face outward normal (from cell material perspective) is -plane.normal
    // because the material is on the outside of the cube.
    const capNormal = cubePlanes[pi].normal.clone().negate();

    const sorted = sortPolygonVertices(verts, capNormal);

    // The radial sort's winding direction is basis-dependent (arbitrary sign
    // relative to capNormal). Winding is the single source of truth for
    // downstream normal derivation (triangulateCellData / STLExporter), so
    // make it deterministic: reverse if the sorted polygon's actual winding
    // (Newell's method) disagrees with the intended cap normal.
    if (computeNewellNormal(sorted).dot(capNormal) < 0) {
      sorted.reverse();
    }

    // Map sorted vertices back to pool indices
    const faceIndices = sorted.map(v => pool.getOrAdd(v));
    capFaces.push(faceIndices);
  }

  return capFaces;
};

// --- Edge-conformity pass (T-junction elimination) --------------------------

/**
 * Eliminate T-junctions: for every directed edge (a, b) of every face, scan
 * the whole vertex pool for OTHER vertices that lie on the open segment
 * a->b (within ON_PLANE_TOL of the segment's line, strictly between the
 * endpoints) and splice them into the edge, ordered by their position along
 * it.
 *
 * Why this is needed: `subtractCubeFromFace` pushes each face's outside
 * fragments independently, without re-visiting a face once a LATER cut (on
 * a sibling face sharing the same physical edge) introduces a new vertex
 * partway along that shared edge. One side of the edge ends up with a
 * single long edge, the other with two shorter ones through the new vertex
 * - a T-junction, which breaks directed-edge pairing (watertightness).
 * Splicing every such vertex into every face's edges (including cap faces,
 * whose boundaries can themselves be a T-junction's other side) makes both
 * sides of every physical edge carry the identical vertex chain.
 *
 * Pure and side-effect free: returns new face arrays, does not mutate the
 * input faces or pool.
 */
export const conformEdgesToPool = (faces: number[][], pool: VertexPool): number[][] => {
  const nVerts = pool.vertices.length / 3;

  return faces.map(face => {
    const conformed: number[] = [];

    for (let i = 0; i < face.length; i++) {
      const aIdx = face[i];
      const bIdx = face[(i + 1) % face.length];
      conformed.push(aIdx);

      const a = pool.getVertex(aIdx);
      const b = pool.getVertex(bIdx);
      const ab = b.clone().sub(a);
      const abLenSq = ab.lengthSq();
      if (abLenSq < EPSILON * EPSILON) continue; // degenerate edge, nothing to splice in
      const edgeLen = Math.sqrt(abLenSq);

      const onSegment: { idx: number; t: number }[] = [];
      for (let vi = 0; vi < nVerts; vi++) {
        if (vi === aIdx || vi === bIdx) continue;
        const v = pool.getVertex(vi);
        const t = v.clone().sub(a).dot(ab) / abLenSq;
        // Exclusion zone near each endpoint sized by PHYSICAL distance
        // (ON_PLANE_TOL), not a dimensionless t-threshold: a fixed t cutoff
        // would correspond to a sub-ON_PLANE_TOL physical distance on a
        // short edge, letting a vertex that IS the endpoint (within
        // tolerance) get spliced in as a distinct "mid-edge" point and
        // create a near-zero-length edge. Equivalent to requiring
        // t in (ON_PLANE_TOL / edgeLen, 1 - ON_PLANE_TOL / edgeLen); also
        // naturally excludes t outside [0, 1].
        if (t * edgeLen < ON_PLANE_TOL || (1 - t) * edgeLen < ON_PLANE_TOL) continue;

        const closest = a.clone().addScaledVector(ab, t);
        if (v.distanceTo(closest) < ON_PLANE_TOL) {
          onSegment.push({ idx: vi, t });
        }
      }

      if (onSegment.length > 0) {
        onSegment.sort((x, y) => x.t - y.t);
        for (const { idx } of onSegment) {
          // Dedupe safety: skip if already adjacent to the last-pushed vertex.
          if (conformed[conformed.length - 1] !== idx) conformed.push(idx);
        }
      }
    }

    return conformed;
  });
};

// --- Fan-triangulation-safe rotation -----------------------------------------

// Threshold on |cross product| (not squared) for treating 3 points as
// collinear. Genuine T-junction insertions from conformEdgesToPool lie on
// their segment to floating-point precision (~1e-13), so EPSILON (the shared
// numeric-noise floor) is a generous margin above that without risking false
// positives on real, merely-thin geometry (D5's sliver fixture has areas
// many orders larger).
const FAN_COLLINEAR_TOL = EPSILON;

const isCollinearTriple = (a: Vector3, b: Vector3, c: Vector3): boolean =>
  b.clone().sub(a).cross(c.clone().sub(a)).length() < FAN_COLLINEAR_TOL;

/**
 * `triangulateCellData` (cellCuttingAlgorithm.ts) fan-triangulates each face
 * from its vertex 0, and derives that face's ENTIRE normal from vertices
 * [0, 1, 2] alone (reused for every triangle in the fan). The edge-
 * conformity pass above can splice a T-junction vertex directly next to a
 * face's vertex 0 on either incident edge - by construction that spliced
 * vertex is exactly collinear with its two flanking original vertices, so
 * whichever fan triangle includes it (the first, using [0,1,2], or the
 * wrap-around last one) degenerates to zero area. Worse, if it's the first
 * triangle, the whole face's stored normal becomes the zero vector,
 * corrupting every triangle from that face, not just one.
 *
 * This does not break watertightness (a degenerate triangle's edges still
 * pair up correctly with its neighbors - checkCutCellData / directed-edge
 * pairing is unaffected), but it does leave zero-area/zero-normal triangles
 * in the final mesh.
 *
 * Fix: rotate the face's vertex-index cycle (a lossless relabeling of the
 * same polygon - the fan of a convex polygon is invariant to which vertex
 * is called "first" up to this collinearity concern) to a start vertex
 * whose two incident edges are both real (not a spliced-in T-junction
 * point). Falls back to the original order if no such rotation exists
 * (every edge of the face got a T-junction insertion) - unwinding that
 * would require changing triangulateCellData itself, out of scope here.
 */
export const rotateForSafeFan = (face: number[], pool: VertexPool): number[] => {
  const n = face.length;
  if (n < 4) return face; // triangles have no fan "wings" to worry about

  const v = face.map(i => pool.getVertex(i));

  for (let s = 0; s < n; s++) {
    const firstOk = !isCollinearTriple(v[s], v[(s + 1) % n], v[(s + 2) % n]);
    const lastOk = !isCollinearTriple(v[(s - 2 + n) % n], v[(s - 1 + n) % n], v[s]);
    if (firstOk && lastOk) {
      return s === 0 ? face : face.slice(s).concat(face.slice(0, s));
    }
  }

  return face;
};

// --- Compute cell face planes (for cube-corner-inside-cell test) ------------

const computeCellFacePlanes = (cellData: CutCellData): ClipPlane[] => {
  const planes: ClipPlane[] = [];
  const verts = cellData.vertices;

  for (const face of cellData.faces) {
    if (face.length < 3) continue;

    const pts = face.map(
      idx => new Vector3(verts[idx * 3], verts[idx * 3 + 1], verts[idx * 3 + 2]),
    );

    // D5 guard: derive the normal from the WHOLE polygon via Newell's method
    // rather than from vertices [0,1,2] alone. A single vertex triple can be
    // collinear (e.g. the conformity pass splices a T-junction vertex right
    // next to a face's vertex 0 - see rotateForSafeFan above for the same
    // failure mode in triangulation), which would zero out a cross-product
    // normal and manufacture a garbage plane. Newell sums every edge, so it
    // stays well-conditioned unless the polygon AS A WHOLE is degenerate.
    const rawNormal = computeNewellNormalRaw(pts);

    // If the whole polygon is degenerate (near-zero Newell normal - all
    // vertices collinear or coincident), there's no meaningful plane to
    // derive. Skip it rather than emit a garbage (zero-normal) plane: this
    // plane set only feeds the cube-corner-inside-cell test in
    // buildCapFaces, where a missing constraint just makes that test
    // slightly more permissive for corners this face would have excluded -
    // safe, since a degenerate face has no real area to exclude a corner
    // over in the first place.
    if (rawNormal.lengthSq() < EPSILON * EPSILON) continue;

    const normal = rawNormal.normalize();

    // Face center
    const center = new Vector3(0, 0, 0);
    for (const p of pts) center.add(p);
    center.divideScalar(pts.length);

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
 * Cut a convex region out of a single cell.
 * Returns a new CutCellData with the region subtracted.
 */
export const subtractRegionFromCell = (cellData: CutCellData, region: CutRegion): CutCellData => {
  const cubePlanes = region.planes;

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

    // Early return, "wholly outside" case. History (D6): the ORIGINAL check
    // was "every vertex is outside the region" (each vertex failing *some*
    // plane, possibly a different one per vertex) - UNSOUND, since "outside
    // a convex region" is not itself a convex condition (an edge between two
    // outside vertices can still dip through the region's interior; see
    // realCell-n100-seed1-particle{87,90}.json). The first fix required all
    // vertices beyond the SAME plane - sound, but incomplete for regions
    // with tilted planes (the hex frustum): a face can straddle several
    // infinite side planes while the region itself (the intersection of ALL
    // half-spaces) never touches it, and would get needlessly BSP-fragmented.
    //
    // The EXACT test: intersect the face with the region (Sutherland-Hodgman
    // against every plane - exact for a convex polygon vs a convex region).
    // If the intersection is empty or degenerate (below the area noise
    // floor), the region removes nothing - keep the face unchanged.
    let intersection: Polygon = polygon;
    for (const plane of cubePlanes) {
      intersection = clipPolygonByPlane(intersection, plane);
      if (intersection.length < 3) break;
    }
    if (intersection.length < 3 || computePolygonArea(intersection) < EPSILON) {
      const faceIndices = polygon.map(v => pool.getOrAdd(v));
      newFaces.push(faceIndices);
      continue;
    }

    // Face is entirely inside the cube -> discard. Sound as-is: the inner
    // cube is convex, so "every vertex inside" DOES imply "every
    // edge/interior point inside" (a line segment between two points of a
    // convex set stays in the set).
    const allInside = polygon.every(v => isInsideCube(v, cubePlanes));
    if (allInside) {
      continue;
    }

    const resultPolygons = subtractCubeFromFace(polygon, cubePlanes);

    for (const poly of resultPolygons) {
      if (poly.length < 3) continue;
      // D5 guard: drop fragments that are NUMERICALLY degenerate (area below
      // the shared EPSILON noise floor) - these cannot survive triangulation
      // meaningfully and are clipping-precision artifacts, not real
      // geometry. Deliberately NOT applied to merely-thin slivers (area >=
      // EPSILON but still a needle) - those are real material from a
      // near-tangent cut (D5 disposition: documented limitation, not a
      // defect) and dropping them would break watertightness with
      // neighboring faces that still expect that edge.
      if (computePolygonArea(poly) < EPSILON) continue;
      const faceIndices = poly.map(v => pool.getOrAdd(v));
      newFaces.push(faceIndices);
    }
  }

  // Build cap faces to close the cell
  const cellPlanes = computeCellFacePlanes(cellData);
  const capFaces = buildCapFaces(pool, region, cellPlanes);
  newFaces.push(...capFaces);

  // Edge-conformity pass: with all faces (including caps) present, splice
  // any T-junction vertices into every face's edges so shared physical
  // edges carry an identical vertex chain on both sides (see D1 report).
  const conformedFaces = conformEdgesToPool(newFaces, pool);

  // Rotate each face's vertex-index cycle away from a fan-triangulation-
  // unsafe start (see rotateForSafeFan) - a spliced T-junction vertex can
  // land next to a face's vertex 0, degenerating triangulateCellData's fan.
  const finalFaces = conformedFaces.map(face => rotateForSafeFan(face, pool));

  return {
    vertices: pool.vertices,
    faces: finalFaces,
    particleId: cellData.particleId,
    x: cellData.x,
    y: cellData.y,
    z: cellData.z,
  };
};

/**
 * Cut the inner cube out of a single cell.
 * Returns a new CutCellData with the inner cube subtracted.
 */
export const cutInnerCubeFromCell = (
  cellData: CutCellData,
  innerCubeHalfSize: number,
): CutCellData =>
  subtractRegionFromCell(
    cellData,
    buildInnerCubeRegion(innerCubeHalfSize, cellData.x, cellData.y, cellData.z),
  );

export interface PrintPrepOptions {
  cutInnerCube?: boolean;
  cutBottomHole?: boolean;
  bottomCutoutWidth?: number; // base polygon width across corners, fraction of cube size
  bottomCutoutSides?: number; // side count of the cutout polygon
}

/**
 * Process all cells: subtract the enabled print-prep regions from each one
 * (inner cube first, then the bottom hex frustum). Defaults preserve the
 * original inner-cube-only behavior.
 */
export const prepareForPrint = (
  cells: CutCellData[],
  cubeSize: number,
  innerCubeRatio: number,
  options: PrintPrepOptions = {},
): CutCellData[] => {
  const {
    cutInnerCube = true,
    cutBottomHole = false,
    bottomCutoutWidth = 0.3,
    bottomCutoutSides = 6,
  } = options;
  const innerCubeHalfSize = (cubeSize * innerCubeRatio) / 2;

  return cells
    .map(cell => {
      let result = cell;
      if (cutInnerCube) result = cutInnerCubeFromCell(result, innerCubeHalfSize);
      if (cutBottomHole) {
        // Without the cavity the frustum top gets capped (blind pocket).
        const region = buildBottomCutoutRegion(
          cubeSize,
          innerCubeRatio,
          bottomCutoutWidth,
          !cutInnerCube,
          result.x,
          result.y,
          result.z,
          bottomCutoutSides,
        );
        result = subtractRegionFromCell(result, region);
      }
      return result;
    })
    .filter(cell => cell.faces.length > 0);
};
