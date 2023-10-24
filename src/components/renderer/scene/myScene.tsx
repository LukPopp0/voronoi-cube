import { useVoronoiStore } from '../../../store/store';
import { Controls } from './controls';
import { Lighting } from './lighting';
import { VoronoiCube } from './voronoiCube';
import { ModelGroup } from './modelGroup';
import { InnerCube } from './innerCube';

type MySceneProps = {
  rotationSpeed?: number;
};

export const MyScene = ({ rotationSpeed = 0 }: MySceneProps) => {
  const { nPoints, size, seed, restriction } = useVoronoiStore(state => state.pointDistribution);

  return (
    <>
      <Lighting />
      <Controls />
      <ModelGroup rotationSpeed={rotationSpeed}>
        <VoronoiCube nPoints={nPoints} size={size} seed={seed} restriction={restriction} />
        <InnerCube />
      </ModelGroup>
    </>
  );
};
