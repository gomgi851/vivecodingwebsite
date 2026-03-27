import { Link } from 'react-router-dom'
import { useAppData } from '../store/AppDataContext'
import styles from './HomePage.module.css'

const RENDER_NOW_MS = Date.now()

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR')
}

function formatDateShort(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ko-KR')
}

export function HomePage() {
  const { hackathons, teams, submissions, leaderboards } = useAppData()
  const activeCount = hackathons.filter((h) => h.status === 'ongoing').length
  const upcomingCount = hackathons.filter((h) => h.status === 'upcoming').length
  const getCurrentMembers = (member: { currentMemberCount?: number; memberCount?: number }) =>
    Math.max(1, Number(member.currentMemberCount ?? member.memberCount ?? 1) || 1)
  const getTotalMembers = (member: {
    totalMemberCount?: number
    currentMemberCount?: number
    memberCount?: number
  }) => {
    const current = getCurrentMembers(member)
    return Math.max(current, Number(member.totalMemberCount ?? current) || current)
  }
  const openTeams = teams.filter((t) => t.isOpen && getCurrentMembers(t) < getTotalMembers(t)).length
  const boardTitleBySlug = new Map(hackathons.map((item) => [item.slug, item.title]))
  const latestBoard = leaderboards[leaderboards.length - 1]
  const latestBoardLabel = latestBoard?.hackathonSlug
    ? boardTitleBySlug.get(latestBoard.hackathonSlug) || latestBoard.hackathonSlug
    : '없음'
  const latestSubmissions = [...submissions]
    .sort((a, b) => new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime())
    .slice(0, 5)
  const latestTeams = [...teams]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 4)
  const targetHackathon =
    hackathons.find((item) => item.slug === 'daker-handover-2026-03') ||
    hackathons.find((item) => item.status !== 'ended') ||
    null
  const nextDeadline = [...hackathons]
    .sort(
      (a, b) =>
        new Date(a.period?.submissionDeadlineAt || 0).getTime() -
        new Date(b.period?.submissionDeadlineAt || 0).getTime(),
    )
    .find((item) => new Date(item.period?.submissionDeadlineAt || 0).getTime() > RENDER_NOW_MS)
  const nextDeadlines = [...hackathons]
    .filter((item) => new Date(item.period?.submissionDeadlineAt || 0).getTime() > RENDER_NOW_MS)
    .sort(
      (a, b) =>
        new Date(a.period?.submissionDeadlineAt || 0).getTime() -
        new Date(b.period?.submissionDeadlineAt || 0).getTime(),
    )
    .slice(0, 3)
  const topBoardEntries = (latestBoard?.entries || []).slice(0, 3)
  const todayChecklist = [
    nextDeadline
      ? `가장 가까운 마감은 ${formatDateShort(nextDeadline.period?.submissionDeadlineAt)}입니다. 제출 준비를 먼저 점검하세요.`
      : '예정된 마감이 없습니다. 신규 해커톤 온보딩을 준비하세요.',
    openTeams > 0
      ? `현재 모집 중 팀 ${openTeams}개가 열려 있습니다. 팀 매칭이 필요한 참가자를 캠프로 유도하세요.`
      : '모집 중인 팀이 적습니다. 캠프에서 새 팀 생성 유도를 강화하세요.',
    latestSubmissions.length > 0
      ? `최근 제출 ${latestSubmissions.length}건이 기록되었습니다. 랭킹 반영과 품질 체크를 진행하세요.`
      : '아직 제출 기록이 없습니다. 상세 페이지에서 첫 제출을 유도하세요.',
  ]

  return (
    <section className="stack-lg">
      <section className={`hero-card hero-grid ${styles.heroAccent}`}>
        <div className={styles.heroMain}>
          <p className="eyebrow">VibeCoder Platform</p>
          <h1>명세 기반으로 빠르게 완성하는 해커톤 운영 허브</h1>
          <p className="hero-copy">
            오늘 해야 할 일과 다음 액션을 한 화면에서 확인하고,
            해커톤 탐색부터 팀 구성, 제출, 랭킹 반영까지 끊김 없이 진행할 수 있습니다.
          </p>
          <div className={styles.heroPills}>
            <span className={styles.heroPill}>진행 중 {activeCount}</span>
            <span className={styles.heroPill}>예정 {upcomingCount}</span>
            <span className={styles.heroPill}>모집 중 팀 {openTeams}</span>
            <span className={styles.heroPill}>최근 보드 {latestBoardLabel}</span>
          </div>
          <div className="inline-actions">
            <Link className="button" to="/hackathons">
              지금 해커톤 탐색
            </Link>
            <Link className="button secondary" to="/camp">
              팀 매칭 시작
            </Link>
            <Link className="button ghost" to="/rankings">
              성과 대시보드
            </Link>
          </div>
          <div className={styles.trustStrip}>
            <span>Design cues sampled from Apple · Stripe · Notion · Vercel · Figma · Framer · Shopify · Airbnb · Dropbox · Webflow · Awwwards</span>
          </div>
        </div>
        <aside className={`focus-panel ${styles.focusPanel}`}>
          <h2>Now / Next</h2>
          {targetHackathon ? (
            <>
              <p className={styles.focusLabel}>현재 집중 해커톤</p>
              <p className="focus-title">{targetHackathon.title}</p>
              <p className="muted">마감: {formatDate(targetHackathon.period?.submissionDeadlineAt)}</p>
              <Link className="button ghost" to={`/hackathons/${targetHackathon.slug}`}>
                상세 페이지 열기
              </Link>
            </>
          ) : (
            <p className="muted">표시할 해커톤이 없습니다.</p>
          )}
          <div className="divider" />
          <p className={styles.focusLabel}>다음 전체 마감</p>
          <p className={styles.deadlineText}>
            {nextDeadline ? formatDate(nextDeadline.period?.submissionDeadlineAt) : '예정 없음'}
          </p>
          <p className="muted">제출 동선: 목록 → 상세 → 팀 → 제출 → 랭킹</p>
        </aside>
      </section>

      <section className={styles.todayBoard}>
        {todayChecklist.map((item) => (
          <article key={item} className={styles.todayItem}>
            <h2>Today</h2>
            <p>{item}</p>
          </article>
        ))}
      </section>

      <section className={styles.bentoGrid}>
        <article className={`panel panel-elevated ${styles.bentoWide}`}>
          <h2>빠른 실행 동선</h2>
          <div className={styles.actionRail}>
            <Link to="/hackathons" className={styles.actionTile}>
              <h3>1. 해커톤 탐색</h3>
              <p>상태/태그/검색으로 해커톤을 빠르게 찾습니다.</p>
            </Link>
            <Link to="/camp" className={styles.actionTile}>
              <h3>2. 팀 구성</h3>
              <p>해커톤별 팀을 확인하고 모집글을 생성합니다.</p>
            </Link>
            <Link to="/rankings" className={styles.actionTile}>
              <h3>3. 랭킹 확인</h3>
              <p>최신 제출 결과와 TOP 랭킹 흐름을 점검합니다.</p>
            </Link>
          </div>
        </article>

        <article className={`panel ${styles.bentoCard}`}>
          <h2>다가오는 마감</h2>
          {nextDeadlines.length ? (
            <ul className="list">
              {nextDeadlines.map((item) => (
                <li key={item.slug}>
                  <strong>{item.title}</strong> · {formatDateShort(item.period?.submissionDeadlineAt)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">예정된 마감이 없습니다.</p>
          )}
        </article>

        <article className={`panel ${styles.bentoCard}`}>
          <h2>최근 생성 팀</h2>
          {latestTeams.length ? (
            <ul className="list">
              {latestTeams.map((item) => (
                <li key={item.teamCode}>
                  <strong>{item.name}</strong> · 현재/총 {getCurrentMembers(item)}/{getTotalMembers(item)} ·{' '}
                  {item.isOpen ? '모집 중' : '마감'}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">최근 팀 생성 기록이 없습니다.</p>
          )}
        </article>
      </section>

      <section className={styles.dualGrid}>
        <article className={`panel panel-elevated ${styles.activityCard}`}>
          <h2>최근 제출 활동</h2>
          {latestSubmissions.length ? (
            <ul className={styles.activityList}>
              {latestSubmissions.map((item) => (
                <li key={item.id}>
                  <div>
                    <strong>{item.teamName}</strong>
                    <p className="muted">{formatDate(item.submittedAt)}</p>
                  </div>
                  <span className={item.status === 'submitted' ? styles.statusDone : styles.statusDraft}>
                    {item.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">아직 제출 기록이 없습니다. 상세 페이지의 Submit에서 시작하세요.</p>
          )}
        </article>

        <article className={`panel panel-elevated ${styles.activityCardAlt}`}>
          <h2>리더보드 스냅샷</h2>
          {topBoardEntries.length ? (
            <ul className={styles.boardList}>
              {topBoardEntries.map((item, idx) => (
                <li key={`${item.teamName}-${item.submittedAt}`}>
                  <span className={styles.rankBadge}>{item.rank || idx + 1}</span>
                  <div>
                    <strong>{item.teamName}</strong>
                    <p className="muted">점수 {item.score}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">현재 리더보드 엔트리가 없습니다.</p>
          )}
          <div className="inline-actions">
            <Link className="button secondary" to="/rankings">
              전체 랭킹 보기
            </Link>
          </div>
        </article>
      </section>
    </section>
  )
}
