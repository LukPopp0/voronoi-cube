# voronoi-cube

## Overview
3D voronoi cube generator. Generates 3D voronoi cells bound by a cube, with gaps between cells so light passes through. End goal: a 3D-printable decorative desk lamp - hollow cutout in the center for a light source, plus a circular cutout at the bottom to feed in electronics. Printing and electronics themselves are out of scope for this repo; the app only needs to produce correct, printable geometry (STL).

## Tech stack
- React 19 + TypeScript, Vite 7
- `@react-three/fiber` / `@react-three/drei` (Three.js) for rendering
- `zustand` for state
- `voro3d` npm dependency (`^0.0.7`) - emscripten/WASM wrapper around [voro++](https://math.lbl.gov/voro++/), loaded via `vite-plugin-wasm`. Source lives in sibling repo `../voro3d` ([github.com/LukPopp0/voro3d](https://github.com/LukPopp0/voro3d)). Voronoi cell calculation itself is considered working/stable.
- pnpm workspace, no test framework configured. ESLint (`.eslintrc.cjs`) + Prettier (singleQuote, printWidth 100, tabWidth 2, arrowParens avoid).

## Scope (not exhaustive, grows over time)
- Settings for voronoi cell generation: point generation method, point count, gap size between cells, etc.
- Point generation for cell centers.
- 3D voronoi cell calculation from input points.
- Shrinking cells / creating gaps between cells per settings.
- Cutting out the inner cube (hollow center for light source).
- Cutting out the bottom shape (electronics feed-through).
- STL export - individual parts and combined.

## Architecture / key files
- `src/utils/randomDistributions.ts` - generates the seed points fed into `voro3d` for voronoi cell generation (see below). Not "cell centers" - just input sites for the voronoi calculation. Includes `fibonacciDistributionGuarded` (current fibonacci path: deterministic guard ring around the bottom for a consistent-looking base - see "Point distribution" below).
- `voro3d` (`VoroCell`, `Voro3D`) - actual voronoi cell computation. Used in `src/utils/cellCuttingAlgorithm.ts`, `src/components/renderer/scene/voronoiCube.tsx`, `src/components/voronoi/Cell.tsx`, `src/hooks/useCellCuttingWorker.ts`.
- `src/utils/cellCuttingAlgorithm.ts` - gap creation: shrinks each cell via plane intersection.
- `src/utils/printCutting.ts` - print-prep cutting (Sutherland-Hodgman-style polygon clipping), generalized to `CutRegion` (convex plane set + per-plane cap mask + region corners): `subtractRegionFromCell` with region builders `buildInnerCubeRegion` (hollow center) and `buildBottomCutoutRegion` (bottom N-gon-frustum feed-through, side count parameterized, default 6; side planes through the cube center = apex-at-center taper, top plane at the cavity floor, open into the cavity or capped as a blind pocket when the inner cube is not cut).
- `src/utils/plugGeometry.ts` - `buildBottomPlug`: solid one-piece frustum plug for the bottom cutout (inset by gapSize; equivalent to translating the pyramid apex down), exported in place in the combined STL so a full cube can be printed.
- `src/components/settings/downloadButton.tsx` - triangulates cut cells, exports STL via three.js `STLExporter`. This is where inner-cube cutting currently gets invoked, right before download.
- `src/components/settings/debugMenu.tsx` - collapsible "Debug" panel in the settings; UI for the `debugSettings` store slice (guard-ring knobs + relocated dev values). Angles shown in degrees, stored in radians.
- `src/hooks/useCellCuttingWorker.ts` - worker offload for cell cutting.
- `src/` layout: `components/{settings,renderer,voronoi,geometries,header}`, `store/`, `utils/`, `hooks/`, `workers/`, `types/`, `constants/`.

## Worker architecture
Cell cutting runs off the main thread for performance. `src/hooks/useCellCuttingWorker.ts` spawns a dedicated `Worker` (`src/workers/cellCuttingWorker.ts`) per call site - each voronoi cell gets its own worker instance, so cells cut in parallel. Worker receives `{ cell, triangleIndices, destructionParameter, cubeSize, particleId }` (`WorkerInput`), runs `cutCellCore` + `triangulateCellData` from `cellCuttingAlgorithm.ts`, and posts back `{ positions, normals, indices, cellData }` (`WorkerOutput`) using transferable `ArrayBuffer`s (zero-copy). The hook turns the result into a `BufferGeometry` and exposes `{ geometry, cellData, isProcessing, cutCell }`.

## State (zustand store)
`src/store/store.ts` - single `useVoronoiStore`, wired to Redux DevTools when the extension is present. Holds:
- `pointDistribution` (`{ distribution, nPoints, size, seed, restriction }`) - point-gen settings, initialized from and synced back to URL query params (`?distribution=&nPoints=&seed=&restriction=`) via `setPointDistribution`, so configs are shareable via link.
- `gapSize` - controls cell shrink amount in `cellCuttingAlgorithm.ts`.
- `cutInnerCube`, `cutBottomHole`, `bottomCutoutWidth` - print-prep toggles + bottom-cutout base width (polygon across-corners extent as fraction of cube size, default 0.85). Applied at STL download time; no URL sync.
- `debugSettings` (`setDebugSettings(partial)`) - nested dev/tuning slice, no URL sync, surfaced only in the debug menu (`debugMenu.tsx`). Holds the guard-ring distribution knobs (`guardCountMode`/`guardCountPct`/`guardCount`, `phiGMode` (`'cutout'|'density'|'manual'`)/`minPhiG`/`phiG`, `guardRotation`, `marginFactor` - angles in radians) plus the formerly top-level UI-less values relocated here: `innerCubeSize` (hollow-center size, default 0.85), `bottomCutoutSides` (cutout polygon side count, default 8), `explosionAmount` (visual-only cell separation). Defaults keep the guard ring at a safe 45 deg (`phiGMode:'manual'`, `phiG=minPhiG=PI/4`).
- `displayStyle` (`'wireframe' | 'solid'`), `darkMode`, `debug` - UI/render toggles.
- `cutCells` (`Map<particleId, CutCellData>`) + `cutCellsGeneration` - populated incrementally by `registerCutCell(cellData, generation)` as each worker finishes. `generation` bumps on every recompute (derived in `voronoiCube.tsx` render, passed to each `<Cell>`); a newer generation RESETS the map, older-generation stragglers are ignored, so the map only ever holds the current computation's cells. This fixed the "ghost cells in the exported STL" bug: the map used to be append/overwrite-only with `clearCutCells` never called, so stale cells from prior computations (e.g. a higher earlier `nPoints`, or voro3d reordering particleIds) accumulated and exported as overlapping ghosts (the viewport was unaffected - it renders each `<Cell>`'s own live geometry, not the map). `clearCutCells` still exists for explicit resets.

