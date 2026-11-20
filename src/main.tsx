/* @refresh reload */
import { render } from 'solid-js/web';
import './index.css';
import App from './App';
import { handleRedirectCallback } from './store/trakt';

// If we returned from a Trakt login, finish the exchange before rendering.
handleRedirectCallback();

const root = document.getElementById('root');
if (root) render(() => <App />, root);
