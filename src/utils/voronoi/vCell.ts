import { BlockIterator } from './blockIterator';
import { VContainer } from './vContainer';

export class VCell {
  /** The total number of vertices for the cell. */
  nVerts = 0;
  particle: [number, number, number];
  /** The positions of the vertices */
  verts: [number, number, number][] = [];

  constructor() {
    this.particle = [0, 0, 0];
  }

  initialize(con: VContainer, it: BlockIterator) {
    // Get the right particle
    const partID = con.partIDsInBlocks[it.ijk][it.q];
    this.particle = con.pPositions[partID];
    console.log('VCell init', { con, it });
    console.log('Particle: ', this.particle);

    // Min. and max. coordinates of the cell relative to the particle position
    const x1 = con.xMin - this.particle[0];
    const x2 = con.xMax - this.particle[0];
    const y1 = con.yMin - this.particle[1];
    const y2 = con.yMax - this.particle[1];
    const z1 = con.zMin - this.particle[2];
    const z2 = con.zMax - this.particle[2];

    // TODO: Initialize vertices of box as rectangle

    // ???
    const disp = it.ijk - it.i - con.nx * (it.j + con.ny * it.k);
  }
}
