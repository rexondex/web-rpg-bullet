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

  it('게임 규칙과 스테이지 연결 오류를 검출한다', () => {
    const invalid = structuredClone(shooterData) as ShooterProtocol;
    invalid.rules.grazeRadius = invalid.rules.playerHitboxRadius;
    invalid.stages[0].nextStage = 'missing-stage';
    const result = validateShooterContent(invalid).join('\n');
    expect(result).toContain('grazeRadius');
    expect(result).toContain('missing-stage');
  });

  it('필수 규칙 묶음이 없어도 예외 대신 검증 오류를 반환한다', () => {
    const invalid = structuredClone(shooterData) as Partial<ShooterProtocol>;
    delete invalid.rules;
    expect(() => validateShooterContent(invalid as ShooterProtocol)).not.toThrow();
    expect(validateShooterContent(invalid as ShooterProtocol).join('\n')).toContain('rules.playfield');
  });

  it('등록되지 않은 기본 캐릭터를 검출한다', () => {
    const invalid = structuredClone(shooterData) as ShooterProtocol;
    invalid.game.defaultPlayer = 'missing-player';
    expect(validateShooterContent(invalid).join('\n')).toContain('missing-player');
  });
});
