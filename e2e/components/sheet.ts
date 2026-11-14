/** The production bar, mounted by itself; only its content and surrounding layout are fixtures. */
import { createDeepTimeBar } from '../../src/ui/deepTimeBar';
import '../../src/style.css';
import './sheet.css';

const nothing = () => undefined;
const bar = createDeepTimeBar({
  why: (_id, label) => {
    const button = document.createElement('button');
    button.textContent = label;
    return button;
  },
  explain: nothing,
  onMa: nothing,
  onPlay: nothing,
  onSpeed: nothing,
  onTemperature: nothing,
  onSeaLevel: nothing,
  onLayer: nothing,
  onAir: nothing,
  onCo2Archive: nothing,
  onCoast: nothing,
  onSeaIce: nothing,
  onTemperatureModel: nothing,
  onTemperatureShow: nothing,
  onSketch: nothing,
});
const details = bar.root.querySelector<HTMLElement>('.deep-details');
if (details === null) throw new Error('The production bar has no folding details');
const content = document.createElement('div');
content.className = 'sheet-fixture-content';
content.textContent = 'Fixed detail content for measuring the real sheet geometry.';
details.replaceChildren(content);
bar.root.hidden = false;
document.body.append(bar.root);
