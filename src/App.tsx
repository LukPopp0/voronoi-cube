import './App.scss';
import { Header } from './components/header/header';
import { Renderer } from './components/renderer/renderer';
import { Settings } from './components/settings/settings';

const App = () => {
  return (
    <div className="App">
      <Header />
      <Settings />
      <Renderer />
    </div>
  );
};

export default App;
