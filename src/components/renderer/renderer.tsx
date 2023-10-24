import { Canvas } from '@react-three/fiber';
import { initialCameraPosition } from '../../constants';
import { MyScene } from './scene/myScene';
import './renderer.scss';
import { useVoronoiStore } from '../../store/store';

export const Renderer = () => {
  const darkMode = useVoronoiStore(state => state.darkMode);
  return (
    <div className="renderer-container">
      <Canvas
        camera={{
          position: initialCameraPosition.clone(),
        }}
      >
        <color attach="background" args={[darkMode ? '#111111' : '#e6e6e6']} />
        <MyScene />
      </Canvas>
    </div>
  );
};
