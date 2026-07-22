import MersenneTwister from 'mersenne-twister';
import { clamp } from 'three/src/math/MathUtils';

/**
 * Distribute points randomly on a sphere.
 * @param n Number of points.
 * @param radius Sphere radius.
 * @param seed Random seed.
 * @returns Array of array of 3 points.
 */
export const sphereDistribution = (
  n: number,
  radius: number,
  seed?: number
): [number, number, number][] => {
  const random = new MersenneTwister(seed);
  const points: [number, number, number][] = [];

  for (let i = 0; i < n; i++) {
    const theta = 2 * Math.PI * random.random();
    const phi = Math.acos(2 * random.random() - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    points.push([x, y, z]);
  }

  return points;
};

const lerp = (x: number, y: number, a: number) => x * (1 - a) + y * a;
const restrictPoints = (a: number, b: number, restriction: number): [number, number] => {
  if (restriction === 0) return [a, b];
  const mid = (a + b) / 2;
  return [lerp(a, mid, restriction), lerp(b, mid, restriction)];
};

/**
 * Distribute points randomly on a sphere with restrictions:
 * - The first point is always at the bottom of the sphere.
 * - The points have a minimum distance `minDistance` to each other.
 * The calculation of the points is done via brute-force. If the number of tries exceeds the max.
 * number of tries, a point is added even if it does not fit the minimum distance restriction.
 * @param n Number of points.
 * @param radius Sphere radius.
 * @param seed Random seed.
 * @param restriction A value between 0 and 1 that controls how random the points are. A value of 0
 * means there is no restriction, the spread is bigger. A value of 1 leads to a more even spread.
 * @returns Array of array of 3 points.
 */
export const sphereDistributionRestricted = (
  n: number,
  radius: number,
  seed?: number,
  restriction = 0
): [number, number, number][] => {
  // How the distribution works:
  // - Distribute in rows and colums. 2 * #rows = #cols
  // - Top row (top of sphere) gets remaining points if fraction left
  // - Add points randomly in the area of their row/column
  // - Add random rotation to the whole sphere
  // - Add rotation to each row to avoid points directly above each other
  // - Restriction
  //  - Theta: [-PI, PI]
  //  - Phi: [-PI / 4, PI / 2]
  //  - The restriction determines the size of the area the points can spawn in:
  //   - 0 => Possible to put point in whole area
  //   - 1 => Point will always be in the center of the area

  const nRowsRaw = Math.sqrt((n - 1) / 2);
  const nColsRegular = Math.round(2 * nRowsRaw);
  const pointsPerRow = Array(Math.ceil(nRowsRaw)).fill(nColsRegular);
  // Fix number of points in top row if nRowsRaw is not an integer
  pointsPerRow[pointsPerRow.length - 1] = n - 1 - nColsRegular * (pointsPerRow.length - 1);

  const random = new MersenneTwister(seed);
  const points: [number, number, number][] = [];
  points.push([0, -radius, 0]);
  // Add additional random rotation
  const randomRotation = random.random() * 2 * Math.PI;

  const phiPerRow = ((3 / 4) * Math.PI) / pointsPerRow.length;
  const minPhiAngle = -Math.PI / 4;
  pointsPerRow.forEach((nPoints, row) => {
    const thetaPerPoint = (2 * Math.PI) / nPoints;
    let phiMin = minPhiAngle + row * phiPerRow;
    let phiMax = minPhiAngle + (row + 1) * phiPerRow;
    [phiMin, phiMax] = restrictPoints(phiMin, phiMax, restriction);

    // Add extra rotation for every row to avoid points directly above each other
    const extraThetaRotation = ((row % 2) * 2 * Math.PI) / nPoints / 2;

    for (let col = 0; col < nPoints; ++col) {
      let thetaMin = extraThetaRotation + randomRotation + thetaPerPoint * col;
      let thetaMax = extraThetaRotation + randomRotation + thetaPerPoint * (col + 1);
      [thetaMin, thetaMax] = restrictPoints(thetaMin, thetaMax, restriction);

      const theta = random.random() * (thetaMax - thetaMin) + thetaMin;
      const phi = random.random() * (phiMax - phiMin) + phiMin;

      const x = radius * Math.cos(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi);
      const z = radius * Math.cos(phi) * Math.sin(theta);
      points.push([x, y, z]);
    }
  });

  return points;
};

/**
 * Distribute points on the surface of a cube. This is the base function for other cube
 * distribution functions. It takes a distribution function as well as additional parameters
 * that would be passed to this distribution function. By default this is a regular sphere
 * sphere distribution.
 * @param n Number of points.
 * @param s Cube side length.
 * @param seed Random seed.
 * @param args Arguments to pass on to the distribution function (e.g. min. distance).
 * @returns Array of array of 3 points.
 */
export const cubeDistribution = (
  n: number,
  s: number,
  seed?: number,
  distributionFunction: (
    n: number,
    s: number,
    seed?: number,
    ...args: any[]
  ) => [number, number, number][] = sphereDistribution,
  args: any[] = []
): [number, number, number][] => {
  return distributionFunction(n, s / 2, seed, ...args).map(([x, y, z]) =>
    sphereToCubeProjection(x, y, z, s / 2)
  );
};

/**
 * Project a point on a sphere onto a cube with optional radius.
 */
const sphereToCubeProjection = (
  x: number,
  y: number,
  z: number,
  radius?: number
): [number, number, number] => {
  const r = radius || Math.sqrt(x * x + y * y + z * z);
  const fx = Math.abs(x),
    fy = Math.abs(y),
    fz = Math.abs(z);

  const max = Math.max(fx, fy, fz);
  const scale = r / max;
  return [x * scale, y * scale, z * scale];
};

/**
 * Calculate distance between two points.
 */
const getDistance = (p1: [number, number, number], p2: [number, number, number]): number => {
  const dx = p1[0] - p2[0];
  const dy = p1[1] - p2[1];
  const dz = p1[2] - p2[2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

export const fibonacciDistribution = (
  n: number,
  radius: number,
  seed?: number
): [number, number, number][] => {
  const random = new MersenneTwister(seed);
  const randomRotation = random.random() * Math.PI * 2;
  const goldenRatio = (1 + Math.pow(5, 0.5)) / 2;
  const arr: [number, number, number][] = new Array(n).fill(0).map((_, idx) => {
    const i = idx + 0.5;
    const phi = Math.acos(1 - (2 * i) / n);
    const theta = (2 * Math.PI * i) / goldenRatio + randomRotation;
    return [
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.cos(phi),
      radius * Math.sin(theta) * Math.sin(phi),
    ];
  });
  return arr;
};

const mapNumRange = (
  num: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => ((num - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;

export const fibonacciDistributionRestricted = (
  n: number,
  radius: number,
  seed?: number
): [number, number, number][] => {
  const random = new MersenneTwister(seed);
  const randomRotation = random.random() * Math.PI * 2;

  const _n = n - 1;
  const phiRestriction = 0.2 * Math.PI;
  const goldenRatio = (1 + Math.pow(5, 0.5)) / 2;
  const arr: [number, number, number][] = new Array(_n).fill(0).map((_, idx) => {
    const i = idx + 0.5;
    let phi = Math.acos(1 - (2 * i) / _n);
    phi = mapNumRange(phi, 0, Math.PI, 0, Math.PI - phiRestriction);
    const theta = (2 * Math.PI * i) / goldenRatio + randomRotation;
    return [
      radius * Math.cos(theta) * Math.sin(phi),
      radius * Math.cos(phi),
      radius * Math.sin(theta) * Math.sin(phi),
    ];
  });
  arr.unshift([0, -radius, 0]);
  return arr;
};

/**
 * Tuning options for the guarded fibonacci distribution. All angles in radians.
 * These live in the store's `debugSettings` slice; `cutoutWidth` is read from
 * the top-level `bottomCutoutWidth` for the 'cutout' phiG mode.
 */
export interface GuardRingOptions {
  guardCountMode: 'auto' | 'manual';
  guardCountPct: number; // fraction of n placed in the guard ring (auto mode)
  guardCount: number; // manual guard-ring point count
  phiGMode: 'cutout' | 'density' | 'manual';
  minPhiG: number; // lower clamp on the guard-ring angle
  phiG: number; // manual guard-ring angle
  guardRotation: number; // theta offset applied to the whole guard ring
  marginFactor: number; // exclusion band = phiG * (1 + marginFactor)
  cutoutWidth: number; // bottomCutoutWidth, drives the 'cutout' phiG mode
}

/** Guard-ring angle can never exceed this (keeps the ring off the equator). */
const MAX_PHI_G = 0.45 * Math.PI;

/**
 * Guard-ring point count `G`. Auto scales with the total point count
 * (`pct * n`), snapped to a multiple of 4 (nice cube-symmetric alignment) and
 * clamped to `[4, n-1]`. Too few total points to form a min-4 ring => all
 * non-pole sites become the ring.
 */
export const computeGuardCount = (n: number, opts: GuardRingOptions): number => {
  if (n <= 1) return 0;
  if (n - 1 < 4) return n - 1;
  const raw = opts.guardCountMode === 'manual' ? opts.guardCount : opts.guardCountPct * n;
  const snapped = Math.round(raw / 4) * 4;
  return clamp(snapped, 4, n - 1);
};

/**
 * Guard-ring angle up from the south pole (radians). Three modes, all clamped
 * to `[minPhiG, MAX_PHI_G]`:
 * - 'cutout': ring angle scales linearly with cutout width - width 1.0 -> 45 deg,
 *   width 0.5 -> 22.5 deg, i.e. `phiG = cutoutWidth * PI/4`. Tuned by eye.
 * - 'density': pole cap ~ one average cell's solid angle.
 * - 'manual': use the supplied angle.
 */
export const computePhiG = (n: number, opts: GuardRingOptions): number => {
  let phiG: number;
  switch (opts.phiGMode) {
    case 'manual':
      phiG = opts.phiG;
      break;
    case 'density':
      phiG = 2 * Math.acos(clamp(1 - 2 / n, -1, 1));
      break;
    case 'cutout':
    default:
      phiG = opts.cutoutWidth * (Math.PI / 4);
      break;
  }
  return clamp(phiG, opts.minPhiG, MAX_PHI_G);
};

/**
 * Fibonacci distribution with a deterministic guard ring around the south pole,
 * so the bottom (pole) cell is identical for every seed.
 *
 * Layout (angles measured as beta = angle up from the south pole):
 * - one fixed south-pole site at beta = 0,
 * - `G` fixed guard sites evenly spaced at beta = phiG (seed-independent; only
 *   `n` -> G and `guardRotation` move them),
 * - the remaining `n-1-G` sites placed by the fibonacci spiral but compressed
 *   into the band beta in [phiExclude, PI] (phiExclude = phiG*(1+marginFactor)),
 *   so no random site is ever closer to the pole than the guard ring.
 *
 * The guard ring fully encloses the pole and every random site lies beyond the
 * exclusion band, so the pole cell's only neighbors are the deterministic guard
 * sites => the pole cell is seed-independent.
 */
export const fibonacciDistributionGuarded = (
  n: number,
  radius: number,
  seed: number | undefined,
  opts: GuardRingOptions,
): [number, number, number][] => {
  if (n <= 0) return [];

  const points: [number, number, number][] = [];
  points.push([0, -radius, 0]); // south pole, deterministic
  if (n === 1) return points;

  const G = computeGuardCount(n, opts);
  const phiG = computePhiG(n, opts);

  // Guard ring: deterministic, seed-independent.
  const ringY = -radius * Math.cos(phiG);
  const ringR = radius * Math.sin(phiG);
  for (let k = 0; k < G; k++) {
    const theta = (2 * Math.PI * k) / G + opts.guardRotation;
    points.push([ringR * Math.cos(theta), ringY, ringR * Math.sin(theta)]);
  }

  // Random field, compressed above the exclusion band. Only the overall
  // rotation depends on the seed (mirrors fibonacciDistribution).
  const R = n - 1 - G;
  if (R > 0) {
    const random = new MersenneTwister(seed);
    const randomRotation = random.random() * Math.PI * 2;
    const goldenRatio = (1 + Math.pow(5, 0.5)) / 2;
    const phiExclude = Math.min(phiG * (1 + opts.marginFactor), Math.PI - 1e-3);
    const phiMax = Math.PI - phiExclude; // upper bound on spiral phi (north band)
    for (let idx = 0; idx < R; idx++) {
      const i = idx + 0.5;
      let phi = Math.acos(1 - (2 * i) / R);
      phi = mapNumRange(phi, 0, Math.PI, 0, phiMax);
      const theta = (2 * Math.PI * i) / goldenRatio + randomRotation;
      points.push([
        radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.cos(phi),
        radius * Math.sin(theta) * Math.sin(phi),
      ]);
    }
  }

  return points;
};
