# 게임 데이터 프로토콜 v2 작성 가이드

엔진은 빌드 시 코드에 시나리오를 포함하지 않고, 실행 시 `public/game-data/game.json`을 읽어 세계를 구성합니다. 같은 프로토콜을 지킨 JSON으로 이 파일을 교체하면 GitHub Pages에 배포된 게임 내용도 바뀝니다.

## 편집과 검증

`game.json`의 첫 줄에 있는 `$schema` 때문에 JSON Schema를 지원하는 VS Code 등의 편집기에서 자동완성과 오류 표시를 사용할 수 있습니다. 엔진도 시작할 때 ID 참조를 추가 검증합니다. 설정에 오류가 있으면 게임 대신 `maps.forest.exits[0].to` 같은 정확한 위치가 표시됩니다.

ID는 영문 소문자와 `_` 조합을 권장합니다. 표시 이름은 자유롭게 한글로 작성합니다. 다른 데이터를 연결할 때는 표시 이름이 아니라 ID를 사용합니다.

## 최상위 구조

- `game`: 게임 ID, 표시 제목, 콘텐츠 버전, 자동 저장 주기
- `assets`: 이미지, 스프라이트시트, 오디오 파일 매니페스트
- `player`: 시작 위치, 기본 능력치, 레벨 성장치, 누적 경험치 표, 시작 아이템
- `combat`: 공격 재사용 시간, 피격 무적 시간, 공격 거리
- `items`: 소비·재료·퀘스트 아이템
- `monsters`: 능력치, AI 속도, 경험치, 드롭 테이블
- `quests`: 목표, 보상, 성공·실패 설명
- `npcs`: NPC 표시 설정과 사용할 대화 ID
- `dialogues`: 조건, 선택지, 액션으로 구성한 대화 노드
- `maps`: NPC 배치, 출구, 몬스터 스폰 구역

## 에셋 폴더와 등록

에셋 파일은 `public/assets/` 아래에 둡니다. 권장 구조는 다음과 같습니다.

```text
public/assets/
├─ characters/   플레이어와 NPC 월드 이미지
├─ portraits/    대화창 초상화
├─ monsters/     몬스터 이미지와 스프라이트시트
├─ maps/         맵 배경과 오버레이
├─ audio/        배경 음악과 효과음
└─ ui/           아이콘과 UI 이미지
```

먼저 `assets`에 파일을 고유한 에셋 ID로 등록합니다. 경로는 GitHub Pages 하위 경로 배포를 지원하도록 `./assets/`로 시작하는 상대 경로를 권장합니다.

```json
"assets": {
  "images": {
    "knight": { "src": "./assets/characters/knight.png" },
    "portrait_knight": { "src": "./assets/portraits/knight.webp" },
    "castle_background": { "src": "./assets/maps/castle.webp" }
  },
  "spritesheets": {
    "bat_sheet": {
      "src": "./assets/monsters/bat.png",
      "frameWidth": 32,
      "frameHeight": 32
    }
  },
  "audio": {
    "forest_theme": {
      "src": ["./assets/audio/forest.ogg", "./assets/audio/forest.mp3"],
      "volume": 0.45,
      "loop": true
    }
  }
}
```

그다음 데이터에서는 경로를 반복하지 않고 에셋 ID만 사용합니다.

```json
"player": {
  "name": "기사 아렌",
  "texture": "knight",
  "portrait": "portrait_knight",
  "scale": 0.8
}
```

NPC의 `texture`는 월드에 표시할 이미지, `portrait`는 대화창 이미지입니다. 몬스터도 `texture`와 `scale`을 사용합니다. 맵은 `backgroundImage`, `backgroundAlpha`, `music`을 선택적으로 가질 수 있습니다.

완성형 맵 배경을 사용할 때는 `pathOverlay: false`로 설정해 엔진의 기본 길 사각형이 이미지 위를 덮지 않게 합니다. 배경에 그려진 집, 가구, 분수와 실제 이동 영역을 일치시키려면 `objects`에 동일한 좌표와 크기의 `solid: true`, `visible: false` 오브젝트를 배치합니다. 이는 그림에는 보이지만 물리적으로 통과할 수 없는 비가시 충돌 영역입니다.

충돌 오브젝트는 플레이어뿐 아니라 몬스터의 이동에도 적용됩니다. 몬스터는 스폰 구역 안에서 충돌 오브젝트와 겹치지 않는 좌표를 탐색하므로, `spawns` 영역도 배경에서 실제로 걸을 수 있는 전투 평지 안에 두는 것이 좋습니다. 굽은 길은 하나의 큰 충돌 상자로 덮지 말고 절벽·수역·수림의 윤곽을 따라 여러 개의 작은 사각형으로 나누십시오. 출구, 플레이어 `spawn`, NPC 좌표 주변에는 최소한 캐릭터 한 명이 통과할 여유를 남겨야 합니다.

