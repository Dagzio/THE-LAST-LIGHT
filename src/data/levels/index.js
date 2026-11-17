// KILL LIST (D78): the campaign's levels in order. The design plans 20 levels in 5 locations (NEW/NEW GAME.docx);
// step 1 (user decision 2026-11-16) has one location — the office — with one level. A new level = a new data file
// added here (`next` id optional; otherwise the next one in the list).
import { OFFICE } from './office.js';
import { TRAINING } from './training.js';

// D88: the training ground first (always open), then the office
export const LEVELS = [TRAINING, OFFICE];

export const getLevel = (id) => LEVELS.find((l) => l.id === id) || null;
