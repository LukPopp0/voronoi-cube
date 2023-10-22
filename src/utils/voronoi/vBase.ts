export class VBase {
  /** The number of grid blocks x-direction. */
  nx: number;
  /** The number of grid blocks y-direction. */
  ny: number;
  /** The number of grid blocks z-direction. */
  nz: number;
  /** Constant indicating nx * ny. */
  nxy: number;
  /** Constant indicating nx * ny * nz. */
  nxyz: number;
  /** Size of a block in x-direction. */
  blockX: number;
  /** Size of a block in y-direction. */
  blockY: number;
  /** Size of a block in z-direction. */
  blockZ: number;

  constructor(
    nx: number,
    ny: number,
    nz: number,
    blockX?: number,
    blockY?: number,
    blockZ?: number
  ) {
    this.nx = nx;
    this.ny = ny;
    this.nz = nz;
    this.nxy = nx * ny;
    this.nxyz = nx * ny * nz;
    this.blockX = blockX || -1;
    this.blockY = blockY || -1;
    this.blockZ = blockZ || -1;
  }
}
