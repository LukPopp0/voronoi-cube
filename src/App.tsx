import { useState } from 'react';
import './App.scss';
import { DarkModeSwitch } from './components/darkModeSwitch';
import { Header } from './components/header/header';
import { Renderer } from './components/renderer/renderer';
import { Settings } from './components/settings/settings';
import { useVoronoiStore } from './store/store';
import { Scene } from 'three';
import { SceneContext } from './hooks/sceneContext';

const App = () => {
  const darkMode = useVoronoiStore(state => state.darkMode);
  const [scene, setScene] = useState<Scene>();

  return (
    <div className={`App ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      <SceneContext.Provider value={scene || {}}>
        <Renderer passScene={setScene} />
        <Header />
        <Settings />
        <DarkModeSwitch />
      </SceneContext.Provider>
    </div>
  );
};

export default App;
