import { beforeEach, describe, expect, it } from 'vitest';
import { SaveManager } from './SaveManager';
import type { SaveData } from '../types';
import gameData from '../../public/game-data/game.json';
import type { GameProtocol } from '../types';

const data: SaveData = { version: 4, contentId: 'starlight-valley', contentVersion: '1.0.0', savedAt: '2026-08-02T00:00:00.000Z', playTime: 42, player: { x: 10, y: 20, hp: 88, level: 2, xp: 35, mapId: 'meadow', inventory: { potion: 1 }, equipment: { weapon: null, armor: null, accessory: null }, skills: ['power_strike'], effects: [], currencies: { gold: 75 }, hotbar: { q: { type: 'item', id: 'potion' }, w: null } }, world: { quests: { slime_cleanup: { status: 'active', objectives: { slimes: 1 } } }, defeated: { green_slime: 1 }, flags: {}, chapter: 'prologue', endings: [] }, settings: { musicVolume: 0.6, effectsVolume: 0.8, muted: false } };

const memory = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { value: {
  clear: () => memory.clear(),
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
} });

beforeEach(() => { localStorage.clear(); SaveManager.configure(gameData as GameProtocol); });
describe('SaveManager', () => {
  it('슬롯에 저장하고 콘텐츠의 신규 퀘스트를 보충해 읽는다', () => { SaveManager.save('1', data); expect(SaveManager.load('1')).toMatchObject(data); expect(SaveManager.load('1')?.world.quests.forest_message).toBeDefined(); });
  it('변조된 파일을 거부한다', () => { SaveManager.save('1', data); const raw = localStorage.getItem('data-rpg-engine:starlight-valley:1')!.replace('"hp":88', '"hp":99'); expect(() => SaveManager.parse(raw)).toThrow('손상'); });
});
