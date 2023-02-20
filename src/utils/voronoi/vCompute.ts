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
   * @param params Cell parameters
   *  - ijk: Index of the current block.
   *  - q: Index of the particle inside the block.
   * @returns Voronoi Cell
   */
  computeCell(particleInfo: { ijk: number; q: number; i: number; j: number; k: number }): VCell {
    const { ijk, q, i, j, k } = particleInfo;
    const countList = [7, 11, 15, 19, 26, 35, 45, 59];
    // let countE: number;
    //   x1 = -1,
    //   y1 = -1,
    //   z1 = -1,
    //   qx = 0,
    //   qy = 0,
    //   qz = 0;
    // let xlo, ylo, zlo, xhi, yhi, zhi, x2, y2, z2, rs;
    // let di, dj, dk, ei, ej, ek, f, g, l, disp;
    // let fx, fy, fz, gxs, gys, gzs, radp;
    // let q, e, mijk;

    // Initialize the voronoi cell
    const cell = new VCell(this.con, particleInfo);
    const disp = ijk - i - this.con.nx * (j + this.con.ny * k);
    console.log('\n-------- compute_cell --------');
    console.log(`ijk  : ${ijk}`);
    console.log(`q    : ${q}`);
    console.log(`ci cj ck: ${i} ${j} ${k}`);
    console.log(`x y z   : ${cell.particle[0]} ${cell.particle[1]} ${cell.particle[2]}`);
    console.log(`disp    : ${disp}`);

    // Cut the cell by any wall objects that have been added

    // Apply plane cuts to the cell corresponding to the other particles within the current region.

    // Test over pre-computed worklist of neighboring regions that have been ordered by distance
    // away from the particles's position. Apply radius tests after every few regions to see if
    // calculation can terminate.

    // If code reaches end of worklist, add all neighboring regions to a new list.

    // Carry out a region test on the first item of the list. If the region needs to be tested,
    // apply the plane routine for all of its particles and add neighboring regions to the end of
    // the list that need to be tested. Continue until the list has no elements left.

    return cell;
  }
}
