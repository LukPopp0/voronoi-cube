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

/**
 * Distribute points randomly on a sphere with restrictions:
 * - The first point is always at the bottom of the sphere.
 * - The points have a minimum distance `minDistance` to each other.
 * The calculation of the points is done via brute-force. If the number of tries exceeds the max.
 * number of tries, a point is added even if it does not fit the minimum distance restriction.
 * @param n Number of points.
 * @param radius Sphere radius.
 * @param seed Random seed.
 * @param minDistance Minimum distance between the points.
 * @returns Array of array of 3 points.
 */
export const sphereDistributionRestricted = (
  n: number,
  radius: number,
  seed?: number,
  minDistance = 0
): [number, number, number][] => {
  const random = new MersenneTwister(seed);
  const points: [number, number, number][] = [];

  points.push([0, -radius, 0]);

  let tries = 0;
  const maxTries = 10000;

  while (points.length < n) {
    const theta = 2 * Math.PI * random.random();
    const phi = Math.acos(2 * random.random() - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    const point: [number, number, number] = [x, y, z];

    // Check if the point is at least minDistance away from all existing points
    let isValid = true;
    for (const p of points) {
      if (getDistance(p, point) < minDistance) {
        isValid = false;
        break;
      }
    }

    if (isValid || tries > maxTries) {
      points.push(point);
      tries = 0;
    }

    tries++;
  }

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
