import Phaser from 'phaser';
import './style.css';
import { BulletHellScene } from './shooter/BulletHellScene';
import { loadShooterContent, ShooterContentError } from './shooter/ShooterContent';
import type { DialogueRequest, ShooterState } from './shooter/types';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
let scene: BulletHellScene;
let messageTimer = 0;
let maxPower = 1;
let uiText: Awaited<ReturnType<typeof loadShooterContent>>['ui'];
let dialogueAdvance: (() => void) | null = null;

async function boot(): Promise<void> {
  try {
    const config = await loadShooterContent();
    assetManifest = config.assets;
    maxPower = config.player.maxPower;
    uiText = config.ui;
    $('#game-title').textContent = config.game.title;
    $('#game-subtitle').textContent = config.game.subtitle;
    $('#eyebrow').textContent = config.ui.eyebrow;
    $('#brand-kicker').textContent = config.ui.brandKicker;
    $('#brand-title').textContent = config.ui.brandTitle;
    $('#brand-caption').textContent = config.ui.brandCaption;
    $('#pause-button').textContent = config.ui.pauseButton;
    $('#pause-title').textContent = config.ui.pauseTitle;
    $('#pause-help').textContent = config.ui.pauseHelp;
    $('#loading-title').textContent = config.ui.loading;
    $('#guide-title').textContent = config.ui.guideTitle;
    $('#guide-list').innerHTML = config.ui.guide.map(item => `<div><dt>${item.label}</dt><dd>${item.value}</dd></div>`).join('');
    $('#guide-tip').textContent = config.ui.guideTip;
    Object.entries(config.ui.labels).forEach(([id, value]) => document.querySelectorAll<HTMLElement>(`[data-label="${id}"]`).forEach(element => { element.textContent = value; }));
    $('#mobile-focus').textContent = config.ui.mobile.focus;
    $('#mobile-shot').textContent = config.ui.mobile.shot;
    $('#mobile-bomb').textContent = config.ui.mobile.bomb;
    $('#restart').textContent = config.ui.retry;
    $('#dialogue-hint').textContent = config.ui.dialogueHint;
    $('#retry-hint').textContent = config.ui.retryHint;
    $('.playfield').style.aspectRatio = `${config.rules.playfield.width} / ${config.rules.playfield.height}`;
    scene = new BulletHellScene(config);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: config.rules.playfield.width,
      height: config.rules.playfield.height,
      backgroundColor: '#070b18',
      physics: { default:'arcade', arcade:{ debug:false } },
      scale: { mode:Phaser.Scale.FIT, autoCenter:Phaser.Scale.CENTER_BOTH },
      scene,
      render: { antialias:true, pixelArt:false, roundPixels:false },
    });
    game.events.once(Phaser.Core.Events.READY, () => {
      scene.events.on('state', renderState);
      scene.events.on('message', showMessage);
      scene.events.on('result', showResult);
      scene.events.on('dialogue', showDialogue);
      scene.events.on('pause', (paused: boolean) => $('#pause-layer').classList.toggle('hidden', !paused));
    });
    bindControls();
    $('#loading').classList.add('hidden');
  } catch (error) {
    const issues = error instanceof ShooterContentError ? error.issues : [error instanceof Error ? error.message : String(error)];
    $('#loading').classList.add('error');
    $('#loading').innerHTML = `<strong>게임을 시작할 수 없습니다</strong><span>${issues.map(issue => `• ${issue}`).join('<br>')}</span>`;
  }
}

function renderState(state: ShooterState): void {
  $('#score').textContent = state.score.toString().padStart(9, '0');
  $('#high-score').textContent = state.highScore.toString().padStart(9, '0');
  $('#lives').innerHTML = Array.from({ length:Math.max(0, state.lives) }, () => '<i>◆</i>').join('') || '<span>LAST</span>';
  $('#bombs').innerHTML = Array.from({ length:Math.max(0, state.bombs) }, () => '<i>✦</i>').join('') || '<span>EMPTY</span>';
  $('#power').textContent = `${state.power} / ${maxPower}`;
  $('#power-bar').style.width = `${state.power / maxPower * 100}%`;
  $('#graze').textContent = state.graze.toLocaleString();
  $('#combo').textContent = state.combo > 1 ? `×${state.combo}` : '—';
  $('#stage-progress').textContent = uiText.stageProgress.replace('{current}', String(state.stageNumber)).replace('{total}', String(state.stageCount));
  $('#stage-name').textContent = state.stageName;
  const bossVisible = Boolean(state.bossName);
  $('#boss-hud').classList.toggle('hidden', !bossVisible);
  if (bossVisible) {
    $('#boss-name').textContent = state.bossName;
    $('#boss-phase').textContent = state.bossPhase;
    $('#boss-hp').style.width = `${Math.max(0, state.bossHp / state.bossMaxHp * 100)}%`;
    $('#boss-time').textContent = (state.bossTime / 1000).toFixed(1);
  }
}

