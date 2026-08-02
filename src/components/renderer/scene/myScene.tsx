import { useVoronoiStore } from '../../../store/store';
import { Controls } from './controls';
import { Lighting } from './lighting';
import { VoronoiCube } from './voronoiCube';
import { ModelGroup } from './modelGroup';
import { InnerCube } from './innerCube';
import { BottomCutout } from './bottomCutout';
import { useMemo } from 'react';
import { generatePoints } from '@/utils/distributions/generatePoints';
import { BufferGeomPoints } from '../../geometries/bufferGeomPoints';

export const MyScene = () => {
  const { nPoints, size, seed, restriction, distribution } = useVoronoiStore(
    state => state.pointDistribution
  );
  const debug = useVoronoiStore(state => state.debug);
  const debugSettings = useVoronoiStore(state => state.debugSettings);
  const bottomCutoutWidth = useVoronoiStore(state => state.bottomCutoutWidth);

  const pointDistribution = useMemo(
    () =>
      generatePoints(
        { nPoints, size, seed, restriction, distribution },
        debugSettings,
        bottomCutoutWidth,
      ),
    [nPoints, distribution, size, seed, restriction, debugSettings, bottomCutoutWidth],
  );

  return (
    <>
      <Lighting />
      <Controls />
      <ModelGroup>
        <VoronoiCube points={pointDistribution.flat()} size={size} />
        <InnerCube size={size} />
        <BottomCutout size={size} />
      </ModelGroup>
      {debug && (
        <>
          <axesHelper args={[size / 2]} />
          <BufferGeomPoints positions={new Float32Array(pointDistribution.flat())}>
            <pointsMaterial color={'#00ffff'} />
          </BufferGeomPoints>
        </>
      )}
    </>
  );
};
