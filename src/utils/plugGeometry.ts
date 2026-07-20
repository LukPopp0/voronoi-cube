import { CutCellData } from '../workers/types/workerOutput';

/**
 * Solid one-piece plug for the bottom hex-frustum cutout, so a full cube
 * (no electronics feed-through) can be printed. World-positioned
 * (x/y/z offsets 0), faces wound outward (CCW viewed from outside) so
 * triangulateCellData derives correct normals.
 *
 * Clearance: the hole walls cannot shrink (they are cap faces on the exact
 * frustum planes), so the plug takes the full `gapSize` - each side plane is
 * inset inward by gapSize along its normal. Because all six side planes pass
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
): CutCellData => {
  const half = cubeSize / 2;
  const innerHalf = (cubeSize * innerCubeRatio) / 2;
  const circumRadius = (baseWidthRatio * cubeSize) / 2;

  // Outward side-plane normal y-component (same for all 6 sides): normal of
  // the plane through the apex (origin) and base edge (corners k, k+1).
  const theta0 = 0;
  const theta1 = Math.PI / 3;
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
  // Bottom ring: indices 0..5, top ring: 6..11.
  for (const [s, y] of [
    [sBottom, -half],
    [sTop, -innerHalf],
  ]) {
    for (let k = 0; k < 6; k++) {
      const theta = (k * Math.PI) / 3;
      vertices.push(s * circumRadius * Math.cos(theta), y, s * circumRadius * Math.sin(theta));
    }
  }

  // Winding: the bottom ring ordered by increasing theta winds with outward
  // (-y) normal, so it is the bottom cap directly; the top cap is reversed.
  const faces: number[][] = [
    [0, 1, 2, 3, 4, 5],
    [11, 10, 9, 8, 7, 6],
  ];
  for (let k = 0; k < 6; k++) {
    const k1 = (k + 1) % 6;
    faces.push([k1, k, 6 + k, 6 + k1]);
  }

  return { vertices, faces, particleId: -1, x: 0, y: 0, z: 0 };
};
