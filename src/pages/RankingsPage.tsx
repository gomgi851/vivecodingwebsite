import { Link, useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlocks'
import { MainSidebarSection } from '../maincomponent/MainSidebarSection'
import { MainStatList } from '../maincomponent/MainStatList'
import { useAppData } from '../store/AppDataContext'
import styles from './RankingsPage.module.css'

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR')
}

function isWithinPeriod(value: string, period: string) {
  if (period === 'all') return true
  const base = new Date(value).getTime()
  if (!base) return false
  const now = Date.now()
  const days = period === '7d' ? 7 : 30
  return now - base <= days * 24 * 60 * 60 * 1000
}

export function RankingsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [copiedView, setCopiedView] = useState(false)
  const { loading, error, refresh, leaderboards, hackathons } = useAppData()
  const boardSlug = searchParams.get('board') || 'all'
  const period = searchParams.get('period') || 'all'
  const sortBy = searchParams.get('sort') || 'rank'
  const keyword = searchParams.get('q') || ''

  if (loading) return <LoadingState title="랭킹 정보를 불러오는 중..." />
  if (error) return <ErrorState message={error} onRetry={refresh} />
  if (!leaderboards.length) {
    return <EmptyState title="랭킹 데이터가 없습니다." message="제출이 발생하면 랭킹이 갱신됩니다." />
  }

  function updateQuery(key: 'board' | 'period' | 'sort' | 'q', value: string) {
    const next = new URLSearchParams(searchParams)
    const defaults = { board: 'all', period: 'all', sort: 'rank', q: '' }
    if (!value || value === defaults[key]) {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    setSearchParams(next)
  }

  const latestBoard = leaderboards[leaderboards.length - 1]
  const selected =
    boardSlug === 'all'
      ? latestBoard
      : leaderboards.find((item) => item.hackathonSlug === boardSlug) || latestBoard
  const boardTitleBySlug = new Map(hackathons.map((item) => [item.slug, item.title]))
  const selectedBoardLabel = selected?.hackathonSlug
    ? boardTitleBySlug.get(selected.hackathonSlug) || selected.hackathonSlug
    : '-'

  let entries = (selected?.entries || []).filter((entry) => {
    if (!isWithinPeriod(entry.submittedAt, period)) return false
    const q = keyword.trim().toLowerCase()
    if (!q) return true
    return `${entry.teamName} ${entry.rank || ''} ${entry.score || ''}`.toLowerCase().includes(q)
  })
  entries = [...entries].sort((a, b) => {
    if (sortBy === 'score') return Number(b.score || 0) - Number(a.score || 0)
    if (sortBy === 'latest') {
      return new Date(b.submittedAt || 0).getTime() - new Date(a.submittedAt || 0).getTime()
    }
    return Number(a.rank || 999) - Number(b.rank || 999)
  })

  const top3 = entries.slice(0, 3)
  const topScore = top3[0]?.score || '-'
  const avgScore =
    entries.length > 0
      ? (entries.reduce((acc, entry) => acc + Number(entry.score || 0), 0) / entries.length).toFixed(1)
      : '-'
  const boardOptions = leaderboards
    .map((item) => ({
      slug: item.hackathonSlug,
      label: boardTitleBySlug.get(item.hackathonSlug) || item.hackathonSlug,
      entryCount: item.entries.length,
      updatedAt: item.updatedAt,
    }))
    .sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime())

  const quickBoards = boardOptions.slice(0, 5)
  const hasActiveFilter = Boolean(keyword.trim()) || boardSlug !== 'all' || period !== 'all' || sortBy !== 'rank'
  const activeFilterCount =
    Number(Boolean(keyword.trim())) + Number(boardSlug !== 'all') + Number(period !== 'all') + Number(sortBy !== 'rank')

  function resetFilters() {
    setSearchParams({})
  }

  async function copyCurrentView() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard) return
    const query = searchParams.toString()
    const targetUrl = `${window.location.origin}${window.location.pathname}${query ? `?${query}` : ''}`
    try {
      await navigator.clipboard.writeText(targetUrl)
      setCopiedView(true)
      window.setTimeout(() => setCopiedView(false), 1400)
    } catch {
      setCopiedView(false)
    }
  }

  return (
    <section className={styles.rankLayout}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSticky}>
          <MainSidebarSection title="빠른 필터">
            <div className={styles.sidebarActions}>
              <button type="button" className="button secondary" onClick={() => updateQuery('period', 'all')}>
                전체 기간
              </button>
              <button type="button" className="button secondary" onClick={() => updateQuery('period', '7d')}>
                최근 7일
              </button>
              <button type="button" className="button secondary" onClick={() => updateQuery('period', '30d')}>
                최근 30일
              </button>
              <button type="button" className="button ghost" onClick={() => updateQuery('sort', 'score')}>
                점수순 보기
              </button>
              <button type="button" className="button ghost" onClick={resetFilters}>
                필터 전체 해제
              </button>
            </div>
          </MainSidebarSection>

          <MainSidebarSection title="보드 바로가기">
            <button
              type="button"
              className={`${styles.boardButton} ${boardSlug === 'all' ? styles.boardButtonActive : ''}`}
              onClick={() => updateQuery('board', 'all')}
            >
              <strong>최근 업데이트 기준</strong>
              <span>전체 보드 중 최신 기준</span>
            </button>
            <div className={styles.boardList}>
              {quickBoards.map((board) => (
                <button
                  key={board.slug}
                  type="button"
                  className={`${styles.boardButton} ${boardSlug === board.slug ? styles.boardButtonActive : ''}`}
                  onClick={() => updateQuery('board', board.slug)}
                >
                  <strong>{board.label}</strong>
                  <span>엔트리 {board.entryCount}</span>
                </button>
              ))}
            </div>
          </MainSidebarSection>

          <MainSidebarSection title="현재 컨텍스트">
            <MainStatList
              items={[
                { label: '표시 엔트리', value: entries.length },
                { label: '최고 점수', value: topScore },
                { label: '평균 점수', value: avgScore },
                { label: '업데이트', value: formatDate(selected?.updatedAt) },
              ]}
              className={styles.sidebarStats}
            />
          </MainSidebarSection>

          {selected?.hackathonSlug ? (
            <MainSidebarSection title="바로가기">
              <div className={styles.sidebarActions}>
                <Link className="button primary" to={`/hackathons/${selected.hackathonSlug}`}>
                  해커톤 상세 보기
                </Link>
                <Link className="button secondary" to={`/camp?hackathon=${selected.hackathonSlug}`}>
                  팀 찾기
                </Link>
              </div>
            </MainSidebarSection>
          ) : null}
        </div>
      </aside>

      <div className={`stack-lg ${styles.mainColumn}`}>
        <header className={`page-header ${styles.headerBar}`}>
          <div className={styles.insightChips}>
            <span className={styles.insightChip}>표시 엔트리 {entries.length}</span>
            <span className={`${styles.insightChip} ${styles.insightChipTop}`}>최고 점수 {topScore}</span>
            <span className={styles.insightChip}>평균 점수 {avgScore}</span>
            <span className={`${styles.insightChip} ${styles.insightChipBoard}`}>
              현재 보드 {selectedBoardLabel}
            </span>
          </div>
        </header>

        <section className={`controls ${styles.filterBar}`}>
          <label>
            검색
            <input
              value={keyword}
              onChange={(e) => updateQuery('q', e.target.value)}
              placeholder="팀명, 점수, 순위"
            />
          </label>
          <label>
            해커톤
            <select value={boardSlug} onChange={(e) => updateQuery('board', e.target.value)}>
              <option value="all">최근 업데이트 기준</option>
              {leaderboards.map((item) => (
                <option key={item.hackathonSlug} value={item.hackathonSlug}>
                  {boardTitleBySlug.get(item.hackathonSlug) || item.hackathonSlug}
                </option>
              ))}
            </select>
          </label>
          <label>
            기간
            <select value={period} onChange={(e) => updateQuery('period', e.target.value)}>
              <option value="all">전체</option>
              <option value="7d">최근 7일</option>
              <option value="30d">최근 30일</option>
            </select>
          </label>
          <label>
            정렬
            <select value={sortBy} onChange={(e) => updateQuery('sort', e.target.value)}>
              <option value="rank">순위순</option>
              <option value="score">점수순</option>
              <option value="latest">최신 제출순</option>
            </select>
          </label>
          <button className="button ghost align-end" type="button" onClick={resetFilters}>
            필터 초기화
          </button>
          <button className="button secondary align-end" type="button" onClick={copyCurrentView}>
            {copiedView ? '뷰 링크 복사됨' : '현재 뷰 링크 복사'}
          </button>
        </section>

        <section className={styles.resultMeta} aria-live="polite">
          <p>
            현재 결과 <strong>{entries.length}</strong>개 · 활성 필터 <strong>{activeFilterCount}</strong>개
          </p>
          <p className="muted">정렬/기간/보드 조건을 유지한 상태로 공유할 수 있습니다.</p>
        </section>

        {hasActiveFilter ? (
          <section className={styles.activeFilters} aria-label="현재 적용 필터">
            {keyword.trim() ? (
              <button className={styles.activeFilterChip} type="button" onClick={() => updateQuery('q', '')}>
                검색: {keyword} ×
              </button>
            ) : null}
            {boardSlug !== 'all' ? (
              <button className={styles.activeFilterChip} type="button" onClick={() => updateQuery('board', 'all')}>
                보드: {selectedBoardLabel} ×
              </button>
            ) : null}
            {period !== 'all' ? (
              <button className={styles.activeFilterChip} type="button" onClick={() => updateQuery('period', 'all')}>
                기간: {period} ×
              </button>
            ) : null}
            {sortBy !== 'rank' ? (
              <button className={styles.activeFilterChip} type="button" onClick={() => updateQuery('sort', 'rank')}>
                정렬: {sortBy === 'score' ? '점수순' : '최신 제출순'} ×
              </button>
            ) : null}
          </section>
        ) : null}

        {top3.length ? (
          <section className={`grid grid-3 ${styles.topGrid}`}>
            {top3.map((entry, idx) => (
              <article
                key={`${entry.teamName}-${entry.submittedAt}`}
                className={`panel cv-auto podium podium-${idx + 1} ${styles.topCard}`}
              >
                <span className={styles.topRankBadge}>TOP {idx + 1}</span>
                <p className="metric-label">TOP {idx + 1}</p>
                <h2 className="card-title">{entry.teamName}</h2>
                <p className={styles.topScore}>점수: {entry.score}</p>
                <p className="muted">{formatDate(entry.submittedAt)}</p>
              </article>
            ))}
          </section>
        ) : null}

        <article className={`panel ${styles.tablePanel}`}>
          <div className={styles.tableHeader}>
            <div>
              <p className="muted">현재 보드: {selectedBoardLabel}</p>
              <p className="muted">업데이트: {formatDate(selected?.updatedAt)}</p>
            </div>
            {selected?.hackathonSlug ? (
              <Link className="button secondary" to={`/hackathons/${selected.hackathonSlug}`}>
                해커톤 상세 보기
              </Link>
            ) : null}
          </div>
          {entries.length ? (
            <div className={`table-wrap ${styles.rankTableWrap}`}>
              <table className={styles.rankTable}>
                <thead>
                  <tr>
                    <th>rank</th>
                    <th>team</th>
                    <th>points</th>
                    <th>submittedAt</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr key={`${entry.teamName}-${entry.submittedAt}`} className={idx < 3 ? 'top-row' : ''}>
                      <td>
                        <span
                          className={`${styles.rankBadge} ${
                            idx === 0 ? styles.rank1 : idx === 1 ? styles.rank2 : idx === 2 ? styles.rank3 : ''
                          }`}
                        >
                          {entry.rank || idx + 1}
                        </span>
                      </td>
                      <td>{entry.teamName}</td>
                      <td>
                        <strong>{entry.score}</strong>
                      </td>
                      <td>{formatDate(entry.submittedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="조건에 맞는 랭킹 기록이 없습니다." />
          )}
        </article>
      </div>
    </section>
  )
}