## Design history / known challenges

### Point distribution (`src/utils/randomDistributions.ts`)
Crude since project start, two approaches, both distribute on a sphere then project onto the cube surface:
1. **Spherical distribution** (`sphereDistribution`, `sphereDistributionRestricted`) - divides points into rows/columns, top row gets remainder. `restriction` param (misnamed - actually relaxation) randomizes position slightly to break up uniformity. Downside: points near the top of the sphere cluster too close, cells end up non-uniform in size.
2. **Fibonacci distribution** (`fibonacciDistribution`, `fibonacciDistributionRestricted`) - much more uniform cell sizes. Restricted variant limits generation to start at a specific angle from the bottom, producing one larger cell there so the bottom cutout only intersects one cell (or as few as possible). `fibonacciDistributionRestricted` is now only used by test fixtures.
3. **Fibonacci guarded** (`fibonacciDistributionGuarded`, current app fibonacci path) - the improvement on the restricted variant (`feature/point-distribution`). Fixed south-pole site + a deterministic, evenly spaced **guard ring** of `G` sites at angle `phiG` up from the pole; the remaining random sites are compressed into the band above an exclusion latitude (`phiExclude = phiG*(1+marginFactor)`), generalizing the old fixed `0.2*PI` band. `G` and `phiG` scale with the total point count (`computeGuardCount`, `computePhiG`; helpers exported); `G` snaps to a multiple of 4. All knobs live in `debugSettings` (debug menu) for by-eye tuning.
   - Guard sites are **seed-independent** (only `n` -> G and `guardRotation` move them), so the ring of bottom cells looks consistent across seeds. This is NOT bit-exact determinism: a lone ring cannot cap the pole cell (it leaves an uncapped "chimney" straight up the central axis that reaches the seed-dependent random field). That is fine by design - the wide cutout consumes the pole cell anyway; the goal is a consistent-looking base, not identical geometry. If stricter consistency is ever needed, two validated escalations (deferred): (a) add one deterministic cap site on the +Y axis above the pole (closes the chimney -> pole cell becomes seed-identical); (b) "whole bottom cap" - a shield ring making the guard-ring cells deterministic too, needed for wide cutouts to be identical.
   - Default `phiGMode` is `'cutout'`: ring angle scales linearly with cutout width (`phiG = cutoutWidth * PI/4`, so width 1.0 -> 45 deg, 0.5 -> 22.5 deg), tuned by eye; `minPhiG` default ~8.6 deg.
   - WATERTIGHTNESS: strictly manifold across the full ring-angle / width range since the negative-zero vertex-key fix (`fix/bottom-cut-coincident-cap`). Low ring angles used to leave unpaired edges on a few irregular cells; root cause was IEEE -0 vs +0 splitting apex/axis vertices into duplicate `VertexPool` entries in `printCutting.ts` (fixed by `coordKey` normalizing the sign of zero). Note on severity: those were duplicate-COINCIDENT-vertex unpaired edges - the project's own `checkTriangulated`/`holeCount` (sign-sensitive) flags them, but proximity-welding tools (MeshLab default, most slicers) merge the ±0 vertices and already tolerate them; the fix makes the mesh unambiguously manifold for any checker. Exact `bottomCutoutWidth = 1.0` (edge-tangency) may still be fragile - keep width just under max.

