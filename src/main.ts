import Phaser from 'phaser';
import './style.css';
import { BulletHellScene } from './shooter/BulletHellScene';
import { loadShooterContent, ShooterContentError } from './shooter/ShooterContent';
import type { ShooterState } from './shooter/types';

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;
let scene: BulletHellScene;
let messageTimer = 0;

async function boot(): Promise<void> {
  try {
    const config = await loadShooterContent();
    $('#game-title').textContent = config.game.title;
    $('#game-subtitle').textContent = config.game.subtitle;
    scene = new BulletHellScene(config);
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      width: 640,
      height: 720,
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
  $('#power').textContent = `${state.power} / 4`;
  $('#power-bar').style.width = `${state.power / 4 * 100}%`;
  $('#graze').textContent = state.graze.toLocaleString();
  $('#combo').textContent = state.combo > 1 ? `×${state.combo}` : '—';
  const bossVisible = Boolean(state.bossName);
  $('#boss-hud').classList.toggle('hidden', !bossVisible);
  if (bossVisible) {
    $('#boss-name').textContent = state.bossName;
    $('#boss-phase').textContent = state.bossPhase;
    $('#boss-hp').style.width = `${Math.max(0, state.bossHp / state.bossMaxHp * 100)}%`;
    $('#boss-time').textContent = (state.bossTime / 1000).toFixed(1);
  }
}

function showMessage(message: { title:string; text:string; duration:number }): void {
  window.clearTimeout(messageTimer);
  $('#message-title').textContent = message.title;
  $('#message-text').textContent = message.text;
  $('#stage-message').classList.remove('hidden');
  messageTimer = window.setTimeout(() => $('#stage-message').classList.add('hidden'), message.duration);
}

function showResult(result: { clear:boolean; score:number; graze:number; highScore:number }): void {
  $('#result-kicker').textContent = result.clear ? 'STAGE CLEAR' : 'GAME OVER';
  $('#result-title').textContent = result.clear ? '별의 문이 열렸습니다' : '탄막에 삼켜졌습니다';
  $('#result-score').textContent = result.score.toLocaleString();
  $('#result-graze').textContent = result.graze.toLocaleString();
  $('#result-high').textContent = result.highScore.toLocaleString();
  $('#result-screen').classList.remove('hidden');
}

function bindControls(): void {
  $('#restart').onclick = () => { $('#result-screen').classList.add('hidden'); scene.restart(); };
  $('#pause-button').onclick = () => scene.togglePause();
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
