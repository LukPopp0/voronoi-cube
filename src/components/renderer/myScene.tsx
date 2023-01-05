import { Controls } from './controls';
import { Lighting } from './lighting';
import { RandomPoints } from './randomPoints';
import { VoronoiCube } from './voronoiCube';

export const MyScene = () => {
  return (
    <>
      <Lighting />
      <Controls />
      <VoronoiCube />
      <RandomPoints seed={0} minDistance={7} />
    </>
  );
};
