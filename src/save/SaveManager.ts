import type { GameProtocol, SaveData, SaveEnvelope } from '../types';
import { createInitialSave } from '../game/content';

let config: GameProtocol;
const PREFIX = 'data-rpg-engine';
function checksum(value: string): string { let hash = 2166136261; for (let i = 0; i < value.length; i += 1) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); } return (hash >>> 0).toString(16).padStart(8, '0'); }

export class SaveManager {
  static readonly slots = ['auto', '1', '2', '3'] as const;
  static configure(content: GameProtocol): void { config = content; }
  private static key(slot: string): string { return `${PREFIX}:${config.game.id}:${slot}`; }

  static save(slot: string, data: SaveData): void {
    const serialized = JSON.stringify(data); const envelope: SaveEnvelope = { game: config.game.id, format: 4, data, checksum: checksum(serialized) };
    localStorage.setItem(this.key(slot), JSON.stringify(envelope));
  }
  static load(slot: string): SaveData | null { const raw = localStorage.getItem(this.key(slot)); return raw ? this.parse(raw) : null; }
  static parse(raw: string): SaveData {
    const parsed = JSON.parse(raw) as Partial<SaveEnvelope> & { format?: number; data?: SaveData };
    if (parsed.game !== config.game.id || !parsed.data || !parsed.checksum) throw new Error('다른 게임이거나 지원하지 않는 저장 파일입니다.');
    if (checksum(JSON.stringify(parsed.data)) !== parsed.checksum) throw new Error('저장 파일이 손상되었거나 수정되었습니다.');
    if (parsed.data.version !== 4) return this.migrateLegacy(parsed.data as unknown as Record<string, unknown>);
    return this.reconcile(parsed.data);
  }
  private static reconcile(save: SaveData): SaveData {
    const initial = createInitialSave(config);
    if (!config.maps[save.player.mapId]) { save.player.mapId = config.player.startMap; save.player.x = config.player.startX; save.player.y = config.player.startY; }
    Object.entries(initial.world.quests).forEach(([id, quest]) => { if (!save.world.quests[id]) save.world.quests[id] = quest; });
    Object.keys(save.world.quests).forEach((id) => { if (!config.quests[id]) delete save.world.quests[id]; });
    Object.keys(save.player.inventory).forEach((id) => { if (!config.items[id]) delete save.player.inventory[id]; });
    save.player.equipment ??= initial.player.equipment; save.player.skills ??= initial.player.skills; save.player.effects ??= []; save.player.currencies ??= initial.player.currencies; save.player.hotbar ??= { q: null, w: null };
    save.world.chapter ??= initial.world.chapter; save.world.endings ??= []; save.settings ??= initial.settings;
    save.contentVersion = config.game.version; return save;
  }
  private static migrateLegacy(old: Record<string, unknown>): SaveData {
    const fresh = createInitialSave(config); const player = old.player as Record<string, unknown> | undefined;
    if (player) { fresh.player.hp = Number(player.hp) || fresh.player.hp; fresh.player.x = Number(player.x) || fresh.player.x; fresh.player.y = Number(player.y) || fresh.player.y; const oldMap = String(player.mapId ?? ''); if (config.maps[oldMap]) fresh.player.mapId = oldMap; }
    fresh.playTime = Number(old.playTime) || 0; return fresh;
  }
  static export(data: SaveData): void {
    const serialized = JSON.stringify(data); const envelope: SaveEnvelope = { game: config.game.id, format: 4, data, checksum: checksum(serialized) };
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${config.game.id}-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
  }
}
