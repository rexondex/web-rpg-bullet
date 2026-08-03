import { describe, expect, it } from 'vitest';
import shooterData from '../../public/game-data/shooter.json';
import { validateShooterContent } from './ShooterContent';
import type { ShooterProtocol } from './types';

describe('탄막 슈팅 데이터 프로토콜', () => {
  it('예제 스테이지의 참조와 패턴이 유효하다', () => {
    expect(validateShooterContent(shooterData as ShooterProtocol)).toEqual([]);
  });

  it('등록하지 않은 적과 위험한 탄 개수를 검출한다', () => {
    const invalid = structuredClone(shooterData) as ShooterProtocol;
    invalid.stages[0].waves[0].enemy = 'missing-enemy';
    invalid.boss.phases[0].patterns[0].count = 999;
    const result = validateShooterContent(invalid).join('\n');
    expect(result).toContain('missing-enemy');
    expect(result).toContain('탄 개수');
  });

  it('없는 대화와 스탠딩 일러스트 참조를 검출한다', () => {
    const invalid = structuredClone(shooterData) as ShooterProtocol;
    invalid.stages[0].introDialogue = 'missing-dialogue';
    invalid.dialogues.opening[0].portrait = 'missing-portrait';
    const result = validateShooterContent(invalid).join('\n');
    expect(result).toContain('missing-dialogue');
    expect(result).toContain('missing-portrait');
  });
});
