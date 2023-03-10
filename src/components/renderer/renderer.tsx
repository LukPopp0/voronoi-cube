import { Canvas } from '@react-three/fiber';
import { initialCameraPosition } from '../../constants';
import { MyScene } from './myScene';
import './renderer.scss';

export const Renderer = () => {
  return (
    <div className="renderer-container">
      <Canvas
        frameloop="demand"
        camera={{
          position: initialCameraPosition.clone(),
        }}
      >
        <color attach="background" args={['#e6e6e6']} />
        <MyScene />
      </Canvas>
    </div>
  );
};
