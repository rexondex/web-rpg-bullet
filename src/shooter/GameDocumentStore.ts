import type { ShooterGameDocument, ShooterProtocol, ShooterRuntimeState } from './types';
import { validateShooterContent } from './ShooterContent';

export class GameDocumentStore {
  constructor(private readonly base: ShooterProtocol) {}

  get key(): string { return this.base.persistence?.storageKey ?? `${this.base.game.id}:game-document`; }

  save(runtime: ShooterRuntimeState, content: ShooterProtocol = this.base): ShooterGameDocument {
    const document = { ...structuredClone(content), runtime } satisfies ShooterGameDocument;
    localStorage.setItem(this.key, JSON.stringify(document));
    return document;
  }

  load(): ShooterGameDocument | null {
    const raw = localStorage.getItem(this.key);
    if (!raw) return null;
    try { return this.parse(raw); } catch { return null; }
  }

  parse(raw: string): ShooterGameDocument {
    const document = JSON.parse(raw) as ShooterGameDocument;
    const issues = validateShooterContent(document);
    if (issues.length) throw new Error(`게임 문서가 현재 프로토콜과 맞지 않습니다: ${issues.join(', ')}`);
    if (!document.runtime || document.runtime.schemaVersion !== 1) throw new Error('저장 진행 데이터가 없거나 지원하지 않는 버전입니다.');
    if (!document.players[document.runtime.playerId]) throw new Error('저장된 캐릭터가 게임 데이터에 없습니다.');
    if (!document.stages.some(stage => stage.id === document.runtime!.stageId)) throw new Error('저장된 스테이지가 게임 데이터에 없습니다.');
    return document;
  }

  clear(): void { localStorage.removeItem(this.key); }

  export(document = this.load()): Blob {
    if (!document) throw new Error('내보낼 저장 데이터가 없습니다.');
    return new Blob([JSON.stringify(document, null, 2)], { type:'application/json' });
  }
}
