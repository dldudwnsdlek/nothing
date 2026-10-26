# 치이카와 데스크톱 펫 🐻🐱🐰

치이카와 · 하치와레 · 우사기가 모니터 아래쪽(작업표시줄/Dock 위)을 돌아다니는 데스크톱 펫입니다.
**Windows**와 **macOS(인텔/애플 실리콘)** 모두에서 동작합니다. (Electron 기반)

> 캐릭터 그림은 저장소 루트에 올린 사진들(`치이카와_1.jpg` 등)에서 배경을 지워 만든 것입니다.
> 원작 그림의 저작권은 원작자(nagano)에게 있으므로 개인 소장·비상업적 용도로만 사용해 주세요.

## 사용법

앱을 켜면 작은 패널 창이 뜹니다.

| 버튼 | 동작 |
| --- | --- |
| 치이카와 / 하치와레 / 우사기 카드 | 누를 때마다 해당 캐릭터가 화면 가장자리에서 걸어 나옴 (최대 15마리) |
| 다 같이 나와! | 셋이 차례로 등장 |
| 모두 들여보내기 | 전부 화면 밖으로 뛰어서 퇴장 |

캐릭터와 놀기
- **클릭**: 깡충 뛰면서 한마디
- **드래그**: 들어 올려서 흔들기 → 놓으면 던져져서 날아감
- **우클릭**: 그 캐릭터만 집에 보내기
- 캐릭터가 없는 곳의 클릭은 아래 창으로 그대로 전달되므로 평소처럼 컴퓨터를 쓸 수 있습니다.
- 패널 창을 닫으면 프로그램이 종료됩니다.

## 자세(포즈)

| 자세 | 사용하는 그림 / 움직임 |
| --- | --- |
| 엎드리기 | 첫 사진처럼 납작하게 찌부러져 쉬기 |
| 잠자기 | 납작 엎드려서 숨쉬며 Zzz |
| 걷기 / 달리기 | 통통 튀며 좌우 이동 (우사기는 뒤돌아 달리는 그림) |
| 소풍 | 셋이 함께 있는 사진에서 잘라낸 바구니 든 모습 |
| 냠냠 (치이카와) | 간식 들고 있는 그림 + 반짝이 |
| 응원 춤 (하치와레) | 폼폼 든 그림 + ♪ |
| 청소 (우사기) | 빗자루 든 그림 |
| 울기 (치이카와) | 우는 그림 + 눈물 |
| 점프 / 떨어지기 / 착지 | 중력 물리 적용, 착지 시 찌부 |
| 말하기 / 외치기 | 말풍선 (우사기는 "우라!", "야하!") |
| 들려있기 | 드래그 중 흔들흔들 |

## 그림 바꾸기 / 추가하기

1. 저장소 루트에 캐릭터 사진을 올립니다 (흰 배경일수록 잘 지워집니다).
2. `tools/make_sprites.py` 의 `SOURCES` 에 파일 이름을 추가합니다.
3. `python3 tools/make_sprites.py` 를 실행하면 `src/sprites/` 에 배경이 지워진 PNG가 생깁니다. (Pillow, numpy 필요)
4. `src/characters.js` 의 `SPRITES`(표시 높이)와 `POSE_SPRITE`(어떤 자세에 쓸지)에 등록합니다.

## 실행하기 (개발 모드)

[Node.js](https://nodejs.org) 18 이상이 필요합니다.

```bash
cd chiikawa-desktop-pet
npm install
npm start
```

## 설치 파일 만들기

```bash
# Windows에서 → dist/ 에 설치용 .exe 와 무설치(portable) .exe 생성
npm run dist:win

# macOS에서 → dist/ 에 .dmg 생성 (인텔·애플 실리콘 공용 universal)
npm run dist:mac
```

GitHub에 올리면 `.github/workflows/build-chiikawa-pet.yml` 가 Windows·macOS 설치 파일을 자동으로 만들어 줍니다.
GitHub 저장소의 **Actions → Build Chiikawa Desktop Pet → 최근 실행 → Artifacts** 에서 내려받으세요.
(수동 실행: Actions 탭에서 `Run workflow`)

### macOS에서 처음 열 때

코드 서명이 없는 앱이라 처음엔 "확인되지 않은 개발자" 경고가 뜹니다.
Finder에서 앱을 **우클릭 → 열기 → 열기** 하면 됩니다.
(또는 터미널에서 `xattr -cr /Applications/ChiikawaPet.app`)

### Windows에서 처음 열 때

SmartScreen 경고가 뜨면 **추가 정보 → 실행**을 누르세요.

## 파일 구조

```
src/
  main.js        Electron 메인 프로세스 (투명 오버레이 창 + 패널 창)
  preload.js     창 ↔ 메인 통신
  characters.js  자세별 그림 선택 + 움직임/효과
  sprites/       배경을 지운 캐릭터 그림
  pets.js        돌아다니기 행동 AI, 물리, 클릭/드래그
  overlay.html   화면 전체를 덮는 투명 창
  panel.html/js  캐릭터 부르기 버튼 패널
build/icon.png   앱 아이콘
tools/make_sprites.py  사진 → 투명 스프라이트 변환
```

새 자세를 추가하려면 `characters.js` 의 `motion()` 에 case를 추가하고,
`pets.js` 의 `BEHAVIOR` 표에 가중치를 넣으면 됩니다.
