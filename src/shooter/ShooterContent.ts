import type { ShooterProtocol } from './types';

export class ShooterContentError extends Error {
  constructor(public issues: string[]) { super(`탄막 게임 설정 오류 ${issues.length}개`); }
}

export async function loadShooterContent(url = './game-data/shooter.json'): Promise<ShooterProtocol> {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`탄막 설정을 불러오지 못했습니다. (${response.status})`);
  const data = await response.json() as ShooterProtocol;
  const issues = validateShooterContent(data);
  if (issues.length) throw new ShooterContentError(issues);
  return data;
}

export function validateShooterContent(data: ShooterProtocol): string[] {
  const issues: string[] = [];
  if (data.protocolVersion !== 1) issues.push('protocolVersion: 지원 버전은 1입니다.');
  if (!data.game?.id || !data.game?.title) issues.push('game.id와 game.title은 필수입니다.');
  if (data.stage?.width !== 640 || data.stage?.height !== 720) issues.push('stage: 예제 플레이 영역은 640×720이어야 합니다.');
  if (!data.assets?.[data.stage?.background]) issues.push(`stage.background: 없는 에셋 '${data.stage?.background}'`);
  if (!data.assets?.[data.player?.texture]) issues.push(`player.texture: 없는 에셋 '${data.player?.texture}'`);
  if (!data.assets?.[data.boss?.texture]) issues.push(`boss.texture: 없는 에셋 '${data.boss?.texture}'`);
  data.stage?.waves?.forEach((wave, index) => {
    if (!data.enemies?.[wave.enemy]) issues.push(`stage.waves[${index}]: 없는 적 '${wave.enemy}'`);
    if (wave.count < 1 || wave.atMs < 0) issues.push(`stage.waves[${index}]: count와 atMs가 유효하지 않습니다.`);
  });
  Object.entries(data.enemies ?? {}).forEach(([id, enemy]) => {
    if (enemy.hp <= 0 || enemy.speed < 0) issues.push(`enemies.${id}: hp와 speed가 유효하지 않습니다.`);
    validatePattern(enemy.pattern, `enemies.${id}.pattern`, issues);
  });
  data.boss?.phases?.forEach((phase, phaseIndex) => {
    if (phase.hp <= 0 || phase.durationMs < 1000) issues.push(`boss.phases[${phaseIndex}]: hp 또는 제한 시간이 유효하지 않습니다.`);
    phase.patterns.forEach((pattern, patternIndex) => validatePattern(pattern, `boss.phases[${phaseIndex}].patterns[${patternIndex}]`, issues));
  });
  return issues;
}

function validatePattern(pattern: { intervalMs:number; bulletSpeed:number; count:number }, path: string, issues: string[]): void {
  if (pattern.intervalMs < 40 || pattern.bulletSpeed <= 0 || pattern.count < 1 || pattern.count > 96) issues.push(`${path}: 발사 간격, 속도 또는 탄 개수가 유효하지 않습니다.`);
}
