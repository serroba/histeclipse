import './style.css';

import { startApp } from './app';
import { errorMessage } from './util/errors';

const root = document.querySelector<HTMLElement>('#app');
if (root === null) {
  throw new Error('Missing #app root element');
}

startApp(root).catch((error: unknown) => {
  const message = document.createElement('p');
  message.className = 'fatal';
  message.textContent = `Something went wrong while loading: ${errorMessage(error)}`;
  root.replaceChildren(message);
  console.error(error);
});
