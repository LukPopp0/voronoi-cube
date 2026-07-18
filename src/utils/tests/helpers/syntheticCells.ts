import { CutCellData } from '../../../workers/types/workerOutput';

/**
 * Synthetic axis-aligned box cells for probing the inner-cube cutting
 * algorithm (printCutting.ts) with hand-verifiable geometry.
 */

type Vec3 = [number, number, number];

/**
 * Build an axis-aligned box as CutCellData, in CELL-LOCAL coordinates
 * (vertices relative to the box center), with cellData.x/y/z set to the
 * box's world center. 8 vertices, 6 quad faces, consistent outward winding
 * (CCW viewed from outside) - same convention as the hand-verified cube
 * fixture in meshInvariants.test.ts.
 */
export const makeBoxCell = (min: Vec3, max: Vec3, particleId = 0): CutCellData => {
  const center: Vec3 = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const hx = (max[0] - min[0]) / 2;
  const hy = (max[1] - min[1]) / 2;
  const hz = (max[2] - min[2]) / 2;

  // Local-coordinate corners, same ordering as buildCube in meshInvariants.test.ts.
  // prettier-ignore
  const vertices = [
    -hx, -hy, -hz, // 0
     hx, -hy, -hz, // 1
     hx,  hy, -hz, // 2
    -hx,  hy, -hz, // 3
    -hx, -hy,  hz, // 4
     hx, -hy,  hz, // 5
     hx,  hy,  hz, // 6
    -hx,  hy,  hz, // 7
  ];

  const faces = [
    [0, 3, 2, 1], // bottom z=-hz, normal -z
    [4, 5, 6, 7], // top z=+hz, normal +z
    [0, 1, 5, 4], // front y=-hy, normal -y
    [3, 7, 6, 2], // back y=+hy, normal +y
    [0, 4, 7, 3], // left x=-hx, normal -x
    [1, 2, 6, 5], // right x=+hx, normal +x
  ];

  return {
    vertices,
    faces,
    particleId,
    x: center[0],
    y: center[1],
    z: center[2],
  };
};

/** Volume of an axis-aligned box given its min/max corners. */
export const boxVolume = (min: Vec3, max: Vec3): number =>
  (max[0] - min[0]) * (max[1] - min[1]) * (max[2] - min[2]);

/**
 * Volume of the intersection of two axis-aligned boxes (0 if they don't
 * overlap). Used to compute expected post-cut volume: boxVolume(A) minus
 * this intersection with the inner cube.
 */
export const boxIntersectionVolume = (minA: Vec3, maxA: Vec3, minB: Vec3, maxB: Vec3): number => {
  let vol = 1;
  for (let axis = 0; axis < 3; axis++) {
    const lo = Math.max(minA[axis], minB[axis]);
    const hi = Math.min(maxA[axis], maxB[axis]);
    const len = Math.max(0, hi - lo);
    vol *= len;
  }
  return vol;
};