더 엄격한 길 기반 이동은 맵의 `walkableAreas`로 정의합니다. 각 항목의 `points`는 960×540 게임 좌표계에서 보행을 허용할 다각형의 꼭짓점이며, 여러 영역은 서로 겹쳐 연결할 수 있습니다. `walkableAreas`가 존재하면 플레이어와 몬스터는 이 다각형들의 합집합 밖으로 나갈 수 없습니다. 넓은 광장, 굽은 길, 출구 복도를 별도 다각형으로 나누고 경계가 조금씩 겹치게 해야 보이지 않는 틈에 걸리지 않습니다. 엔진은 플레이어 시작점과 NPC·이동 경로가 허용 영역 안인지 시작 시 검증합니다.

```json
"walkableAreas": [
  {
    "id": "main_road",
    "name": "마을 중앙길",
    "points": [
      { "x": 0, "y": 220 },
      { "x": 960, "y": 220 },
      { "x": 960, "y": 340 },
      { "x": 0, "y": 340 }
    ]
  }
]
```

> 충돌은 이미지 파일에서 자동 생성되지 않습니다. 배경을 교체하면 기존 충돌 좌표가 새 그림과 어긋날 수 있으므로 반드시 다시 측정해야 합니다. 직사각형으로 표현하기 어려운 해안선·절벽·곡선 벽은 Tiled 충돌 레이어를 사용하거나 포크한 엔진에 커스텀 물리 도형을 추가하세요. JSON 프로토콜은 충돌을 **명시**할 수 있지만 임의 이미지의 의미를 완벽하게 **추론**하지는 않습니다.

대화 일러스트는 `assets.images`에 등록한 뒤 NPC의 `portrait` 또는 개별 대화 노드의 `portrait`에서 참조합니다. 노드 단위 지정이 NPC 기본값보다 우선하므로 주인공 혼잣말, 회상, 감정 변화에 맞는 별도 일러스트도 표시할 수 있습니다.

맵의 NPC 배치에는 선택적으로 `route`와 `routeDurationMs`를 지정할 수 있습니다. 현재 프로토콜은 시작 좌표와 첫 번째 경로 지점 사이를 왕복하는 간단한 순찰을 지원합니다. 경로가 없으면 NPC는 정지 상태를 유지합니다.

```json
{
  "npcId": "orin",
  "x": 625,
  "y": 225,
  "route": [{ "x": 735, "y": 300 }],
  "routeDurationMs": 5200
}
```

```json
{
  "id": "hero_reflection",
  "speaker": "여행자",
  "portrait": "portrait_hero",
  "text": ["이 길 끝에서 무엇을 만나게 될까?"]
}
```

대화 노드에 `portrait`를 넣으면 해당 문장만 NPC 기본 초상화 대신 다른 표정 이미지를 표시할 수 있습니다.

```json
{
  "id": "angry",
  "speaker": "촌장",
  "portrait": "portrait_rowan_angry",
  "text": ["지금 당장 성문을 닫게!"]
}
```

### 지원 파일

- 일반 이미지: PNG, WebP, JPEG, SVG
- 스프라이트시트: PNG, WebP
- 오디오: 브라우저 호환성을 위해 OGG와 MP3를 함께 등록하는 것을 권장

이미지의 투명 여백과 기준점은 파일에서 통일하는 것이 좋습니다. 월드 캐릭터는 같은 캔버스 크기와 발 위치를 사용하고, 초상화는 정사각형 또는 동일한 종횡비로 준비하세요. 외부 URL도 기술적으로 사용할 수 있지만 CORS와 서비스 종료 위험이 있으므로 배포 저장소 내부 파일을 권장합니다.

## 대화 조건

대화 배열에서 조건을 모두 만족하는 첫 노드가 선택됩니다. 따라서 구체적인 조건의 노드를 위에, 기본 대사를 마지막에 둡니다.

```json
{
  "id": "quest_offer",
  "speaker": "촌장",
  "conditions": [{ "type": "questStatus", "id": "wolf_hunt", "value": "available" }],
  "text": ["늑대를 처리해 주겠나?"],
  "choices": [
    { "text": "수락한다", "actions": [{ "type": "startQuest", "id": "wolf_hunt" }] },
    { "text": "거절한다" }
  ]
}
```

