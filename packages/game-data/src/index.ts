import type { GameState } from '../../contracts/src/index.js';
export interface GameDataProvider { getScoreboard(): Promise<readonly GameState[]> }
