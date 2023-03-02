import { VContainer } from './vContainer';

/** If a point is within this distance of a cutting plane, then the code
 * assumes that point exactly lies on the plane. */
const tolerance = 1e-11;

export class VCell {
  /** The total number of vertices for the cell. */
  nVerts = 0;
  /** Position of the particle for the cell. */
  particle: [number, number, number] = [0, 0, 0];
  /** The positions of the vertices */
  verts: [number, number, number][] = [];
  /** The order of each vertex. */
  vertOrder: number[] = [];
  // TODO: Delete if unused
  // /**
  //  * Two dimensional array containing edge information.
  //  * `edgeInfo[i]` holds the edge information of all vertices of of order `i`. Each vertex holds
  //  * 2 * i + 1 integers of information.
  //  * */
  // edgeInfoO: number[][] = new Array(this.currentVertexOrder).fill([]).map(_ => []);
  // up = 0;

  /**
   * Holds information about the connections of each vertex. An entry at position `i` corresponds
   * to the vertex at the same position in the `verts` array. The size of the array at position `i`
   * is dependent on the order `p` of the vertex, with 2 * p integers of information.
   *
   * The first p integers of the i-th entry are the edges e(j, i), where j is the vertex index of
   * the j-th neighbor of vertex i. The last p integers correspond to the index of the current
   * vertex in the edge information of the neighbor vertex.
   *
   * Example: The vertex at position i is of order 3.
   * - verts[i]: Contains the position of the vertex
   * - vertOrder[i] = 3
   * - edgeInfo[i] = [
   *    n1,               // 1st neighbor
   *    n2,               // 2nd neighbor
   *    n3,               // 3rd neighbor
   *    index_in_n1, // Index of i in edgeInfo[n1]
   *    index_in_n2, // Index of i in edgeInfo[n2]
   *    index_in_n3  // Index of i in edgeInfo[n3]
   *   ]
   * */
  edgeInfo: number[][] = [];

  constructor(
    con: VContainer,
    particleInfo: { ijk: number; q: number; i: number; j: number; k: number }
  ) {
    this.#initialize(con, particleInfo);
  }

  /**
   * Initialize the cell as a rectangular box with the given dimensions.
   */
  #initBase(xmin: number, xmax: number, ymin: number, ymax: number, zmin: number, zmax: number) {
    // Add corners of box to stored vertices
    this.verts.push([xmin, ymin, zmin]); // 0
    this.verts.push([xmax, ymin, zmin]); // 1
    this.verts.push([xmin, ymax, zmin]); // 2
    this.verts.push([xmax, ymax, zmin]); // 3
    this.verts.push([xmin, ymin, zmax]); // 4
    this.verts.push([xmax, ymin, zmax]); // 5
    this.verts.push([xmin, ymax, zmax]); // 6
    this.verts.push([xmax, ymax, zmax]); // 7

    // Set vertex order to 3 for all vertices
    this.vertOrder = new Array(8).fill(3);

    // Push edge information for all initial vertices
    this.edgeInfo.push(
      [1, 4, 2, 2, 1, 0],
      [3, 5, 0, 2, 1, 0],
      [0, 6, 3, 2, 1, 0],
      [2, 7, 1, 2, 1, 0],
      [6, 0, 5, 2, 1, 0],
      [4, 1, 7, 2, 1, 0],
      [7, 2, 4, 2, 1, 0],
      [5, 3, 6, 2, 1, 0]
    );

