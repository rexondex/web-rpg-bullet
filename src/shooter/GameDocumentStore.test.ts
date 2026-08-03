import { beforeEach, describe, expect, it } from 'vitest';
import shooterData from '../../public/game-data/shooter.json';
import { GameDocumentStore } from './GameDocumentStore';
import type { ShooterProtocol, ShooterRuntimeState } from './types';

const memory=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value),removeItem:(key:string)=>memory.delete(key)}});
const runtime:ShooterRuntimeState={schemaVersion:1,savedAt:'2026-08-04T00:00:00.000Z',playerId:'star_traveler',stageId:'moonlit_path',stageElapsedMs:1200,waveIndex:1,bossTriggered:false,player:{x:320,y:600,score:100,lives:3,bombs:2,power:1,graze:0,combo:0,comboRemainingMs:0,invulnerableRemainingMs:0},boss:null,entities:[]};

describe('GameDocumentStore',()=>{
  beforeEach(()=>memory.clear());
  it('콘텐츠와 진행 상태를 하나의 JSON 문서로 저장한다',()=>{const store=new GameDocumentStore(shooterData as ShooterProtocol),document=store.save(runtime);expect(document.stages).toEqual(shooterData.stages);expect(store.load()?.runtime?.player.score).toBe(100);});
  it('진행 상태가 없는 콘텐츠 JSON은 저장 게임으로 거부한다',()=>{const store=new GameDocumentStore(shooterData as ShooterProtocol);expect(()=>store.parse(JSON.stringify(shooterData))).toThrow('진행 데이터');});
});
