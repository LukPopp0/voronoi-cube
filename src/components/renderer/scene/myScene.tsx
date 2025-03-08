import { useVoronoiStore } from '../../../store/store';
import { Controls } from './controls';
import { Lighting } from './lighting';
import { VoronoiCube } from './voronoiCube';
import { ModelGroup } from './modelGroup';
import { InnerCube } from './innerCube';
import { useMemo } from 'react';
import { randomInRect } from '../../../utils/randomDistributions';
import { BufferGeomPoints } from '../../geometries/bufferGeomPoints';

export const MyScene = () => {
  const { nPoints, size, seed } = useVoronoiStore(state => state.pointDistribution);
  const debug = useVoronoiStore(state => state.debug);

  const pointDistribution = useMemo(() => {
    const pointsPerFace = Math.floor(nPoints / 6);
    // First #missingPoints faces will get one extra point
    const missingPoints = nPoints - pointsPerFace * 6;
    console.log({ pointsPerFace, missingPoints });
    // Create random points
    const pointsOnCube: number[][][] = [];
    for (let fi = 0; fi < 6; ++fi) {
      pointsOnCube.push(
        randomInRect(pointsPerFace + (fi < missingPoints ? 1 : 0), size, size, seed + fi)
      );
    }

    // Unfolded cube:
    // 1   2   3
    //     4
    //     5
    //     6

    // Move points to side of cube
    // Bottom
    pointsOnCube[0] = pointsOnCube[0].map(p => [p[0], -size / 2, p[1]]);
    // Top
    pointsOnCube[1] = pointsOnCube[1].map(p => [p[0], size / 2, p[1]]);
    // Left
    pointsOnCube[2] = pointsOnCube[2].map(p => [-size / 2, p[0], p[1]]);
    // Right
    pointsOnCube[3] = pointsOnCube[3].map(p => [size / 2, p[0], p[1]]);
    // Front
    pointsOnCube[4] = pointsOnCube[4].map(p => [p[0], p[1], -size / 2]);
    // Back
    pointsOnCube[5] = pointsOnCube[5].map(p => [p[0], p[1], size / 2]);

    console.log({ pointsOnCube });
    return pointsOnCube;
  }, [nPoints, seed, size]);

  return (
    <>
      <Lighting />
      <Controls />
      <ModelGroup>
        {/* <VoronoiCube points={pointDistribution.flat()} size={size} /> */}
        <InnerCube size={size} />
      </ModelGroup>
      {debug && (
        <>
          <axesHelper args={[size / 2]} />
          <BufferGeomPoints positions={new Float32Array(pointDistribution.flat(3))}>
            <pointsMaterial color={'#00ffff'} />
          </BufferGeomPoints>
        </>
      )}
    </>
  );
};
