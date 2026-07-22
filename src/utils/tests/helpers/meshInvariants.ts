import { Vector3 } from 'three';
import { CutCellData } from '../../../workers/types/workerOutput';

/**
 * Reusable mesh-invariant checker for geometry produced by the cutting
 * pipeline. Pure, no side effects - the measurement instrument for
 * defect-confirmation tests elsewhere.
 */

export interface Violation {
  kind: string; // e.g. 'unpaired-edge', 'degenerate-face', 'non-planar', 'self-intersecting',
  // 'non-convex', 'duplicate-vertex', 'normal-winding-mismatch', 'nonpositive-volume'
  faceIndex?: number; // or triangle index
  detail: string; // human-readable, includes offending values
}

export interface CutCellCheckOptions {
  planarTol?: number;
  areaTol?: number;
  edgeTol?: number;
  mergeTol?: number;
}

export interface TriangulatedMesh {
  positions: number[];
  normals: number[];
  indices: number[];
}

export interface TriangulatedCheckOptions {
  areaTol?: number;
}

export interface MeshStats {
  faceCount: number;
  triangleCount: number;
  sliverTriangles: number;
  minAspectQuality: number;
  duplicateVertexPairs: number;
  unpairedEdges: number;
}

const DEFAULT_PLANAR_TOL = 1e-6;
const DEFAULT_AREA_TOL = 1e-9;
const DEFAULT_EDGE_TOL = 1e-9;
const DEFAULT_MERGE_TOL = 1e-9;

// A tolerance for the 2D convexity/self-intersection checks, on the same
// order as the other "near-zero" tolerances above.
const SHAPE_TOL = 1e-9;

// --- small vector helpers ----------------------------------------------------

const vecAt = (arr: number[], i: number): Vector3 =>
  new Vector3(arr[i * 3], arr[i * 3 + 1], arr[i * 3 + 2]);

/**
 * Newell's method: raw (unnormalized) normal + centroid for a planar
 * (or near-planar) polygon. |rawNormal|/2 equals the polygon area for an
 * exactly planar polygon; rawNormal direction gives a consistently
 * oriented normal even for non-convex simple polygons.
 */
const newellRaw = (pts: Vector3[]): { rawNormal: Vector3; centroid: Vector3 } => {
  const n = pts.length;
  const rawNormal = new Vector3(0, 0, 0);
  const centroid = new Vector3(0, 0, 0);
  for (let i = 0; i < n; i++) {
    const cur = pts[i];
    const next = pts[(i + 1) % n];
    rawNormal.x += (cur.y - next.y) * (cur.z + next.z);
    rawNormal.y += (cur.z - next.z) * (cur.x + next.x);
    rawNormal.z += (cur.x - next.x) * (cur.y + next.y);
    centroid.add(cur);
  }
  centroid.divideScalar(n);
  return { rawNormal, centroid };
};

/** Project 3D points onto an orthonormal 2D basis of the given plane normal. */
const project2D = (
  pts: Vector3[],
  normal: Vector3,
  centroid: Vector3,
): { x: number; y: number }[] => {
  let ref = new Vector3(1, 0, 0);
  if (Math.abs(normal.dot(ref)) > 0.9) ref = new Vector3(0, 1, 0);
  const u = ref
    .clone()
    .sub(normal.clone().multiplyScalar(normal.dot(ref)))
    .normalize();
  const v = normal.clone().cross(u);
  return pts.map(p => {
    const rel = p.clone().sub(centroid);
    return { x: rel.dot(u), y: rel.dot(v) };
  });
};

/** 2D orientation: cross of (q-p) and (r-p). */
const orient2D = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }): number =>
  (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);

/** Proper (interior) segment-segment intersection test, ignoring touching/collinear cases. */
const segmentsProperlyIntersect = (
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number },
): boolean => {
  const sign = (v: number): number => (Math.abs(v) < SHAPE_TOL ? 0 : Math.sign(v));
  const s1 = sign(orient2D(b1, b2, a1));
  const s2 = sign(orient2D(b1, b2, a2));
  const s3 = sign(orient2D(a1, a2, b1));
  const s4 = sign(orient2D(a1, a2, b2));
  return s1 !== 0 && s2 !== 0 && s1 !== s2 && s3 !== 0 && s4 !== 0 && s3 !== s4;
};

/**
 * Check a planar polygon's boundary for convexity/self-intersection in its
 * own 2D projection. Reports at most one 'non-convex' violation (reflex
 * vertex found) plus any 'self-intersecting' violations (crossing
 * non-adjacent edges).
 */