조건 타입은 `questStatus`, `objective`, `level`, `hasItem`, `flag`입니다. 숫자 비교는 `operator`에 `gte` 또는 `lte`를 사용하고, 생략하면 일치 비교입니다.

## 액션

대화, 선택지, 소비 아이템에서 다음 액션을 사용할 수 있습니다.

- `startQuest`, `completeQuest`, `failQuest`
- `objective`: 특정 퀘스트 목표 수치 증가
- `giveItem`, `takeItem`
- `heal`, `xp`
- `setFlag`: 스토리 불리언 값 기록
- `teleport`: 맵과 좌표 변경

퀘스트 목표의 `type`은 `kill`, `talk`, `visit`, `collect`, `custom`입니다. 앞의 네 타입은 엔진 이벤트로 자동 증가하고 `targetId`에는 각각 몬스터, NPC, 맵, 아이템 ID를 넣습니다. `custom`은 대화의 `objective` 액션으로 올립니다.

## 맵과 스폰

각 지역의 게임 좌표계는 960×540이고, 모든 지역은 더 큰 월드 격자의 셀입니다. `grid.x`는 동쪽으로 갈수록 증가하고 `grid.y`는 남쪽으로 갈수록 증가합니다. 예를 들어 `[0,0]`의 동쪽은 `[1,0]`, 북쪽은 `[0,-1]`입니다. 두 맵이 같은 격자 좌표를 사용할 수 없습니다.

출구는 `direction`에 `north`, `east`, `south`, `west` 중 하나를 사용합니다. 일반 월드 경계 출구의 대상 맵은 해당 방향의 바로 옆 격자여야 합니다. 동쪽 경계를 넘으면 대상 맵의 서쪽 경계에 나타나고 Y축 위치가 유지됩니다. 문, 계단, 실내 입구 같은 포탈은 `targetX`, `targetY`를 함께 지정하여 목적지의 정확한 좌표로 이동할 수 있으며 이 경우 인접 격자 검사를 적용하지 않습니다.

```json
{
  "name": "서쪽 평원",
  "grid": { "x": 0, "y": 0 },
  "exits": [
    { "direction": "east", "x": 945, "y": 270, "width": 30, "height": 150, "to": "east_forest", "label": "동쪽 숲" }
  ]
}
```

미니맵은 현재 격자 셀 내부의 위치를 보여주고, 상단의 **월드맵** 버튼은 모든 셀의 배치와 현재 지역을 보여줍니다. 현재 지역명과 월드 좌표는 게임 캔버스 아래에 표시됩니다.

스폰 구역은 좌상단 `x`, `y`, 크기 `width`, `height`, 최대 동시 개체 `max`, 재생성 주기 `respawnMs`를 갖습니다.

## 콘텐츠 업데이트와 세이브

`game.id`가 같으면 기존 세이브를 같은 게임으로 인식합니다. 콘텐츠를 배포할 때 `game.version`을 올리세요. 로드 시 삭제된 퀘스트와 아이템은 정리되고 새 퀘스트는 자동 추가됩니다. `game.id`를 바꾸면 완전히 별개의 게임과 저장 공간으로 취급합니다.

세이브에는 진행 상황만 들어가며 원본 대사·몬스터 설정은 복제하지 않습니다. 따라서 밸런스나 대사를 바꾼 뒤 재배포해도 기존 플레이어는 새로운 설정과 자신의 진행도를 함께 사용합니다.

## 프로토콜 v3 확장 시스템

### 장비

`equipmentSlots`에 슬롯을 선언하고 아이템의 `type`을 `equipment`로 지정합니다. `slot`은 선언한 슬롯 ID, `modifiers`는 장착 중 더할 능력치입니다. 가방 UI에서 장착과 해제가 가능합니다.

### 스킬과 상태 효과

`skills`는 재사용 시간, 범위, 공격 배율, 대상과 추가 액션을 정의합니다. `effects`는 지속 시간, 틱 주기, 능력치 변화, 틱 피해·회복을 정의합니다. `learnSkill`, `effect` 액션으로 이야기 진행 중 획득시킬 수 있습니다.

공격 스킬은 키를 누르는 즉시 범위 안의 적에게 피해를 줍니다. `effect`에는 `slash`, `burst`, `ring`을, `effectColor`에는 `#ffb347` 같은 색상을 지정해 일반 공격과 다른 전용 시각 효과를 구성합니다. `target: "self"`인 회복·강화 스킬도 같은 방식으로 캐릭터 주위에 효과를 표시합니다.

### 화폐와 상점

