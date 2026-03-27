# VibeCoder Hackathon Hub

해커톤 탐색, 팀 캠프(팀 매칭), 랭킹을 한 곳에서 볼 수 있는 웹 서비스입니다.  
React + Vite + TypeScript 기반으로 만들었고, 데이터는 JSON + localStorage로 동작합니다.

## 프로젝트 한눈에 보기

- 해커톤 목록을 보고 상세 페이지에서 핵심 정보를 확인할 수 있습니다.
- 팀 캠프에서 팀 모집 글을 확인하고, 팀 매칭 흐름을 관리할 수 있습니다.
- 랭킹 페이지에서 점수/지표 기반으로 비교할 수 있습니다.
- 공통 UI 컴포넌트를 분리해 페이지 간 디자인 일관성을 유지합니다.

## 기술 스택

- Frontend: React 19, React Router DOM 7
- Language: TypeScript
- Build Tool: Vite
- Styling: CSS Modules + Global CSS Tokens
- Data: JSON seed + localStorage
- Quality: ESLint, TypeScript typecheck

## 빠른 시작

```bash
npm install
npm run dev
```

개발 서버 실행 후 기본 주소:

- `http://localhost:5173`

## 주요 명령어

```bash
npm run dev          # 개발 서버 실행
npm run build        # 프로덕션 빌드
npm run preview      # 빌드 결과 미리보기
npm run lint         # 코드 린트 검사
npm run typecheck    # 타입 검사
npm run check:release
```

`check:release`는 아래 순서로 실행됩니다.

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`

## 폴더 구조

```text
.
|-- public/
|   `-- data/                    # 해커톤/랭킹 seed 데이터
|-- src/
|   |-- assets/                  # 이미지/정적 리소스
|   |-- components/              # 공통 레이아웃, 페이지 보조 컴포넌트
|   |-- maincomponent/           # 페이지 공통 메인 UI 컴포넌트
|   |-- pages/                   # 라우트 단위 페이지
|   |-- store/                   # 상태/저장소 관련 로직
|   |-- styles/                  # 전역 스타일, 토큰
|   |-- App.tsx                  # 라우팅 엔트리
|   `-- main.tsx                 # 앱 부트스트랩
|-- README.md
|-- package.json
`-- vite.config.js
```

## 페이지 구성

- `/` : 홈
- `/hackathons` : 해커톤 탐색
- `/hackathons/:slug` : 해커톤 상세
- `/camp` : 팀 캠프
- `/rankings` : 랭킹

## 이 프로젝트에서 중점 둔 것

- 페이지 간 동일한 컴포넌트/토큰 사용으로 UI 일관성 유지
- 1920px 기준 레이아웃 밸런스 최적화
- 사이드바/상단바/하단 영역 구조 통일
- 유지보수를 위해 공통 컴포넌트(maincomponent)로 분리

## 배포/운영 체크

배포 전에는 아래 명령어를 권장합니다.

```bash
npm run check:release
```

추가 점검 문서는 아래 파일을 참고하세요.

- `Service_Readiness_Checklist.md`
