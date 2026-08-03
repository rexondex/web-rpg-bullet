export type BulletPatternType = 'radial' | 'aimed' | 'fan' | 'spiral' | 'rain';

export interface BulletPattern {
  type: BulletPatternType;
  intervalMs: number;
  bulletSpeed: number;
  count: number;
  color: string;
  spread?: number;
  spin?: number;
  waves?: number;
}

export interface EnemyDefinition {
  hp: number;
  speed: number;
  radius: number;
  score: number;
  color: string;
  pattern: BulletPattern;
}

export interface WaveEntry {
  atMs: number;
  enemy: string;
  count: number;
  formation: 'line' | 'v' | 'sweep-left' | 'sweep-right';
  spacing?: number;
}

export interface ShooterStage {
  id: string;
  name: string;
  subtitle: string;
  background: string;
  width: number;
  height: number;
  waves: WaveEntry[];
  introDialogue?: string;
  clearDialogue?: string;
  bossDialogue?: string;
  hasBoss?: boolean;
}

export interface ShooterDialogueLine {
  speaker: string;
  text: string;
  portrait?: string;
  side?: 'left' | 'right';
}

export interface BossPhase {
  name: string;
  hp: number;
  durationMs: number;
  patterns: BulletPattern[];
}

export interface ShooterProtocol {
  protocolVersion: 1;
  game: { id: string; title: string; subtitle: string; version: string };
  stages: ShooterStage[];
  dialogues: Record<string, ShooterDialogueLine[]>;
  player: {
    name: string;
    texture: string;
    speed: number;
    focusSpeed: number;
    lives: number;
    bombs: number;
    shotIntervalMs: number;
    shotSpeed: number;
  };
  enemies: Record<string, EnemyDefinition>;
  boss: { name: string; texture: string; radius: number; phases: BossPhase[] };
  assets: Record<string, string>;
}

export interface ShooterState {
  score: number;
  highScore: number;
  lives: number;
  bombs: number;
  power: number;
  graze: number;
  combo: number;
  bossName: string;
  bossPhase: string;
  bossHp: number;
  bossMaxHp: number;
  bossTime: number;
  paused: boolean;
  stageNumber: number;
  stageCount: number;
  stageName: string;
}

export interface DialogueRequest {
  lines: ShooterDialogueLine[];
  done: () => void;
}
