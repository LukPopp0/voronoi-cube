import { Controls } from './controls';
import { Lighting } from './lighting';
import { VoronoiCube } from './voronoiCube';

export const MyScene = () => {
  return (
    <>
      <Lighting />
      <Controls />
      <VoronoiCube />
    </>
  );
};
