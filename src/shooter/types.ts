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
  pickupChance: number;
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
  nextStage?: string;
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
  rules: {
    playfield: { width:number; height:number };
    pools: { playerShots:number; enemyBullets:number; enemies:number; pickups:number };
    playerHitboxRadius: number;
    grazeRadius: number;
    hitInvulnerabilityMs: number;
    bombInvulnerabilityMs: number;
    bombDamage: number;
    deathPowerLoss: number;
    respawnBombs: number;
    bulletCullMargin: number;
    pickupFallSpeed: number;
  };
  scoring: {
    grazeBase: number;
    pickup: number;
    bombBulletClear: number;
    bossCapture: number;
    bossTimeout: number;
    bossTimeMultiplier: number;
    clearPerLife: number;
    clearPerBomb: number;
  };
  ui: {
    eyebrow: string;
    brandKicker: string;
    brandTitle: string;
    brandCaption: string;
    pauseButton: string;
    pauseTitle: string;
    pauseHelp: string;
    loading: string;
    stageProgress: string;
    guideTitle: string;
    guide: { label:string; value:string }[];
    guideTip: string;
    labels: { highScore:string; score:string; player:string; bomb:string; power:string; graze:string; chain:string };
    mobile: { focus:string; shot:string; bomb:string };
    stageClear: string;
    stageClearTitle: string;
    gameOver: string;
    gameOverTitle: string;
    retry: string;
    nextDialogue: string;
    startBattle: string;
    messages: { miss:string; respawn:string; lastLife:string; bomb:string; bombCleared:string; bossWarning:string };
  };
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
    spawnX: number;
    spawnBottom: number;
    maxPower: number;
    shotLevels: { power:number; offsets:number[]; damage:number; velocityXScale?:number }[];
  };
  enemies: Record<string, EnemyDefinition>;
  boss: { name: string; texture: string; radius: number; movement:{ spawnX:number; spawnY:number; enterY:number; enterSpeed:number; amplitudeX:number; periodMs:number }; phases: BossPhase[] };
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
