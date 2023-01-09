import { useVoronoiStore } from '../../../store/store';
import { Controls } from './controls';
import { Lighting } from './lighting';
import { RandomPoints } from './randomPoints';
import { VoronoiCube } from './voronoiCube';
import { ModelGroup } from './modelGroup';

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
        <VoronoiCube size={size} />
        <RandomPoints nPoints={nPoints} size={size} seed={seed} restriction={restriction} />
      </ModelGroup>
    </>
  );
};
