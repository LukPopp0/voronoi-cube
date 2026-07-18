import { Vector3 } from 'three';
import { CutCellData } from '../workers/types/workerOutput';
import { PLANE_TOL, ON_PLANE_TOL, KEY_PRECISION, EPSILON } from './geometryConstants';

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

export class VertexPool {
  vertices: number[] = [];
  private map = new Map<string, number>();

  getOrAdd(v: Vector3): number {
    const key = `${v.x.toFixed(KEY_PRECISION)}_${v.y.toFixed(KEY_PRECISION)}_${v.z.toFixed(KEY_PRECISION)}`;
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

const computeNewellNormal = (polygon: Polygon): Vector3 => {
  const normal = new Vector3(0, 0, 0);
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const current = polygon[i];
    const next = polygon[(i + 1) % n];
    normal.x += (current.y - next.y) * (current.z + next.z);
    normal.y += (current.z - next.z) * (current.x + next.x);
    normal.z += (current.x - next.x) * (current.y + next.y);
  }
  return normal.normalize();
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
    if (p.normal.dot(point) - p.distance > PLANE_TOL) return false;
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
      if (Math.abs(d) < ON_PLANE_TOL) {
        // A vertex on plane pi only belongs to that plane's cap if it also
        // lies inside-or-on the cube w.r.t. every OTHER cube plane - i.e.
        // within that face's square extent. Without this, a vertex created
        // by clipping against an edge/corner-straddling cell face (which
        // lies on plane pi but beyond an adjacent plane) gets swept into
        // pi's cap polygon even though it belongs to kept solid geometry,
        // not the cavity boundary (D1).
        let withinFaceExtent = true;
        for (let qi = 0; qi < 6; qi++) {
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
      if (cp.normal.dot(corner) - cp.distance > PLANE_TOL) {
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
