import type { ShooterProtocol } from './types';
import { collectRequiredCapabilities, ENGINE_CAPABILITIES } from './ProtocolCapabilities';

export class ShooterContentError extends Error {
  constructor(public issues: string[]) { super(`탄막 게임 설정 오류 ${issues.length}개`); }
}

export async function loadShooterContent(url = './game-data/shooter.json'): Promise<ShooterProtocol> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`탄막 설정을 불러오지 못했습니다. (${response.status})`);
  const data = await response.json() as ShooterProtocol;
  const issues = validateShooterContent(data);
  if (!issues.length) issues.push(...await validateAssetFiles(data));
  if (issues.length) throw new ShooterContentError(issues);
  return data;
}

async function validateAssetFiles(data: ShooterProtocol): Promise<string[]> {
  const results = await Promise.all(Object.entries(data.assets).map(async ([id, src]) => {
    try {
      const response = await fetch(src, { method:'HEAD' });
      return response.ok ? null : `assets.${id}: 파일을 찾을 수 없습니다. '${src}'`;
    } catch { return `assets.${id}: 파일에 접근할 수 없습니다. '${src}'`; }
  }));
  return results.filter((issue): issue is string => issue !== null);
}

export function validateShooterContent(data: ShooterProtocol): string[] {
  const issues: string[] = [];
  if (data.protocolVersion !== 2) issues.push('protocolVersion: 지원 버전은 2입니다.');
  const declared=new Set(data.capabilities??[]),required=collectRequiredCapabilities(data);
  declared.forEach(capability=>{if(!ENGINE_CAPABILITIES.has(capability))issues.push(`capabilities: 엔진이 지원하지 않는 기능 '${capability}'`);});
  required.forEach(capability=>{if(!declared.has(capability))issues.push(`capabilities: 데이터가 사용하는 기능 '${capability}' 선언이 필요합니다.`);});
  if (!data.game?.id || !data.game?.title) issues.push('game.id와 game.title은 필수입니다.');
  if (!data.rules?.playfield || data.rules.playfield.width < 320 || data.rules.playfield.height < 320) issues.push('rules.playfield: 너비와 높이는 320 이상이어야 합니다.');
  if (!data.rules?.pools || Object.values(data.rules.pools).some(value => value < 1)) issues.push('rules.pools: 모든 오브젝트 풀 크기는 1 이상이어야 합니다.');
  if (data.rules && (data.rules.playerHitboxRadius <= 0 || data.rules.grazeRadius <= data.rules.playerHitboxRadius)) issues.push('rules: grazeRadius는 playerHitboxRadius보다 커야 합니다.');
  if (!data.scoring || Object.values(data.scoring).some(value => value < 0)) issues.push('scoring: 점수 값은 0 이상이어야 합니다.');
  if (!data.ui?.stageClear || !data.ui?.gameOver || !data.ui?.labels || !data.ui?.messages) issues.push('ui: 결과, 라벨, 메시지 문구가 필요합니다.');
  if (data.persistence && data.persistence.autosaveIntervalMs < 1000) issues.push('persistence.autosaveIntervalMs: 1000ms 이상이어야 합니다.');
  if (!data.stages?.length) issues.push('stages: 스테이지가 하나 이상 필요합니다.');
  if (!data.players?.[data.game?.defaultPlayer]) issues.push(`game.defaultPlayer: 없는 캐릭터 '${data.game?.defaultPlayer}'`);
  Object.entries(data.players ?? {}).forEach(([id, player]) => {
    if (!data.assets?.[player.texture]) issues.push(`players.${id}.texture: 없는 에셋 '${player.texture}'`);
    if (player.portrait && !data.assets?.[player.portrait]) issues.push(`players.${id}.portrait: 없는 에셋 '${player.portrait}'`);
    if (!player.shotLevels?.length) issues.push(`players.${id}.shotLevels: 사격 단계가 하나 이상 필요합니다.`);
    player.shotLevels?.forEach((level,index)=>{if(level.power<1||level.power>player.maxPower||level.damage<=0||(level.type==='parallel'&&!level.offsets.length)||(level.type==='fan'&&(level.count<1||level.spread<=0)))issues.push(`players.${id}.shotLevels[${index}]: 사격 전략의 파워, 탄 수 또는 피해량이 유효하지 않습니다.`);});
    if(!player.bomb||player.bomb.invulnerabilityMs<0)issues.push(`players.${id}.bomb: 폭탄 전략이 필요합니다.`);
    if (data.rules?.playfield && (player.spawnX<0||player.spawnX>data.rules.playfield.width||player.spawnBottom<0||player.spawnBottom>data.rules.playfield.height)) issues.push(`players.${id}: 시작 위치가 플레이 영역 밖입니다.`);
  });
  const stageIds = new Set<string>();
  data.stages?.forEach((stage, stageIndex) => {
    if (stageIds.has(stage.id)) issues.push(`stages[${stageIndex}].id: 중복 ID '${stage.id}'`); else stageIds.add(stage.id);
    if (stage.width !== data.rules?.playfield.width || stage.height !== data.rules?.playfield.height) issues.push(`stages[${stageIndex}]: rules.playfield 크기와 일치해야 합니다.`);
    if (!data.assets?.[stage.background]) issues.push(`stages[${stageIndex}].background: 없는 에셋 '${stage.background}'`);
    if(stage.backgroundPresentation&&((stage.backgroundPresentation.focusX??.5)<0||(stage.backgroundPresentation.focusX??.5)>1||(stage.backgroundPresentation.focusY??.5)<0||(stage.backgroundPresentation.focusY??.5)>1))issues.push(`stages[${stageIndex}].backgroundPresentation: focusX와 focusY는 0~1이어야 합니다.`);
    if(stage.bossId&&!data.bosses?.[stage.bossId])issues.push(`stages[${stageIndex}].bossId: 없는 보스 '${stage.bossId}'`);
    [stage.introDialogue, stage.clearDialogue, stage.bossDialogue].filter(Boolean).forEach(dialogueId => { if (!data.dialogues?.[dialogueId!]) issues.push(`stages[${stageIndex}]: 없는 대화 '${dialogueId}'`); });
    stage.waves.forEach((wave, waveIndex) => {
      if (!data.enemies?.[wave.enemy]) issues.push(`stages[${stageIndex}].waves[${waveIndex}]: 없는 적 '${wave.enemy}'`);
      if (wave.count < 1 || wave.atMs < 0) issues.push(`stages[${stageIndex}].waves[${waveIndex}]: count와 atMs가 유효하지 않습니다.`);
    });
  });
  data.stages?.forEach((stage, stageIndex) => { if (stage.nextStage && !stageIds.has(stage.nextStage)) issues.push(`stages[${stageIndex}].nextStage: 없는 스테이지 '${stage.nextStage}'`); });
  Object.entries(data.dialogues ?? {}).forEach(([id, lines]) => lines.forEach((line, index) => { if (!line.speaker || !line.text) issues.push(`dialogues.${id}[${index}]: 화자와 대사가 필요합니다.`); if (line.portrait && !data.assets?.[line.portrait]) issues.push(`dialogues.${id}[${index}].portrait: 없는 에셋 '${line.portrait}'`); }));
  Object.entries(data.enemies ?? {}).forEach(([id, enemy]) => {
    if (enemy.hp <= 0 || enemy.speed < 0) issues.push(`enemies.${id}: hp와 speed가 유효하지 않습니다.`);
    if (enemy.pickupChance < 0 || enemy.pickupChance > 1) issues.push(`enemies.${id}.pickupChance: 0~1이어야 합니다.`);
    if(!enemy.patterns?.length)issues.push(`enemies.${id}.patterns: 탄막이 하나 이상 필요합니다.`);
    enemy.patterns?.forEach((pattern,index)=>validatePattern(pattern,`enemies.${id}.patterns[${index}]`,issues));
    if(enemy.texture&&!data.assets?.[enemy.texture])issues.push(`enemies.${id}.texture: 없는 에셋 '${enemy.texture}'`);
  });
  Object.entries(data.bosses??{}).forEach(([id,boss])=>{
    if(!data.assets?.[boss.texture])issues.push(`bosses.${id}.texture: 없는 에셋 '${boss.texture}'`);
    if(!boss.phases?.length)issues.push(`bosses.${id}.phases: 페이즈가 하나 이상 필요합니다.`);
    if(boss.movement?.type==='sine'&&(boss.movement.periodMs<=0||boss.movement.enterSpeed<=0))issues.push(`bosses.${id}.movement: 이동 주기와 진입 속도는 0보다 커야 합니다.`);
    boss.phases?.forEach((phase,phaseIndex)=>{if(phase.hp<=0||phase.durationMs<1000)issues.push(`bosses.${id}.phases[${phaseIndex}]: hp 또는 제한 시간이 유효하지 않습니다.`);phase.patterns?.forEach((pattern,patternIndex)=>validatePattern(pattern,`bosses.${id}.phases[${phaseIndex}].patterns[${patternIndex}]`,issues));});
  });
  if(data.game?.entryStage&&!stageIds.has(data.game.entryStage))issues.push(`game.entryStage: 없는 스테이지 '${data.game.entryStage}'`);
  return issues;
}

function validatePattern(pattern: { intervalMs:number; bulletSpeed:number; count:number }, path: string, issues: string[]): void {
  if (pattern.intervalMs < 40 || pattern.bulletSpeed <= 0 || pattern.count < 1 || pattern.count > 96) issues.push(`${path}: 발사 간격, 속도 또는 탄 개수가 유효하지 않습니다.`);
}
