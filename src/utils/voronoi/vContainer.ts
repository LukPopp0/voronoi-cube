import { BlockIterator } from './blockIterator';
import { VBase } from './vBase';
import { VCell } from './vCell';

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
  /** Array containing the particle ids. */
  pIDs: number[] = [];
  /** Array storing the number of particles within each block */
  particlesInBlocks: number[] = [];
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
    this.particlesInBlocks = new Array(nx * ny * nz).fill(0);
  }

  /**
   * Sets the particles for this container (creates a deep copy of it) as well as new particle ids.
   * @param points The positions of the particles for the container.
   */
  setParticles(points: [number, number, number][]): void {
    this.pPositions = new Array(points.length);
    points.forEach((v, i) => (this.pPositions[i] = [...v]));
    this.pIDs = [...Array(points.length).keys()];

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

    const nParticles = this.pIDs.length;
    for (let n = 0; n < nParticles; ++n) {
      const ijk = putParticle(this.pPositions[n][0], this.pPositions[n][1], this.pPositions[n][2]);
      if (ijk >= 0) this.particlesInBlocks[ijk]++;
    }
  }

  /**
   * Get the voronoi cells for the particles. Compute them if necessary.
   * @returns Array of voronoi cells.
   */
  getCells(): VCell[] {
    if (this.pPositions.length === 0) return [];
    if (!this.#cells) this.#computeCells();
    return this.#cells || [];
  }

  #computeCells(): void {
    const it = new BlockIterator(this.nx, this.ny, this.nz);
    this.#cells = new Array(this.pPositions.length);

    if (it.start(this.particlesInBlocks)) {
      do {
        this.#computeCell(it);
      } while (it.increase(this.particlesInBlocks));
    }
  }

  #computeCell(it: BlockIterator): VCell {
    // TODO
    return new VCell();
  }
}
