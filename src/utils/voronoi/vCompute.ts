import { RadiusCalc } from './tesselationHelper';
import { VCell } from './vCell';
import { VContainer } from './vContainer';

export class VCompute {
  /** The container the computation class works on. */
  con: VContainer;

  constructor(c: VContainer) {
    this.con = c;
  }

  /**
   * Compute a cell for a particle inside a block.
   * @param particleInfo Cell parameters
   *  - ijk/i, j, k: Index of the current block.
   *  - q: Index of the particle inside the block.
   * @returns Voronoi Cell or `null` in case a cell has been cut off completely.
   */
  computeCell(particleInfo: {
    ijk: number;
    q: number;
    i: number;
    j: number;
    k: number;
  }): VCell | null {
    const { ijk, q, i, j, k } = particleInfo;
    //   qx = 0,
    //   qy = 0,
    //   qz = 0;
    // let xlo, ylo, zlo, xhi, yhi, zhi, x2, y2, z2;
    // let di, dj, dk, ei, ej, ek, f, g, disp;
    // let fx, fy, fz, gxs, gys, gzs, radp;
    // let q, e, mijk;

    // --------------------------
    // Initialize the voronoi cell
    // --------------------------

    const cell = new VCell(this.con, particleInfo);
    const disp = ijk - i - this.con.nx * (j + this.con.ny * k);
    console.log('\n-------- compute_cell --------');
    console.log(`ijk  : ${ijk}`);
    console.log(`q    : ${q}`);
    // console.log(`ci cj ck: ${i} ${j} ${k}`);
    console.log(
      `x y z   : ${cell.particle[0].toFixed(5)} ${cell.particle[1].toFixed(
        5
      )} ${cell.particle[2].toFixed(5)}`
    );
    console.log(`disp    : ${disp}`);

    // --------------------------
    // Test all particles in the particle's local region (same block) first
    // --------------------------

    console.log('\nTesting nearby particles:');
    // Variables for the position of other particles in the cell coordinate system
    let x1: number, y1: number, z1: number;
    // Squared distance to other particle (radius squared)
    let rs: number;
    for (let l = 0; l < this.con.partsInBlocks[ijk]; ++l) {
      if (l === q) continue;
      const pId = this.con.partIDsInBlocks[ijk][l];
      x1 = this.con.pPositions[pId][0] - cell.particle[0];
      y1 = this.con.pPositions[pId][1] - cell.particle[1];
      z1 = this.con.pPositions[pId][2] - cell.particle[2];
      // const rs = RadiusCalc.rScale(x1 * x1 + y1 * y1 + z1 * z1, ijk, l);
      rs = x1 * x1 + y1 * y1 + z1 * z1;
      console.log(`P: ${x1.toFixed(5)} ${y1.toFixed(5)} ${z1.toFixed(5)} ${rs}`);

      if (!cell.cutPlane({ x: x1, y: y1, z: z1, rs }, pId)) return null;
    }

    // let countIndex = 0;
    // const countList = [7, 11, 15, 19, 26, 35, 45, 59];
    // const countEnd = countList[countList.length - 1];
    // const nextCount = 3;
    // let crs: number, mrs: number; // double

    // Cut the cell by any wall objects that have been added

    // Apply plane cuts to the cell corresponding to the other particles within the current region.

    // Test over pre-computed worklist of neighboring regions that have been ordered by distance
    // away from the particles's position. Apply radius tests after every few regions to see if
    // calculation can terminate.

    // If code reaches end of worklist, add all neighboring regions to a new list.

    // Carry out a region test on the first item of the list. If the region needs to be tested,
    // apply the plane routine for all of its particles and add neighboring regions to the end of
    // the list that need to be tested. Continue until the list has no elements left.

    console.log('End of vcompute\n');
    return cell;
  }
}
