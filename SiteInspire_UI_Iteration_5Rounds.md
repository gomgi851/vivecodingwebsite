# SiteInspire 기반 UI 개선 5회 기록

요청사항: SiteInspire 스타일 레퍼런스를 기반으로 UI 개선을 5회 반복 적용  
범위: 데스크톱 우선(반응형 제외)

## Round 1 — 레이아웃 도킹
- 상단 네비를 sticky 처리해 페이지 이동 중에도 핵심 내비 유지
- 유틸 바도 sticky 처리해 빠른 작업 접근성 강화

## Round 2 — 히어로 bento 정보 구조
- 메인 히어로 영역에 핵심 수치 카드 3개 추가
- 텍스트 중심 히어로를 "메시지 + 즉시 지표 확인" 구조로 개선

## Round 3 — 카드 리듬/정렬 일관화
- 해커톤 카드, 팀 카드, TOP 카드에 최소 높이 부여
- 카드 내부 액션 버튼 위치를 하단으로 정렬해 시선 흐름 통일

## Round 4 — 인터랙션 계층 개선
- 액션 카드 hover 시 그림자/포커스 강화
- 입력창 focus 스타일 추가로 조작성 개선

## Round 5 — 데이터 영역 가독성 개선
- 테이블 컨테이너에 경계/배경 부여
- 헤더 sticky 처리, 교차행 배경, hover 강조 추가

## 적용 파일
- `src/components/Layout.module.css`
- `src/pages/HomePage.tsx`
- `src/pages/HomePage.module.css`
- `src/styles/global.css`
- `src/pages/HackathonsPage.module.css`
- `src/pages/CampPage.module.css`
- `src/pages/RankingsPage.module.css`
