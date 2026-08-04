import Phaser from 'phaser';
import './style.css';
import { BulletHellScene } from './shooter/BulletHellScene';
import { LocalLeaderboard } from './shooter/Leaderboard';
import { loadShooterContent, ShooterContentError } from './shooter/ShooterContent';
import type { DialogueRequest, ScoreEntry, ShooterProtocol, ShooterState } from './shooter/types';

const $ = <T extends HTMLElement>(selector:string):T => document.querySelector<T>(selector)!;
let config:ShooterProtocol;let scene:BulletHellScene;let game:Phaser.Game;let leaderboard:LocalLeaderboard;
let selectedPlayerId='';let messageTimer=0;let dialogueAdvance:(()=>void)|null=null;

async function boot():Promise<void>{
  try{
    config=await loadShooterContent();selectedPlayerId=config.game.defaultPlayer;leaderboard=new LocalLeaderboard(config.game.id);
    applyStaticContent();renderCharacterSelect();renderLeaderboard();bindControls();
    game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:config.rules.playfield.width,height:config.rules.playfield.height,backgroundColor:'#070b18',physics:{default:'arcade',arcade:{debug:false}},scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},scene:[],render:{antialias:true,pixelArt:false,roundPixels:false}});
    game.events.once(Phaser.Core.Events.READY,()=>{
      scene=new BulletHellScene(config);game.scene.add('bullet-hell',scene,false);
      scene.events.on('state',renderState);scene.events.on('message',showMessage);scene.events.on('result',showResult);scene.events.on('dialogue',showDialogue);scene.events.on('pause',(paused:boolean)=>$('#pause-layer').classList.toggle('hidden',!paused));
      $('#loading').classList.add('hidden');$('#title-screen').classList.remove('hidden');
    });
  }catch(error){showBootError(error);}
}

function applyStaticContent():void{
  const ui=config.ui;document.title=config.game.title;$('#game-title').textContent=config.game.title;$('#game-subtitle').textContent=config.game.subtitle;$('#eyebrow').textContent=ui.eyebrow;
  $('#brand-kicker').textContent=ui.brandKicker;$('#brand-title').textContent=ui.brandTitle;$('#brand-caption').textContent=ui.brandCaption;$('#pause-button').textContent=ui.pauseButton;$('#pause-title').textContent=ui.pauseTitle;$('#pause-help').textContent=ui.pauseHelp;$('#loading-title').textContent=ui.loading;
  $('#title-kicker').textContent=ui.title.kicker;$('#title-heading').textContent=ui.title.heading;$('#title-description').textContent=ui.title.description;$('#select-title').textContent=ui.title.selectCharacter;$('#controls-title').textContent=ui.title.controls;$('#leaderboard-title').textContent=ui.title.leaderboard;$('#start-game').textContent=ui.title.start;$('#clear-scores').textContent=ui.title.clearScores;
  $('#guide-title').textContent=ui.guideTitle;$('#guide-tip').textContent=ui.guideTip;fillGuide($('#guide-list'));fillGuide($('#title-guide'));
  Object.entries(ui.labels).forEach(([id,value])=>document.querySelectorAll<HTMLElement>(`[data-label="${id}"]`).forEach(element=>{element.textContent=value;}));
  $('#mobile-focus').textContent=ui.mobile.focus;$('#mobile-shot').textContent=ui.mobile.shot;$('#mobile-bomb').textContent=ui.mobile.bomb;$('#restart').textContent=ui.title.quickRetry;$('#return-title').textContent=ui.title.returnToTitle;$('#dialogue-hint').textContent=ui.dialogueHint;$('#retry-hint').textContent=ui.retryHint;
  $('.playfield').style.aspectRatio=`${config.rules.playfield.width} / ${config.rules.playfield.height}`;
}

function fillGuide(target:HTMLElement):void{target.replaceChildren(...config.ui.guide.map(item=>{const row=document.createElement('div'),term=document.createElement('dt'),description=document.createElement('dd');term.textContent=item.label;description.textContent=item.value;row.append(term,description);return row;}));}

