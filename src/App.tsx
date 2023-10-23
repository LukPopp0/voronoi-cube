import './App.scss';
import { Header } from './components/header/header';
import { Renderer } from './components/renderer/renderer';
import { Settings } from './components/settings/settings';

const App = () => {
  return (
    <div className="App">
      <Renderer />
      <Header />
      <Settings />
    </div>
  );
};

export default App;
