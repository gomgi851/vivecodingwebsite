import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlocks'
import { MainSidebarSection } from '../maincomponent/MainSidebarSection'
import { useAppData } from '../store/AppDataContext'
import type { Hackathon, HackathonDetail, Team } from '../types'
import styles from './HackathonsPage.module.css'

type QuickViewKey = 'all' | 'ongoing' | 'urgent' | 'new' | 'interest'
type SortKey = 'end-asc' | 'end-desc' | 'title'
type ChecklistKey = 'basic' | 'extension' | 'completeness' | 'docs'

interface ChecklistState {
  basic: boolean
  extension: boolean
  completeness: boolean
  docs: boolean
}

const MS_DAY = 24 * 60 * 60 * 1000
const RECENT_VIEW_KEY = 'hackathons_recent_views'
const INTEREST_TAGS_KEY = 'hackathons_interest_tags'
const REDUCE_MOTION_KEY = 'hackathons_reduce_motion'
const CHECKLIST_KEY = 'hackathons_quality_checklist'

const STATUS_LABEL: Record<string, string> = {
  upcoming: '예정',
  ongoing: '진행중',
  ended: '종료',
}

const QUICK_VIEW_LABEL: Record<QuickViewKey, string> = {
  all: '전체',
  ongoing: '진행중',
  urgent: '마감임박',
  new: '신규',
  interest: '내 관심태그',
}

function toTimestamp(value?: string) {
  if (!value) return 0
  const ts = new Date(value).getTime()
  return Number.isFinite(ts) ? ts : 0
}

function formatDateShort(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
}

function readStoredArray(key: string) {
  if (typeof window === 'undefined') return [] as string[]
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return [] as string[]
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : ([] as string[])
  } catch {
    return [] as string[]
  }
}

function readStoredChecklist() {
  const fallback: ChecklistState = {
    basic: false,
    extension: false,
    completeness: false,
    docs: false,
  }
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(CHECKLIST_KEY)
    if (!raw) return fallback
    return {
      ...fallback,
      ...(JSON.parse(raw) as Partial<ChecklistState>),
    }
  } catch {
    return fallback
  }
}

function getCurrentMembers(team: Team) {
  return Math.max(1, Number(team.currentMemberCount ?? team.memberCount ?? 1) || 1)
}

function getDeadlineTimestamp(item: Hackathon) {
  return toTimestamp(item.period?.submissionDeadlineAt || item.period?.endAt)
}

function getFirstKnownTimestamp(item: Hackathon, detailsBySlug: Record<string, HackathonDetail>) {
  const milestones = detailsBySlug[item.slug]?.sections?.schedule?.milestones || []
  const milestoneTimes = milestones
    .map((milestone) => toTimestamp(milestone.at))
    .filter((value) => value > 0)
  const candidates = [
    toTimestamp(item.period?.startAt),
    ...milestoneTimes,
    toTimestamp(item.period?.submissionDeadlineAt),
    toTimestamp(item.period?.endAt),
  ].filter((value) => value > 0)

  if (!candidates.length) return 0
  return Math.min(...candidates)
}

function isUrgent(item: Hackathon, nowMs: number) {
  const deadline = getDeadlineTimestamp(item)
  if (!deadline) return false
  const daysLeft = Math.ceil((deadline - nowMs) / MS_DAY)
  return daysLeft >= 0 && daysLeft <= 3
}

function isNew(item: Hackathon, detailsBySlug: Record<string, HackathonDetail>, nowMs: number) {
  const firstKnown = getFirstKnownTimestamp(item, detailsBySlug)
  if (!firstKnown) return false
  const diff = nowMs - firstKnown
  return diff >= -2 * MS_DAY && diff <= 21 * MS_DAY
}

function getDeadlineMeta(item: Hackathon, nowMs: number) {
  const deadline = getDeadlineTimestamp(item)
  if (!deadline) {
    return {
      label: '마감 미정',
      variant: 'none' as const,
    }
  }

  const diffDays = Math.ceil((deadline - nowMs) / MS_DAY)
  if (diffDays < 0) {
    return {
      label: '마감 종료',
      variant: 'closed' as const,
    }
  }

  if (diffDays <= 3) {
    return {
      label: diffDays === 0 ? 'D-Day' : `D-${diffDays}`,
      variant: 'urgent' as const,
    }
  }

  return {
    label: formatDateShort(new Date(deadline).toISOString()),
    variant: 'default' as const,
  }
}

