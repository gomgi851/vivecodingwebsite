# VibeCoder Hackathon Hub

해커톤 탐색, 팀 매칭, 랭킹 확인을 한 곳에서 제공하는 React + Vite 기반 웹 서비스입니다.

## 프로젝트 개요

- 해커톤 목록/상세 조회
- 팀 캠프(팀 생성, 모집, 필터링, 쪽지)
- 리더보드/랭킹 확인
- 공통 UI 컴포넌트 기반 일관된 화면 구성

## 기술 스택

- Frontend: React 19, React Router DOM 7
- Language: TypeScript
- Build: Vite
- Styling: CSS Modules + Global CSS Variables
- Data: JSON Seed + localStorage
- Quality: ESLint, TypeScript Typecheck

## 개발/실행

```bash
npm install
npm run dev
```

기본 개발 서버:

- `http://localhost:5173`

## 주요 명령어

```bash
npm run dev
npm run build
npm run preview
npm run lint
npm run typecheck
npm run check:release
```

`check:release` 실행 순서:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`

## 반응형/개발 기준

-------------------------------

<= 767px: 모바일  
768px ~ 1023px: 태블릿  
>= 1024px: 데스크톱

-------------------------------

1600px 상태로 개발.

-----------------------------

## 폴더 구조

```text
.
|-- public/
|   `-- data/                    # 샘플 데이터(JSON)
|-- src/
|   |-- assets/                  # 정적 리소스
|   |-- components/              # 공통 레이아웃/공용 컴포넌트
|   |-- maincomponent/           # 주요 공통 UI 컴포넌트
|   |-- pages/                   # 라우트 페이지
|   |-- store/                   # 상태/데이터 로직
|   |-- styles/                  # 전역 스타일
|   |-- App.tsx
|   `-- main.tsx
|-- README.md
|-- package.json
`-- vite.config.js
```

## 라우트

- `/` : 홈
- `/hackathons` : 해커톤 탐색
- `/hackathons/:slug` : 해커톤 상세
- `/camp` : 팀 캠프
- `/rankings` : 랭킹

## 배포 전 체크

```bash
npm run check:release
```

추가 문서:

- `Service_Readiness_Checklist.md`