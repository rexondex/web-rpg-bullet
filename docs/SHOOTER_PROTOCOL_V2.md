# Shooter Protocol v2

엔진은 입력·충돌·렌더링·오브젝트 풀·저장 복원을 담당하고, 게임 문서는 콘텐츠와 실행 전략의 조합을 담당합니다.

```text
게임 문서(JSON) ── capability/ID 검증 ──> 엔진 전략 실행기 ──> Phaser 런타임
       └──────────────── runtime 자동저장 <────────────────┘
```

## 경계

- 데이터가 바꾸는 것: 캐릭터 능력치와 사격·폭탄 전략, 편대, 적 이동과 복수 탄막, 스테이지 순서, 보스와 페이즈, 대사, UI, 에셋
- 엔진이 보장하는 것: 전략 디스패치, 입력, 충돌, 수명주기, 풀링, 일시정지, 상태 직렬화, 참조 검증
- 새 `type`은 임의의 코드를 실행하지 않습니다. 엔진에 실행기와 capability를 먼저 등록해야 사용할 수 있습니다.

## 참조 규칙

- `game.defaultPlayer` → `players`의 ID
- `game.entryStage`, `stages[].nextStage` → `stages[].id`
- `stages[].waves[].enemy` → `enemies`의 ID
- `stages[].bossId` → `bosses`의 ID
- 모든 `texture`, `portrait`, `background` → `assets`의 ID

## 다형성 전략

| 영역 | `type` |
|---|---|
| 편대 | `line`, `v`, `sweep` |
| 이동 | `linear`, `sine`, `stationary` |
| 적·보스 탄막 | `radial`, `aimed`, `fan`, `spiral`, `rain` |
| 플레이어 사격 | `parallel`, `fan` |
| 폭탄 | `clear-and-damage`, `clear-only` |

문서 최상위 `capabilities`는 데이터가 요구하는 전략을 선언합니다. 로더는 실제 사용 전략이 선언되었는지, 선언한 전략을 현재 엔진이 지원하는지 모두 검사합니다.

## 확장 절차

새 전략을 추가할 때는 다음 네 곳을 함께 변경합니다.

1. `types.ts`의 판별 유니온에 새 타입과 전용 필드 추가
2. `ProtocolCapabilities.ts`에 capability 등록
3. `BulletHellScene.ts`의 해당 전략 실행기에 구현 추가
4. `ShooterContent.ts`와 `shooter.schema.json`에 검증 규칙 추가

이 절차 때문에 잘못된 데이터는 실행 중이 아니라 로딩 단계에서 거부됩니다.

## 버전과 저장

- 콘텐츠 프로토콜: `protocolVersion: 2`
- 런타임 저장 스키마: `runtime.schemaVersion: 1`
- v1 콘텐츠 문서는 v2와 형태가 다르므로 자동 실행하지 않습니다.
- 저장 문서는 콘텐츠 전체와 `runtime`을 결합합니다. 따라서 캐릭터·스테이지·보스 ID는 저장 이후에도 유지해야 합니다.

기계 판독용 기본 스키마는 [`public/game-data/shooter.schema.json`](../public/game-data/shooter.schema.json), 실제 의미·교차 참조 검증은 [`src/shooter/ShooterContent.ts`](../src/shooter/ShooterContent.ts)가 담당합니다.
