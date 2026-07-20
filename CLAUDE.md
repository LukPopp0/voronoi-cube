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
- `src/utils/randomDistributions.ts` - generates the seed points fed into `voro3d` for voronoi cell generation (see below). Not "cell centers" - just input sites for the voronoi calculation.
- `voro3d` (`VoroCell`, `Voro3D`) - actual voronoi cell computation. Used in `src/utils/cellCuttingAlgorithm.ts`, `src/components/renderer/scene/voronoiCube.tsx`, `src/components/voronoi/Cell.tsx`, `src/hooks/useCellCuttingWorker.ts`.
- `src/utils/cellCuttingAlgorithm.ts` - gap creation: shrinks each cell via plane intersection.
- `src/utils/printCutting.ts` - print-prep cutting (Sutherland-Hodgman-style polygon clipping), generalized to `CutRegion` (convex plane set + per-plane cap mask + region corners): `subtractRegionFromCell` with region builders `buildInnerCubeRegion` (hollow center) and `buildBottomCutoutRegion` (bottom N-gon-frustum feed-through, side count parameterized, default 6; side planes through the cube center = apex-at-center taper, top plane at the cavity floor, open into the cavity or capped as a blind pocket when the inner cube is not cut).
- `src/utils/plugGeometry.ts` - `buildBottomPlug`: solid one-piece frustum plug for the bottom cutout (inset by gapSize; equivalent to translating the pyramid apex down), exported in place in the combined STL so a full cube can be printed.
- `src/components/settings/downloadButton.tsx` - triangulates cut cells, exports STL via three.js `STLExporter`. This is where inner-cube cutting currently gets invoked, right before download.
- `src/hooks/useCellCuttingWorker.ts` - worker offload for cell cutting.
- `src/` layout: `components/{settings,renderer,voronoi,geometries,header}`, `store/`, `utils/`, `hooks/`, `workers/`, `types/`, `constants/`.

## Worker architecture
Cell cutting runs off the main thread for performance. `src/hooks/useCellCuttingWorker.ts` spawns a dedicated `Worker` (`src/workers/cellCuttingWorker.ts`) per call site - each voronoi cell gets its own worker instance, so cells cut in parallel. Worker receives `{ cell, triangleIndices, destructionParameter, cubeSize, particleId }` (`WorkerInput`), runs `cutCellCore` + `triangulateCellData` from `cellCuttingAlgorithm.ts`, and posts back `{ positions, normals, indices, cellData }` (`WorkerOutput`) using transferable `ArrayBuffer`s (zero-copy). The hook turns the result into a `BufferGeometry` and exposes `{ geometry, cellData, isProcessing, cutCell }`.

## State (zustand store)
`src/store/store.ts` - single `useVoronoiStore`, wired to Redux DevTools when the extension is present. Holds:
- `pointDistribution` (`{ distribution, nPoints, size, seed, restriction }`) - point-gen settings, initialized from and synced back to URL query params (`?distribution=&nPoints=&seed=&restriction=`) via `setPointDistribution`, so configs are shareable via link.
- `gapSize` - controls cell shrink amount in `cellCuttingAlgorithm.ts`.
- `innerCubeSize` - size of the hollow center cutout.
- `cutInnerCube`, `cutBottomHole`, `bottomCutoutWidth`, `bottomCutoutSides` - print-prep toggles + bottom-cutout base width (polygon across-corners extent as fraction of cube size) + polygon side count (store-only, no UI control by design; default 6, clamped 3-16). Applied at STL download time; no URL sync (like `innerCubeSize`).
- `explosionAmount` - visual-only cell separation for viewing/debugging, not part of print geometry.
- `displayStyle` (`'wireframe' | 'solid'`), `darkMode`, `debug` - UI/render toggles.
- `cutCells` (`Map<particleId, CutCellData>`) - populated incrementally by `registerCutCell` as each worker finishes; `clearCutCells` resets it on recalculation.

## Design history / known challenges

### Point distribution (`src/utils/randomDistributions.ts`)
Crude since project start, two approaches, both distribute on a sphere then project onto the cube surface:
1. **Spherical distribution** (`sphereDistribution`, `sphereDistributionRestricted`) - divides points into rows/columns, top row gets remainder. `restriction` param (misnamed - actually relaxation) randomizes position slightly to break up uniformity. Downside: points near the top of the sphere cluster too close, cells end up non-uniform in size.
2. **Fibonacci distribution** (`fibonacciDistribution`, `fibonacciDistributionRestricted`) - much more uniform cell sizes. Restricted variant limits generation to start at a specific angle from the bottom, producing one larger cell there so the bottom cutout only intersects one cell (or as few as possible). This works but isn't perfect - ideally the bottom cutout piece would look identical every time. Open problem, no better solution found yet.

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
- `feature/bottom-cutout` DONE: hex-frustum bottom cutout (uniform regardless of seed) + separate `cutInnerCube`/`cutBottomHole` toggles + solid in-place plug (`plugGeometry.ts`). printCutting generalized to `CutRegion`; two robustness fixes found via TDD: (1) `clipPolygonByPlane` dedups consecutive output vertices (a polygon crossing a clip plane through one of its own vertices - e.g. the frustum apex - emitted that vertex twice), (2) the wholly-outside fast path is now the exact face-vs-region intersection test (the "all vertices beyond the SAME plane" check missed faces straddling several infinite tilted planes, causing needless BSP fragmentation). Suite now 90 tests incl. `bottomCutout.test.ts` (synthetic + real-cell frustum sweep + plug).
- Next, on separate branches:
  - Improve distribution algorithm and explore restrictions for better bottom cutout separation (see "Point distribution" above - goal is a consistent, minimally-intersected bottom cell).
  - Gap-creation algorithm optimization.
  - Inner-cube-cut optimization (second pass): performance (main-thread at download time; worker offload; live cut preview), fragmentation (subtractCubeFromFace recursion can over-fragment multi-plane faces), STL export memory (data-URL buildup in downloadButton).
  - Repo layout / overall refactor (known duplication between printCutting.ts and cellCuttingAlgorithm.ts helpers: plane math, vertex pool, sorting).
  - UI upgrade.
  - ESLint 9 vs legacy `.eslintrc.cjs`: `pnpm lint` is broken repo-wide (needs flat-config migration).

## Maintaining this file
Keep this CLAUDE.md up to date as the project evolves: update it when features are added or finished, when the roadmap changes, or when the repo layout/architecture changes. Treat it as living documentation, not a one-time snapshot.
