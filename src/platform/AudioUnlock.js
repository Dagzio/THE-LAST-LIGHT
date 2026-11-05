// AC.unlock(): called from a real tap (TAP TO PLAY, retry taps, first tap after returning).
import { Sfx } from './Sfx.js';
import { Music } from './Music.js';

export const AC = {
  unlock() {
    Sfx.wake();
    Music.sync();
  },
};