    // // Push connection information for all initial vertices of initial vertex order 3
    // console.log(this.edgeInfoO);
    // this.edgeInfoO[3].push(
    //   ...[
    //     1, 4, 2, 2, 1, 0, 0, 3, 5, 0, 2, 1, 0, 1, 0, 6, 3, 2, 1, 0, 2, 2, 7, 1, 2, 1, 0, 3, 6, 0, 5,
    //     2, 1, 0, 4, 4, 1, 7, 2, 1, 0, 5, 7, 2, 4, 2, 1, 0, 6, 5, 3, 6, 2, 1, 0, 7,
    //   ]
    // );
  }

  #initialize(
    con: VContainer,
    particleInfo: { ijk: number; q: number; i: number; j: number; k: number }
  ) {
    // Get the right particle
    const { ijk, q, i, j, k } = particleInfo;
    const partID = con.partIDsInBlocks[ijk][q];
    this.particle = con.pPositions[partID];

    // Min. and max. coordinates of the cell relative to the particle position
    const xmin = con.xMin - this.particle[0];
    const xmax = con.xMax - this.particle[0];
    const ymin = con.yMin - this.particle[1];
    const ymax = con.yMax - this.particle[1];
    const zmin = con.zMin - this.particle[2];
    const zmax = con.zMax - this.particle[2];

    // Init rectangular box with given dimensions
    this.#initBase(2 * xmin, 2 * xmax, 2 * ymin, 2 * ymax, 2 * zmin, 2 * zmax);

    // TODO: Remove if not used anymore
    // ! Unused
    // Displacement
    const disp = ijk - i - con.nx * (j + con.ny * k);
    return disp;
  }

  /**
   * Cuts a cell by the plane corresponding to the perpendicular bisector of a particle.
   * @param (x, y, z) Normal vector of the plane.
   * @param rs Squared distance of the particle that cuts the cell (length of the vector).
   * @param pId ID of the particle that cuts the cell (for neighbor tracking only).
   * @returns False if the cell has been cut away completely, true otherwise.
   */
  cutPlane(planeParams: { x: number; y: number; z: number; rs: number }, pId: number): boolean {
    // TODO: Check if it is even needed to pass in rs and pId
    const { x, y, z, rs } = planeParams;
    let complicatedSetup = false;

    console.log(
      `\nCutting plane w/: ${x.toFixed(5)} ${y.toFixed(5)} ${z.toFixed(5)} ${rs.toFixed(5)} ${pId}`
    );

    /** The initial vertex. From this one we try to find an edge that is cut by the plane. This
     * one is updated as we move along edges closer to the plane. */
    let testVert = 0;

    // Test approximately sqrt(n)/4 points for their proximity to the plane
    // and keep the one which is closest
    let { inOutOn, distRep } = this.#testPoint(planeParams, testVert);

    console.log(`First test result: ${distRep} ${inOutOn}`);

    // Starting from an initial guess, we now move from vertex to vertex, to try and find an edge
    // which intersects the cutting plane, or a vertex which is on the plane.

    /** The current index in the entry for `testVert` in `edgeInfo`.  */
    let conIdx = 0;
    /** The index of `testVert` in the entry for the connected vertex in `edgeInfo`.  */
    let conPosIdxA, conPosIdxB: number | undefined;
    /** The index of the vertex connected to `testVert`. */
    let conVertA, conVertB: number | undefined;
    /** Indicates whether the connected vertex is inside, outside or on the plane. */
    let inOutOnA, inOutOnB: number | undefined;
    /** Representation of the distance of the connected vertex to the plane. */
    let distRepA, distRepB: number | undefined;
    try {
      if (inOutOn === 1) {
        // ------------------------------------------
        // Test point is inside the cutting plane
        // ------------------------------------------

        // Find first connection that is closer to the plane
        do {
          conVertA = this.edgeInfo[testVert][conIdx];
          const result = this.#testPoint(planeParams, conVertA);
          inOutOnA = result.inOutOn;
          distRepA = result.distRep;

          // console.log(`inOutOn = 1 - testing ${conIdx}. connected vertex`);
          // console.log(`m_test result: ${distRepA} ${inOutOnA}`);

          if (distRepA < distRep) break;
          conIdx++;
        } while (conIdx < this.vertOrder[testVert]);

        // If there is no vertex that is closer to the plane, the cell is cut completely as then
        // all vertices of the cell must be within the cutting plane.
        if (conIdx === this.vertOrder[testVert]) return false;

        conPosIdxA = this.edgeInfo[testVert][this.vertOrder[testVert] + conIdx];

        // Continue iterating until a point that is not on the same side of the plane is found
        while (inOutOnA === 1) {
          distRep = distRepA;
          testVert = conVertA;

          // Try finding another point that is not only closer than `testVert` but also `conVert`
          for (conIdx = 0; conIdx < conPosIdxA; conIdx++) {
            conVertA = this.edgeInfo[testVert][conIdx];
            const result = this.#testPoint(planeParams, conVertA);
            inOutOnA = result.inOutOn;
            distRepA = result.distRep;

            if (distRepA < distRep) break;
          }

          // console.log(`In while (1): ${inOutOnA} ${distRepA}`);

          // If `conIdx === conPosIdxA`, then there was no vertex closer to the plane than `conVert`.
          // -> Look for more vertices connected to testVert (that has been set to `conVert`) until
          // vertex order is reached. If then also no other point has been found, return.
          if (conIdx === conPosIdxA) {
            conIdx++;
            while (conIdx < this.vertOrder[testVert]) {
              conVertA = this.edgeInfo[testVert][conIdx];
              const result = this.#testPoint(planeParams, conVertA);
              inOutOnA = result.inOutOn;
              distRepA = result.distRep;
              if (distRepA < distRep) break;
              conIdx++;
            }
            // No point found that is closer to the plane. Cell is cut completely.
            if (conIdx === this.vertOrder[testVert]) return false;
          }

          // Another point closer to the plane has been found. Move to that point.
          conPosIdxA = this.edgeInfo[testVert][this.vertOrder[testVert] + conIdx];
        }

        // If the last point is on the plane, enter complicated setup
        if (inOutOnA === 0) {
          testVert = conVertA;
          complicatedSetup = true;
        }
      } else if (inOutOn === -1) {
        // ------------------------------------------
        // Test point is outside of the cutting plane
        // ------------------------------------------

        // Find first connection that is closer to the plane
        do {
          conVertB = this.edgeInfo[testVert][conIdx];
          const result = this.#testPoint(planeParams, conVertB);
          inOutOnB = result.inOutOn;
          distRepB = result.distRep;

          // console.log(`inOutOn = -1 - testing ${conIdx}. connected vertex`);
          // console.log(`m_test result: ${distRepB} ${inOutOnB}`);

          if (distRep < distRepB) break;
          conIdx++;
        } while (conIdx < this.vertOrder[testVert]);

        // If there is no vertex that is closer to the plane, the cell is not cut at all as no
        // edge/vertex can is crossing the plane.
        if (conIdx === this.vertOrder[testVert]) return true;

        conPosIdxB = this.edgeInfo[testVert][this.vertOrder[testVert] + conIdx];

        // Continue iterating until a point that is not on the same side of the plane is found
        while (inOutOnB === -1) {
          distRep = distRepB;
          testVert = conVertB;

          for (conIdx = 0; conIdx < conPosIdxB; conIdx++) {
            conVertB = this.edgeInfo[testVert][conIdx];
            const result = this.#testPoint(planeParams, conVertB);
            inOutOnB = result.inOutOn;
            distRepB = result.distRep;
            if (distRep < distRepB) break;
          }

          // console.log(`In while (-1): ${inOutOnB} ${distRepB}`);

          if (conIdx === conPosIdxB) {
            conIdx++;
            while (conIdx < this.vertOrder[testVert]) {
              conVertB = this.edgeInfo[testVert][conIdx];
              const result = this.#testPoint(planeParams, conVertB);
              inOutOnA = result.inOutOn;
              distRepA = result.distRep;
              if (distRep < distRepB) break;
              conIdx++;
            }
            // No point found that is closer to the plane. Cell is not cut at all.
            if (conIdx === this.vertOrder[testVert]) return true;
          }
          conPosIdxB = this.edgeInfo[testVert][this.vertOrder[testVert] + conIdx];
        }

        if (inOutOnB === 1) {
          conVertA = testVert;
          conVertA = testVert;
          conPosIdxA = conIdx;
          distRepA = distRep;
          testVert = conVertB;
          conIdx = this.edgeInfo[conVertA][this.vertOrder[conVertA] + conPosIdxA];
          distRep = distRepB;
          complicatedSetup = false;
        } else {
          testVert = conVertB;
          complicatedSetup = true;
        }
      } else {
        // ------------------------------------------
        // Test point is on the cutting plane. Switch to the complicated setup.
        // ------------------------------------------
        complicatedSetup = true;
        conVertA = testVert;
        conPosIdxA = conIdx;
        distRepA = distRep;
        testVert = conVertB || 0;
        conIdx = this.edgeInfo[conVertA][this.vertOrder[conVertA] + conPosIdxA];
        distRep = distRepB || 0;
      }
    } catch (e) {
      console.error('An error occured: ', e);
    }

    console.log('Attributes after first iteration: ');
    console.log(`\ttestVert: ${testVert}`);
    console.log(`\tconVertA: ${conVertA}`);
    console.log(`\tconVertB: ${conVertB}`);
    console.log(`\tconIdx: ${conIdx}`);
    console.log(`\tconPosIdxA: ${conPosIdxA}`);
    console.log(`\tconPosIdxB: ${conPosIdxB}`);
    console.log(`\tinOutOn, inOutOnA, inOutOnB: ${inOutOn} ${inOutOnA} ${inOutOnB}`);
    console.log(
      `\tdistRep, distRepA, distRepB: ${distRep.toFixed(5)} ${distRepA?.toFixed(
        5
      )} ${distRepB?.toFixed(5)}`
    );

    if (complicatedSetup) {
      // TODO
    } else {
      // TODO
    }

    return true;
  }

  /**
   * Test whether a given vertex is inside, outside or on the test plane.
   * @param planeParams Parameters of the test plane.
   * @param testIndex The index of the vertex to test.
   * @returns The result of the scalar product (a distance representation of the point to the
   * plane) used in evaluating the location of the point as well as whether it is inside (-1),
   * outside (+1) or on (0) the plane.
   */
  #testPoint(
    planeParams: { x: number; y: number; z: number; rs: number },
    testIndex: number
  ): { distRep: number; inOutOn: number } {
    const distRep =
      this.verts[testIndex][0] * planeParams.x +
      this.verts[testIndex][1] * planeParams.y +
      this.verts[testIndex][2] * planeParams.z -
      planeParams.rs;

    console.log(
      `point inside? ${testIndex}: ${this.verts[testIndex][0].toFixed(5)} ${this.verts[
        testIndex
      ][1].toFixed(5)} ${this.verts[testIndex][2].toFixed(5)}     \t==> ${distRep.toFixed(5)}`
    );

    let inOutOn = 0;
    if (distRep < -tolerance) {
      inOutOn = -1;
    } else if (distRep > tolerance) {
      inOutOn = 1;
    }

    return { distRep, inOutOn };
  }
}
