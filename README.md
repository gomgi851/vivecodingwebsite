# VibeCoder Hackathon Hub

해커톤 탐색, 팀 구성, 제출, 랭킹 확인을 하나의 흐름으로 연결하는 React + Vite 기반 웹 애플리케이션입니다.

## 주요 기능

- 홈 대시보드: 현재/다음 액션, 최근 활동, 리더보드 스냅샷
- 해커톤 목록: 필터/정렬/빠른 보기/저장된 뷰
- 해커톤 상세: 참가 신청 -> 팀 구성 -> 제출 -> 랭킹 퍼널
- 캠프: 팀 생성/수정/삭제, 쪽지, 컨텍스트 필터
- 랭킹: 보드/기간/정렬/검색 + 공유 가능한 현재 뷰

## 기술 스택

- React 19, React Router
- TypeScript
- Vite
- CSS Modules + global tokens
- JSON seed + localStorage state

## 시작하기

```bash
npm install
npm run dev
```

## 릴리스 검증

```bash
npm run check:release
```

위 명령은 아래 순서로 실행됩니다.

1. `npm run lint`
2. `npm run typecheck`
3. `npm run build`

## 배포 전 점검

- 상세 체크리스트: `Service_Readiness_Checklist.md`
- 최소 요구사항: 핵심 시나리오, 접근성, 반응형, 데이터 무결성, 빌드 성공

## 프로젝트 구조

```text
src/
	components/        공통 레이아웃 및 상태 블록
	pages/             홈/목록/상세/캠프/랭킹
	store/             데이터 부트스트랩 및 persistence
	styles/            전역 토큰 및 공통 스타일
public/data/         해커톤/팀/리더보드 seed JSON
```
