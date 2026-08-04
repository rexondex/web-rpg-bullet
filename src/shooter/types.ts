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

export type MovementDefinition =
  | { type:'linear'; velocityX?:number; velocityY:number }
  | { type:'sine'; centerX:number; amplitudeX:number; periodMs:number; enterY:number; enterSpeed:number }
  | { type:'stationary'; x:number; y:number };

export type FormationDefinition =
  | { type:'line'|'v'; spacing?:number }
  | { type:'sweep'; direction:'left'|'right'; spacing?:number; stepY?:number };

export type PlayerShotPattern =
  | { type:'parallel'; offsets:number[]; damage:number; velocityXScale?:number }
  | { type:'fan'; count:number; spread:number; damage:number };

export type BombBehavior = { type:'clear-and-damage'; damage:number; invulnerabilityMs:number } | { type:'clear-only'; invulnerabilityMs:number };

export interface EnemyDefinition {
  hp: number;
  speed: number;
  radius: number;
  score: number;
  color: string;
  texture?: string;
  movement?: MovementDefinition;
  patterns: BulletPattern[];
  pickupChance: number;
}

export interface WaveEntry {
  atMs: number;
  enemy: string;
  count: number;
  formation: FormationDefinition;
}

export interface ShooterStage {
  id: string;
  name: string;
  subtitle: string;
  background: string;
  backgroundPresentation?: { fit:'cover'|'stretch'; focusX?:number; focusY?:number; alpha?:number };
  width: number;
  height: number;
  waves: WaveEntry[];
  introDialogue?: string;
  clearDialogue?: string;
  bossDialogue?: string;
  bossId?: string;
  nextStage?: string;
}

export interface ShooterDialogueLine {
  speaker: string;
  text: string;
  portrait?: string;
  side?: 'left' | 'right';
}

export interface PlayerDefinition {
  name: string;
  description: string;
  portrait?: string;
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
  shotName: string;
  bombName: string;
  shotLevels: ({ power:number } & PlayerShotPattern)[];
  bomb: BombBehavior;
  selection: { archetype:string; accent:string; ratings:{ speed:number; power:number; range:number } };
}

export interface BossPhase {
  name: string;
  hp: number;
  durationMs: number;
  patterns: BulletPattern[];
}

export interface BossDefinition {
  name: string;
  texture: string;
  radius: number;
  tint?: string;
  spawn: { x:number; y:number };
  movement: MovementDefinition;
  phases: BossPhase[];
}

export interface ShooterProtocol {
  protocolVersion: 2;
  capabilities: string[];
  game: { id: string; title: string; subtitle: string; version: string; defaultPlayer: string; entryStage: string };
  rules: {
    playfield: { width:number; height:number };
    pools: { playerShots:number; enemyBullets:number; enemies:number; pickups:number };
    playerHitboxRadius: number;
    grazeRadius: number;
    hitInvulnerabilityMs: number;
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
    dialogueHint: string;
    dialogue?: { showProgress: boolean };
    retryHint: string;
    title: {
      kicker:string; heading:string; description:string; selectCharacter:string; controls:string; leaderboard:string;
      noScores:string; start:string; quickRetry:string; returnToTitle:string; clearScores:string;
      leaderboardLimit?:number;
      stats?: { speed:string; power:string; range:string; lives:string; bombs:string };
    };
    messages: { miss:string; respawn:string; lastLife:string; bomb:string; bombCleared:string; bossWarning:string };
  };
  stages: ShooterStage[];
  dialogues: Record<string, ShooterDialogueLine[]>;
  players: Record<string, PlayerDefinition>;
  enemies: Record<string, EnemyDefinition>;
  bosses: Record<string, BossDefinition>;
  assets: Record<string, string>;
  persistence?: {
    autosaveIntervalMs: number;
    storageKey?: string;
  };
}

export interface ShooterEntityState {
  kind: 'enemy'|'boss'|'enemyBullet'|'playerShot'|'pickup';
  definitionId?: string;
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  hp?: number;
  damage?: number;
  tint?: number;
  grazed?: boolean;
  firedAgoMs?: number;
  patternElapsedMs?: Record<string,number>;
  angleSeed?: number;
}

/** 게임 데이터와 함께 저장·이식되는 가변 실행 상태입니다. 모든 시간은 복원 시계를 기준으로 한 상대값입니다. */
export interface ShooterRuntimeState {
  schemaVersion: 1;
  savedAt: string;
  playerId: string;
  stageId: string;
  stageElapsedMs: number;
  waveIndex: number;
  bossTriggered: boolean;
  player: { x:number; y:number; score:number; lives:number; bombs:number; power:number; graze:number; combo:number; comboRemainingMs:number; invulnerableRemainingMs:number };
  boss: { definitionId:string; phase:number; hp:number; phaseElapsedMs:number; patternElapsedMs:Record<string,number> } | null;
  entities: ShooterEntityState[];
}

/** 배포용 콘텐츠와 진행 상태가 하나의 JSON 뼈대를 이루는 저장 문서입니다. */
export interface ShooterGameDocument extends ShooterProtocol {
  runtime?: ShooterRuntimeState;
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
  playerId: string;
  playerName: string;
}

export interface DialogueRequest {
  lines: ShooterDialogueLine[];
  done: () => void;
}

export interface ScoreEntry {
  id: string;
  score: number;
  graze: number;
  cleared: boolean;
  playerId: string;
  playerName: string;
  recordedAt: string;
}
