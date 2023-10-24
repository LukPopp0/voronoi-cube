import { Canvas, useThree } from '@react-three/fiber';
import { initialCameraPosition } from '../../constants';
import { MyScene } from './scene/myScene';
import './renderer.scss';
import { useVoronoiStore } from '../../store/store';
import { useEffect } from 'react';
import { Scene } from 'three';

const ThreeSetter = ({ passScene }: { passScene: (scene: Scene) => void }) => {
  const { scene } = useThree();
  useEffect(() => {
    console.log('setting three');
    passScene(scene);
  }, [scene, passScene]);
  return <></>;
};

export const Renderer = ({ passScene }: { passScene: (scene: Scene) => void }) => {
  const darkMode = useVoronoiStore(state => state.darkMode);

  return (
    <div className="renderer-container">
      <Canvas
        camera={{
          position: initialCameraPosition.clone(),
        }}
      >
        <color attach="background" args={[darkMode ? '#111111' : '#e6e6e6']} />
        <ThreeSetter passScene={passScene} />
        <MyScene />
      </Canvas>
    </div>
  );
};
