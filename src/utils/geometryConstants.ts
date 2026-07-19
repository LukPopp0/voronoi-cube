/**
 * Shared numeric tolerances for the cell-cutting / print-preparation pipeline
 * (`cellCuttingAlgorithm.ts`, `printCutting.ts`).
 *
 * Hierarchy (each tier is derived from - and must stay consistent with - the
 * one above it):
 *
 *   EPSILON       Base floating-point noise floor (~machine precision at the
 *                 coordinate scale used here). Only used where the question
 *                 is "is this numerically exactly zero" (e.g. a near-zero
 *                 determinant meaning two planes are parallel) - NOT used
 *                 directly for geometric classification.
 *
 *   PLANE_TOL     The tolerance for classifying a point relative to a plane
 *                 (inside/outside a half-space, on/off a plane). Used by
 *                 clipping (Sutherland-Hodgman), inside-cube tests, cap-face
 *                 vertex collection, cube-corner-inside-cell test
 *                 (printCutting.ts ~265), and vertex-validity filter
 *                 (cellCuttingAlgorithm.ts ~224). Last two were loosened
 *                 10x (1e-8 -> 1e-7) during unification for consistency.
 *
 *                 DEFECT D3 was exactly this tolerance disagreeing between
 *                 call sites: clipping classified a point as outside while
 *                 cap-collection (a looser tolerance) still treated it as
 *                 on-plane, producing duplicated/unpaired edges. Every
 *                 classification-style check below must share this one
 *                 value so "inside" and "on-plane" agree everywhere.
 *
 *   ON_PLANE_TOL  Alias for PLANE_TOL, used at cap-face-collection call sites
 *                 to document intent ("does this vertex lie on this cube
 *                 plane") while guaranteeing it can never drift from the
 *                 classification tolerance above.
 *
 *   KEY_PRECISION Decimal places for vertex-dedup string keys (toFixed(n)).
 *                 Must not be finer than what PLANE_TOL implies, or two
 *                 vertices the tolerance considers coincident would still
 *                 hash to different keys and fail to merge. PLANE_TOL = 1e-7
 *                 implies coordinates need only agree to 7 decimal places,
 *                 so KEY_PRECISION = 7. NOTE: triangulateCellData uses its own
 *                 coarser toFixed(6) key for render/export-side vertex dedup
 *                 (a separate, intentional gap - not included in this tolerance
 *                 unification).
 */

/** Base numeric noise floor - for exact-zero / degeneracy checks only. */
export const EPSILON = 1e-9;

/** Point-vs-plane classification tolerance (inside/outside, on/off). */
export const PLANE_TOL = 1e-7;

/** Cap-face vertex-collection tolerance - kept equal to PLANE_TOL (see above). */
export const ON_PLANE_TOL = PLANE_TOL;

/** Decimal places for vertex-dedup keys; consistent with PLANE_TOL. */
export const KEY_PRECISION = 7;
