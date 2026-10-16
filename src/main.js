import './styles.css';

// Paint the shared shell first; game and native-only adapters load as separate chunks.
// The Three.js world is the same module on Windows, mobile web and Android.
import('./game.js').catch((error) => {
  console.error('Beyond Destination could not start.', error);
  const screen = document.getElementById('errorScreen');
  screen.textContent = 'The game could not start. Please use a browser with WebGL 2 or an up-to-date Android System WebView, then reload. Existing saves have not been replaced.';
  screen.hidden = false;
});
