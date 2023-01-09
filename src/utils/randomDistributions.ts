import MersenneTwister from 'mersenne-twister';

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
 */
const _cubeDistribution = (
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
  const points = distributionFunction(n, s / 2, seed, ...args);
  const projectedPoints: [number, number, number][] = [];

  for (const point of points) {
    const [x, y, z] = point;
    projectedPoints.push(sphereToCubeProjection(x, y, z, s / 2));
  }

  return projectedPoints;
};

/**
 * Distributes points on the surface of a cube.
 * @param n Number of points.
 * @param s Cube side length.
 * @param seed Random seed.
 * @returns Array of array of 3 points.
 */
export const cubeDistribution = (
  n: number,
  s: number,
  seed?: number
): [number, number, number][] => {
  return _cubeDistribution(n, s, seed, sphereDistribution);
};

/**
 * Distributes points on the surface of a cube.
 * @param n Number of points.
 * @param s Cube side length.
 * @param seed Random seed.
 * @param minDistance Minimum distance between the points.
 * @returns Array of array of 3 points.
 */
export const cubeDistributionRestricted = (
  n: number,
  s: number,
  seed?: number,
  minDistance = 0
): [number, number, number][] => {
  return _cubeDistribution(n, s, seed, sphereDistributionRestricted, [minDistance]);
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
