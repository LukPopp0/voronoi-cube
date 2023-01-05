import './App.scss';
import { Header } from './components/header/header';
import { Renderer } from './components/renderer/renderer';

const App = () => {
  return (
    <div className="App">
      <Header />
      <Renderer />
    </div>
  );
};

export default App;
