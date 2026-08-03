# STARFALL BARRAGE

Phaser 3, TypeScript, Vite로 만든 데이터 기반 웹 탄막 슈팅 예제입니다. 기존 2D RPG 프로젝트의 에셋 로딩 구조를 유지하면서 실제 플레이 루프를 세로형 탄막 슈팅으로 전환했습니다.

## 실행

```bash
npm install
npm run dev
```

- 프로덕션 빌드: `npm run build`
- 전체 테스트: `npm test`
- 탄막 데이터만 검증: `npm run validate:content`

## 조작

- 이동: 방향키 또는 WASD
- 사격: Z
- 저속 이동 및 히트박스 표시: Shift
- 폭탄: X
- 일시정지: P

모바일·터치 환경에서는 화면 아래의 가상 버튼을 사용할 수 있습니다.

## 프로토타입 구성

- 약 2~4분 분량의 짧은 스테이지 2개
- 오프닝, 스테이지 전환, 보스 조우, 클리어 대화
- 보스 1명과 스펠 페이즈 2개
- JSON에서 대사, 화자, 좌우 배치, 선택적 스탠딩 이미지 교체

## 예제 기능

- 오브젝트 풀을 이용한 최대 900개 적 탄환 관리
- 방사형, 조준형, 부채꼴, 나선형, 낙하형 탄막
- JSON으로 편집하는 웨이브와 보스 3페이즈
- 집중 이동, 히트박스 표시, 그레이즈와 체인 점수
- 파워 아이템, 다중 사격, 잔기, 폭탄, 무적 시간
- 스펠 제한 시간, 격파 보너스, 스테이지 클리어와 재도전
- 브라우저 로컬 최고 점수 저장
- 키보드 및 모바일 터치 조작

## 콘텐츠 편집

탄막과 대화 콘텐츠는 [`public/game-data/shooter.json`](public/game-data/shooter.json)에 있습니다.

- `stages[].waves`: 등장 시각, 적 종류, 수, 진형
- `dialogues`: 화자, 대사, 스탠딩 에셋 ID, 좌우 배치
- `enemies`: 체력, 이동 속도, 점수, 기본 탄막
- `boss.phases`: 페이즈별 체력, 제한 시간, 복수 탄막
- `assets`: 플레이어, 보스, 배경 이미지 경로

데이터 형식은 [`src/shooter/types.ts`](src/shooter/types.ts), 참조 검증은 [`src/shooter/ShooterContent.ts`](src/shooter/ShooterContent.ts), 런타임은 [`src/shooter/BulletHellScene.ts`](src/shooter/BulletHellScene.ts)에 구현되어 있습니다.

기존 RPG 엔진 파일과 `game.json`은 이후 대화 장면, 스토리 인터미션, 상점 같은 메타 게임을 다시 결합할 수 있도록 보존되어 있습니다.
