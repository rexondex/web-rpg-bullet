import { describe, expect, it } from 'vitest';
import gameData from '../../public/game-data/game.json';
import type { GameProtocol } from '../types';
import { validateContent } from './ContentLoader';

describe('게임 데이터 프로토콜', () => {
  it('기본 시나리오의 모든 참조가 유효하다', () => { expect(validateContent(gameData as GameProtocol)).toEqual([]); });
  it('존재하지 않는 맵 출구를 검출한다', () => {
    const invalid = structuredClone(gameData) as GameProtocol;
    invalid.maps.village.exits[0].to = 'missing-map';
    expect(validateContent(invalid)[0]).toContain('missing-map');
  });
  it('등록하지 않은 캐릭터 에셋 참조를 검출한다', () => {
    const invalid = structuredClone(gameData) as GameProtocol;
    invalid.npcs.rowan.texture = 'missing_portrait';
    expect(validateContent(invalid).join('\n')).toContain('missing_portrait');
  });
  it('잘못된 장비 슬롯과 상점 아이템을 검출한다', () => {
    const invalid = structuredClone(gameData) as GameProtocol;
    invalid.items.bronze_sword.slot = 'unknown_slot';
    invalid.shops.general_store.items[0].itemId = 'missing_item';
    const result = validateContent(invalid).join('\n');
    expect(result).toContain('unknown_slot'); expect(result).toContain('missing_item');
  });
  it('출구 방향과 월드 격자 좌표 불일치를 검출한다', () => {
    const invalid = structuredClone(gameData) as GameProtocol;
    invalid.maps.meadow.exits.find((exit) => exit.to === 'forest')!.direction = 'north';
    expect(validateContent(invalid).join('\n')).toContain('격자 좌표');
  });
});
