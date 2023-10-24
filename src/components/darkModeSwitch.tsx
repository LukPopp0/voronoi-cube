import { useVoronoiStore } from '../store/store';
import darkModeSwitch from '../assets/dark-mode-switch.svg';
import darkModeSwitchLight from '../assets/dark-mode-switch-light.svg';

export const DarkModeSwitch = () => {
  const darkMode = useVoronoiStore(state => state.darkMode);
  const setDarkMode = useVoronoiStore(state => state.setDarkMode);

  return (
    <button
      style={{
        position: 'absolute',
        background: 'none',
        border: 'none',
        top: '2rem',
        right: '2rem',
      }}
      onClick={() => setDarkMode(!darkMode)}
    >
      <img
        width={40}
        height={40}
        src={darkMode ? darkModeSwitchLight : darkModeSwitch}
        alt="dark-mode-switch"
      />
    </button>
  );
};