### Gap creation / cell cutting
Must not shrink the overall cube - only faces not facing the cube exterior get cut.
- **CSG approach (abandoned, removed from repo)**: converted cells to solids, used CSG boolean subtraction. Too slow, not always watertight (non-negotiable for printing), and blew up triangle counts (a 3-triangle face could become 10+).
- **Manual plane-intersection approach (current, `cellCuttingAlgorithm.ts`)**: reduces cell size via direct plane intersections. Fast, produces near-perfect watertight geometry. Possibly still optimizable.

### Inner cube cutting
Verified and hardened on `feature/print-preparation` (2026-07). Still done per-cell, only at STL download time (`src/utils/printCutting.ts` + `src/components/settings/downloadButton.tsx`), on the main thread. Six defects were found via an invariant test suite and fixed:
- D1: cap faces collected vertices outside the cube-face extent (edge/corner-straddling cells) + T-junctions between fragments -> cap within-extent filter, `conformEdgesToPool` edge-conformity pass, `rotateForSafeFan`.
- D2: cap normals flipped "away from cell center" without re-winding (inverted STL caps) -> winding is now authoritative; caps Newell-wound toward the cavity; `triangulateCellData` derives normals from winding.
- D3: inconsistent tolerances (1e-9 vs 1e-8 vs 1e-7) -> unified in `src/utils/geometryConstants.ts` (EPSILON, PLANE_TOL=ON_PLANE_TOL=1e-7, KEY_PRECISION=7).
- D4: cell face exactly coplanar with a cube plane got duplicated into both clip halves -> explicit "no vertex strictly beyond plane" skip in `subtractCubeFromFace`.
- D5: needle-sliver triangles from near-tangent cuts - DOCUMENTED LIMITATION, not fixed (geometrically real, watertight, slicer-safe; elimination would need snapping/remeshing). Degenerate guards added (Newell-based face planes, area<EPSILON fragment drop).
- D6: "all vertices outside cube" fast path was unsound (outside of a convex region is not convex) - found on real voro3d cells only -> narrowed to "all vertices beyond the SAME plane".

Remaining (see roadmap): performance/optimality second pass, worker offload, live cut preview.

## Constraints
- Geometry must stay watertight/manifold - non-negotiable for 3D printing.
- Cutting gaps must not shrink the overall cube - only internal-facing faces get cut.
- Performance matters: recalculating on point-count or gap-size change must stay fast.

## Branching strategy
Feature branches: `feature/<short-description>`. When starting new feature work: move to a new branch (unless told otherwise), then start in plan mode - always write a plan first for bigger features.

