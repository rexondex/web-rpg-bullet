import Phaser from 'phaser';
import type { BossDefinition, BulletPattern, EnemyDefinition, FormationDefinition, MovementDefinition, PlayerDefinition, ShooterProtocol, ShooterRuntimeState, ShooterState, WaveEntry } from './types';

type EnemySprite = Phaser.Physics.Arcade.Sprite & { firedAt?: number; definition?: EnemyDefinition; definitionId?: string; phase?: number; angleSeed?: number };
type BulletSprite = Phaser.Physics.Arcade.Image & { grazed?: boolean };

export class BulletHellScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShots!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'up'|'down'|'left'|'right'|'focus'|'shoot'|'bomb'|'pause', Phaser.Input.Keyboard.Key>;
  private stageStartedAt = 0;
  private currentStageIndex = 0;
  private lastShot = 0;
  private invulnerableUntil = 0;
  private score = 0;
  private highScore = 0;
  private lives = 0;
  private bombs = 0;
  private power = 1;
  private graze = 0;
  private combo = 0;
  private comboUntil = 0;
  private waveIndex = 0;
  private stageTransitioning = false;
  private bossTriggered = false;
  private cinematic = false;
  private stageBackground!: Phaser.GameObjects.Image;
  private boss: EnemySprite | null = null;
  private currentBossId = '';
  private bossPhase = -1;
  private bossPhaseHp = 0;
  private bossPhaseStarted = 0;
  private bossPhaseTransitioning = false;
  private ended = false;
  private isPaused = false;
  private patternTimers = new Map<string, number>();
  private lastStateEmitAt = -Infinity;
  private highScoreDirty = false;
  private selectedPlayerId: string;
  private pendingRuntime?: ShooterRuntimeState;

  constructor(private config: ShooterProtocol) { super('bullet-hell'); this.selectedPlayerId = config.game.defaultPlayer; }
  private get playerConfig(): PlayerDefinition { return this.config.players[this.selectedPlayerId] ?? this.config.players[this.config.game.defaultPlayer]; }
  private get playWidth(): number { return this.config.rules.playfield.width; }
  private get playHeight(): number { return this.config.rules.playfield.height; }
  private get playerSpawnX(): number { return this.playerConfig.spawnX; }
  private get playerSpawnY(): number { return this.playHeight - this.playerConfig.spawnBottom; }
  private get bossConfig(): BossDefinition | undefined { return this.config.bosses[this.currentBossId]; }

  init(data?: { playerId?:string; runtime?:ShooterRuntimeState }): void {
    this.pendingRuntime = data?.runtime;
    const playerId = data?.runtime?.playerId ?? data?.playerId;
    if (playerId && this.config.players[playerId]) this.selectedPlayerId = playerId;
  }

  preload(): void {
    Object.entries(this.config.assets).forEach(([id, src]) => this.load.image(id, src));
  }

  create(): void {
    this.resetRunState();
    this.createTextures();
    this.physics.world.resume();
    this.physics.world.setBounds(0, 0, this.playWidth, this.playHeight);
    this.drawStage();
    const pools = this.config.rules.pools;
    this.playerShots = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize:pools.playerShots, runChildUpdate:false });
    this.enemyBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize:pools.enemyBullets, runChildUpdate:false });
    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize:pools.enemies, runChildUpdate:false });
    this.pickups = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize:pools.pickups, runChildUpdate:false });
    this.player = this.physics.add.sprite(this.playerSpawnX, this.playerSpawnY, this.playerConfig.texture).setScale(.28).setDepth(8);
    const hitbox = this.config.rules.playerHitboxRadius;
    this.player.setCollideWorldBounds(true).setCircle(hitbox, Math.max(0, this.player.width / 2 - hitbox), Math.max(0, this.player.height / 2 - hitbox));
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.keyboard!.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
    ]);
    this.keys = this.input.keyboard!.addKeys({ up:'W', down:'S', left:'A', right:'D', focus:'SHIFT', shoot:'Z', bomb:'X', pause:'P' }) as typeof this.keys;
    this.physics.add.overlap(this.playerShots, this.enemies, (shot, enemy) => this.hitEnemy(shot as Phaser.Types.Physics.Arcade.GameObjectWithBody, enemy as Phaser.Types.Physics.Arcade.GameObjectWithBody));
    this.physics.add.overlap(this.player, this.enemyBullets, (player, bullet) => this.hitPlayer(player as Phaser.Types.Physics.Arcade.GameObjectWithBody, bullet as Phaser.Types.Physics.Arcade.GameObjectWithBody));
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => this.hitPlayer(player as Phaser.Types.Physics.Arcade.GameObjectWithBody, enemy as Phaser.Types.Physics.Arcade.GameObjectWithBody));
    this.physics.add.overlap(this.player, this.pickups, (player, pickup) => this.collectPickup(player as Phaser.Types.Physics.Arcade.GameObjectWithBody, pickup as Phaser.Types.Physics.Arcade.GameObjectWithBody));
    this.highScore = Number(localStorage.getItem(`${this.config.game.id}:high-score`) ?? 0);
    this.time.addEvent({ delay:2000, loop:true, callback:()=>this.persistHighScore() });
    const runtime = this.pendingRuntime; this.pendingRuntime = undefined;
    this.time.delayedCall(120, () => runtime ? this.restoreRuntime(runtime) : this.startStage(Math.max(0,this.config.stages.findIndex(stage=>stage.id===this.config.game.entryStage))));
    if(this.config.persistence)this.time.addEvent({ delay:this.config.persistence.autosaveIntervalMs, loop:true, callback:()=>this.requestAutosave() });
    this.events.emit('pause', false);
    this.emitState(true);
  }

  private resetRunState(): void {
    this.stageStartedAt = 0;
    this.currentStageIndex = 0;
    this.lastShot = 0;
    this.invulnerableUntil = 0;
    this.score = 0;
    this.lives = this.playerConfig.lives;
    this.bombs = this.playerConfig.bombs;
    this.power = 1;
    this.graze = 0;
    this.combo = 0;
    this.comboUntil = 0;
    this.waveIndex = 0;
    this.stageTransitioning = false;
    this.bossTriggered = false;
    this.cinematic = false;
    this.boss = null;
    this.currentBossId = '';
    this.bossPhase = -1;
    this.bossPhaseHp = 0;
    this.bossPhaseStarted = 0;
    this.bossPhaseTransitioning = false;
    this.ended = false;
    this.isPaused = false;
    this.patternTimers.clear();
    this.lastStateEmitAt = -Infinity;
    this.highScoreDirty = false;
  }

  update(time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause) && !this.ended) this.togglePause();
    if (this.isPaused || this.ended || this.cinematic) return;
    this.updatePlayer(time);
    this.updateStage(time);
    this.updateEnemies(time, delta);
    this.updateBullets();
    this.updateGraze(time);
    if (this.combo && time > this.comboUntil) this.combo = 0;
    this.emitState();
  }

  private updatePlayer(time: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const x = Number(this.cursors.right.isDown || this.keys.right.isDown) - Number(this.cursors.left.isDown || this.keys.left.isDown);
    const y = Number(this.cursors.down.isDown || this.keys.down.isDown) - Number(this.cursors.up.isDown || this.keys.up.isDown);
    const movement = new Phaser.Math.Vector2(x, y);
    const focused = this.keys.focus.isDown;
    if (movement.lengthSq()) movement.normalize().scale(focused ? this.playerConfig.focusSpeed : this.playerConfig.speed);
    body.setVelocity(movement.x, movement.y);
    this.player.setAlpha(time < this.invulnerableUntil && Math.floor(time / 80) % 2 ? .25 : 1);
    (this.children.getByName('hitbox') as Phaser.GameObjects.Arc | null)?.setVisible(focused).setPosition(this.player.x, this.player.y);
    if (this.keys.shoot.isDown && time - this.lastShot >= this.playerConfig.shotIntervalMs) this.shoot(time);
    if (Phaser.Input.Keyboard.JustDown(this.keys.bomb)) this.useBomb(time);
  }

  private updateStage(time: number): void {
    const stage = this.config.stages[this.currentStageIndex];
    const elapsed = time - this.stageStartedAt;
    while (this.waveIndex < stage.waves.length && elapsed >= stage.waves[this.waveIndex].atMs) {
      this.spawnWave(stage.waves[this.waveIndex]);
      this.waveIndex += 1;
    }
    const enemiesRemain = this.enemies.getChildren().some(child => child.active);
    if (this.waveIndex < stage.waves.length || enemiesRemain || this.stageTransitioning) return;
    if (stage.bossId) {
      if (this.bossTriggered) return;
      this.bossTriggered = true; this.stageTransitioning = true;
      this.beginDialogue(stage.bossDialogue, () => { this.stageTransitioning = false; this.spawnBoss(stage.bossId!, this.time.now); });
      return;
    }
    this.stageTransitioning = true;
    this.beginDialogue(stage.clearDialogue, () => {
      const nextIndex = stage.nextStage ? this.config.stages.findIndex(candidate => candidate.id === stage.nextStage) : this.currentStageIndex + 1;
      this.startStage(nextIndex);
    });
  }

  private startStage(index: number): void {
    if (index >= this.config.stages.length) { this.clearStage(); return; }
    const stage = this.config.stages[index];
    this.currentStageIndex = index; this.waveIndex = 0; this.bossTriggered = false; this.stageTransitioning = false;
    this.applyStageBackground(stage);
    this.player.setPosition(this.playerSpawnX, this.playerSpawnY);
    this.enemyBullets.clear(true, true); this.playerShots.clear(true, true);
    this.events.emit('message', { title: stage.name, text: stage.subtitle, duration: 1800 });
    this.beginDialogue(stage.introDialogue, () => { this.stageStartedAt = this.time.now; });
  }

  private beginDialogue(dialogueId: string | undefined, done: () => void): void {
    const lines = dialogueId ? this.config.dialogues[dialogueId] : undefined;
    if (!lines?.length) { done(); return; }
    let completed = false;
    this.cinematic = true; this.physics.world.pause();
    this.events.emit('dialogue', { lines, done:() => { if(completed)return;completed=true;this.cinematic = false; if (!this.isPaused) this.physics.world.resume(); done(); } });
  }

  private spawnWave(wave: WaveEntry): void {
    const definition = this.config.enemies[wave.enemy];
    const formation=wave.formation,spacing=formation.spacing ?? 72;
    for (let index = 0; index < wave.count; index += 1) {
      let x = this.playWidth / 2 + (index - (wave.count - 1) / 2) * spacing;
      let y = -30 - Math.abs(index - (wave.count - 1) / 2) * 22;
      if (formation.type === 'v') y -= Math.abs(index - (wave.count - 1) / 2) * 30;
      if (formation.type === 'sweep'&&formation.direction==='left') { x = 45 + index * spacing; y -= index * (formation.stepY??34); }
      if (formation.type === 'sweep'&&formation.direction==='right') { x = this.playWidth - 45 - index * spacing; y -= index * (formation.stepY??34); }
      const texture=definition.texture??'enemy-core',enemy = this.enemies.get(x, y, texture) as EnemySprite | null;
      if (!enemy) continue;
      enemy.enableBody(true, x, y, true, true).setTexture(texture).setTint(Phaser.Display.Color.HexStringToColor(definition.color).color).setScale(definition.radius / 16).setDepth(5);
      enemy.setCircle(13).setData('hp', definition.hp).setData('wave', formation.type);
      enemy.definition = definition; enemy.definitionId = wave.enemy; enemy.firedAt = 0; enemy.angleSeed = Math.random() * Math.PI * 2;
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      const movement=definition.movement??{type:'linear',velocityY:definition.speed} as MovementDefinition;
      this.applyMovement(body,movement,index,formation);
    }
  }

  private updateEnemies(time: number, delta: number): void {
    this.enemies.getChildren().forEach(child => {
      const enemy = child as EnemySprite;
      if (!enemy.active) return;
      if (enemy === this.boss) { this.updateBoss(enemy, time, delta); return; }
      const definition = enemy.definition;
      if (!definition) { enemy.disableBody(true, true); return; }
      const movement=definition.movement;
      if(movement?.type==='sine'&&enemy.y>=movement.enterY){const body=enemy.body as Phaser.Physics.Arcade.Body;body.setVelocity(0,0);enemy.x=movement.centerX+Math.sin((time-this.stageStartedAt)/movement.periodMs*Math.PI*2)*movement.amplitudeX;body.updateFromGameObject();}
      if(movement?.type==='stationary'){enemy.setPosition(movement.x,movement.y);(enemy.body as Phaser.Physics.Arcade.Body).setVelocity(0,0);}
      if (enemy.y > 90 && enemy.y < 410) definition.patterns.forEach((pattern,index)=>{const key=`enemy:${index}`,last=Number(enemy.getData(key)??enemy.firedAt??0);if(time-last>=pattern.intervalMs){enemy.setData(key,time);this.firePattern(enemy.x,enemy.y,pattern,time,(enemy.angleSeed??0)+index);}});
      const margin = this.config.rules.bulletCullMargin;
      if (enemy.y > this.playHeight + margin || enemy.x < -margin || enemy.x > this.playWidth + margin) enemy.disableBody(true, true);
    });
  }

  private applyMovement(body:Phaser.Physics.Arcade.Body,movement:MovementDefinition,index=0,formation?:FormationDefinition):void {
    if(movement.type==='linear'){const formationX=formation?.type==='sweep'?(formation.direction==='left'?35:-35):Math.sin(index*2)*24;body.setVelocity(movement.velocityX??formationX,movement.velocityY);}
    if(movement.type==='sine')body.setVelocity(0,movement.enterSpeed);
    if(movement.type==='stationary'){(body.gameObject as Phaser.GameObjects.Sprite).setPosition(movement.x,movement.y);body.setVelocity(0,0);}
  }

  private spawnBoss(bossId:string,time: number): void {
    if (this.boss?.active || this.ended) return;
    if (!this.isPaused && !this.cinematic) this.physics.world.resume();
    const definition=this.config.bosses[bossId];if(!definition)return;this.currentBossId=bossId;
    const movement = definition.movement,spawn=definition.spawn;
    const boss = this.enemies.get(spawn.x, spawn.y, definition.texture) as EnemySprite | null;
    if (!boss) return;
    boss.enableBody(true, spawn.x, spawn.y, true, true).setTexture(definition.texture).setScale(.24).setDepth(6).setTint(Phaser.Display.Color.HexStringToColor(definition.tint??'#ffd8ff').color);
    boss.setCircle(definition.radius, Math.max(0, boss.width / 2 - definition.radius), Math.max(0, boss.height / 2 - definition.radius));
    this.applyMovement(boss.body as Phaser.Physics.Arcade.Body,movement);
    boss.phase = -1; boss.definition = undefined;
    this.bossPhase = -1; this.bossPhaseHp = 0; this.bossPhaseTransitioning = true;
    this.boss = boss;
    this.events.emit('message', { title:definition.name, text:this.config.ui.messages.bossWarning, duration:2200 });
    this.time.delayedCall(1200, () => this.startBossPhase(0, time + 1200));
  }

  private startBossPhase(index: number, time: number): void {
    if (!this.boss?.active) return;
    const definition=this.bossConfig;if(!definition)return;
    if (index >= definition.phases.length) { this.clearStage(); return; }
    const phase = definition.phases[index];
    this.bossPhaseTransitioning = false; this.bossPhase = index; this.boss.phase = index; this.bossPhaseHp = phase.hp; this.boss.setData('hp', phase.hp);
    this.bossPhaseStarted = time; this.patternTimers.clear();
    this.enemyBullets.clear(true, true);
    this.events.emit('message', { title: `SPELL ${index + 1}`, text: phase.name, duration: 1400 });
  }

  private updateBoss(enemy: EnemySprite, time: number, _delta: number): void {
    const definition=this.bossConfig;if(!definition)return;const movement = definition.movement;
    if (movement.type==='sine'&&enemy.y < movement.enterY) return;
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    if(movement.type==='sine')enemy.x = movement.centerX + Math.sin((time - this.stageStartedAt) / movement.periodMs * Math.PI * 2) * movement.amplitudeX;
    if(movement.type==='stationary')enemy.setPosition(movement.x,movement.y);
    body.updateFromGameObject();
    if (this.bossPhaseTransitioning) return;
    const phase = definition.phases[this.bossPhase];
    if (!phase) return;
    phase.patterns.forEach((pattern, index) => {
      const key = `${this.bossPhase}:${index}`;
      if (time - (this.patternTimers.get(key) ?? 0) < pattern.intervalMs) return;
      this.patternTimers.set(key, time);
      this.firePattern(enemy.x, enemy.y + 26, pattern, time, index * 1.7);
    });
    if (time - this.bossPhaseStarted >= phase.durationMs) this.finishBossPhase(false, time);
  }

  private firePattern(x: number, y: number, pattern: BulletPattern, time: number, seed: number): void {
    const color = Phaser.Display.Color.HexStringToColor(pattern.color).color;
    const aim = Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y);
    const spin = seed + time * (pattern.spin ?? 0) / 1000;
    const shoot = (angle: number, speed = pattern.bulletSpeed): void => {
      const bullet = this.enemyBullets.get(x, y, 'enemy-bullet') as BulletSprite | null;
      if (!bullet) return;
      bullet.enableBody(true, x, y, true, true).setTint(color).setDepth(4).setScale(.85).setCircle(5);
      bullet.grazed = false;
      this.physics.velocityFromRotation(angle, speed, (bullet.body as Phaser.Physics.Arcade.Body).velocity);
    };
    if (pattern.type === 'radial' || pattern.type === 'spiral') for (let i = 0; i < pattern.count; i += 1) shoot(spin + Math.PI * 2 * i / pattern.count);
    if (pattern.type === 'aimed') for (let wave = 0; wave < (pattern.waves ?? 1); wave += 1) shoot(aim + (wave - ((pattern.waves ?? 1) - 1) / 2) * .1, pattern.bulletSpeed + wave * 14);
    if (pattern.type === 'fan') for (let i = 0; i < pattern.count; i += 1) shoot(aim + (i - (pattern.count - 1) / 2) * (pattern.spread ?? .14));
    if (pattern.type === 'rain') for (let i = 0; i < pattern.count; i += 1) { const bulletX = Phaser.Math.Between(12, this.playWidth - 12); const angle = Math.PI / 2 + Phaser.Math.FloatBetween(-.16, .16); const bullet = this.enemyBullets.get(bulletX, -10, 'enemy-bullet') as BulletSprite | null; if (bullet) { bullet.enableBody(true, bulletX, -10, true, true).setTint(color).setDepth(4).setCircle(5); bullet.grazed = false; this.physics.velocityFromRotation(angle, pattern.bulletSpeed, (bullet.body as Phaser.Physics.Arcade.Body).velocity); } }
  }

  private shoot(time: number): void {
    this.lastShot = time;
    const shotLevel = [...this.playerConfig.shotLevels].sort((a,b) => b.power - a.power).find(level => this.power >= level.power) ?? this.playerConfig.shotLevels[0];
    const shots=shotLevel.type==='parallel'?shotLevel.offsets.map(offset=>({xOffset:offset,velocityX:offset*(shotLevel.velocityXScale??0)})):Array.from({length:shotLevel.count},(_,index)=>({xOffset:(index-(shotLevel.count-1)/2)*7,velocityX:Math.sin((index-(shotLevel.count-1)/2)*shotLevel.spread)*this.playerConfig.shotSpeed}));
    shots.forEach(({xOffset,velocityX}, index) => {
      const shot = this.playerShots.get(this.player.x + xOffset, this.player.y - 26, 'player-shot') as Phaser.Physics.Arcade.Image | null;
      if (!shot) return;
      shot.enableBody(true, this.player.x + xOffset, this.player.y - 26, true, true).setTexture('player-shot').setDepth(5).setTint(index % 2 ? 0x8fffff : 0xffffff);
      const shotBody = shot.body as Phaser.Physics.Arcade.Body; shotBody.setSize(6, 20, true).setVelocity(velocityX, -this.playerConfig.shotSpeed);
      shot.setData('damage', shotLevel.damage);
    });
  }

  private hitEnemy(shotObject: Phaser.Types.Physics.Arcade.GameObjectWithBody, enemyObject: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
    const shot = shotObject as Phaser.Physics.Arcade.Image;
    const enemy = enemyObject as EnemySprite;
    if (!shot.active || !enemy.active) return;
    if (enemy === this.boss && (this.bossPhaseTransitioning || this.bossPhase < 0 || !this.bossConfig?.phases[this.bossPhase])) return;
    shot.disableBody(true, true);
    const hp = Number(enemy.getData('hp')) - Number(shot.getData('damage') ?? 1);
    enemy.setData('hp', hp);
    if (enemy === this.boss) {
      this.bossPhaseHp = Math.max(0, hp);
      if (hp <= 0) this.finishBossPhase(true, this.time.now);
    } else if (hp <= 0) this.destroyEnemy(enemy);
  }

  private destroyEnemy(enemy: EnemySprite): void {
    const definition = enemy.definition!;
    this.addScore(definition.score);
    this.burst(enemy.x, enemy.y, definition.color);
    if (Math.random() < definition.pickupChance) this.spawnPickup(enemy.x, enemy.y);
    enemy.disableBody(true, true);
  }

  private finishBossPhase(captured: boolean, time: number): void {
    if (!this.boss?.active || this.bossPhaseTransitioning) return;
    const phase = this.bossConfig?.phases[this.bossPhase];
    if (!phase) return;
    this.bossPhaseTransitioning = true;
    const remaining = Math.max(0, phase.durationMs - (time - this.bossPhaseStarted));
    const scoring = this.config.scoring;
    this.addScore((captured ? scoring.bossCapture : scoring.bossTimeout) + Math.floor(remaining * scoring.bossTimeMultiplier));
    this.burst(this.boss.x, this.boss.y, '#ffe07a', 32);
    const nextPhase = this.bossPhase + 1;
    this.time.delayedCall(250, () => this.startBossPhase(nextPhase, this.time.now));
  }

  private hitPlayer(_playerObject: Phaser.Types.Physics.Arcade.GameObjectWithBody, dangerObject: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
    const danger = dangerObject as Phaser.Physics.Arcade.Sprite;
    const time = this.time.now;
    if (time < this.invulnerableUntil || this.ended) return;
    if (danger.texture.key === 'enemy-bullet') danger.disableBody(true, true);
    const rules = this.config.rules;
    this.lives -= 1; this.bombs = Math.max(this.bombs, rules.respawnBombs); this.power = Math.max(1, this.power - rules.deathPowerLoss); this.combo = 0;
    this.invulnerableUntil = time + rules.hitInvulnerabilityMs;
    this.cameras.main.shake(180, .012);
    this.enemyBullets.getChildren().forEach(child => { const bullet = child as Phaser.Physics.Arcade.Image; if (bullet.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y) < rules.grazeRadius * 4.5) bullet.disableBody(true, true); });
    this.player.setPosition(this.playerSpawnX, this.playerSpawnY);
    this.events.emit('message', { title:this.config.ui.messages.miss, text:this.lives > 0 ? this.config.ui.messages.respawn : this.config.ui.messages.lastLife, duration:1000 });
    if (this.lives <= 0) this.gameOver();
  }

  private useBomb(time: number): void {
    if (this.bombs <= 0 || time < this.invulnerableUntil || this.ended) return;
    const behavior=this.playerConfig.bomb;this.bombs -= 1; this.invulnerableUntil = time + behavior.invulnerabilityMs;
    const cleared = this.enemyBullets.countActive(true);
    this.enemyBullets.clear(true, true);
    this.addScore(cleared * this.config.scoring.bombBulletClear);
    const ring = this.add.circle(this.player.x, this.player.y, 30, 0x7ffaff, .2).setStrokeStyle(5, 0xffffff, .9).setDepth(10);
    this.tweens.add({ targets:ring, radius:520, alpha:0, duration:700, onComplete:()=>ring.destroy() });
    if (behavior.type==='clear-and-damage'&&this.boss?.active && this.bossPhase >= 0) { const hp = Math.max(1, Number(this.boss.getData('hp')) - behavior.damage); this.boss.setData('hp', hp); this.bossPhaseHp = hp; }
    this.events.emit('message', { title:this.config.ui.messages.bomb, text:this.config.ui.messages.bombCleared.replace('{count}', String(cleared)), duration:700 });
  }

  private updateGraze(time: number): void {
    this.enemyBullets.getChildren().forEach(child => {
      const bullet = child as BulletSprite;
      if (!bullet.active || bullet.grazed) return;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y);
      if (distance > this.config.rules.playerHitboxRadius && distance < this.config.rules.grazeRadius) { bullet.grazed = true; this.graze += 1; this.combo += 1; this.comboUntil = time + 1600; this.addScore(this.config.scoring.grazeBase * Math.max(1, this.combo)); }
    });
  }

  private updateBullets(): void {
    [...this.playerShots.getChildren(), ...this.enemyBullets.getChildren()].forEach(child => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      const margin = this.config.rules.bulletCullMargin;
      if (bullet.active && (bullet.y < -margin || bullet.y > this.playHeight + margin || bullet.x < -margin || bullet.x > this.playWidth + margin)) bullet.disableBody(true, true);
    });
    this.pickups.getChildren().forEach(child => { const pickup = child as Phaser.Physics.Arcade.Image; if (pickup.active && pickup.y > this.playHeight + this.config.rules.bulletCullMargin) pickup.disableBody(true, true); });
  }

  private spawnPickup(x: number, y: number): void {
    const pickup = this.pickups.get(x, y, 'power-item') as Phaser.Physics.Arcade.Image | null;
    if (!pickup) return;
    pickup.enableBody(true, x, y, true, true).setTexture('power-item').setDepth(5).setCircle(7);
    (pickup.body as Phaser.Physics.Arcade.Body).setVelocity(Phaser.Math.Between(-25, 25), this.config.rules.pickupFallSpeed);
  }

  private collectPickup(_playerObject: Phaser.Types.Physics.Arcade.GameObjectWithBody, pickupObject: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
    const pickup = pickupObject as Phaser.Physics.Arcade.Image;
    pickup.disableBody(true, true); this.power = Math.min(this.playerConfig.maxPower, this.power + 1); this.addScore(this.config.scoring.pickup);
  }

  private addScore(amount: number): void {
    this.score += amount;
    if (this.score > this.highScore) { this.highScore = this.score; this.highScoreDirty = true; }
  }

  private persistHighScore(): void {
    if (!this.highScoreDirty) return;
    localStorage.setItem(`${this.config.game.id}:high-score`, String(this.highScore));
    this.highScoreDirty = false;
  }

  private clearStage(): void {
    if (this.ended) return;
    this.ended = true; this.enemyBullets.clear(true, true); this.boss?.disableBody(true, true);
    this.addScore(this.lives * this.config.scoring.clearPerLife + this.bombs * this.config.scoring.clearPerBomb);
    this.persistHighScore();
    const dialogue = this.config.stages[this.currentStageIndex]?.clearDialogue;
    this.ended = false;
    this.beginDialogue(dialogue, () => { this.ended = true; this.physics.world.pause(); this.events.emit('result', { clear:true, score:this.score, graze:this.graze, highScore:this.highScore }); });
  }

  private gameOver(): void {
    if (this.ended) return;
    this.ended = true; (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0); this.physics.world.pause(); this.persistHighScore();
    this.events.emit('result', { clear:false, score:this.score, graze:this.graze, highScore:this.highScore });
  }

  restart(): void { this.scene.restart(); }

  createRuntimeState(): ShooterRuntimeState | null {
    if (this.ended || this.cinematic || this.stageTransitioning || this.bossPhaseTransitioning) return null;
    const now = this.time.now;
    const entities: ShooterRuntimeState['entities'] = [];
    this.enemies.getChildren().forEach(child => {
      const enemy = child as EnemySprite; if (!enemy.active) return;
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      const patternElapsedMs:Record<string,number>={};enemy.definition?.patterns.forEach((_,index)=>{const key=`enemy:${index}`,at=Number(enemy.getData(key)??0);if(at)patternElapsedMs[key]=Math.max(0,now-at);});
      entities.push({ kind:enemy===this.boss?'boss':'enemy', definitionId:enemy.definitionId, x:enemy.x, y:enemy.y, velocityX:body.velocity.x, velocityY:body.velocity.y, hp:Number(enemy.getData('hp')??0), firedAgoMs:Math.max(0,now-(enemy.firedAt??now)),patternElapsedMs, angleSeed:enemy.angleSeed });
    });
    const collect = (group:Phaser.Physics.Arcade.Group, kind:'enemyBullet'|'playerShot'|'pickup'):void => group.getChildren().forEach(child => {
      const item=child as BulletSprite; if(!item.active)return; const body=item.body as Phaser.Physics.Arcade.Body;
      entities.push({kind,x:item.x,y:item.y,velocityX:body.velocity.x,velocityY:body.velocity.y,damage:Number(item.getData('damage')??0)||undefined,tint:item.tintTopLeft,grazed:item.grazed});
    });
    collect(this.enemyBullets,'enemyBullet');collect(this.playerShots,'playerShot');collect(this.pickups,'pickup');
    const patternElapsedMs:Record<string,number>={};this.patternTimers.forEach((at,key)=>{patternElapsedMs[key]=Math.max(0,now-at);});
    return {schemaVersion:1,savedAt:new Date().toISOString(),playerId:this.selectedPlayerId,stageId:this.config.stages[this.currentStageIndex].id,stageElapsedMs:Math.max(0,now-this.stageStartedAt),waveIndex:this.waveIndex,bossTriggered:this.bossTriggered,player:{x:this.player.x,y:this.player.y,score:this.score,lives:this.lives,bombs:this.bombs,power:this.power,graze:this.graze,combo:this.combo,comboRemainingMs:Math.max(0,this.comboUntil-now),invulnerableRemainingMs:Math.max(0,this.invulnerableUntil-now)},boss:this.boss?.active&&this.bossPhase>=0?{definitionId:this.currentBossId,phase:this.bossPhase,hp:this.bossPhaseHp,phaseElapsedMs:Math.max(0,now-this.bossPhaseStarted),patternElapsedMs}:null,entities};
  }

  requestManualSave(): boolean { const runtime=this.createRuntimeState();if(!runtime)return false;this.events.emit('checkpoint',runtime);return true; }

  private requestAutosave(): void { const runtime=this.createRuntimeState();if(runtime)this.events.emit('checkpoint',runtime); }

  private restoreRuntime(runtime: ShooterRuntimeState): void {
    const stageIndex=this.config.stages.findIndex(stage=>stage.id===runtime.stageId);if(stageIndex<0){this.startStage(0);return;}
    const now=this.time.now,p=runtime.player;this.currentStageIndex=stageIndex;this.waveIndex=runtime.waveIndex;this.bossTriggered=runtime.bossTriggered;this.stageStartedAt=now-runtime.stageElapsedMs;
    this.applyStageBackground(this.config.stages[stageIndex]);this.player.setPosition(p.x,p.y);this.score=p.score;this.lives=p.lives;this.bombs=p.bombs;this.power=p.power;this.graze=p.graze;this.combo=p.combo;this.comboUntil=now+p.comboRemainingMs;this.invulnerableUntil=now+p.invulnerableRemainingMs;
    this.enemyBullets.clear(true,true);this.playerShots.clear(true,true);this.enemies.clear(true,true);this.pickups.clear(true,true);this.boss=null;this.patternTimers.clear();
    runtime.entities.forEach(saved=>{
      let item:Phaser.Physics.Arcade.Image|Phaser.Physics.Arcade.Sprite|null=null;
      if(saved.kind==='enemy'||saved.kind==='boss'){
        const bossDefinition=runtime.boss?this.config.bosses[runtime.boss.definitionId]:undefined,enemyDefinition=saved.definitionId?this.config.enemies[saved.definitionId]:undefined,texture=saved.kind==='boss'?bossDefinition?.texture:(enemyDefinition?.texture??'enemy-core');if(!texture)return;
        const enemy=this.enemies.get(saved.x,saved.y,texture) as EnemySprite|null;if(!enemy)return;enemy.enableBody(true,saved.x,saved.y,true,true).setDepth(saved.kind==='boss'?6:5);enemy.setData('hp',saved.hp??1);enemy.angleSeed=saved.angleSeed;enemy.firedAt=now-(saved.firedAgoMs??0);
        if(saved.kind==='boss'&&bossDefinition){this.currentBossId=runtime.boss!.definitionId;enemy.setTexture(bossDefinition.texture).setScale(.24).setTint(Phaser.Display.Color.HexStringToColor(bossDefinition.tint??'#ffd8ff').color);enemy.setCircle(bossDefinition.radius,Math.max(0,enemy.width/2-bossDefinition.radius),Math.max(0,enemy.height/2-bossDefinition.radius));enemy.phase=runtime.boss?.phase??-1;this.boss=enemy;}
        else {const definition=enemyDefinition;if(!definition){enemy.disableBody(true,true);return;}enemy.definition=definition;enemy.definitionId=saved.definitionId;enemy.setTexture(definition.texture??'enemy-core').setTint(Phaser.Display.Color.HexStringToColor(definition.color).color).setScale(definition.radius/16).setCircle(13);Object.entries(saved.patternElapsedMs??{}).forEach(([key,elapsed])=>enemy.setData(key,now-elapsed));}
        item=enemy;
      } else {
        const group=saved.kind==='enemyBullet'?this.enemyBullets:saved.kind==='playerShot'?this.playerShots:this.pickups;const texture=saved.kind==='enemyBullet'?'enemy-bullet':saved.kind==='playerShot'?'player-shot':'power-item';const image=group.get(saved.x,saved.y,texture) as BulletSprite|null;if(!image)return;image.enableBody(true,saved.x,saved.y,true,true).setTexture(texture).setDepth(saved.kind==='enemyBullet'?4:5);if(saved.tint!==undefined)image.setTint(saved.tint);if(saved.kind==='enemyBullet'){image.setCircle(5);image.grazed=Boolean(saved.grazed);}if(saved.kind==='playerShot'){image.setData('damage',saved.damage??1);(image.body as Phaser.Physics.Arcade.Body).setSize(6,20,true);}if(saved.kind==='pickup')image.setCircle(7);item=image;
      }
      (item.body as Phaser.Physics.Arcade.Body).setVelocity(saved.velocityX,saved.velocityY);
    });
    if(runtime.boss&&this.boss){this.bossPhase=runtime.boss.phase;this.bossPhaseHp=runtime.boss.hp;this.bossPhaseStarted=now-runtime.boss.phaseElapsedMs;this.bossPhaseTransitioning=false;Object.entries(runtime.boss.patternElapsedMs).forEach(([key,elapsed])=>this.patternTimers.set(key,now-elapsed));}
    else {this.bossPhase=-1;this.bossPhaseHp=0;this.bossPhaseTransitioning=false;}
    this.stageTransitioning=false;this.cinematic=false;this.ended=false;this.physics.world.resume();this.events.emit('message',{title:this.config.stages[stageIndex].name,text:'저장한 시점에서 계속합니다.',duration:1400});this.emitState(true);
  }

  togglePause(): void {
    if (this.cinematic || this.ended) return;
    this.isPaused = !this.isPaused;
    this.physics.world.isPaused = this.isPaused;
    this.events.emit('pause', this.isPaused);
    this.emitState(true);
  }

  pauseForVisibility(): void {
    if (!this.ended && !this.cinematic && !this.isPaused) this.togglePause();
  }

  private emitState(force = false): void {
    if (!force && this.time.now - this.lastStateEmitAt < 50) return;
    this.lastStateEmitAt = this.time.now;
    const phase = this.bossConfig?.phases[this.bossPhase];
    const stage = this.config.stages[this.currentStageIndex];
    this.events.emit('state', { score:this.score, highScore:this.highScore, lives:this.lives, bombs:this.bombs, power:this.power, graze:this.graze, combo:this.combo, bossName:this.boss?.active ? this.bossConfig?.name??'' : '', bossPhase:phase?.name ?? '', bossHp:this.bossPhaseHp, bossMaxHp:phase?.hp ?? 1, bossTime:phase ? Math.max(0, phase.durationMs - (this.time.now - this.bossPhaseStarted)) : 0, paused:this.isPaused, stageNumber:this.currentStageIndex + 1, stageCount:this.config.stages.length, stageName:stage?.name ?? '', playerId:this.selectedPlayerId, playerName:this.playerConfig.name } satisfies ShooterState);
  }

  private drawStage(): void {
    this.stageBackground = this.add.image(this.playWidth / 2, this.playHeight / 2, this.config.stages[0].background).setDepth(-5);
    this.applyStageBackground(this.config.stages[0]);
    const overlay = this.add.graphics().setDepth(-4); overlay.fillGradientStyle(0x071125, 0x071125, 0x101633, 0x101633, .25, .25, .9, .9).fillRect(0, 0, this.playWidth, this.playHeight);
    for (let i = 0; i < 70; i += 1) { const star = this.add.circle(Phaser.Math.Between(5, this.playWidth - 5), Phaser.Math.Between(0, this.playHeight), Phaser.Math.Between(1, 2), 0xbceaff, Phaser.Math.FloatBetween(.15, .6)).setDepth(-3); this.tweens.add({ targets:star, alpha:.05, duration:Phaser.Math.Between(500, 1600), yoyo:true, repeat:-1 }); }
    this.add.rectangle(this.playWidth - 1, this.playHeight / 2, 2, this.playHeight, 0x8defff, .4).setDepth(20);
    this.add.circle(0, 0, 5, 0xffffff, .2).setStrokeStyle(1, 0x79ffff, 1).setDepth(20).setName('hitbox').setVisible(false);
  }

  private applyStageBackground(stage:ShooterProtocol['stages'][number]):void {
    const presentation=stage.backgroundPresentation??{fit:'cover' as const,focusX:.5,focusY:.5,alpha:.42};
    this.stageBackground.setTexture(stage.background).setAlpha(presentation.alpha??.42);
    if(presentation.fit==='stretch'){this.stageBackground.setPosition(this.playWidth/2,this.playHeight/2).setDisplaySize(this.playWidth,this.playHeight);return;}
    const source=this.textures.get(stage.background).getSourceImage() as {width:number;height:number};
    const scale=Math.max(this.playWidth/source.width,this.playHeight/source.height),width=source.width*scale,height=source.height*scale;
    const focusX=Phaser.Math.Clamp(presentation.focusX??.5,0,1),focusY=Phaser.Math.Clamp(presentation.focusY??.5,0,1);
    this.stageBackground.setDisplaySize(width,height).setPosition(this.playWidth/2+(.5-focusX)*Math.max(0,width-this.playWidth),this.playHeight/2+(.5-focusY)*Math.max(0,height-this.playHeight));
  }

  private burst(x: number, y: number, color: string, count = 12): void {
    const tint = Phaser.Display.Color.HexStringToColor(color).color;
    for (let i = 0; i < count; i += 1) { const particle = this.add.circle(x, y, Phaser.Math.Between(2, 5), tint, .85).setDepth(9); const angle = Math.PI * 2 * i / count; this.tweens.add({ targets:particle, x:x + Math.cos(angle) * Phaser.Math.Between(25, 80), y:y + Math.sin(angle) * Phaser.Math.Between(25, 80), alpha:0, scale:.2, duration:Phaser.Math.Between(260, 600), onComplete:()=>particle.destroy() }); }
  }

  private createTextures(): void {
    if (this.textures.exists('enemy-bullet')) return;
    const graphics = this.make.graphics({ x:0, y:0 }, false);
    graphics.fillStyle(0xffffff).fillCircle(8, 8, 7).lineStyle(2, 0xffffff, .7).strokeCircle(8, 8, 7).generateTexture('enemy-bullet', 16, 16).clear();
    graphics.fillStyle(0xffffff).fillRoundedRect(2, 0, 6, 20, 3).generateTexture('player-shot', 10, 20).clear();
    graphics.fillStyle(0xffffff).fillCircle(16, 16, 14).lineStyle(3, 0xffffff, .8).strokeCircle(16, 16, 11).generateTexture('enemy-core', 32, 32).clear();
    graphics.fillStyle(0xff507c).fillTriangle(10, 1, 19, 10, 10, 19).fillTriangle(10, 1, 10, 19, 1, 10).lineStyle(2, 0xffffff, .9).strokeRect(3, 3, 14, 14).generateTexture('power-item', 20, 20);
    graphics.destroy();
  }
}
