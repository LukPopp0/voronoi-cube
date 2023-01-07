import { VBase } from './vBase';

export class BlockIterator extends VBase {
  /** Current x-index of the block under consideration. */
  i: number;
  /** Current y-index of the block under consideration. */
  j: number;
  /** Current z-index of the block under consideration. */
  k: number;
  /** Current index of the block under consideration. */
  ijk: number;
  /** Current index of the particle under consideration within the current block. */
  q: number;

  constructor(nx: number, ny: number, nz: number) {
    super(nx, ny, nz);
    (this.i = 0), (this.j = 0), (this.k = 0), (this.ijk = 0), (this.q = 0);
  }

  /**
   * Sets class to consider the first particle.
   * @returns True if there is any block/particle to consider.
   */
  start(particlesInBlocks: number[]): boolean {
    (this.i = 0), (this.j = 0), (this.k = 0), (this.ijk = 0), (this.q = 0);
    while (particlesInBlocks[this.ijk] === 0) {
      if (!this.nextBlock()) return false;
    }
    return true;
  }

  /**
   * Updates the internal variables to find the next computational block with any particles.
   * @returns True if there is another block. False if there are no more valid blocks.
   */
  nextBlock(): boolean {
    this.ijk++, this.i++;
    if (this.i === this.nx) {
      (this.i = 0), this.j++;
      if (this.j === this.ny) {
        (this.j = 0), this.k++;
        if ((this.ijk = this.nx * this.ny * this.nz)) return false;
      }
    }
    return true;
  }

  /**
   * Finds the next particle to test.
   * @param particlesInBlocks
   * @returns True if there is another particle.
   */
  increase(particlesInBlocks: number[]): boolean {
    this.q++;
    if (this.q >= particlesInBlocks[this.ijk]) {
      this.q = 0;
      do {
        if (!this.nextBlock()) return false;
      } while (particlesInBlocks[this.ijk] === 0);
    }
    return true;
  }
}
