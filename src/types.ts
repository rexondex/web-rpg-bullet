export type QuestStatus = 'available' | 'active' | 'ready' | 'completed' | 'failed';
export type ConditionOperator = 'eq' | 'gte' | 'lte';

export interface Condition {
  type: 'questStatus' | 'objective' | 'level' | 'hasItem' | 'flag' | 'currency' | 'equipped' | 'chapter';
  id: string;
  value: string | number | boolean;
  operator?: ConditionOperator;
}

export interface Action {
  type: 'startQuest' | 'completeQuest' | 'failQuest' | 'objective' | 'giveItem' | 'takeItem' | 'heal' | 'setFlag' | 'xp' | 'teleport' | 'currency' | 'learnSkill' | 'effect' | 'cutscene' | 'chapter' | 'ending';
  id?: string;
  objectiveId?: string;
  amount?: number;
  value?: boolean;
  mapId?: string;
  x?: number;
  y?: number;
  durationMs?: number;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  text: string[];
  portrait?: string;
  conditions?: Condition[];
  choices?: { text: string; next?: string; actions?: Action[]; conditions?: Condition[] }[];
  next?: string;
  actions?: Action[];
}

export interface GameProtocol {
  protocolVersion: 3;
  game: { id: string; title: string; subtitle: string; version: string; autosaveSeconds: number };
  assets: {
    images: Record<string, { src: string }>;
    spritesheets: Record<string, { src: string; frameWidth: number; frameHeight: number }>;
    audio: Record<string, { src: string[]; volume?: number; loop?: boolean }>;
    animations?: Record<string, { texture: string; start: number; end: number; frameRate: number; repeat?: number }>;
  };
  player: { name: string; texture: string; animation?: string; portrait?: string; scale?: number; startMap: string; startX: number; startY: number; baseStats: Stats; levelGrowth: Partial<Stats>; xpCurve: number[]; startingItems: Record<string, number>; startingSkills?: string[] };
  combat: { attackCooldownMs: number; invulnerabilityMs: number; attackRange: number; lootPickupRange?: number };
  items: Record<string, { name: string; description: string; icon?: string; type: 'consumable' | 'quest' | 'material' | 'equipment'; slot?: string; modifiers?: Partial<Stats>; maxStack: number; value: number; actions?: Action[] }>;
  equipmentSlots: { id: string; label: string }[];
  skills: Record<string, { name: string; description: string; icon?: string; effect?: 'burst' | 'slash' | 'ring'; effectColor?: string; cooldownMs: number; range: number; power: number; cost?: number; target: 'enemy' | 'self'; actions?: Action[] }>;
  effects: Record<string, { name: string; durationMs: number; tickMs?: number; modifiers?: Partial<Stats>; damagePerTick?: number; healPerTick?: number }>;
  monsters: Record<string, { name: string; texture: string; scale?: number; stats: Stats; speed: number; aggroRange: number; xp: number; boss?: boolean; patterns?: { id: string; hpBelow?: number; cooldownMs: number; type: 'chase' | 'dash' | 'area'; power: number }[]; drops: { itemId: string; chance: number; min: number; max: number }[] }>;
  quests: Record<string, { title: string; giver: string; summary: string; objectives: { id: string; label: string; type: 'kill' | 'talk' | 'visit' | 'collect' | 'custom'; target: number; targetId: string }[]; rewards: { xp?: number; items?: Record<string, number> }; success: string; failure: string }>;
  npcs: Record<string, { name: string; texture: string; portrait?: string; scale?: number; color?: string; dialogue: string; shop?: string }>;
  shops: Record<string, { name: string; currency: string; sellMultiplier?: number; items: { itemId: string; buy: number; sell?: number }[] }>;
  currencies: Record<string, { name: string; symbol: string; startingAmount: number }>;
  dialogues: Record<string, DialogueNode[]>;
  cutscenes: Record<string, { steps: { type: 'text' | 'wait' | 'camera' | 'action'; text?: string; durationMs?: number; x?: number; y?: number; zoom?: number; actions?: Action[] }[] }>;
  chapters: { id: string; title: string; conditions?: Condition[] }[];
  endings: Record<string, { title: string; text: string[]; conditions?: Condition[] }>;
  maps: Record<string, MapDefinition>;
}

export interface Stats { maxHp: number; attack: number; defense: number }
export type Direction = 'north' | 'east' | 'south' | 'west';
export type Point = { x: number; y: number };
export interface MapDefinition { name: string; subtitle: string; grid: { x: number; y: number }; ground: string; path: string; pathOverlay?: boolean; backgroundImage?: string; backgroundAlpha?: number; music?: string; tiled?: { json: string; tilesets: { name: string; image: string }[]; collisionLayer?: string }; spawn: { x: number; y: number }; walkableAreas?: { id: string; name: string; points: Point[] }[]; npcs: { npcId: string; x: number; y: number; route?: { x: number; y: number }[]; routeDurationMs?: number }[]; objects?: { id: string; name: string; texture?: string; visible?: boolean; x: number; y: number; width: number; height: number; solid?: boolean; conditions?: Condition[]; actions?: Action[] }[]; exits: { direction: Direction; x: number; y: number; width: number; height: number; to: string; label: string; targetX?: number; targetY?: number; conditions?: Condition[]; lockedText?: string }[]; spawns: { id: string; monsterId: string; x: number; y: number; width: number; height: number; max: number; respawnMs: number }[] }
export interface QuestProgress { status: QuestStatus; objectives: Record<string, number>; rewarded?: boolean }
export interface ActiveEffect { id: string; expiresAt: number; nextTick: number }
export interface SaveData {
  version: 4;
  contentId: string;
  contentVersion: string;
  savedAt: string;
  playTime: number;
  player: { x: number; y: number; hp: number; level: number; xp: number; mapId: string; inventory: Record<string, number>; equipment: Record<string, string | null>; skills: string[]; effects: ActiveEffect[]; currencies: Record<string, number>; hotbar: Record<'q' | 'w', { type: 'item' | 'skill'; id: string } | null> };
  world: { quests: Record<string, QuestProgress>; defeated: Record<string, number>; flags: Record<string, boolean>; chapter: string; endings: string[] };
  settings: { musicVolume: number; effectsVolume: number; muted: boolean };
}
export interface SaveEnvelope { game: string; format: 4; data: SaveData; checksum: string }
