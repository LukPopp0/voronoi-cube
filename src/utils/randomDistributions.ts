import MersenneTwister from 'mersenne-twister';

export const distributePointsOnCube = (
  n: number,
  s: number,
  seed: number
): [number, number, number][] => {
  const points = distributePointsOnSphere(n, s / 2, seed);
  const projectedPoints: [number, number, number][] = [];

  for (const point of points) {
    const [x, y, z] = point;
    projectedPoints.push(spherePointToCube(x, y, z, s / 2));
  }

  return projectedPoints;
};

export const distributePointsOnSphere = (n: number, radius: number, seed: number): number[][] => {
  const random = new MersenneTwister(seed);
  const points: [number, number, number][] = [];

  points.push([0, -radius, 0]);

  for (let i = 1; i < n; i++) {
    const theta = 2 * Math.PI * random.random();
    const phi = Math.acos(2 * random.random() - 1);
    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.sin(phi) * Math.sin(theta);
    const z = radius * Math.cos(phi);
    points.push([x, y, z]);
  }

  return points;
};

const spherePointToCube = (
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