function renderCharacterSelect():void{
  const entries=Object.entries(config.players);$('#character-select').replaceChildren(...entries.map(([id,player])=>{const button=document.createElement('button');button.type='button';button.className='character-card';button.dataset.player=id;button.classList.toggle('selected',id===selectedPlayerId);if(player.portrait){const image=document.createElement('img');image.src=config.assets[player.portrait];image.alt='';button.append(image);}const copy=document.createElement('span'),name=document.createElement('strong'),description=document.createElement('small'),weapons=document.createElement('em');name.textContent=player.name;description.textContent=player.description;weapons.textContent=`SHOT · ${player.shotName}  /  BOMB · ${player.bombName}`;copy.append(name,description,weapons);button.append(copy);return button;}));
}

function startGame():void{
  if(!config.players[selectedPlayerId])return;clearOverlays();$('#title-screen').classList.add('hidden');$('#game-shell').classList.remove('title-mode');game.scene.start('bullet-hell',{playerId:selectedPlayerId});
}

function returnToTitle():void{
  if(game.scene.isActive('bullet-hell'))game.scene.stop('bullet-hell');clearOverlays();renderLeaderboard();renderCharacterSelect();$('#game-shell').classList.add('title-mode');$('#title-screen').classList.remove('hidden');
}

function quickRetry():void{clearOverlays();game.scene.start('bullet-hell',{playerId:selectedPlayerId});}

function clearOverlays():void{window.clearTimeout(messageTimer);dialogueAdvance=null;['#result-screen','#stage-message','#pause-layer','#dialogue'].forEach(selector=>$(selector).classList.add('hidden'));}

function renderState(state:ShooterState):void{
  const player=config.players[state.playerId];$('#score').textContent=state.score.toString().padStart(9,'0');$('#high-score').textContent=state.highScore.toString().padStart(9,'0');$('#lives').innerHTML=Array.from({length:Math.max(0,state.lives)},()=>'<i>◆</i>').join('')||'<span>LAST</span>';$('#bombs').innerHTML=Array.from({length:Math.max(0,state.bombs)},()=>'<i>✦</i>').join('')||'<span>EMPTY</span>';$('#power').textContent=`${state.power} / ${player.maxPower}`;$('#power-bar').style.width=`${state.power/player.maxPower*100}%`;$('#graze').textContent=state.graze.toLocaleString();$('#combo').textContent=state.combo>1?`×${state.combo}`:'—';$('#stage-progress').textContent=config.ui.stageProgress.replace('{current}',String(state.stageNumber)).replace('{total}',String(state.stageCount));$('#stage-name').textContent=state.stageName;
  const visible=Boolean(state.bossName);$('#boss-hud').classList.toggle('hidden',!visible);if(visible){$('#boss-name').textContent=state.bossName;$('#boss-phase').textContent=state.bossPhase;$('#boss-hp').style.width=`${Math.max(0,state.bossHp/state.bossMaxHp*100)}%`;$('#boss-time').textContent=(state.bossTime/1000).toFixed(1);}
}

function showDialogue(request:DialogueRequest):void{
  const panel=$('#dialogue'),box=panel.querySelector<HTMLElement>('.dialogue-box')!,portrait=$('#dialogue-portrait') as HTMLImageElement;let index=0,closed=false,progress=panel.querySelector<HTMLElement>('#dialogue-progress');
  if(config.ui.dialogue?.showProgress&&!progress){progress=document.createElement('b');progress.id='dialogue-progress';box.insertBefore(progress,$('#dialogue-text'));}else if(!config.ui.dialogue?.showProgress){progress?.remove();progress=null;}
  const render=():void=>{const line=request.lines[index];$('#dialogue-speaker').textContent=line.speaker;$('#dialogue-text').textContent=line.text;if(progress)progress.textContent=`${index+1} / ${request.lines.length}`;$('#dialogue-next').textContent=index===request.lines.length-1?config.ui.startBattle:config.ui.nextDialogue;panel.dataset.side=line.side??'left';const source=line.portrait?config.assets[line.portrait]:'';if(source){portrait.src=source;portrait.alt=`${line.speaker} 스탠딩 일러스트`;portrait.classList.remove('hidden');}else{portrait.removeAttribute('src');portrait.classList.add('hidden');}};
  const advance=():void=>{if(closed)return;index+=1;if(index<request.lines.length){render();return;}closed=true;panel.classList.add('hidden');$('#dialogue-next').onclick=null;panel.onclick=null;dialogueAdvance=null;request.done();};
  dialogueAdvance=advance;$('#dialogue-next').onclick=event=>{event.stopPropagation();advance();};panel.onclick=event=>{if(!(event.target as HTMLElement).closest('button'))advance();};panel.classList.remove('hidden');render();
}

