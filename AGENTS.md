# AGENTS.md

## 프로젝트 고정 조건
- 스택은 `Vite + React + Firebase Firestore + Firebase Auth + Vercel`만 사용한다.
- PWA는 `vite-plugin-pwa`를 사용한다.
- 푸시 백엔드는 `Firebase Cloud Functions v2 + FCM` 기준으로 유지한다.
- 다른 프레임워크나 대체 라이브러리는 추가하지 않는다.

## 환경변수 / 시크릿
- Firebase 웹 설정값은 전부 `.env`로 분리한다.
- 클라이언트에서는 `import.meta.env.VITE_*`로만 읽는다.
- 하드코딩 금지.
- 커밋 대상은 `.env.example`만이다.
- 현재 필요한 키:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FCM_VAPID_KEY=
```

## MVP 범위
- 아래 3개만 유지한다.
- 공유 캘린더: 월/주 뷰, 일정 추가/수정/삭제, owner 색 구분
- 일별 컨디션: 날짜별 이모지 상태 + 짧은 노트, 각자 입력
- D-day 카운터: 만난 날, 100일 단위 반복, 다음 여행 등
- 이 범위를 벗어나는 기능은 요청 전까지 추가하지 않는다.

## 인증 / 가입 플로우
- 인증은 `이메일/비밀번호 + 커플 코드` 방식이다.
- 로그인 후 별도 페어링 화면으로 합류하지 않는다.
- 회원가입 안에서 2가지 경로를 처리한다.
  - founder: `커플 새로 만들기`
  - joiner: `커플 코드로 합류`
- founder 가입 성공 시:
  - Auth 계정 생성
  - `couples` 문서 생성
  - `pairingCodes` 문서 생성
  - `users/{uid}.coupleId` 저장
  - 대기 화면에서 커플 코드 노출
- joiner 가입 성공 시:
  - Auth 계정 생성
  - pairing code 검증
  - 해당 couple의 `members`에 자기 uid 추가
  - `users/{uid}.coupleId` 저장
- founder 가입 직후 `users/{uid}` 반영 레이스를 막기 위해 `sessionStorage`의 pending signup context를 사용한다.

## 가입 차단 스위치
- `config/app` 문서를 사용한다.
- 구조:

```txt
/config/app
  signupEnabled: boolean
```

- 이 문서는 Firestore 콘솔에서 수동 생성/토글한다.
- `signupEnabled=false`면:
  - 회원가입 UI 숨김
  - 로그인만 허용
  - 서버 rules에서도 커플 생성/합류 차단

## Firestore 데이터 모델

```txt
/config/app
  signupEnabled: boolean

/users/{uid}
  coupleId: string | null

/pairingCodes/{code}
  ownerUid: string
  coupleId: string
  createdAt: timestamp

/couples/{coupleId}
  members: [uid1, uid2]
  anniversary: timestamp
  createdAt: timestamp
  fcmTokens: { [uid]: string }

/couples/{coupleId}/events/{eventId}
  title, start, end, allDay, ownerUid, createdAt

/couples/{coupleId}/moods/{date}
  {uid}: { emoji, note }

/couples/{coupleId}/ddays/{ddayId}
  label, date, repeatEvery
```

## Firestore 보안 규칙 원칙
- 기본은 couple member만 읽기/쓰기 가능.
- `config/app`은 비로그인 public read 허용, write 금지.
- 커플 생성은 `signupEnabled=true`일 때만 허용.
- 커플 join update도 `signupEnabled=true`일 때만 허용.
- `fcmTokens`는 couple member라도 자기 uid 키만 수정 가능하게 제한한다.

## 로컬 데모 모드
- Firebase env가 비어 있으면 로컬 데모 모드로 동작한다.
- 저장소는 `localStorage` 기반이다.
- 데모 로그인 버튼은 `import.meta.env.PROD`가 아닐 때만 노출한다.
- 실제 Firebase 기능 테스트는 `.env`를 채운 상태에서만 가능하다.

## PWA / 서비스워커
- 수동 `public/sw.js`는 사용하지 않는다.
- `vite-plugin-pwa` + `injectManifest` 구조를 사용한다.
- 진짜 서비스워커 엔트리는 `src/sw.js`다.
- `vite.config.js`에서:
  - `strategies: 'injectManifest'`
  - `filename: 'sw.js'`
  - `registerType: 'prompt'`
- 업데이트 UX는 강제 모달 방식이다.
  - 새 버전 감지 시 닫기 없는 모달 표시
  - `지금 업데이트`만 가능
  - `updateSW(true)` 후 새로고침
- iOS standalone 대응으로 `visibilitychange` 시 업데이트 체크를 다시 한다.

## 전역 확대/축소 차단
- iPhone Safari 기준으로 앱 전역 확대/축소를 막는다.
- `index.html` viewport는 아래 형태를 유지한다.

```html
<meta
  name="viewport"
  content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
