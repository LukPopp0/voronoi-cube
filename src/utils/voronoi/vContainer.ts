import { VBase } from './vBase';
import { VCell } from './vCell';
import { VCompute } from './vCompute';

export class VContainer extends VBase {
  /** The minimum x coordinate of the container. */
  xMin: number;
  /** The minimum y coordinate of the container. */
  yMin: number;
  /** The minimum z coordinate of the container. */
  zMin: number;
  /** The maximum x coordinate of the container. */
  xMax: number;
  /** The maximum y coordinate of the container. */
  yMax: number;
  /** The maximum z coordinate of the container. */
  zMax: number;
  /** Array containing the particle positions. */
  pPositions: [number, number, number][] = [];
  /** Array storing the particle ids for each block */
  partIDsInBlocks: number[][] = [];
  /** Array storing the number of particles within each block */
  partsInBlocks: number[] = [];
  /** Array containing the voronoi cells for the container and the particles */
  #cells: VCell[] | undefined = undefined;

  constructor(
    xMin: number,
    yMin: number,
    zMin: number,
    xMax: number,
    yMax: number,
    zMax: number,
    nx: number,
    ny: number,
    nz: number
  ) {
    super(nx, ny, nz, (xMax - xMin) / nx, (yMax - yMin) / ny, (zMax - zMin) / nz);

    this.xMin = xMin;
    this.yMin = yMin;
    this.zMin = zMin;
    this.xMax = xMax;
    this.yMax = yMax;
    this.zMax = zMax;
    this.partsInBlocks = Array(nx * ny * nz).fill(0);
    this.partIDsInBlocks = [...Array(nx * ny * nz)].map(x => []);
  }

  /**
   * Sets the particles for this container (creates a deep copy of it) as well as new particle ids.
   * @param points The positions of the particles for the container.
   */
  setParticles(points: [number, number, number][]): void {
    this.pPositions = Array(points.length);
    points.forEach((v, i) => console.log(`Adding: ${v[0]} \t${v[1]} \t${v[2]}`));
    points.forEach((v, i) => (this.pPositions[i] = [...v]));

    this.#putParticlesInBlocks();
  }

  #putParticlesInBlocks(): void {
    const inx = 1 / this.blockX,
      iny = 1 / this.blockY,
      inz = 1 / this.blockZ;

    const putParticle = (x: number, y: number, z: number) => {
      const i = Math.floor((x - this.xMin) * inx);
      const j = Math.floor((y - this.yMin) * iny);
      const k = Math.floor((z - this.zMin) * inz);
      if (i < 0 || j < 0 || k < 0 || i >= this.nx || j >= this.ny || k >= this.nz) return -1;
      return i + this.nx * j + this.nxy * k;
    };

    const nParticles = this.pPositions.length;
    for (let n = 0; n < nParticles; ++n) {
      const ijk = putParticle(this.pPositions[n][0], this.pPositions[n][1], this.pPositions[n][2]);
      if (ijk >= 0) {
        this.partIDsInBlocks[ijk].push(n);
        this.partsInBlocks[ijk]++;
      }
    }
  }

  /**
   * Get the voronoi cells for the particles. Compute them if necessary.
   * @returns Array of voronoi cells.
   */
  getCells(): VCell[] {
    if (this.pPositions.length === 0) return [];
    if (!this.#cells || this.#cells.length === 0) this.#computeCells();
    return this.#cells || [];
  }

  #computeCells(): void {
    this.#cells = [];

    // Iterate over all computation blocks and then all particles within each block.
    // Compute cell for each particle in order.
    let cellNr = 0;
    const compute = new VCompute(this);
    for (let ijk = 0; ijk < this.partIDsInBlocks.length; ++ijk) {
      for (let q = 0; q < this.partIDsInBlocks[ijk].length; ++q) {
        const k = Math.floor(ijk / this.nxy),
          ijkt = ijk - this.nxy * k,
          j = Math.floor(ijkt / this.nx),
          i = ijkt - j * this.nx;
        const cell = compute.computeCell({ ijk, q, i, j, k });
        if (cell) this.#cells[cellNr++] = cell;
      }
    }
  }
}
