import { useVoronoiStore } from '../../../store/store';
import { Controls } from './controls';
import { Lighting } from './lighting';
import { VoronoiCube } from './voronoiCube';
import { ModelGroup } from './modelGroup';
import { InnerCube } from './innerCube';
import { BottomCutout } from './bottomCutout';
import { useMemo } from 'react';
import {
  cubeDistribution,
  fibonacciDistributionGuarded,
  sphereDistributionRestricted,
  type GuardRingOptions,
} from '../../../utils/randomDistributions';
import { BufferGeomPoints } from '../../geometries/bufferGeomPoints';

export const MyScene = () => {
  const { nPoints, size, seed, restriction, distribution } = useVoronoiStore(
    state => state.pointDistribution
  );
  const debug = useVoronoiStore(state => state.debug);
  const debugSettings = useVoronoiStore(state => state.debugSettings);
  const bottomCutoutWidth = useVoronoiStore(state => state.bottomCutoutWidth);

  const pointDistribution = useMemo(() => {
    if (nPoints < 2) return [[0, 0, 0]];
    const s = size - 0.0001;
    switch (distribution) {
      case 'fibonacci': {
        const guardOpts: GuardRingOptions = {
          guardCountMode: debugSettings.guardCountMode,
          guardCountPct: debugSettings.guardCountPct,
          guardCount: debugSettings.guardCount,
          phiGMode: debugSettings.phiGMode,
          minPhiG: debugSettings.minPhiG,
          phiG: debugSettings.phiG,
          guardRotation: debugSettings.guardRotation,
          marginFactor: debugSettings.marginFactor,
          cutoutWidth: bottomCutoutWidth,
        };
        return cubeDistribution(nPoints, s, seed + nPoints, fibonacciDistributionGuarded, [
          guardOpts,
        ]);
      }
      case 'simple':
        return cubeDistribution(nPoints, s, seed + nPoints, sphereDistributionRestricted, [
          restriction,
        ]);
    }
    return [];
  }, [nPoints, distribution, size, seed, restriction, debugSettings, bottomCutoutWidth]);

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
