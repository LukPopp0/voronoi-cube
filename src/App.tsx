import './App.scss';
import { DarkModeSwitch } from './components/darkModeSwitch';
import { Header } from './components/header/header';
import { Renderer } from './components/renderer/renderer';
import { Settings } from './components/settings/settings';
import { useVoronoiStore } from './store/store';

const App = () => {
  const darkMode = useVoronoiStore(state => state.darkMode);
  return (
    <div className={`App ${darkMode ? 'dark-theme' : 'light-theme'}`}>
      <Renderer />
      <Header />
      <Settings />
      <DarkModeSwitch />
    </div>
  );
};

export default App;
