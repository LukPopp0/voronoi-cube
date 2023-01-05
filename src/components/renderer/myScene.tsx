import { useVoronoiStore } from '../../store/store';
import { Controls } from './controls';
import { Lighting } from './lighting';
import { RandomPoints } from './randomPoints';
import { VoronoiCube } from './voronoiCube';

export const MyScene = () => {
  const { nPoints, size, seed, minDistance } = useVoronoiStore(state => state.pointDistribution);
  return (
    <>
      <Lighting />
      <Controls />
      <VoronoiCube size={size} />
      <RandomPoints nPoints={nPoints} size={size} seed={seed} minDistance={minDistance} />
    </>
  );
};