const checkFaceShape = (
  pts: Vector3[],
  normal: Vector3,
  centroid: Vector3,
  faceIndex: number,
): Violation[] => {
  const violations: Violation[] = [];
  const proj = project2D(pts, normal, centroid);
  const n = proj.length;

  let refSign = 0;
  const crosses: number[] = [];
  for (let i = 0; i < n; i++) {
    const prev = proj[(i - 1 + n) % n];
    const cur = proj[i];
    const next = proj[(i + 1) % n];
    const c = orient2D(prev, cur, next);
    crosses.push(c);
    if (refSign === 0 && Math.abs(c) > SHAPE_TOL) refSign = Math.sign(c);
  }
  if (refSign !== 0) {
    for (const c of crosses) {
      if (Math.abs(c) > SHAPE_TOL && Math.sign(c) !== refSign) {
        violations.push({
          kind: 'non-convex',
          faceIndex,
          detail: `reflex vertex detected in face boundary (cross sign mismatch, value=${c.toExponential(3)})`,
        });
        break;
      }
    }
  }

  for (let i = 0; i < n; i++) {
    const a1 = proj[i];
    const a2 = proj[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      const isAdjacent = j === i || j === (i + 1) % n || (j + 1) % n === i;
      if (isAdjacent) continue;
      const b1 = proj[j];
      const b2 = proj[(j + 1) % n];
      if (segmentsProperlyIntersect(a1, a2, b1, b2)) {
        violations.push({
          kind: 'self-intersecting',
          faceIndex,
          detail: `edge ${i} and edge ${j} of face boundary cross`,
        });
      }
    }
  }

  return violations;
};

// --- directed-edge pairing (shared by polygon and triangle checks) ----------

interface DirectedEdge {
  a: string;
  b: string;
  ownerIndex: number;
}

/**
 * Every directed edge (a,b) must be matched by exactly one (b,a). Covers
 * watertightness, consistent winding, and T-junctions in a single check.
 */
