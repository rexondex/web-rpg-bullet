import type { GameProtocol, QuestProgress, QuestStatus, SaveData, Stats } from '../types';

export function createInitialSave(config: GameProtocol): SaveData {
  const quests: Record<string, QuestProgress> = {};
  Object.keys(config.quests).forEach((id) => { quests[id] = { status: 'available', objectives: Object.fromEntries(config.quests[id].objectives.map((item) => [item.id, 0])) }; });
  return { version: 4, contentId: config.game.id, contentVersion: config.game.version, savedAt: new Date().toISOString(), playTime: 0, player: { x: config.player.startX, y: config.player.startY, hp: config.player.baseStats.maxHp, level: 1, xp: 0, mapId: config.player.startMap, inventory: { ...config.player.startingItems }, equipment: Object.fromEntries(config.equipmentSlots.map((slot) => [slot.id, null])), skills: [...(config.player.startingSkills ?? [])], effects: [], currencies: Object.fromEntries(Object.entries(config.currencies).map(([id, currency]) => [id, currency.startingAmount])), hotbar: { q: null, w: null } }, world: { quests, defeated: {}, flags: {}, chapter: config.chapters[0]?.id ?? 'default', endings: [] }, settings: { musicVolume: 0.6, effectsVolume: 0.8, muted: false } };
}

export function playerStats(config: GameProtocol, level: number): Stats {
  const base = config.player.baseStats; const growth = config.player.levelGrowth;
  return { maxHp: base.maxHp + (growth.maxHp ?? 0) * (level - 1), attack: base.attack + (growth.attack ?? 0) * (level - 1), defense: base.defense + (growth.defense ?? 0) * (level - 1) };
}

export function statusLabel(status: QuestStatus): string {
  return ({ available: '수락 가능', active: '진행 중', ready: '보고 가능', completed: '완료', failed: '실패' })[status];
}
