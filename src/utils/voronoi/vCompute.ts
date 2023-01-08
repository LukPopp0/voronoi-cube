import { BlockIterator } from './blockIterator';
import { VCell } from './vCell';
import { VContainer } from './vContainer';

export class VCompute {
  /** The container the computation class works on. */
  con: VContainer;

  constructor(c: VContainer) {
    this.con = c;
  }

  computeCell(it: BlockIterator): VCell {
    const countList = [7, 11, 15, 19, 26, 35, 45, 59];

    // Initialize the voronoi cell
    const cell = new VCell();
    cell.initialize(this.con, it);

    // Cut the cell by any wall objects that have been added

    // Apply place cuts to the cell corresponding to the other particles within the current region.

    // Test over pre-computed worklist of neighboring regions that have been ordered by distance
    // away from the particles's position. Apply radius tests after every few regions to see if
    // calculation can terminate.

    // If code reaches end of worklist, add all neighboring regions to a new list.

    // Carry out a region test on the first item of the list. If the region needs to be tested,
    // apply the plane routine for all of its particles and add neighboring regions to the end of
    // the list that need to be tested. Continue until the list has no elements left.

    return new VCell();
  }
}
