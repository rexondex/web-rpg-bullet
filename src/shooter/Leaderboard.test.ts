import { beforeEach, describe, expect, it } from 'vitest';
import { LocalLeaderboard } from './Leaderboard';

const memory = new Map<string,string>();
Object.defineProperty(globalThis, 'localStorage', { configurable:true, value:{ getItem:(key:string)=>memory.get(key)??null, setItem:(key:string,value:string)=>memory.set(key,value), removeItem:(key:string)=>memory.delete(key) } });
beforeEach(() => memory.clear());

describe('LocalLeaderboard', () => {
  it('높은 점수 순서로 기록하고 최대 개수를 제한한다', () => {
    const board = new LocalLeaderboard('test', 2);
    board.submit({ score:100, graze:1, cleared:false, playerId:'a', playerName:'A' });
    board.submit({ score:300, graze:2, cleared:true, playerId:'a', playerName:'A' });
    board.submit({ score:200, graze:3, cleared:false, playerId:'b', playerName:'B' });
    expect(board.load().map(entry=>entry.score)).toEqual([300,200]);
  });

  it('손상된 저장값을 안전하게 무시하고 초기화한다', () => {
    localStorage.setItem('test:leaderboard','broken');
    const board = new LocalLeaderboard('test');
    expect(board.load()).toEqual([]); board.clear(); expect(localStorage.getItem('test:leaderboard')).toBeNull();
  });
});