function showDialogue(request: DialogueRequest): void {
  const panel = $('#dialogue');
  const portrait = $('#dialogue-portrait') as HTMLImageElement;
  let index = 0;
  const render = (): void => {
    const line = request.lines[index];
    $('#dialogue-speaker').textContent = line.speaker;
    $('#dialogue-text').textContent = line.text;
    $('#dialogue-progress').textContent = `${index + 1} / ${request.lines.length}`;
    $('#dialogue-next').textContent = index === request.lines.length - 1 ? uiText.startBattle : uiText.nextDialogue;
    panel.dataset.side = line.side ?? 'left';
    const source = line.portrait ? sceneConfigAsset(line.portrait) : '';
    if (source) { portrait.src = source; portrait.alt = `${line.speaker} 스탠딩 일러스트`; portrait.classList.remove('hidden'); }
    else { portrait.removeAttribute('src'); portrait.classList.add('hidden'); }
  };
  const advance = (): void => {
    index += 1;
    if (index < request.lines.length) { render(); return; }
    panel.classList.add('hidden');
    $('#dialogue-next').onclick = null;
    panel.onclick = null;
    dialogueAdvance = null;
    request.done();
  };
  dialogueAdvance = advance;
  $('#dialogue-next').onclick = event => { event.stopPropagation(); advance(); };
  panel.onclick = event => { if (!(event.target as HTMLElement).closest('button')) advance(); };
  panel.classList.remove('hidden');
  render();
}

let assetManifest: Record<string, string> = {};
function sceneConfigAsset(id: string): string { return assetManifest[id] ?? ''; }

function showMessage(message: { title:string; text:string; duration:number }): void {
  window.clearTimeout(messageTimer);
  $('#message-title').textContent = message.title;
  $('#message-text').textContent = message.text;
  $('#stage-message').classList.remove('hidden');
  messageTimer = window.setTimeout(() => $('#stage-message').classList.add('hidden'), message.duration);
}

function showResult(result: { clear:boolean; score:number; graze:number; highScore:number }): void {
  $('#result-kicker').textContent = result.clear ? uiText.stageClear : uiText.gameOver;
  $('#result-title').textContent = result.clear ? uiText.stageClearTitle : uiText.gameOverTitle;
  $('#result-score').textContent = result.score.toLocaleString();
  $('#result-graze').textContent = result.graze.toLocaleString();
  $('#result-high').textContent = result.highScore.toLocaleString();
  $('#result-screen').classList.remove('hidden');
}

function bindControls(): void {
  const restart = (): void => { $('#result-screen').classList.add('hidden'); scene.restart(); };
  $('#restart').onclick = restart;
  $('#pause-button').onclick = () => scene.togglePause();
  document.addEventListener('visibilitychange', () => { if (document.hidden) scene.pauseForVisibility(); });
  window.addEventListener('keydown', event => {
    const advanceKey = event.code === 'KeyZ' || event.code === 'Space' || event.code === 'Enter';
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(event.code)) event.preventDefault();
    if (event.repeat || !advanceKey) return;
    if (dialogueAdvance) { event.preventDefault(); event.stopImmediatePropagation(); dialogueAdvance(); return; }
    if (!$('#result-screen').classList.contains('hidden')) { event.preventDefault(); event.stopImmediatePropagation(); restart(); }
  }, true);
  const keyMap: Record<string, { key:string; code:string }> = {
    up:{key:'ArrowUp',code:'ArrowUp'}, down:{key:'ArrowDown',code:'ArrowDown'}, left:{key:'ArrowLeft',code:'ArrowLeft'}, right:{key:'ArrowRight',code:'ArrowRight'},
    shoot:{key:'z',code:'KeyZ'}, focus:{key:'Shift',code:'ShiftLeft'}, bomb:{key:'x',code:'KeyX'},
  };
  document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(button => {
    const fire = (type: 'keydown'|'keyup'): void => { const key = keyMap[button.dataset.key!]; window.dispatchEvent(new KeyboardEvent(type, { ...key, bubbles:true })); };
    button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); fire('keydown'); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => button.addEventListener(type, () => fire('keyup')));
  });
}

void boot();