function normalizeSort(value: string | null): SortKey {
  if (value === 'end-desc') return 'end-desc'
  if (value === 'title') return 'title'
  return 'end-asc'
}

function normalizeQuickView(value: string | null): QuickViewKey {
  if (value === 'ongoing') return 'ongoing'
  if (value === 'urgent') return 'urgent'
  if (value === 'new') return 'new'
  if (value === 'interest') return 'interest'
  return 'all'
}

function averageTimestamp(values: number[]) {
  if (!values.length) return 0
  return Math.round(values.reduce((acc, value) => acc + value, 0) / values.length)
}

export function HackathonsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { loading, error, refresh, hackathons, detailsBySlug, teams } = useAppData()

  const [nowMs] = useState(() => Date.now())
  const status = searchParams.get('status') || 'all'
  const tag = searchParams.get('tag') || 'all'
  const keyword = searchParams.get('q') || ''
  const sortBy = normalizeSort(searchParams.get('sort'))
  const quickView = normalizeQuickView(searchParams.get('quick'))

  const [interestTags, setInterestTags] = useState<string[]>(() => readStoredArray(INTEREST_TAGS_KEY))
  const [recentViewedSlugs, setRecentViewedSlugs] = useState<string[]>(() => readStoredArray(RECENT_VIEW_KEY).slice(0, 3))
  const [qualityChecklist, setQualityChecklist] = useState<ChecklistState>(() => readStoredChecklist())
  const [selectedSlug, setSelectedSlug] = useState('')
  const [copiedView, setCopiedView] = useState(false)
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const stored = window.localStorage.getItem(REDUCE_MOTION_KEY)
    if (stored !== null) return stored === '1'
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(INTEREST_TAGS_KEY, JSON.stringify(interestTags))
  }, [interestTags])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(CHECKLIST_KEY, JSON.stringify(qualityChecklist))
  }, [qualityChecklist])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(REDUCE_MOTION_KEY, reduceMotion ? '1' : '0')
  }, [reduceMotion])

  const tagOptions = useMemo(
    () => Array.from(new Set(hackathons.flatMap((item) => item.tags || []))).sort((a, b) => a.localeCompare(b)),
    [hackathons],
  )

  const participantCountBySlug = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const team of teams) {
      if (!team.hackathonSlug) continue
      counts[team.hackathonSlug] = (counts[team.hackathonSlug] || 0) + getCurrentMembers(team)
    }
    return counts
  }, [teams])

  const openTeamCountBySlug = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const team of teams) {
      if (!team.hackathonSlug || !team.isOpen) continue
      counts[team.hackathonSlug] = (counts[team.hackathonSlug] || 0) + 1
    }
    return counts
  }, [teams])

  const filtered = useMemo(() => {
    let rows = hackathons.filter((item) => {
      if (status !== 'all' && item.status !== status) return false
      if (tag !== 'all' && !(item.tags || []).includes(tag)) return false

      const q = keyword.trim().toLowerCase()
      if (q) {
        const text = `${item.title} ${item.slug} ${(item.tags || []).join(' ')}`.toLowerCase()
        if (!text.includes(q)) return false
      }

      if (quickView === 'ongoing' && item.status !== 'ongoing') return false
      if (quickView === 'urgent' && !isUrgent(item, nowMs)) return false
      if (quickView === 'new' && !isNew(item, detailsBySlug, nowMs)) return false
      if (quickView === 'interest') {
        if (!interestTags.length) return false
        if (!(item.tags || []).some((itemTag) => interestTags.includes(itemTag))) return false
      }

      return true
    })

    rows = [...rows].sort((a, b) => {
      if (sortBy === 'end-desc') return getDeadlineTimestamp(b) - getDeadlineTimestamp(a)
      if (sortBy === 'title') return a.title.localeCompare(b.title)
      return getDeadlineTimestamp(a) - getDeadlineTimestamp(b)
    })

    return rows
  }, [detailsBySlug, hackathons, interestTags, keyword, nowMs, quickView, sortBy, status, tag])

  const effectiveSelectedSlug = filtered.some((item) => item.slug === selectedSlug)
    ? selectedSlug
    : (filtered[0]?.slug ?? '')
  const selectedHackathon = filtered.find((item) => item.slug === effectiveSelectedSlug) || null
  const visibleSlugSet = new Set(filtered.map((item) => item.slug))

  const quickViewCounts = {
    ongoing: hackathons.filter((item) => item.status === 'ongoing').length,
    urgent: hackathons.filter((item) => isUrgent(item, nowMs)).length,
    new: hackathons.filter((item) => isNew(item, detailsBySlug, nowMs)).length,
    interest:
      interestTags.length > 0
        ? hackathons.filter((item) => (item.tags || []).some((itemTag) => interestTags.includes(itemTag))).length
        : 0,
  }

  const contextResultCount = filtered.length
  const contextAverageDeadline = averageTimestamp(
    filtered.map((item) => getDeadlineTimestamp(item)).filter((value) => value > 0),
  )
  const contextOpenTeamTotal = teams.filter((team) => team.hackathonSlug && visibleSlugSet.has(team.hackathonSlug) && team.isOpen).length

  const recentViewedItems = recentViewedSlugs
    .map((slug) => hackathons.find((item) => item.slug === slug))
    .filter((item): item is Hackathon => Boolean(item))

  const hasActiveFilter =
    Boolean(keyword.trim()) || status !== 'all' || tag !== 'all' || sortBy !== 'end-asc' || quickView !== 'all'
  const activeFilterCount = Number(Boolean(keyword.trim())) + Number(status !== 'all') + Number(tag !== 'all') + Number(sortBy !== 'end-asc') + Number(quickView !== 'all')

  const savedViews: Array<{
    key: string
    label: string
    description: string
    query: {
      status: string
      tag: string
      sort: SortKey
      q: string
      quick: QuickViewKey
    }
  }> = [
    {
      key: 'build-sprint',
      label: '빌드 스프린트',
      description: '진행중 + 마감 빠른순',
      query: { status: 'ongoing', tag: 'all', sort: 'end-asc', q: '', quick: 'all' as QuickViewKey },
    },
    {
      key: 'd3-focus',
      label: 'D-3 집중',
      description: '마감임박만 추리기',
      query: { status: 'all', tag: 'all', sort: 'end-asc', q: '', quick: 'urgent' as QuickViewKey },
    },
    {
      key: 'handover-track',
      label: 'Handover 트랙',
      description: '핸드오버 태그 중심',
      query: { status: 'all', tag: 'Handover', sort: 'end-asc', q: '', quick: 'all' as QuickViewKey },
    },
    {
      key: 'interest-track',
      label: '관심태그만',
      description: '내 관심태그 뷰',
      query: {
        status: 'all',
        tag: interestTags[0] || 'all',
        sort: 'end-asc',
        q: '',
        quick: 'interest' as QuickViewKey,
      },
    },
  ]

  if (loading) return <LoadingState title="해커톤 목록을 불러오는 중..." />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  function setQueryValue(key: 'status' | 'tag' | 'sort' | 'q' | 'quick', value: string) {
    const next = new URLSearchParams(searchParams)
    const defaults = {
      status: 'all',
      tag: 'all',
      sort: 'end-asc',
      q: '',
      quick: 'all',
    }

    if (!value || value === defaults[key]) {
      next.delete(key)
    } else {
      next.set(key, value)
    }

    setSearchParams(next)
  }

  function applyQuickView(nextQuickView: QuickViewKey) {
    const next = new URLSearchParams(searchParams)
    next.delete('q')

    if (nextQuickView === 'ongoing') {
      next.set('status', 'ongoing')
      next.delete('tag')
    }

    if (nextQuickView === 'urgent' || nextQuickView === 'new') {
      next.delete('status')
      next.delete('tag')
    }

    if (nextQuickView === 'interest') {
      next.delete('status')
      if (interestTags[0]) {
        next.set('tag', interestTags[0])
      }
    }

    if (nextQuickView === 'all') {
      next.delete('quick')
    } else {
      next.set('quick', nextQuickView)
    }

    setSearchParams(next)
  }

  function applySavedView(view: {
    status: string
    tag: string
    sort: SortKey
    q: string
    quick: QuickViewKey
  }) {
    const next = new URLSearchParams()
    if (view.status !== 'all') next.set('status', view.status)
    if (view.tag !== 'all') next.set('tag', view.tag)
    if (view.sort !== 'end-asc') next.set('sort', view.sort)
    if (view.q) next.set('q', view.q)
    if (view.quick !== 'all') next.set('quick', view.quick)
    setSearchParams(next)
  }

  function resetAllFilters() {
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

  function selectTagFromCard(nextTag: string, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    setQueryValue('tag', nextTag)
  }

  function rememberRecent(slug: string) {
    setRecentViewedSlugs((prev) => {
      const next = [slug, ...prev.filter((item) => item !== slug)].slice(0, 3)
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(RECENT_VIEW_KEY, JSON.stringify(next))
      }
      return next
    })
  }

  function openDetail(slug: string) {
    rememberRecent(slug)
    navigate(`/hackathons/${slug}`)
  }

  function openCamp(slug: string, e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    rememberRecent(slug)
    navigate(`/camp?hackathon=${slug}`)
  }

  function toggleInterestTag(itemTag: string) {
    setInterestTags((prev) =>
      prev.includes(itemTag) ? prev.filter((tagItem) => tagItem !== itemTag) : [...prev, itemTag].slice(-6),
    )
  }

  function toggleChecklistItem(key: ChecklistKey) {
    setQualityChecklist((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  return (
    <section className={`${styles.pageShell} ${reduceMotion ? styles.reduceMotion : ''}`}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarSticky}>
          <MainSidebarSection title="빠른 보기">
            <div className={styles.quickViewGrid}>
              <button
                type="button"
                className={`${styles.quickViewButton} ${quickView === 'ongoing' ? styles.quickViewActive : ''}`}
                onClick={() => applyQuickView('ongoing')}
              >
                <span>진행중</span>
                <strong>{quickViewCounts.ongoing}</strong>
              </button>
              <button
                type="button"
                className={`${styles.quickViewButton} ${quickView === 'urgent' ? styles.quickViewActive : ''}`}
                onClick={() => applyQuickView('urgent')}
              >
                <span>마감임박 D-3</span>
                <strong>{quickViewCounts.urgent}</strong>
              </button>
              <button
                type="button"
                className={`${styles.quickViewButton} ${quickView === 'new' ? styles.quickViewActive : ''}`}
                onClick={() => applyQuickView('new')}
              >
                <span>신규</span>
                <strong>{quickViewCounts.new}</strong>
              </button>
              <button
                type="button"
                className={`${styles.quickViewButton} ${quickView === 'interest' ? styles.quickViewActive : ''}`}
                onClick={() => applyQuickView('interest')}
              >
                <span>내 관심태그</span>
                <strong>{quickViewCounts.interest}</strong>
              </button>
            </div>
            <div className={styles.tagPicker}>
              {tagOptions.slice(0, 8).map((itemTag) => (
                <button
                  key={itemTag}
                  type="button"
                  className={`${styles.pickTag} ${interestTags.includes(itemTag) ? styles.pickTagActive : ''}`}
                  onClick={() => toggleInterestTag(itemTag)}
                >
                  {itemTag}
                </button>
              ))}
            </div>
          </MainSidebarSection>

          <MainSidebarSection title="저장된 뷰">
            <div className={styles.savedViewList}>
              {savedViews.map((view) => (
                <button key={view.key} type="button" className={styles.savedViewButton} onClick={() => applySavedView(view.query)}>
                  <strong>{view.label}</strong>
                  <span>{view.description}</span>
                </button>
              ))}
            </div>
          </MainSidebarSection>

          <MainSidebarSection title="컨텍스트 인사이트">
            <div className={styles.contextGrid}>
              <div className={styles.contextItem}>
                <span>결과 수</span>
                <strong>{contextResultCount}</strong>
              </div>
              <div className={styles.contextItem}>
                <span>평균 마감일</span>
                <strong>{contextAverageDeadline ? formatDateShort(new Date(contextAverageDeadline).toISOString()) : '-'}</strong>
              </div>
              <div className={styles.contextItem}>
                <span>모집중 팀</span>
                <strong>{contextOpenTeamTotal}</strong>
              </div>
            </div>
          </MainSidebarSection>

          <MainSidebarSection title="최근 본 해커톤">
            {recentViewedItems.length ? (
              <div className={styles.recentList}>
                {recentViewedItems.map((item) => (
                  <button
                    key={item.slug}
                    type="button"
                    className={styles.recentItem}
                    onClick={() => openDetail(item.slug)}
                  >
                    <span>{item.title}</span>
                    <small>{formatDateShort(item.period?.submissionDeadlineAt)}</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted">상세 페이지를 열면 여기에 최근 3개가 표시됩니다.</p>
            )}
          </MainSidebarSection>

          <MainSidebarSection title="심사 포인트 체크">
            <div className={styles.checkList}>
              <label>
                <input
                  type="checkbox"
                  checked={qualityChecklist.basic}
                  onChange={() => toggleChecklistItem('basic')}
                />
                기본구현
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={qualityChecklist.extension}
                  onChange={() => toggleChecklistItem('extension')}
                />
                확장
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={qualityChecklist.completeness}
                  onChange={() => toggleChecklistItem('completeness')}
                />
                완성도
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={qualityChecklist.docs}
                  onChange={() => toggleChecklistItem('docs')}
                />
                문서
              </label>
            </div>
          </MainSidebarSection>

          <MainSidebarSection title="접근성">
            <label className={styles.reduceMotionToggle}>
              <input type="checkbox" checked={reduceMotion} onChange={() => setReduceMotion((prev) => !prev)} />
              사이드바 모션 줄이기
            </label>
          </MainSidebarSection>

        </div>
      </aside>

      <div className={`stack-lg ${styles.mainColumn}`}>
        <header className={`page-header ${styles.headerBar}`}>`r`n          <p>필터는 메인에서, 결정은 좌측 패널에서 빠르게 진행하세요.</p>
          <div className={styles.insightChips}>
            <span className={styles.insightChip}>전체 {hackathons.length}</span>
            <span className={`${styles.insightChip} ${styles.insightChipOngoing}`}>진행중 {quickViewCounts.ongoing}</span>
            <span className={`${styles.insightChip} ${styles.insightChipUrgent}`}>마감 임박 {quickViewCounts.urgent}</span>
            {quickView !== 'all' ? (
              <span className={styles.insightChip}>빠른 보기 {QUICK_VIEW_LABEL[quickView]}</span>
            ) : null}
          </div>
        </header>

        <section className={`controls ${styles.filters}`}>
          <label>
            검색
            <input
              value={keyword}
              onChange={(e) => setQueryValue('q', e.target.value)}
              placeholder="제목, 태그, slug"
            />
          </label>
          <label>
            상태 필터
            <select value={status} onChange={(e) => setQueryValue('status', e.target.value)}>
              <option value="all">전체</option>
              <option value="ongoing">진행중</option>
              <option value="ended">종료</option>
              <option value="upcoming">예정</option>
            </select>
          </label>
          <label>
            태그 필터
            <select value={tag} onChange={(e) => setQueryValue('tag', e.target.value)}>
              <option value="all">전체</option>
              {tagOptions.map((itemTag) => (
                <option key={itemTag} value={itemTag}>
                  {itemTag}
                </option>
              ))}
            </select>
          </label>
          <label>
            정렬
            <select value={sortBy} onChange={(e) => setQueryValue('sort', e.target.value)}>
              <option value="end-asc">마감 빠른순</option>
              <option value="end-desc">마감 늦은순</option>
              <option value="title">제목순</option>
            </select>
          </label>
          <button className="button ghost align-end" type="button" onClick={resetAllFilters}>
            필터 초기화
          </button>
          <button className="button secondary align-end" type="button" onClick={copyCurrentView}>
            {copiedView ? '뷰 링크 복사됨' : '현재 뷰 링크 복사'}
          </button>
        </section>

        <section className={styles.resultMeta} aria-live="polite">
          <p>
            현재 결과 <strong>{filtered.length}</strong>개 · 활성 필터 <strong>{activeFilterCount}</strong>개
          </p>
          <p className="muted">공유 가능한 검색 상태를 유지한 채 상세 페이지로 이동할 수 있습니다.</p>
        </section>

        {hasActiveFilter ? (
          <section className={styles.activeFilters} aria-label="현재 적용 필터">
            {keyword.trim() ? (
              <button className={styles.activeFilterChip} type="button" onClick={() => setQueryValue('q', '')}>
                검색: {keyword} ×
              </button>
            ) : null}
            {status !== 'all' ? (
              <button className={styles.activeFilterChip} type="button" onClick={() => setQueryValue('status', 'all')}>
                상태: {STATUS_LABEL[status] || status} ×
              </button>
            ) : null}
            {tag !== 'all' ? (
              <button className={styles.activeFilterChip} type="button" onClick={() => setQueryValue('tag', 'all')}>
                태그: {tag} ×
              </button>
            ) : null}
            {sortBy !== 'end-asc' ? (
              <button className={styles.activeFilterChip} type="button" onClick={() => setQueryValue('sort', 'end-asc')}>
                정렬: {sortBy === 'end-desc' ? '마감 늦은순' : '제목순'} ×
              </button>
            ) : null}
            {quickView !== 'all' ? (
              <button className={styles.activeFilterChip} type="button" onClick={() => setQueryValue('quick', 'all')}>
                빠른 보기: {QUICK_VIEW_LABEL[quickView]} ×
              </button>
            ) : null}
          </section>
        ) : null}

        {filtered.length ? (
          <section className={styles.listWrap}>
            {filtered.map((item) => {
              const deadlineMeta = getDeadlineMeta(item, nowMs)
              const participants = participantCountBySlug[item.slug] || 0
              const openTeams = openTeamCountBySlug[item.slug] || 0
              const isSelected = selectedHackathon?.slug === item.slug

              return (
                <article
                  key={item.slug}
                  className={`cv-auto ${styles.hackathonCard} ${isSelected ? styles.hackathonCardSelected : ''}`}
                  onClick={() => openDetail(item.slug)}
                  onMouseEnter={() => setSelectedSlug(item.slug)}
                  onFocus={() => setSelectedSlug(item.slug)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      openDetail(item.slug)
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`${item.title} 상세 페이지로 이동`}
                >
                  <div className={styles.cardMedia} aria-hidden="true">
                    {!item.thumbnailUrl || item.thumbnailUrl.includes('example.com') ? (
                      <span className={styles.mediaFallback}>{(item.tags || [item.status]).slice(0, 2).join(' · ')}</span>
                    ) : (
                      <img src={item.thumbnailUrl} alt="" loading="lazy" />
                    )}
                  </div>

                  <header className={styles.cardHead}>
                    <div className={styles.titleCell}>
                      <span className={styles.titleMain}>{item.title}</span>
                      <span className={styles.slugHint}>/{item.slug}</span>
                    </div>
                    <div className={styles.badgeGroup}>
                      <span className={`status-chip status-${item.status}`}>{STATUS_LABEL[item.status] || item.status}</span>
                      <span
                        className={`${styles.deadlineBadge} ${
                          deadlineMeta.variant === 'urgent'
                            ? styles.deadlineUrgent
                            : deadlineMeta.variant === 'closed'
                              ? styles.deadlineClosed
                              : deadlineMeta.variant === 'none'
                                ? styles.deadlineNone
                                : ''
                        }`}
                      >
                        {deadlineMeta.label}
                      </span>
                    </div>
                  </header>

                  <div className={styles.cardMetaGrid}>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>시작일</span>
                      <strong>{formatDateShort(item.period?.startAt)}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>마감일</span>
                      <strong>{formatDateShort(item.period?.submissionDeadlineAt || item.period?.endAt)}</strong>
                    </div>
                    <div className={styles.metaItem}>
                      <span className={styles.metaLabel}>팀/참가자</span>
                      <strong>
                        {openTeams}/{participants}
                      </strong>
                    </div>
                  </div>

                  <div className={styles.tagsInline}>
                    {(item.tags || []).map((itemTag) => (
                      <button
                        key={itemTag}
                        className={`tag ${styles.tagButton}`}
                        type="button"
                        onClick={(e) => selectTagFromCard(itemTag, e)}
                      >
                        {itemTag}
                      </button>
                    ))}
                  </div>

                  <div className={styles.cardFooter}>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        openDetail(item.slug)
                      }}
                    >
                      상세 보기
                    </button>
                    <button className="button ghost" type="button" onClick={(e) => openCamp(item.slug, e)}>
                      팀 찾기
                    </button>
                  </div>
                </article>
              )
            })}
          </section>
        ) : (
          <EmptyState
            title="조건에 맞는 해커톤이 없습니다."
            message={
              quickView === 'interest' && interestTags.length === 0
                ? '관심 태그를 먼저 1개 이상 선택하면 내 관심태그 빠른 보기가 동작합니다.'
                : '검색/필터를 조정해 다시 탐색해보세요.'
            }
            action={
              <button className="button secondary" type="button" onClick={resetAllFilters}>
                전체 해커톤 보기
              </button>
            }
          />
        )}
      </div>
    </section>
  )
}