`currencies`에 화폐를 만들고 `shops`에 상품 목록과 구매·판매 가격을 작성합니다. NPC의 `shop`에 상점 ID를 연결하면 대화 종료 후 상점이 열립니다.

- `items[].buy`: 상점 구매 가격입니다.
- `items[].sell`: 해당 상품의 명시적인 판매 가격입니다.
- `sellMultiplier`: 상점 목록에 없는 일반 아이템과 몬스터 전리품의 기본 판매 배율입니다. 예를 들어 `0.5`는 아이템 `value`의 50%입니다.
- `quest` 타입 아이템과 현재 장착 중인 장비는 판매할 수 없습니다.

스킬북은 별도 전용 타입 없이 `consumable` 아이템의 `actions`에 `{ "type": "learnSkill", "id": "스킬_ID" }`를 넣어 만듭니다. `maxStack`을 `1`로 두면 중복 구매를 방지하기 쉽고, 사용 시 아이템을 소비하면서 해당 스킬이 플레이어의 스킬 목록에 등록됩니다.

### 조건부 출구와 맵 오브젝트

출구의 `conditions`가 충족되지 않으면 이동하지 않으며 `lockedText`가 표시됩니다. `objects`에는 좌표, 크기, 충돌 여부, 표시 에셋, 조건과 상호작용 액션을 지정합니다. 문, 보물상자, 제단, 회복 지점 등을 같은 구조로 만듭니다.

### 보스 행동 패턴

몬스터의 `boss`를 `true`로 하고 `patterns`를 작성합니다. 보스 이름과 전용 체력바가 월드에 표시됩니다. 현재 `chase`, `dash`, `area` 패턴을 지원하며 `hpBelow`, `cooldownMs`, `power`로 페이즈 조건과 위력을 조정합니다. 보스 스폰 구역의 `max`는 보통 `1`로 설정합니다.

몬스터의 `drops`는 처치 즉시 인벤토리에 들어가지 않고 바닥에 아이템과 수량으로 나타납니다. 플레이어가 `combat.lootPickupRange` 안으로 접근하면 자동 획득되며, 아이템별 확률과 최소·최대 수량은 기존 `chance`, `min`, `max`로 설정합니다.

### 컷신·챕터·엔딩

`cutscenes`는 `text`, `wait`, `camera`, `action` 단계의 배열입니다. 대화나 오브젝트에서 `cutscene` 액션으로 실행합니다. `chapter` 액션은 현재 챕터를 바꾸고, `ending` 액션은 조건을 검사한 뒤 엔딩 화면을 표시하고 해금 기록을 세이브합니다.

### 애니메이션

`assets.spritesheets`에 프레임 크기를 등록한 뒤 `assets.animations`에 스프라이트시트 ID, 시작·끝 프레임, FPS와 반복 횟수를 정의합니다. 플레이어의 `animation`에 애니메이션 ID를 연결할 수 있습니다.

### Tiled 맵

맵에 `tiled`를 추가하면 절차형 배경 대신 Tiled JSON을 사용합니다.

```json
"tiled": {
  "json": "./assets/maps/castle.json",
  "tilesets": [{ "name": "castle", "image": "castle_tiles" }],
  "collisionLayer": "Collision"
}
```

Tiled의 타일셋 이름은 `name`, 에셋 매니페스트에 등록한 이미지 ID는 `image`에 작성합니다. 충돌 타일에는 `collides: true` 커스텀 속성을 설정합니다.

### 모바일과 오디오

터치 환경에서는 방향 패드, 상호작용, 공격 버튼이 자동 표시됩니다. 설정 화면의 음악·효과음 음량과 음소거 상태는 세이브에 포함됩니다. 맵의 `music`은 `assets.audio` ID를 참조합니다.

키보드 이동은 방향키만 사용합니다. `E`는 상호작용, `Space`는 기본 공격입니다. 가방의 소비 아이템이나 스킬 창의 스킬은 `Q`, `W` 퀵슬롯에 등록할 수 있으며 등록 내용은 세이브에 포함됩니다. 가방 슬롯은 마우스 포인터 또는 키보드 방향키로 선택하면 별도의 상세 정보 패널을 표시합니다.

### 브라우저 콘텐츠 검사기

게임의 **설정 → JSON 콘텐츠 검사 결과 보기**에서 로드된 맵, NPC, 몬스터, 퀘스트, 아이템, 스킬과 에셋 수를 확인하고 등록 ID를 미리 볼 수 있습니다. 시작 전 로더는 JSON 내부 참조와 실제 파일 존재 여부를 검사합니다.
