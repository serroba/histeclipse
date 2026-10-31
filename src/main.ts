import './style.css';

import { astronomicalYear, formatYear } from './time/year';

const app = document.querySelector<HTMLDivElement>('#app');
if (app === null) {
  throw new Error('Missing #app root element');
}

const heading = document.createElement('h1');
heading.textContent = 'histeclipse';
const subtitle = document.createElement('p');
subtitle.textContent = `Eclipses from ${formatYear(astronomicalYear(-1999))} to ${formatYear(astronomicalYear(3000))}. Coming soon.`;
app.replaceChildren(heading, subtitle);
