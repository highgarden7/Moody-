# AGENTS.md

## 프로젝트 고정 조건
- 스택은 `Vite + React + Firebase Firestore + Firebase Auth + Vercel`만 사용한다.
- 다른 스택이나 대체 라이브러리를 제안하지 않는다.
- Firebase 설정값과 시크릿은 전부 `.env`로 분리한다.
- 클라이언트에서는 `import.meta.env`로만 환경변수를 읽는다.
- `.env` 실값은 저장소에 커밋하지 않는다. 키 이름은 `.env.example`에만 유지한다.

## MVP 범위
- 아래 3개만 다룬다.
- `공유 캘린더`: 월/주 뷰, 일정 추가/수정/삭제, owner별 색 구분
- `일별 컨디션 상태`: 날짜별 이모지 상태 + 짧은 노트, 각자 입력
- `D-day 카운터`: 만난 날, 100일 단위, 다음 여행 등 날짜 카운트
- 웹푸시, 과한 확장 기능, 범위 밖 부가 기능은 요청 전까지 추가하지 않는다.

## 인증 / 데이터 모델
- 인증은 Firebase Auth 기반으로 유지한다.
- 두 계정은 `pairing code`로 하나의 `coupleId`에 묶는다.
- Firestore 데이터 모델은 아래 구조를 기준으로 유지한다.

```txt
/couples/{coupleId}
  members: [uid1, uid2]
  anniversary: timestamp
  createdAt
/couples/{coupleId}/events/{eventId}
  title, start, end, allDay, ownerUid, createdAt
/couples/{coupleId}/moods/{date}
  {uid}: { emoji, note }
/couples/{coupleId}/ddays/{ddayId}
  label, date, repeatEvery
```

## 동기화 / PWA
- 상대 변경사항은 Firestore `onSnapshot` 실시간 리스너로 즉시 반영한다.
- PWA는 `manifest + service worker` 구조를 유지한다.
- 대상 사용 환경은 `iPhone + Safari + 홈 화면에 추가`이다.

## UI / UX 원칙
- 모바일 우선, `iPhone 세로 한 손 화면` 기준으로만 설계한다.
- 데스크탑 반응형은 우선순위가 아니다.
- 한 화면에는 한 가지 일만 배치한다.
- 하단 탭바로 `캘린더 / 컨디션 / D-day`를 전환한다.
- 캘린더 기본은 `주 뷰`이고, 월 뷰는 토글로 제공한다.
- 탭/버튼 터치 영역은 최소 `44x44px` 이상 유지한다.
- 본문 텍스트는 `16px` 이상, 칩/메모 텍스트는 `13px` 미만으로 내리지 않는다.
- 정보 밀도는 낮게 유지한다. 일정 행은 제목, 시간, owner 색점 정도만 노출한다.

## 테마 / 디자인 토큰
- 라이트 모드만 지원한다.
- 따뜻한 레트로, 코르크보드 + 포스트잇 무드로 가되 가독성을 항상 우선한다.
- 아래 CSS 변수 값을 기준으로 유지한다.

```css
:root {
  --bg: #FFF9EC;
  --surface: #FFFFFF;
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
  --radius: 12px;
  --radius-sm: 8px;
  --radius-pill: 999px;
  --shadow: 0 2px 8px rgba(60,40,10,0.08);
}
```

## 컴포넌트 톤
- 기본 면은 평면으로 유지하고, 그라데이션은 쓰지 않는다.
- 빨강 `--accent`는 한 화면에서 핵심 액션 1곳 정도만 강하게 쓴다.
- 일반 버튼은 `surface-2` 또는 보더 스타일을 우선한다.
- 오늘 날짜는 빨강 포인트로 강조한다.
- 일정 owner 구분은 `--me`, `--partner` 색점으로 처리한다.
- 컨디션 선택 칩은 평면 스타일을 유지한다.

## 포스트잇 사용 규칙
- 포스트잇 연출은 양념이다.
- 적용 대상은 `오늘 컨디션 히어로`, `D-day 핵심 카드` 정도로 제한한다.
- 캘린더 그리드, 폼, 리스트 전체에 포스트잇 스타일을 남용하지 않는다.
- 한 화면에 포스트잇 카드는 최대 1~2개까지만 허용한다.
- 회전은 `±1.5deg` 이내만 허용한다.
- 손글씨 폰트는 쓰지 않는다.

## 구현 방식
- 파일 수정 시 파편 코드가 아니라 동작하는 완성본 기준으로 유지한다.
- 기존 MVP 기능을 해치지 않는 범위에서만 구조를 바꾼다.
- 색상, spacing, radius 변경 시 기존 토큰 우선 원칙을 지킨다.

## 인코딩 규칙
- 모든 텍스트 파일은 반드시 `UTF-8`로 저장한다.
- 한글 문자열이 포함된 파일은 수정 후 문자열 깨짐이 없는지 바로 확인한다.
- 콘솔 출력이나 에디터에서 한글이 깨져 보이면 그대로 두지 말고 즉시 파일 인코딩을 점검한다.
- 문자열이 깨진 상태로 커밋하거나 배포하지 않는다.
- 특히 `JSX`, `CSS`, `HTML`, `JSON`, `.md`, Firebase 규칙 파일에서 한글 문구가 손상되지 않도록 주의한다.

## 검증
- UI 수정 후 최소 `npm run build`까지는 통과시킨다.
- 빌드 성공만으로 끝내지 말고, 한글 문자열/라벨/버튼 문구가 깨지지 않았는지도 같이 확인한다.