const pairDirectedEdges = (edges: DirectedEdge[]): Violation[] => {
  const counts = new Map<string, { count: number; owners: number[] }>();
  for (const e of edges) {
    const key = `${e.a}|${e.b}`;
    const entry = counts.get(key);
    if (entry) {
      entry.count++;
      entry.owners.push(e.ownerIndex);
    } else {
      counts.set(key, { count: 1, owners: [e.ownerIndex] });
    }
  }

  const violations: Violation[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    const key = `${e.a}|${e.b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const revKey = `${e.b}|${e.a}`;
    const fwd = counts.get(key)!;
    const revCount = counts.get(revKey)?.count ?? 0;
    if (fwd.count !== 1 || revCount !== 1) {
      violations.push({
        kind: 'unpaired-edge',
        faceIndex: fwd.owners[0],
        detail: `directed edge (${e.a} -> ${e.b}) occurs ${fwd.count} time(s), reverse occurs ${revCount} time(s)`,
      });
    }
  }
  return violations;
};

// --- checkCutCellData ---------------------------------------------------------

export const checkCutCellData = (
  cell: CutCellData,
  opts: CutCellCheckOptions = {},
): Violation[] => {
  const planarTol = opts.planarTol ?? DEFAULT_PLANAR_TOL;
  const areaTol = opts.areaTol ?? DEFAULT_AREA_TOL;
  const edgeTol = opts.edgeTol ?? DEFAULT_EDGE_TOL;
  const mergeTol = opts.mergeTol ?? DEFAULT_MERGE_TOL;

  const violations: Violation[] = [];
  const verts = cell.vertices;
  const nVertices = verts.length / 3;

  const directedEdges: DirectedEdge[] = [];

  cell.faces.forEach((face, faceIndex) => {
    if (face.length < 3) {
      violations.push({
        kind: 'degenerate-face',
        faceIndex,
        detail: `face has only ${face.length} vertices (need >= 3)`,
      });
      return;
    }

    const distinctCount = new Set(face).size;
    if (distinctCount < 3) {
      violations.push({
        kind: 'degenerate-face',
        faceIndex,
        detail: `face has only ${distinctCount} distinct vertex indices`,
      });
    }

    let hasConsecutiveRepeat = false;
    for (let i = 0; i < face.length; i++) {
      if (face[i] === face[(i + 1) % face.length]) {
        hasConsecutiveRepeat = true;
        violations.push({
          kind: 'degenerate-face',
          faceIndex,
          detail: `repeated consecutive vertex index ${face[i]}`,
        });
      }
    }

    const pts = face.map(i => vecAt(verts, i));
    const { rawNormal, centroid } = newellRaw(pts);
    const hasValidNormal = rawNormal.lengthSq() > 0;
    const normal = hasValidNormal ? rawNormal.clone().normalize() : rawNormal;

    if (hasValidNormal) {
      let maxDist = 0;
      for (const p of pts) {
        const d = Math.abs(normal.dot(p.clone().sub(centroid)));
        if (d > maxDist) maxDist = d;
      }
      if (maxDist > planarTol) {
        violations.push({
          kind: 'non-planar',
          faceIndex,
          detail: `max vertex distance to best-fit plane = ${maxDist.toExponential(3)} (tol ${planarTol})`,
        });
      }
    }

    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[i];
      const p1 = pts[(i + 1) % pts.length];
      const len = p0.distanceTo(p1);
      if (len < edgeTol) {
        violations.push({
          kind: 'degenerate-face',
          faceIndex,
          detail: `near-zero-length edge (${face[i]} -> ${face[(i + 1) % pts.length]}), length=${len.toExponential(3)}`,
        });
      }
    }

    const area = rawNormal.length() / 2;
    if (area < areaTol) {
      violations.push({
        kind: 'degenerate-face',
        faceIndex,
        detail: `face area ${area.toExponential(3)} below tolerance ${areaTol}`,
      });
    }

    if (hasValidNormal && !hasConsecutiveRepeat) {
      violations.push(...checkFaceShape(pts, normal, centroid, faceIndex));
    }

    for (let i = 0; i < face.length; i++) {
      directedEdges.push({
        a: String(face[i]),
        b: String(face[(i + 1) % face.length]),
        ownerIndex: faceIndex,
      });
    }
  });

  violations.push(...pairDirectedEdges(directedEdges));

  for (let i = 0; i < nVertices; i++) {
    for (let j = i + 1; j < nVertices; j++) {
      const d = vecAt(verts, i).distanceTo(vecAt(verts, j));
      if (d < mergeTol) {
        violations.push({
          kind: 'duplicate-vertex',
          detail: `vertices ${i} and ${j} coincide (distance=${d.toExponential(3)}, tol ${mergeTol})`,
        });
      }
    }
  }

  return violations;
};

// --- checkTriangulated ---------------------------------------------------------

export const checkTriangulated = (
  mesh: TriangulatedMesh,
  opts: TriangulatedCheckOptions = {},
): Violation[] => {
  const areaTol = opts.areaTol ?? DEFAULT_AREA_TOL;
  const violations: Violation[] = [];
  const { positions, normals, indices } = mesh;
  const triangleCount = indices.length / 3;

  // triangulateCellData dedups vertices by position AND normal, so vertices
  // along edges shared by two faces with different normals get duplicate
  // indices - edge pairing must key on position, not index.
  const posKey = (i: number): string => {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    return `${x.toFixed(6)}_${y.toFixed(6)}_${z.toFixed(6)}`;
  };

  const directedEdges: DirectedEdge[] = [];

  for (let t = 0; t < triangleCount; t++) {
    const i0 = indices[t * 3];
    const i1 = indices[t * 3 + 1];
    const i2 = indices[t * 3 + 2];
    const v0 = vecAt(positions, i0);
    const v1 = vecAt(positions, i1);
    const v2 = vecAt(positions, i2);

    const geomNormalRaw = v1.clone().sub(v0).cross(v2.clone().sub(v0));
    const area = geomNormalRaw.length() / 2;
    if (area < areaTol) {
      violations.push({
        kind: 'degenerate-face',
        faceIndex: t,
        detail: `triangle area ${area.toExponential(3)} below tolerance ${areaTol}`,
      });
    }

    if (geomNormalRaw.lengthSq() > 0) {
      const geomNormal = geomNormalRaw.clone().normalize();
      const nA = vecAt(normals, i0);
      const nB = vecAt(normals, i1);
      const nC = vecAt(normals, i2);
      const mismatched = [nA, nB, nC].some(n => geomNormal.dot(n) <= 0);
      if (mismatched) {
        violations.push({
          kind: 'normal-winding-mismatch',
          faceIndex: t,
          detail: 'stored vertex normal(s) do not agree (positive dot) with the geometric winding normal',
        });
      }
    }

    directedEdges.push({ a: posKey(i0), b: posKey(i1), ownerIndex: t });
    directedEdges.push({ a: posKey(i1), b: posKey(i2), ownerIndex: t });
    directedEdges.push({ a: posKey(i2), b: posKey(i0), ownerIndex: t });
  }

  violations.push(...pairDirectedEdges(directedEdges));

  const vol = signedVolume(mesh);
  if (vol <= 0) {
    violations.push({
      kind: 'nonpositive-volume',
      detail: `signed volume = ${vol.toExponential(3)} (expected > 0)`,
    });
  }

  return violations;
};

/**
 * True topological hole count: undirected edges whose forward vs reverse
 * directed-edge counts DIFFER (fwd != rev), keyed by vertex position. A closed
 * surface has 0 - even a balanced non-manifold edge (fwd == rev, e.g. 2/2) is
 * NOT counted, because it still bounds a closed volume and prints fine. This is
 * the print-relevant "is there an actual hole" metric, distinct from
 * checkTriangulated's stricter `unpaired-edge` (fwd != 1 || rev != 1) check
 * which also flags those balanced non-manifold edges.
 */
export const holeCount = (mesh: TriangulatedMesh): number => {
  const { positions, indices } = mesh;
  const posKey = (i: number): string => {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    return `${x.toFixed(6)}_${y.toFixed(6)}_${z.toFixed(6)}`;
  };
  const counts = new Map<string, number>();
  const bump = (a: string, b: string) => counts.set(`${a}|${b}`, (counts.get(`${a}|${b}`) ?? 0) + 1);
  for (let t = 0; t < indices.length / 3; t++) {
    const k0 = posKey(indices[t * 3]);
    const k1 = posKey(indices[t * 3 + 1]);
    const k2 = posKey(indices[t * 3 + 2]);
    bump(k0, k1);
    bump(k1, k2);
    bump(k2, k0);
  }
  let holes = 0;
  const seen = new Set<string>();
  for (const [k, c] of counts) {
    const [a, b] = k.split('|');
    const rk = `${b}|${a}`;
    if (seen.has(k) || seen.has(rk)) continue;
    seen.add(k);
    if (c !== (counts.get(rk) ?? 0)) holes++;
  }
  return holes;
};

// --- volume helpers ---------------------------------------------------------

/** Signed volume of a closed triangulated mesh via the divergence theorem. */
export const signedVolume = (mesh: { positions: number[]; indices: number[] }): number => {
  const { positions, indices } = mesh;
  let sum = 0;
  for (let t = 0; t < indices.length / 3; t++) {
    const v0 = vecAt(positions, indices[t * 3]);
    const v1 = vecAt(positions, indices[t * 3 + 1]);
    const v2 = vecAt(positions, indices[t * 3 + 2]);
    sum += v0.dot(v1.clone().cross(v2));
  }
  return sum / 6;
};

/**
 * Signed volume computed directly from polygon faces (fan from face[0] per
 * face) - used for volume-conservation tests without triangulation.
 */
export const polygonVolume = (cell: CutCellData): number => {
  const verts = cell.vertices;
  let sum = 0;
  for (const face of cell.faces) {
    if (face.length < 3) continue;
    const v0 = vecAt(verts, face[0]);
    for (let i = 1; i < face.length - 1; i++) {
      const v1 = vecAt(verts, face[i]);
      const v2 = vecAt(verts, face[i + 1]);
      sum += v0.dot(v1.clone().cross(v2));
    }
  }
  return sum / 6;
};

// --- meshStats ---------------------------------------------------------------

export const meshStats = (cell: CutCellData, mesh: TriangulatedMesh): MeshStats => {
  const { positions, indices } = mesh;
  const triangleCount = indices.length / 3;

  let sliverTriangles = 0;
  let minAspectQuality = triangleCount > 0 ? Infinity : 1;

  for (let t = 0; t < triangleCount; t++) {
    const v0 = vecAt(positions, indices[t * 3]);
    const v1 = vecAt(positions, indices[t * 3 + 1]);
    const v2 = vecAt(positions, indices[t * 3 + 2]);
    const e1 = v1.clone().sub(v0);
    const e2 = v2.clone().sub(v0);
    const e3 = v2.clone().sub(v1);

    const area = e1.clone().cross(e2).length() / 2;
    if (area < DEFAULT_AREA_TOL) sliverTriangles++;

    const sumSqEdges = e1.lengthSq() + e2.lengthSq() + e3.lengthSq();
    const quality = sumSqEdges > 0 ? (4 * Math.sqrt(3) * area) / sumSqEdges : 0;
    if (quality < minAspectQuality) minAspectQuality = quality;
  }

  const cellVerts = cell.vertices;
  const nVerts = cellVerts.length / 3;
  let duplicateVertexPairs = 0;
  for (let i = 0; i < nVerts; i++) {
    for (let j = i + 1; j < nVerts; j++) {
      if (vecAt(cellVerts, i).distanceTo(vecAt(cellVerts, j)) < DEFAULT_MERGE_TOL) {
        duplicateVertexPairs++;
      }
    }
  }

  const unpairedEdges = checkTriangulated(mesh).filter(v => v.kind === 'unpaired-edge').length;

  return {
    faceCount: cell.faces.length,
    triangleCount,
    sliverTriangles,
    minAspectQuality,
    duplicateVertexPairs,
    unpairedEdges,
  };
};