function showMessage(message:{title:string;text:string;duration:number}):void{window.clearTimeout(messageTimer);$('#message-title').textContent=message.title;$('#message-text').textContent=message.text;$('#stage-message').classList.remove('hidden');messageTimer=window.setTimeout(()=>$('#stage-message').classList.add('hidden'),message.duration);}

function showResult(result:{clear:boolean;score:number;graze:number;highScore:number}):void{
  const player=config.players[selectedPlayerId];leaderboard.submit({score:result.score,graze:result.graze,cleared:result.clear,playerId:selectedPlayerId,playerName:player.name});renderLeaderboard();$('#result-kicker').textContent=result.clear?config.ui.stageClear:config.ui.gameOver;$('#result-title').textContent=result.clear?config.ui.stageClearTitle:config.ui.gameOverTitle;$('#result-score').textContent=result.score.toLocaleString();$('#result-graze').textContent=result.graze.toLocaleString();$('#result-high').textContent=result.highScore.toLocaleString();$('#result-screen').classList.remove('hidden');
}

function renderLeaderboard():void{
  const scores=leaderboard.load(),list=$('#leaderboard-list');if(!scores.length){const empty=document.createElement('p');empty.className='score-empty';empty.textContent=config.ui.title.noScores;list.replaceChildren(empty);return;}list.replaceChildren(...scores.map((entry,index)=>createScoreRow(entry,index)));
}

function createScoreRow(entry:ScoreEntry,index:number):HTMLElement{const row=document.createElement('article'),rank=document.createElement('b'),copy=document.createElement('span'),name=document.createElement('strong'),meta=document.createElement('small'),score=document.createElement('em');rank.textContent=String(index+1).padStart(2,'0');name.textContent=entry.playerName;meta.textContent=`${entry.cleared?'CLEAR':'MISS'} · GRAZE ${entry.graze.toLocaleString()}`;score.textContent=entry.score.toLocaleString();copy.append(name,meta);row.append(rank,copy,score);return row;}

function bindControls():void{
  $('#character-select').onclick=event=>{const card=(event.target as HTMLElement).closest<HTMLButtonElement>('[data-player]');if(!card)return;selectedPlayerId=card.dataset.player!;renderCharacterSelect();};$('#start-game').onclick=startGame;$('#restart').onclick=quickRetry;$('#return-title').onclick=returnToTitle;$('#clear-scores').onclick=()=>{leaderboard.clear();renderLeaderboard();};$('#pause-button').onclick=()=>scene?.togglePause();document.addEventListener('visibilitychange',()=>{if(document.hidden&&game?.scene.isActive('bullet-hell'))scene.pauseForVisibility();});
  window.addEventListener('keydown',event=>{const advance=event.code==='KeyZ'||event.code==='Space'||event.code==='Enter';if(event.code==='Space')event.preventDefault();if(event.repeat||!advance)return;if(dialogueAdvance){event.stopImmediatePropagation();dialogueAdvance();return;}if(!$('#result-screen').classList.contains('hidden')){event.preventDefault();event.stopImmediatePropagation();return;}if(!$('#title-screen').classList.contains('hidden')){event.stopImmediatePropagation();startGame();}});
  const keyMap:Record<string,{key:string;code:string}>={up:{key:'ArrowUp',code:'ArrowUp'},down:{key:'ArrowDown',code:'ArrowDown'},left:{key:'ArrowLeft',code:'ArrowLeft'},right:{key:'ArrowRight',code:'ArrowRight'},shoot:{key:'z',code:'KeyZ'},focus:{key:'Shift',code:'ShiftLeft'},bomb:{key:'x',code:'KeyX'}};document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(button=>{const fire=(type:'keydown'|'keyup'):void=>{const key=keyMap[button.dataset.key!];window.dispatchEvent(new KeyboardEvent(type,{...key,bubbles:true}));};button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);fire('keydown');});['pointerup','pointercancel','lostpointercapture'].forEach(type=>button.addEventListener(type,()=>fire('keyup')));});
}

function showBootError(error:unknown):void{const issues=error instanceof ShooterContentError?error.issues:[error instanceof Error?error.message:String(error)],loading=$('#loading');loading.classList.add('error');loading.replaceChildren();const title=document.createElement('strong'),detail=document.createElement('span');title.textContent='게임을 시작할 수 없습니다';detail.textContent=issues.map(issue=>`• ${issue}`).join('\n');loading.append(title,detail);}

void boot();
