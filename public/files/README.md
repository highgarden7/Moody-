# moody — 로고 / 아이콘 세트

## 파일
- `app-icon.svg` — 앱(홈 화면) 기본 아이콘. 둥근 타일 + 포스트잇 표정.
- `logotype.svg` — moody 타이포(표정 버전, oo=눈 + 빨강 입). 스플래시/로딩/큰 헤더용. 배경 투명.
- `wordmark.svg` — 아이콘 + moody 글자 묶음. 상단 헤더용. 배경 투명.
- `icon-192.png`, `icon-512.png` — PWA 기본 아이콘.
- `icon-maskable-192.png`, `icon-maskable-512.png` — 안드로이드/마스크용(풀 블리드, safe zone 안에 표정).
- `apple-touch-icon.png` — iOS 홈 화면 추가용(180, 불투명).
- `favicon.svg`, `favicon.ico`, `favicon-16/32.png` — 탭 파비콘(작게도 읽히게 표정만).
- `wordmark.png`, `logotype.png` — 래스터 버전(2x).

## 컬러
- 노랑 타일 `#FFC83D` · 메모지 `#FFF9EC` · 먹색 `#2A2520` · 빨강 `#E63B41` · 테이프 `#FFD24D`
- 폰트: Fredoka (weight 600). SVG는 글자를 패스로 변환해둬서 폰트 설치 없이도 그대로 렌더됨.

## PWA 적용
`public/icons/`에 넣었다고 가정.

manifest:
```json
{
  "name": "moody",
  "short_name": "moody",
  "theme_color": "#FFC83D",
  "background_color": "#FFF9EC",
  "display": "standalone",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

index.html `<head>`:
```html
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
<meta name="theme-color" content="#FFC83D" />
```
