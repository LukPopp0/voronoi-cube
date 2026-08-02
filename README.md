# voronoi-cube

Generate 3D-printable voronoi cube geometry for a decorative desk lamp.

Distributes seed points, computes voronoi cells bound by a cube (via [voro++](https://math.lbl.gov/voro++/) through the `voro3d` WASM wrapper), shrinks each cell to leave gaps for light to pass through, cuts a hollow center for a light source and a bottom feed-through for electronics, then exports watertight STL. Printing and electronics are out of scope.

## Features

- Point distribution methods (spherical, fibonacci, guarded fibonacci) with tunable count / seed
- Voronoi cell generation, off-thread cell cutting (web workers)
- Adjustable gap size between cells
- Inner-cube hollow cutout + bottom N-gon cutout with in-place plug
- Live print-cut preview in the viewport
- STL export (individual parts + combined), shareable configs via URL params

## Tech

React 19 + TypeScript, Vite, `@react-three/fiber` / `@react-three/drei` (Three.js), zustand, `voro3d` (WASM). pnpm workspace, vitest.

## Development

    pnpm install
    pnpm dev      # dev server
    pnpm build    # typecheck + production build
    pnpm test     # vitest
