import { useVoronoiStore } from '../../../store/store';
import { Controls } from './controls';
import { Lighting } from './lighting';
import { VoronoiCube } from './voronoiCube';
import { ModelGroup } from './modelGroup';
import { InnerCube } from './innerCube';

export const MyScene = () => {
  const { nPoints, size, seed, restriction } = useVoronoiStore(state => state.pointDistribution);

  return (
    <>
      <Lighting />
      <Controls />
      <ModelGroup>
        <VoronoiCube nPoints={nPoints} size={size} seed={seed} restriction={restriction} />
        <InnerCube />
      </ModelGroup>
    </>
  );
};