## Testing
Vitest (node environment, config in `vite.config.ts`, `pnpm test` / `pnpm test:watch`). Tests live in `src/utils/tests/` (NOT `__tests__`), explicit vitest imports (no globals). Key pieces:
- `helpers/meshInvariants.ts` - reusable geometry checker (watertightness via directed-edge pairing, planarity, convexity, degenerate detection, signed volume, normal-vs-winding, `meshStats`). Use it for any future geometry work (bottom cutout!).
- `helpers/syntheticCells.ts` - hand-built box-cell fixtures (F1-F7: concentric/face/edge/corner/inside/outside/coplanar cases).
- `realCells.invariants.test.ts` - full-pipeline sweep on REAL voro3d cells: WASM loads fine under vitest (vite wasm plugin is inherited), cells generated live with deterministic seeds, app call pattern mirrored exactly. Suite runs in ~1s.
- Convention: a confirmed defect gets an `it.fails` test asserting the HEALTHY expectation + `// DEFECT` comment; fixing it flips the test to plain `it`. Never weaken assertions.

## Current status / roadmap
- `feature/print-preparation` DONE: inner cube cutting verified + 6 defects fixed, vitest suite added (68 tests, green). See "Inner cube cutting" above.
- `feature/bottom-cutout` DONE (merged, PR #16): N-gon-frustum bottom cutout (side count parameterized, uniform regardless of seed) + separate `cutInnerCube`/`cutBottomHole` toggles + solid in-place plug (`plugGeometry.ts`). printCutting generalized to `CutRegion`; two robustness fixes found via TDD: (1) `clipPolygonByPlane` dedups consecutive output vertices (a polygon crossing a clip plane through one of its own vertices - e.g. the frustum apex - emitted that vertex twice), (2) the wholly-outside fast path is now the exact face-vs-region intersection test (the "all vertices beyond the SAME plane" check missed faces straddling several infinite tilted planes, causing needless BSP fragmentation). Suite now 97 tests incl. `bottomCutout.test.ts` (synthetic + real-cell frustum sweep, width-1.0 tangency, 8-sided parameterization, plug).
  - KNOWN ISSUE: the bottom cutout sometimes leaves very small leftover chunks - cells mostly consumed by the frustum survive as tiny fragments (watertight, but useless/fragile to print and they fall loose). Candidate fix: min-volume (or min-thickness) filter in `prepareForPrint` that drops cells below a threshold after cutting.
- `feature/point-distribution` DONE: `fibonacciDistributionGuarded` (deterministic guard ring for a consistent-looking base) + `debugSettings` store slice + collapsible debug menu (`debugMenu.tsx`); relocated `innerCubeSize`/`bottomCutoutSides`/`explosionAmount` into `debugSettings`. Suite +13 tests (`guardedDistribution.test.ts`), 110 total green. See "Point distribution" above (including the deferred cap-site / whole-bottom-cap escalations for stricter consistency).
- Next, on separate branches:
  - Gap-creation algorithm optimization.
  - Bottom-cut low-angle unpaired edges FIXED (`fix/bottom-cut-coincident-cap`): at low guard-ring angles the bottom cut used to leave unpaired edges on irregular cells when both cuts ran, at world y = -innerCubeHalf. Root cause was NOT the coincident plane itself (an early overshoot "fix" that separated the planes just relocated the bug - it fixed irregular cells but broke the symmetric full-cube box, and vice versa). The real cause: clipping through the frustum apex/axis (side planes meet at coordinate ~0) produced IEEE -0 components, and `VertexPool`'s `toFixed(7)` key hashed "-0.0000000" != "0.0000000", splitting a single apex vertex into duplicate pool entries -> unpaired edges. Fixed by `coordKey` normalizing the sign of zero. Verified: 0 holes on real cells (all low angles) AND the box; `guardedDistribution.test.ts` low-angle test now green. Severity: welding tools already tolerated it (coincident dup vertices); fix makes it strictly manifold. Exact `bottomCutoutWidth = 1.0` still potentially fragile (separate).
  - Bottom-cutout small-chunk filter (see KNOWN ISSUE above).
  - Inner-cube-cut optimization (second pass): performance (main-thread at download time; worker offload; live cut preview), fragmentation (subtractCubeFromFace recursion can over-fragment multi-plane faces), STL export memory (data-URL buildup in downloadButton).
  - Repo layout / overall refactor (known duplication between printCutting.ts and cellCuttingAlgorithm.ts helpers: plane math, vertex pool, sorting).
  - UI upgrade.
  - ESLint 9 vs legacy `.eslintrc.cjs`: `pnpm lint` is broken repo-wide (needs flat-config migration).

## Maintaining this file
Keep this CLAUDE.md up to date as the project evolves: update it when features are added or finished, when the roadmap changes, or when the repo layout/architecture changes. Treat it as living documentation, not a one-time snapshot.
