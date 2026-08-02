import { BufferAttribute, BufferGeometry, Vector3 } from 'three';
import type { VoroCell } from 'voro3d';
import { CellDataInput } from '../workers/types/workerInput';
import { CutCellData } from '../workers/types/workerOutput';
import { ON_PLANE_TOL, PLANE_TOL, EPSILON } from './geometryConstants';
import {
  ClipPlane,
  Polygon,
  VertexPool,
  clipPolygonByPlane,
  sortPolygonVertices,
  computeNewellNormalRaw,
  signedPlaneDistance,
} from './geometryHelper';

const EMPTY_CELL = (cell: CellDataInput): CutCellData => ({
  vertices: [],
  faces: [],
  particleId: -1,
  x: cell.x,
  y: cell.y,
  z: cell.z,
});

/** Get vertex `index` from a flat [x,y,z,...] array. */
const getVertex = (vertices: number[], index: number): Vector3 =>
  new Vector3(vertices[3 * index + 0], vertices[3 * index + 1], vertices[3 * index + 2]);

/**
 * Outward-oriented plane of a cell face polygon, winding the polygon in place to
 * match. Cells are stored in cell-local coordinates (centered at the origin), so
 * a face's outward normal is the one pointing away from the origin. The single
 * Newell normal serves both orientation and the winding check: if it points
 * inward we negate it AND reverse the polygon, so the polygon stays wound to its
 * outward normal (clipping preserves that; triangulateCellData relies on it).
 */
const faceOutwardPlane = (polygon: Polygon): ClipPlane & { center: Vector3 } => {
  const center = new Vector3(0, 0, 0);
  for (const v of polygon) center.add(v);
  center.divideScalar(polygon.length);

  const normal = computeNewellNormalRaw(polygon).normalize();
  if (normal.dot(center) < 0) {
    normal.negate();
    polygon.reverse();
  }

  return { normal, distance: normal.dot(center), center };
};

/** Whether a face lies on the cube boundary (its plane must not be offset). */
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
 * Build the cap polygon closing the cut where a clip plane sliced the solid.
 * Its vertices are the unique intersection points lying on the plane; wind them
 * toward the plane normal (outward) so triangulateCellData derives an outward
 * normal. Returns null if the cap is degenerate (< 3 distinct verts or ~0 area).
 */
const buildCapFace = (onPlaneVerts: Vector3[], planeNormal: Vector3): Polygon | null => {
  // Cap corners are few (~3-8); dedup by distance scan - cheaper than building
  // toFixed string keys, which dominated the per-plane cost on real cells.
  const unique: Vector3[] = [];
  for (const v of onPlaneVerts) {
    let dup = false;
    for (const u of unique) {
      if (u.distanceToSquared(v) < ON_PLANE_TOL * ON_PLANE_TOL) {
        dup = true;
        break;
      }
    }
    if (!dup) unique.push(v);
  }
  if (unique.length < 3) return null;

  const sorted = sortPolygonVertices(unique, planeNormal);
  const raw = computeNewellNormalRaw(sorted);
  if (raw.dot(planeNormal) < 0) sorted.reverse();
  if (raw.length() / 2 < EPSILON) return null; // area = |Newell|/2

  return sorted;
};

/**
 * Clip a convex solid (a closed set of outward-wound face polygons) by one
 * half-space (`normal . p <= distance`), keeping the inside and sealing the cut
 * with a single cap face. Convex-in -> convex-out, watertight by construction.
 */
