/// <reference lib="webworker" />

import { TickerMessage, TickerRenderer } from './ticker-renderer';

let renderer: TickerRenderer | null = null;

addEventListener('message', ({ data }: MessageEvent<TickerMessage>) => {
  switch (data.type) {
    case 'init':
      renderer = new TickerRenderer(data.canvas);
      renderer.setColors(data.colors);
      renderer.setSpeed(data.speed);
      renderer.resize(data.cssW, data.cssH, data.dpr);
      renderer.start();
      break;

    case 'resize':
      renderer?.resize(data.cssW, data.cssH, data.dpr);
      break;

    case 'colors':
      renderer?.setColors(data.colors);
      break;

    case 'chips':
      renderer?.setChips(data.chips);
      break;

    case 'values':
      renderer?.setValues(data.values);
      break;

    case 'stop':
      renderer?.stop();
      renderer = null;
      break;
  }
});