/>
```

- 전역 CSS:
  - `html, body { touch-action: pan-x pan-y; }`
  - `-webkit-text-size-adjust: 100%`
  - `text-size-adjust: 100%`
- 입력 폼은 `font-size: 16px` 이상 유지한다.
- `main.jsx`에서:
  - `gesturestart / gesturechange / gestureend` preventDefault
  - `touchend` 더블탭 줌 차단

## 모바일 인증 화면 규칙
- 로그인 / 회원가입 / 코드 대기 화면은 `100dvh` 기준으로 동작한다.
- 랜딩 화면 마운트 중에는 `body.no-scroll`을 붙여 페이지 스크롤을 막는다.
- 인증 카드 상단 핀 장식은 잘리지 않게 카드 `overflow: visible` 유지.
- 카드 내부 스크롤은 `.auth-card-scroll`이 담당한다.
- `input[type="date"]`는 iOS Safari 대응으로:
  - `appearance: none`
  - `-webkit-appearance: none`
  - 다른 input과 동일한 높이/패딩/보더 유지

## 디자인 / 테마
- 라이트 모드만 지원한다.
- iPhone 세로 한 손 사용 기준이다.
- 코르크보드 배경 + 종이 카드 + 포스트잇 톤 유지.
- 색 토큰은 아래 기준을 유지한다.

```css
:root {
  --board: #D9BF8E;
  --bg: #FFF9EC;
  --surface: #FFFDF7;
  --surface-2: #FFF3CE;
  --primary: #FFC83D;
  --primary-ink: #3A2E12;
  --accent: #E63B41;
  --accent-pressed: #C92A30;
  --text: #2A2520;
  --text-mute: #8B8170;
  --line: #ECE0C4;
  --me: #E63B41;
  --partner: #2C9C8E;
  --note-yellow: #FFE08A;
  --note-peach: #FFC9A3;
  --note-rose: #FFB3B0;
  --note-mint: #BFE8D2;
  --note-ink: #4A3B1E;
}
```

## 버튼 시스템
- 버튼은 아래 4종 기준으로만 유지한다.
- `.btn-primary`
- `.btn-secondary`
- `.btn-ghost`
- `.btn-danger-soft`
- `white-space: nowrap` 유지.
- 빨간 `.btn-primary`는 화면당 핵심 액션 1개만 강하게 보이게 유지한다.

## 캘린더 / 화면 구조
- 탭바는 `캘린더 / 컨디션 / D-day` 3개 고정.
- 캘린더 기본은 `주 뷰`.
- 월 뷰는 토글로만 전환.
- 요일은 헤더 한 줄에만 두고, 날짜 셀은 숫자 + 점 표시 중심으로 유지.
- 선택일 컨디션은 포스트잇, 일정 목록은 흰 카드로 유지.

## 푸시 알림 클라이언트편
- FCM 웹 푸시는 클라이언트에서 이미 연결돼 있다.
- `couples/{coupleId}.fcmTokens.{uid}`에 자기 토큰을 저장한다.
- 권한 요청은 반드시 사용자 클릭 안에서만 호출한다.
- iPhone은 홈 화면에 추가한 PWA에서만 알림 지원.
- Safari 탭에서는 미지원 안내를 보여준다.
- 앱 진입 시 권한이 허용 상태면 토큰을 다시 발급해 최신값으로 저장한다.
- 포그라운드 수신은 `onMessage`로 generic 토스트만 띄운다.

## 푸시 알림 백엔드편
- `functions/` 디렉터리 사용.
- Functions v2 기준.
- 현재 함수:
  - `sendDdayNotifications`
  - `notifyOnMoodWrite`
  - `notifyOnEventCreate`
- 디데이 알림:
  - 매일 오전 7시 KST
  - D-7, D-1만 발송
  - `repeatEvery === "100days"` 계산 포함
- 기록 알림:
  - mood write 시 이번 변경 작성자의 상대에게만
  - event create 시 ownerUid의 상대에게만
- 본인에게는 보내지 않는다.
- 만료 토큰은 자동 삭제한다.

## 푸시 payload 정책
- 실제 내용은 절대 넣지 않는다.
  - mood emoji/note 금지
  - event title 금지
  - dday label 금지
- notification payload 방식 사용.
- generic 문구만 허용.

```txt
디데이 D-7
title: moody
body: 곧 다가와요 — moody에서 확인해요

디데이 D-1
title: moody
body: 내일이에요! moody 열어보기

컨디션/일정 생성
title: moody
body: 오늘의 기록이 도착했어요 — moody에서 확인
```

- `data`에는 최소 정보만 넣는다.
  - `type`
  - `link: "/"`
- 백그라운드 알림은 OS 자동 표시를 사용한다.
- 서비스워커에서 notification payload에 대해 `showNotification()`을 다시 호출하지 않는다.

## 배포 / 운영
- Vercel은 SPA rewrite를 유지하되 정적 asset과 PWA 파일은 제외한다.
- Firebase Functions 배포는 루트에서 아래 명령 사용:

```bash
firebase deploy --only functions
```

- Functions lint:

```bash
cd functions
npm install
npm run lint
```

## Firebase / GCP 수동 체크리스트
- Email/Password Auth 활성화
- Firestore 생성 및 rules 배포
- `config/app` 문서 생성
- Cloud Messaging 활성화
- Web Push VAPID 키 발급
- Blaze 플랜 사용
- Functions 관련 API 활성화:
  - Cloud Functions API
  - Cloud Build API
  - Artifact Registry API
  - Cloud Run Admin API
  - Eventarc API
  - Cloud Scheduler API
  - Pub/Sub API

## 인코딩 규칙
- 모든 파일은 `UTF-8`로 저장한다.
- 한글 문자열이 깨진 상태로 커밋/배포하지 않는다.
- JSX, CSS, HTML, JSON, Markdown, Firestore rules, Functions 코드 모두 동일하다.
- 콘솔 출력상 깨짐이 보이면 실제 파일 인코딩과 문자열을 바로 확인한다.

## 검증 규칙
- 프론트 변경 후 최소 `npm run build` 통과.
- Functions 변경 후 최소 `functions npm run lint` 통과.
- PWA/SW 변경 후 빌드 결과에 `dist/sw.js`가 정상 생성되는지 확인.
- 푸시 관련 변경은 다음을 확인한다.
  - 토큰 저장
  - 토큰 제거
  - 포그라운드 generic 토스트
  - 백그라운드 generic 알림
  - 중복 알림 없음