const clipSolidByPlane = (solid: Polygon[], plane: ClipPlane): Polygon[] => {
  const result: Polygon[] = [];
  const capVerts: Vector3[] = [];

  for (const face of solid) {
    // Classify the face against the plane in one distance pass. Most face/plane
    // pairs are fully inside (a far face untouched by this offset plane) - skip
    // the Sutherland-Hodgman allocation for those; only straddling faces clip.
    let maxD = -Infinity;
    let minD = Infinity;
    for (const v of face) {
      const d = signedPlaneDistance(plane, v);
      if (d > maxD) maxD = d;
      if (d < minD) minD = d;
    }

    if (minD > PLANE_TOL) continue; // fully outside -> drop

    if (maxD <= PLANE_TOL) {
      // Fully inside -> keep as-is. If it grazes the plane, its on-plane
      // vertices are cap corners (a face flush with the cut boundary).
      result.push(face);
      if (maxD > -ON_PLANE_TOL) {
        for (const v of face) {
          if (Math.abs(signedPlaneDistance(plane, v)) < ON_PLANE_TOL) capVerts.push(v);
        }
      }
      continue;
    }

    // Straddles the plane -> clip and record the new cut-boundary vertices.
    const clipped = clipPolygonByPlane(face, plane);
    if (clipped.length < 3) continue;
    result.push(clipped);
    for (const v of clipped) {
      if (Math.abs(signedPlaneDistance(plane, v)) < ON_PLANE_TOL) capVerts.push(v);
    }
  }

  const cap = buildCapFace(capVerts, plane.normal);
  if (cap) result.push(cap);

  return result;
};

/**
 * Core algorithm that shrinks a Voronoi cell by moving each non-border face
 * inward by `destructionParameter`, creating the gaps between cells.
 *
 * The shrunk cell is the intersection of the original cell (already the
 * intersection of its face half-spaces) with the inward-offset half-spaces of
 * its non-border faces. We compute it by sequentially clipping the convex cell
 * solid by each offset plane (Sutherland-Hodgman per face + one cap per plane).
 * This is O(F^2 * V) and watertight for convex input, versus the former
 * O(F^4) all-triples enumeration. Border faces are left at the cube boundary
 * (never offset) so the overall cube does not shrink.
 *
 * Returns polygon-level cell data (shared vertex pool + face index arrays).
 */
export const cutCellCore = (
  cell: CellDataInput,
  destructionParameter: number,
  cubeSize: number,
): CutCellData => {
  const shrink = destructionParameter > 0;
  const cellPosition = new Vector3(cell.x, cell.y, cell.z);

  // Build outward-wound original face polygons; collect the inward-offset
  // planes of the non-border faces (the ones that create the gap). Winding the
  // faces outward is done even at gapSize 0 (no offset planes) - the raw voro3d
  // face winding is inconsistent, and triangulateCellData treats winding as the
  // normal's source of truth, so an unwound outward face would render inward and
  // get backface-culled (disappear) by the FrontSide material.
  const solid: Polygon[] = [];
  const offsetPlanes: ClipPlane[] = [];

  for (const faceIndices of cell.faces) {
    if (faceIndices.length < 3) continue;

    const polygon = faceIndices.map(i => getVertex(cell.vertices, i));
    // faceOutwardPlane winds `polygon` in place to match its outward normal, so
    // clipping preserves outward winding.
    const { normal, distance, center } = faceOutwardPlane(polygon);
    solid.push(polygon);

    if (shrink && !isBorderFace(center, cellPosition, cubeSize)) {
      offsetPlanes.push({ normal, distance: distance - destructionParameter });
    }
  }

  // Sequentially intersect the cell with each inward-offset half-space. With no
  // offset planes (gapSize 0) this is a no-op and the outward-wound cell passes
  // straight through.
  let current = solid;
  for (const plane of offsetPlanes) {
    current = clipSolidByPlane(current, plane);
    // A convex polytope needs >= 4 faces; fewer means it collapsed to nothing.
    if (current.length < 4) return EMPTY_CELL(cell);
  }

  // Build the shared vertex pool and index the faces.
  const pool = new VertexPool();
  const faces: number[][] = [];
  for (const face of current) {
    if (face.length < 3) continue;
    faces.push(face.map(v => pool.getOrAdd(v)));
  }

  if (faces.length < 4 || pool.vertices.length / 3 < 4) return EMPTY_CELL(cell);

  return {
    vertices: pool.vertices,
    faces,
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
  destructionParameter: number,
  cubeSize: number,
): BufferGeometry => {
  const cellData = cutCellCore(cell, destructionParameter, cubeSize);
  const result = triangulateCellData(cellData);

  const bg = new BufferGeometry();
  if (result.positions.length > 0) {
    bg.setAttribute('position', new BufferAttribute(result.positions, 3));
    bg.setAttribute('normal', new BufferAttribute(result.normals, 3));
    bg.setIndex(new BufferAttribute(result.indices, 1));
  }

  return bg;
};
