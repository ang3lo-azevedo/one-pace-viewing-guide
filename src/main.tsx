/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import App from './App';
import { handleRedirectCallback, initTrakt } from './store/trakt';

// Finish a Trakt login if we just came back from it, then load the episode map and ratings.
handleRedirectCallback().then(initTrakt);

const root = document.getElementById('root');
if (root) render(() => <App />, root);

// Installable app + offline support (production builds only, so dev reloads stay fresh).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
