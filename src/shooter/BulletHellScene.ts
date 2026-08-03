import Phaser from 'phaser';
import type { BulletPattern, EnemyDefinition, ShooterProtocol, ShooterState, WaveEntry } from './types';

type EnemySprite = Phaser.Physics.Arcade.Sprite & { firedAt?: number; definition?: EnemyDefinition; phase?: number; angleSeed?: number };
type BulletSprite = Phaser.Physics.Arcade.Image & { grazed?: boolean };

const PLAY_WIDTH = 640;
const PLAY_HEIGHT = 720;

export class BulletHellScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private playerShots!: Phaser.Physics.Arcade.Group;
  private enemyBullets!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private pickups!: Phaser.Physics.Arcade.Group;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<'up'|'down'|'left'|'right'|'focus'|'shoot'|'bomb'|'pause', Phaser.Input.Keyboard.Key>;
  private stageStartedAt = 0;
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
  private boss: EnemySprite | null = null;
  private bossPhase = -1;
  private bossPhaseHp = 0;
  private bossPhaseStarted = 0;
  private ended = false;
  private isPaused = false;
  private patternTimers = new Map<string, number>();

  constructor(private config: ShooterProtocol) { super('bullet-hell'); }

  preload(): void {
    Object.entries(this.config.assets).forEach(([id, src]) => this.load.image(id, src));
  }

  create(): void {
    this.createTextures();
    this.physics.world.setBounds(0, 0, PLAY_WIDTH, PLAY_HEIGHT);
    this.drawStage();
    this.playerShots = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 180, runChildUpdate: false });
    this.enemyBullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 900, runChildUpdate: false });
    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite, maxSize: 80, runChildUpdate: false });
    this.pickups = this.physics.add.group({ classType: Phaser.Physics.Arcade.Image, maxSize: 50, runChildUpdate: false });
    this.player = this.physics.add.sprite(PLAY_WIDTH / 2, PLAY_HEIGHT - 82, this.config.player.texture).setScale(.28).setDepth(8);
    this.player.setCollideWorldBounds(true).setCircle(12, Math.max(0, this.player.width / 2 - 12), Math.max(0, this.player.height / 2 - 12));
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keys = this.input.keyboard!.addKeys({ up:'W', down:'S', left:'A', right:'D', focus:'SHIFT', shoot:'Z', bomb:'X', pause:'P' }) as typeof this.keys;
    this.physics.add.overlap(this.playerShots, this.enemies, (shot, enemy) => this.hitEnemy(shot as Phaser.Types.Physics.Arcade.GameObjectWithBody, enemy as Phaser.Types.Physics.Arcade.GameObjectWithBody));
    this.physics.add.overlap(this.player, this.enemyBullets, (player, bullet) => this.hitPlayer(player as Phaser.Types.Physics.Arcade.GameObjectWithBody, bullet as Phaser.Types.Physics.Arcade.GameObjectWithBody));
    this.physics.add.overlap(this.player, this.enemies, (player, enemy) => this.hitPlayer(player as Phaser.Types.Physics.Arcade.GameObjectWithBody, enemy as Phaser.Types.Physics.Arcade.GameObjectWithBody));
    this.physics.add.overlap(this.player, this.pickups, (player, pickup) => this.collectPickup(player as Phaser.Types.Physics.Arcade.GameObjectWithBody, pickup as Phaser.Types.Physics.Arcade.GameObjectWithBody));
    this.lives = this.config.player.lives;
    this.bombs = this.config.player.bombs;
    this.highScore = Number(localStorage.getItem(`${this.config.game.id}:high-score`) ?? 0);
    this.stageStartedAt = this.time.now;
    this.events.emit('message', { title: this.config.stage.name, text: 'STAGE 1 · 별의 문을 돌파하라', duration: 1800 });
    this.emitState();
  }

  update(time: number, delta: number): void {
    if (Phaser.Input.Keyboard.JustDown(this.keys.pause) && !this.ended) this.togglePause();
    if (this.isPaused || this.ended) return;
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
    if (movement.lengthSq()) movement.normalize().scale(focused ? this.config.player.focusSpeed : this.config.player.speed);
    body.setVelocity(movement.x, movement.y);
    this.player.setAlpha(time < this.invulnerableUntil && Math.floor(time / 80) % 2 ? .25 : 1);
    (this.children.getByName('hitbox') as Phaser.GameObjects.Arc | null)?.setVisible(focused).setPosition(this.player.x, this.player.y);
    if (this.keys.shoot.isDown && time - this.lastShot >= this.config.player.shotIntervalMs) this.shoot(time);
    if (Phaser.Input.Keyboard.JustDown(this.keys.bomb)) this.useBomb(time);
  }

  private updateStage(time: number): void {
    const elapsed = time - this.stageStartedAt;
    while (this.waveIndex < this.config.stage.waves.length && elapsed >= this.config.stage.waves[this.waveIndex].atMs) {
      this.spawnWave(this.config.stage.waves[this.waveIndex]);
      this.waveIndex += 1;
    }
    if (!this.boss && elapsed >= this.config.stage.bossAtMs && !this.enemies.getChildren().some(child => child.active)) this.spawnBoss(time);
  }

  private spawnWave(wave: WaveEntry): void {
    const definition = this.config.enemies[wave.enemy];
    const spacing = wave.spacing ?? 72;
    for (let index = 0; index < wave.count; index += 1) {
      let x = PLAY_WIDTH / 2 + (index - (wave.count - 1) / 2) * spacing;
      let y = -30 - Math.abs(index - (wave.count - 1) / 2) * 22;
      if (wave.formation === 'v') y -= Math.abs(index - (wave.count - 1) / 2) * 30;
      if (wave.formation === 'sweep-left') { x = 45 + index * spacing; y -= index * 34; }
      if (wave.formation === 'sweep-right') { x = PLAY_WIDTH - 45 - index * spacing; y -= index * 34; }
      const enemy = this.enemies.get(x, y, 'enemy-core') as EnemySprite | null;
      if (!enemy) continue;
      enemy.enableBody(true, x, y, true, true).setTint(Phaser.Display.Color.HexStringToColor(definition.color).color).setScale(definition.radius / 16).setDepth(5);
      enemy.setCircle(13).setData('hp', definition.hp).setData('wave', wave.formation);
      enemy.definition = definition; enemy.firedAt = 0; enemy.angleSeed = Math.random() * Math.PI * 2;
      const body = enemy.body as Phaser.Physics.Arcade.Body;
      body.setVelocity(wave.formation === 'sweep-left' ? 35 : wave.formation === 'sweep-right' ? -35 : Math.sin(index * 2) * 24, definition.speed);
    }
  }

  private updateEnemies(time: number, delta: number): void {
    this.enemies.getChildren().forEach(child => {
      const enemy = child as EnemySprite;
      if (!enemy.active) return;
      if (enemy === this.boss) { this.updateBoss(enemy, time, delta); return; }
      const definition = enemy.definition!;
      if (enemy.y > 90 && enemy.y < 410 && time - (enemy.firedAt ?? 0) >= definition.pattern.intervalMs) {
        enemy.firedAt = time;
        this.firePattern(enemy.x, enemy.y, definition.pattern, time, enemy.angleSeed ?? 0);
      }
      if (enemy.y > PLAY_HEIGHT + 50 || enemy.x < -80 || enemy.x > PLAY_WIDTH + 80) enemy.disableBody(true, true);
    });
  }

  private spawnBoss(time: number): void {
    const boss = this.enemies.get(PLAY_WIDTH / 2, -90, this.config.boss.texture) as EnemySprite | null;
    if (!boss) return;
    boss.enableBody(true, PLAY_WIDTH / 2, -90, true, true).setScale(.24).setDepth(6).setTint(0xffd8ff);
    boss.setCircle(this.config.boss.radius, Math.max(0, boss.width / 2 - this.config.boss.radius), Math.max(0, boss.height / 2 - this.config.boss.radius));
    (boss.body as Phaser.Physics.Arcade.Body).setVelocity(0, 95);
    boss.phase = -1;
    this.boss = boss;
    this.events.emit('message', { title: this.config.boss.name, text: 'WARNING · 별을 삼키는 수호자', duration: 2200 });
    this.time.delayedCall(1200, () => this.startBossPhase(0, time + 1200));
  }

  private startBossPhase(index: number, time: number): void {
    if (!this.boss?.active) return;
    if (index >= this.config.boss.phases.length) { this.clearStage(); return; }
    const phase = this.config.boss.phases[index];
    this.bossPhase = index; this.boss.phase = index; this.bossPhaseHp = phase.hp; this.boss.setData('hp', phase.hp);
    this.bossPhaseStarted = time; this.patternTimers.clear();
    this.enemyBullets.clear(true, true);
    this.events.emit('message', { title: `SPELL ${index + 1}`, text: phase.name, duration: 1400 });
  }

  private updateBoss(enemy: EnemySprite, time: number, _delta: number): void {
    if (enemy.y < 130) return;
    const body = enemy.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    enemy.x = PLAY_WIDTH / 2 + Math.sin((time - this.stageStartedAt) / 1200) * 190;
    body.updateFromGameObject();
    const phase = this.config.boss.phases[this.bossPhase];
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
    if (pattern.type === 'rain') for (let i = 0; i < pattern.count; i += 1) { const bulletX = Phaser.Math.Between(12, PLAY_WIDTH - 12); const angle = Math.PI / 2 + Phaser.Math.FloatBetween(-.16, .16); const bullet = this.enemyBullets.get(bulletX, -10, 'enemy-bullet') as BulletSprite | null; if (bullet) { bullet.enableBody(true, bulletX, -10, true, true).setTint(color).setDepth(4).setCircle(5); bullet.grazed = false; this.physics.velocityFromRotation(angle, pattern.bulletSpeed, (bullet.body as Phaser.Physics.Arcade.Body).velocity); } }
  }

  private shoot(time: number): void {
    this.lastShot = time;
    const lanes = this.power >= 4 ? [-26, -13, 0, 13, 26] : this.power >= 3 ? [-20, -7, 7, 20] : this.power >= 2 ? [-12, 0, 12] : [-7, 7];
    lanes.forEach((offset, index) => {
      const shot = this.playerShots.get(this.player.x + offset, this.player.y - 26, 'player-shot') as Phaser.Physics.Arcade.Image | null;
      if (!shot) return;
      shot.enableBody(true, this.player.x + offset, this.player.y - 26, true, true).setDepth(5).setTint(index % 2 ? 0x8fffff : 0xffffff).setCircle(3);
      (shot.body as Phaser.Physics.Arcade.Body).setVelocity(offset * 1.2, -this.config.player.shotSpeed);
      shot.setData('damage', this.power >= 4 ? 3 : 2);
    });
  }

  private hitEnemy(shotObject: Phaser.Types.Physics.Arcade.GameObjectWithBody, enemyObject: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
    const shot = shotObject as Phaser.Physics.Arcade.Image;
    const enemy = enemyObject as EnemySprite;
    if (!shot.active || !enemy.active) return;
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
    if (Math.random() < .42) this.spawnPickup(enemy.x, enemy.y);
    enemy.disableBody(true, true);
  }

  private finishBossPhase(captured: boolean, time: number): void {
    if (!this.boss?.active) return;
    const phase = this.config.boss.phases[this.bossPhase];
    const remaining = Math.max(0, phase.durationMs - (time - this.bossPhaseStarted));
    this.addScore((captured ? 50000 : 10000) + Math.floor(remaining * 8));
    this.burst(this.boss.x, this.boss.y, '#ffe07a', 32);
    this.startBossPhase(this.bossPhase + 1, time + 250);
  }

  private hitPlayer(_playerObject: Phaser.Types.Physics.Arcade.GameObjectWithBody, dangerObject: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
    const danger = dangerObject as Phaser.Physics.Arcade.Sprite;
    const time = this.time.now;
    if (time < this.invulnerableUntil || this.ended) return;
    if (danger.texture.key === 'enemy-bullet') danger.disableBody(true, true);
    this.lives -= 1; this.bombs = Math.max(this.bombs, 2); this.power = Math.max(1, this.power - 1); this.combo = 0;
    this.invulnerableUntil = time + 2200;
    this.cameras.main.shake(180, .012);
    this.enemyBullets.getChildren().forEach(child => { const bullet = child as Phaser.Physics.Arcade.Image; if (bullet.active && Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y) < 150) bullet.disableBody(true, true); });
    this.player.setPosition(PLAY_WIDTH / 2, PLAY_HEIGHT - 82);
    this.events.emit('message', { title: 'MISS', text: this.lives > 0 ? '남은 기체로 복귀합니다' : '모든 기체를 잃었습니다', duration: 1000 });
    if (this.lives <= 0) this.gameOver();
  }

  private useBomb(time: number): void {
    if (this.bombs <= 0 || time < this.invulnerableUntil || this.ended) return;
    this.bombs -= 1; this.invulnerableUntil = time + 1800;
    const cleared = this.enemyBullets.countActive(true);
    this.enemyBullets.clear(true, true);
    this.addScore(cleared * 40);
    const ring = this.add.circle(this.player.x, this.player.y, 30, 0x7ffaff, .2).setStrokeStyle(5, 0xffffff, .9).setDepth(10);
    this.tweens.add({ targets:ring, radius:520, alpha:0, duration:700, onComplete:()=>ring.destroy() });
    if (this.boss?.active && this.bossPhase >= 0) { const hp = Math.max(1, Number(this.boss.getData('hp')) - 90); this.boss.setData('hp', hp); this.bossPhaseHp = hp; }
    this.events.emit('message', { title: 'STAR BREAK', text: `탄환 ${cleared}개 소거`, duration: 700 });
  }

  private updateGraze(time: number): void {
    this.enemyBullets.getChildren().forEach(child => {
      const bullet = child as BulletSprite;
      if (!bullet.active || bullet.grazed) return;
      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, bullet.x, bullet.y);
      if (distance > 13 && distance < 34) { bullet.grazed = true; this.graze += 1; this.combo += 1; this.comboUntil = time + 1600; this.addScore(100 * Math.max(1, this.combo)); }
    });
  }

  private updateBullets(): void {
    [...this.playerShots.getChildren(), ...this.enemyBullets.getChildren()].forEach(child => {
      const bullet = child as Phaser.Physics.Arcade.Image;
      if (bullet.active && (bullet.y < -40 || bullet.y > PLAY_HEIGHT + 40 || bullet.x < -40 || bullet.x > PLAY_WIDTH + 40)) bullet.disableBody(true, true);
    });
    this.pickups.getChildren().forEach(child => { const pickup = child as Phaser.Physics.Arcade.Image; if (pickup.active && pickup.y > PLAY_HEIGHT + 30) pickup.disableBody(true, true); });
  }

  private spawnPickup(x: number, y: number): void {
    const pickup = this.pickups.get(x, y, 'power-item') as Phaser.Physics.Arcade.Image | null;
    if (!pickup) return;
    pickup.enableBody(true, x, y, true, true).setDepth(5).setCircle(7);
    (pickup.body as Phaser.Physics.Arcade.Body).setVelocity(Phaser.Math.Between(-25, 25), 85);
  }

  private collectPickup(_playerObject: Phaser.Types.Physics.Arcade.GameObjectWithBody, pickupObject: Phaser.Types.Physics.Arcade.GameObjectWithBody): void {
    const pickup = pickupObject as Phaser.Physics.Arcade.Image;
    pickup.disableBody(true, true); this.power = Math.min(4, this.power + 1); this.addScore(2500);
  }

  private addScore(amount: number): void {
    this.score += amount;
    if (this.score > this.highScore) { this.highScore = this.score; localStorage.setItem(`${this.config.game.id}:high-score`, String(this.highScore)); }
  }

  private clearStage(): void {
    if (this.ended) return;
    this.ended = true; this.enemyBullets.clear(true, true); this.boss?.disableBody(true, true);
    this.addScore(this.lives * 30000 + this.bombs * 10000);
    this.events.emit('result', { clear:true, score:this.score, graze:this.graze, highScore:this.highScore });
  }

  private gameOver(): void {
    if (this.ended) return;
    this.ended = true; (this.player.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    this.events.emit('result', { clear:false, score:this.score, graze:this.graze, highScore:this.highScore });
  }

  restart(): void { this.scene.restart(); }

  togglePause(): void {
    this.isPaused = !this.isPaused;
    this.physics.world.isPaused = this.isPaused;
    this.events.emit('pause', this.isPaused);
    this.emitState();
  }

  private emitState(): void {
    const phase = this.config.boss.phases[this.bossPhase];
    this.events.emit('state', { score:this.score, highScore:this.highScore, lives:this.lives, bombs:this.bombs, power:this.power, graze:this.graze, combo:this.combo, bossName:this.boss?.active ? this.config.boss.name : '', bossPhase:phase?.name ?? '', bossHp:this.bossPhaseHp, bossMaxHp:phase?.hp ?? 1, bossTime:phase ? Math.max(0, phase.durationMs - (this.time.now - this.bossPhaseStarted)) : 0, paused:this.isPaused } satisfies ShooterState);
  }

  private drawStage(): void {
    const background = this.add.image(PLAY_WIDTH / 2, PLAY_HEIGHT / 2, this.config.stage.background).setDisplaySize(PLAY_WIDTH, PLAY_HEIGHT).setAlpha(.42).setDepth(-5);
    this.tweens.add({ targets:background, y:PLAY_HEIGHT / 2 + 18, duration:5000, yoyo:true, repeat:-1, ease:'Sine.InOut' });
    const overlay = this.add.graphics().setDepth(-4); overlay.fillGradientStyle(0x071125, 0x071125, 0x101633, 0x101633, .25, .25, .9, .9).fillRect(0, 0, PLAY_WIDTH, PLAY_HEIGHT);
    for (let i = 0; i < 70; i += 1) { const star = this.add.circle(Phaser.Math.Between(5, PLAY_WIDTH - 5), Phaser.Math.Between(0, PLAY_HEIGHT), Phaser.Math.Between(1, 2), 0xbceaff, Phaser.Math.FloatBetween(.15, .6)).setDepth(-3); this.tweens.add({ targets:star, alpha:.05, duration:Phaser.Math.Between(500, 1600), yoyo:true, repeat:-1 }); }
    this.add.rectangle(PLAY_WIDTH - 1, PLAY_HEIGHT / 2, 2, PLAY_HEIGHT, 0x8defff, .4).setDepth(20);
    this.add.circle(0, 0, 5, 0xffffff, .2).setStrokeStyle(1, 0x79ffff, 1).setDepth(20).setName('hitbox').setVisible(false);
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
