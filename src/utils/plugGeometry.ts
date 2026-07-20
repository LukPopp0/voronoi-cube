import { CutCellData } from '../workers/types/workerOutput';

/**
 * Solid one-piece plug for the bottom cutout (N-gon frustum), so a full cube
 * (no electronics feed-through) can be printed. World-positioned
 * (x/y/z offsets 0), faces wound outward (CCW viewed from outside) so
 * triangulateCellData derives correct normals. `sides` must match the
 * cutout region's side count.
 *
 * Clearance: the hole walls cannot shrink (they are cap faces on the exact
 * frustum planes), so the plug takes the full `gapSize` - each side plane is
 * inset inward by gapSize along its normal. Because all side planes pass
 * through the frustum apex (the cube center) and share the same normal
 * y-component by symmetry, insetting them is equivalent to translating the
 * apex down by gapSize / normalY; the plug is that translated pyramid,
 * sliced between the cube bottom face and the inner-cavity floor.
 */
export const buildBottomPlug = (
  cubeSize: number,
  innerCubeRatio: number,
  baseWidthRatio: number,
  gapSize: number,
  sides = 6,
): CutCellData => {
  const half = cubeSize / 2;
  const innerHalf = (cubeSize * innerCubeRatio) / 2;
  const circumRadius = (baseWidthRatio * cubeSize) / 2;

  // Outward side-plane normal y-component (same for all sides): normal of
  // the plane through the apex (origin) and base edge (corners 0, 1).
  const theta0 = 0;
  const theta1 = (2 * Math.PI) / sides;
  const b0 = [circumRadius * Math.cos(theta0), -half, circumRadius * Math.sin(theta0)];
  const b1 = [circumRadius * Math.cos(theta1), -half, circumRadius * Math.sin(theta1)];
  const crossX = b0[1] * b1[2] - b0[2] * b1[1];
  const crossY = b0[2] * b1[0] - b0[0] * b1[2];
  const crossZ = b0[0] * b1[1] - b0[1] * b1[0];
  const crossLen = Math.hypot(crossX, crossY, crossZ);
  const normalY = Math.abs(crossY) / crossLen;

  // Translated apex; corner rays go from the apex through the original base
  // corners' directions. At height y the ray parameter is (apexY - y) / half.
  const apexY = -gapSize / normalY;
  const sBottom = (apexY + half) / half;
  const sTop = (apexY + innerHalf) / half;

  if (sTop <= 0) {
    // Gap so large the plug vanishes before reaching the cavity floor.
    return { vertices: [], faces: [], particleId: -1, x: 0, y: 0, z: 0 };
  }

  const vertices: number[] = [];
  // Bottom ring: indices 0..sides-1, top ring: sides..2*sides-1.
  for (const [s, y] of [
    [sBottom, -half],
    [sTop, -innerHalf],
  ]) {
    for (let k = 0; k < sides; k++) {
      const theta = (k * 2 * Math.PI) / sides;
      vertices.push(s * circumRadius * Math.cos(theta), y, s * circumRadius * Math.sin(theta));
    }
  }

  // Winding: the bottom ring ordered by increasing theta winds with outward
  // (-y) normal, so it is the bottom cap directly; the top cap is reversed.
  const bottomCap = Array.from({ length: sides }, (_, k) => k);
  const topCap = Array.from({ length: sides }, (_, k) => 2 * sides - 1 - k);
  const faces: number[][] = [bottomCap, topCap];
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    faces.push([k1, k, sides + k, sides + k1]);
  }

  return { vertices, faces, particleId: -1, x: 0, y: 0, z: 0 };
};
