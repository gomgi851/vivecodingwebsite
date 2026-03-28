import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlocks'
import { useAppData } from '../store/AppDataContext'
import type { Leaderboard, Team } from '../types'
import styles from './HackathonDetailPage.module.css'

const TEAM_JOIN_REQUESTS_KEY = 'team_join_requests'
const HACKATHON_APPLICATIONS_KEY = 'hackathon_applications'
const VIEWER_ID_KEY = 'vivecoder_viewer_id'
const RECRUITING_PREVIEW_LIMIT = 4
const DUMMY_RECRUITING_TEAM_COUNT = 10

interface RecruitingTeamRow {
  team: Team
  currentMembers: number
  totalMembers: number
  openSlots: number
  roleList: string[]
  isRecruiting: boolean
  isDummy?: boolean
}

type JoinStatus = 'pending' | 'approved' | 'rejected'

interface TeamJoinRequest {
  id: string
  hackathonSlug: string
  teamCode: string
  teamName: string
  requesterId: string
  status: JoinStatus
  createdAt: string
}

interface HackathonApplication {
  id: string
  viewerId: string
  hackathonSlug: string
  participationMode: 'personal' | 'team'
  agreedRules: boolean
  agreedSchedule: boolean
  createdAt: string
}

const STATUS_LABEL = {
  upcoming: '예정',
  ongoing: '진행 중',
  ended: '종료',
}

const SECTION_LINKS = [
  { id: 'teams', label: '팀', hint: '모집 · 참가 신청' },
  { id: 'overview', label: '개요', hint: '대회 요약 · 정책' },
  { id: 'eval', label: '평가 기준', hint: '기준 · 배점' },
  { id: 'prize', label: '상금', hint: '보상 · 혜택' },
  { id: 'info', label: '안내', hint: '공지 · 링크' },
  { id: 'schedule', label: '일정', hint: '마일스톤' },
  { id: 'submit', label: '제출', hint: '폼 · 검증 상태' },
  { id: 'leaderboard', label: '리더보드', hint: '순위 · 점수' },
] as const

const FALLBACK_THUMBNAILS = [
  '/images/hackathon-fallback/fallback-0.svg',
  '/images/hackathon-fallback/fallback-1.svg',
  '/images/hackathon-fallback/fallback-2.svg',
  '/images/hackathon-fallback/fallback-3.svg',
  '/images/hackathon-fallback/fallback-4.svg',
  '/images/hackathon-fallback/fallback-5.svg',
]

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR')
}

function getDaysLeft(value?: string) {
  if (!value) return null
  const target = new Date(value).getTime()
  if (!Number.isFinite(target) || target <= 0) return null
  const diff = Math.ceil((target - Date.now()) / (24 * 60 * 60 * 1000))
  return diff
}

function getCurrentMembers(team: { currentMemberCount?: number; memberCount?: number }) {
  return Math.max(1, Number(team.currentMemberCount ?? team.memberCount ?? 1) || 1)
}

function getTotalMembers(team: { totalMemberCount?: number; currentMemberCount?: number; memberCount?: number }) {
  const current = getCurrentMembers(team)
  return Math.max(current, Number(team.totalMemberCount ?? current) || current)
}

function computeScore(participant: string, judge: string) {
  if (participant === '' || judge === '') return 80
  const p = Number(participant)
  const j = Number(judge)
  if (Number.isNaN(p) || Number.isNaN(j)) return 80
  return Math.round((p * 0.3 + j * 0.7) * 10) / 10
}

function formatPlaceLabel(place?: string) {
  if (!place) return '-'
  const normalized = place.trim().toLowerCase()
  if (normalized === '1st') return '1등'
  if (normalized === '2nd') return '2등'
  if (normalized === '3rd') return '3등'
  return place
}

function formatMetricDisplay(metricName?: string) {
  if (!metricName) return '-'
  const normalized = metricName.trim().toLowerCase()
  if (normalized === 'finalscore') return '최종 평가 점수'
  if (normalized === 'ideascore') return '아이디어 평가 점수'
  return metricName
}

function rankBadge(rank?: number) {
  if (rank === 1) return '🥇'
  if (rank === 2) return '🥈'
  if (rank === 3) return '🥉'
  return '·'
}

function getToneIndexBySlug(slug: string) {
  let hash = 0
  for (let i = 0; i < slug.length; i += 1) {
    hash = (hash * 31 + slug.charCodeAt(i)) >>> 0
  }
  return hash % 6
}

function getFallbackThumbnailBySlug(slug: string) {
  return FALLBACK_THUMBNAILS[getToneIndexBySlug(slug) % FALLBACK_THUMBNAILS.length]
}

function findLeaderboardBySlug(leaderboards: Leaderboard[], slug: string) {
  return leaderboards.find((item) => item.hackathonSlug === slug)
}

function getOrCreateViewerId() {
  if (typeof window === 'undefined') return 'viewer-anon'
  const existing = window.localStorage.getItem(VIEWER_ID_KEY)
  if (existing) return existing
  const created = `viewer-${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem(VIEWER_ID_KEY, created)
  return created
}

function readJoinRequests() {
  if (typeof window === 'undefined') return [] as TeamJoinRequest[]
  try {
    const raw = window.localStorage.getItem(TEAM_JOIN_REQUESTS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as TeamJoinRequest[]
  } catch {
    return []
  }
}

function readApplications() {
  if (typeof window === 'undefined') return [] as HackathonApplication[]
  try {
    const raw = window.localStorage.getItem(HACKATHON_APPLICATIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as HackathonApplication[]
  } catch {
    return []
  }
}

function buildDummyRecruitingTeamRows(slug: string): RecruitingTeamRow[] {
  const safeSlug = slug.replace(/[^a-z0-9]/gi, '').toUpperCase().slice(0, 10) || 'HACKATHON'
  const namePrefix = safeSlug.slice(0, 4).toLowerCase()
  const rolePool = ['Frontend', 'Backend', 'AI Engineer', 'Designer', 'PM', 'Data']

  return Array.from({ length: DUMMY_RECRUITING_TEAM_COUNT }, (_, index) => {
    const label = String(index + 1).padStart(2, '0')
    const currentMembers = 2 + (index % 3)
    const totalMembers = currentMembers + (index % 2 === 0 ? 2 : 1)
    const roleList = [rolePool[index % rolePool.length], rolePool[(index + 2) % rolePool.length]].filter(
      (role, roleIndex, arr) => arr.indexOf(role) === roleIndex,
    )

    return {
      team: {
        teamCode: `TEST-${safeSlug}-${label}`,
        hackathonSlug: slug,
        name: `${namePrefix}-test${label}`,
        isOpen: true,
        currentMemberCount: currentMembers,
        totalMemberCount: totalMembers,
        memberCount: currentMembers,
        lookingFor: roleList,
        intro: `test${label} 더미 팀입니다.`,
        contact: {
          type: 'link',
          url: `https://example.com/test-team-${label}`,
        },
      },
      currentMembers,
      totalMembers,
      openSlots: totalMembers - currentMembers,
      roleList,
      isRecruiting: true,
      isDummy: true,
    }
  })
}

export function HackathonDetailPage() {
  const { slug = '' } = useParams()
  const {
    loading,
    error,
    refresh,
    hackathons,
    detailsBySlug,
    teams,
    setTeams,
    submissions,
    leaderboards,
    setSubmissions,
    setLeaderboards,
  } = useAppData()

  const [form, setForm] = useState({
    teamName: '',
    planTitle: '',
    webUrl: '',
    pdfUrl: '',
    notes: '',
    participant: '',
    judge: '',
  })
  const [message, setMessage] = useState('')
  const [activeSection, setActiveSection] = useState<(typeof SECTION_LINKS)[number]['id']>('teams')
  const [viewerId] = useState<string>(() => getOrCreateViewerId())
  const [joinRequests, setJoinRequests] = useState<TeamJoinRequest[]>(() => readJoinRequests())
  const [applications, setApplications] = useState<HackathonApplication[]>(() => readApplications())
  const [teamFlowMessage, setTeamFlowMessage] = useState('')
  const [showAllRecruitingTeams, setShowAllRecruitingTeams] = useState(false)
  const [isTocExpanded, setIsTocExpanded] = useState(false)
  const tocLockedSectionRef = useRef<(typeof SECTION_LINKS)[number]['id'] | null>(null)
  const tocLockExpiresAtRef = useRef(0)
  const [applicationForm, setApplicationForm] = useState({
    agreedRules: false,
    agreedSchedule: false,
    participationMode: 'personal' as 'personal' | 'team',
  })

  useEffect(() => {
    setShowAllRecruitingTeams(false)
    setIsTocExpanded(false)
  }, [slug])

  useEffect(() => {
    const sectionNodes = SECTION_LINKS.map((item) => document.getElementById(item.id)).filter(
      Boolean,
    ) as HTMLElement[]
    if (!sectionNodes.length) return

    const updateActiveSection = () => {
      const sectionSwitchOffset = 108
      const cursor = window.scrollY + sectionSwitchOffset
      const atPageBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4

      const lockedSection = tocLockedSectionRef.current
      if (lockedSection) {
        const target = document.getElementById(lockedSection)
        const isExpired = Date.now() > tocLockExpiresAtRef.current

        if (!target || isExpired) {
          tocLockedSectionRef.current = null
        } else {
          const targetY = target.getBoundingClientRect().top + window.scrollY - sectionSwitchOffset
          const arrived = Math.abs(targetY - cursor) <= 12

          if (arrived) {
            tocLockedSectionRef.current = null
          } else {
            setActiveSection((prev) => (prev === lockedSection ? prev : lockedSection))
            return
          }
        }
      }

      if (atPageBottom) {
        const last = sectionNodes[sectionNodes.length - 1]
        setActiveSection((prev) =>
          prev === last.id ? prev : (last.id as (typeof SECTION_LINKS)[number]['id']),
        )
        return
      }

      const sectionStartPositions = sectionNodes.map(
        (node) => node.getBoundingClientRect().top + window.scrollY,
      )

      let activeIndex = 0
      for (let index = 0; index < sectionNodes.length - 1; index += 1) {
        const currentStart = sectionStartPositions[index]
        const nextStart = sectionStartPositions[index + 1]
        const switchPoint = currentStart + (nextStart - currentStart) * 0.5

        if (cursor >= switchPoint) {
          activeIndex = index + 1
        } else {
          break
        }
      }

      const current = sectionNodes[activeIndex].id

      setActiveSection((prev) =>
        prev === current ? prev : (current as (typeof SECTION_LINKS)[number]['id']),
      )
    }

    let rafId = 0
    const onScroll = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        updateActiveSection()
        rafId = 0
      })
    }

    updateActiveSection()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', updateActiveSection)
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [slug, loading, error])

  function handleSidebarNavigate(sectionId: (typeof SECTION_LINKS)[number]['id']) {
    const target = document.getElementById(sectionId)
    if (!target) return

    const topOffset = 108
    const targetTop = target.getBoundingClientRect().top + window.scrollY - topOffset
    tocLockedSectionRef.current = sectionId
    tocLockExpiresAtRef.current = Date.now() + 900
    window.scrollTo({ top: targetTop, behavior: 'smooth' })
    setActiveSection(sectionId)
    window.history.replaceState(null, '', `#${sectionId}`)
  }

  if (loading) return <LoadingState title="해커톤 상세를 불러오는 중..." />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const hackathon = hackathons.find((item) => item.slug === slug)
  const detail = detailsBySlug[slug]

  if (!hackathon || !detail) {
    return (
      <EmptyState
        title="존재하지 않는 해커톤입니다."
        message="목록 페이지에서 다시 선택해주세요."
        action={
          <Link className="button" to="/hackathons">
            해커톤 목록으로 이동
          </Link>
        }
      />
    )
  }

  const section = detail.sections || {}
  const teamRows = teams.filter((team) => team.hackathonSlug === slug)
  const myApplication = applications.find((item) => item.hackathonSlug === slug && item.viewerId === viewerId)
  const myLeaderTeams = teamRows.filter((team) => team.ownerId === viewerId)
  const pendingRequestsForMyTeams = joinRequests.filter(
    (item) =>
      item.hackathonSlug === slug &&
      item.status === 'pending' &&
      myLeaderTeams.some((team) => team.teamCode === item.teamCode),
  )
  const board = findLeaderboardBySlug(leaderboards, slug)
  const entries = board?.entries || []
  const recentSubmissions = [...submissions]
    .filter((item) => item.hackathonSlug === slug)
    .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    .slice(0, 5)
  const submissionDeadline = hackathon.period?.submissionDeadlineAt || hackathon.period?.endAt
  const deadlineDaysLeft = getDaysLeft(submissionDeadline)
  const noticeItems = section.info?.notice || []
  const milestoneItems = section.schedule?.milestones || []
  const prizeItems = section.prize?.items || []
  const evalBreakdown = section.eval?.scoreDisplay?.breakdown || []
  const evalLimits = section.eval?.limits
  const metricDisplay = formatMetricDisplay(section.eval?.metricName)
  const teamPolicyMaxSize = Number(section.overview?.teamPolicy?.maxTeamSize) || null
  const funnelSteps = [
    { key: 'apply', label: '참가 신청', done: Boolean(myApplication) },
    { key: 'team', label: '팀 구성', done: teamRows.length > 0 },
    {
      key: 'submit',
      label: '제출 완료',
      done: recentSubmissions.some((item) => item.status === 'submitted'),
    },
    { key: 'rank', label: '랭킹 반영', done: entries.length > 0 },
  ]
  const funnelDoneCount = funnelSteps.filter((item) => item.done).length
  const progressPercent = Math.round((funnelDoneCount / funnelSteps.length) * 100)
  const fallbackThumbnail = getFallbackThumbnailBySlug(slug)
  const hasRealThumbnail = Boolean(hackathon.thumbnailUrl && !hackathon.thumbnailUrl.includes('example.com'))
  const heroThumbnailSrc = hasRealThumbnail ? hackathon.thumbnailUrl! : fallbackThumbnail
  const realRecruitingTeamRows: RecruitingTeamRow[] = teamRows
    .map((team) => {
      const currentMembers = getCurrentMembers(team)
      const normalizedTotal = getTotalMembers(team)
      const inferredTotal =
        team.isOpen && normalizedTotal <= currentMembers
          ? Math.max(currentMembers + 1, teamPolicyMaxSize ?? currentMembers + 1)
          : normalizedTotal
      const totalMembers = inferredTotal
      const openSlots = Math.max(totalMembers - currentMembers, 0)
      const roleList = (team.lookingFor || []).filter(Boolean)
      return {
        team,
        currentMembers,
        totalMembers,
        openSlots,
        roleList,
        isRecruiting: team.isOpen && openSlots > 0,
      }
    })
    .filter((item) => item.isRecruiting)
    .sort(
      (a, b) =>
        b.openSlots - a.openSlots || a.team.name.localeCompare(b.team.name, 'ko-KR'),
    )

  const dummyRecruitingTeamRows = buildDummyRecruitingTeamRows(slug)
  const missingTeamCount = Math.max(0, DUMMY_RECRUITING_TEAM_COUNT - realRecruitingTeamRows.length)
  const recruitingTeamRows = [
    ...realRecruitingTeamRows,
    ...dummyRecruitingTeamRows.slice(0, missingTeamCount),
  ]
  const dummyInjectedCount = recruitingTeamRows.filter((item) => item.isDummy).length
  const usingDummyRecruitingTeams = dummyInjectedCount > 0

  const visibleRecruitingTeams = showAllRecruitingTeams
    ? recruitingTeamRows
    : recruitingTeamRows.slice(0, RECRUITING_PREVIEW_LIMIT)
  const hiddenRecruitingTeamCount = Math.max(
    0,
    recruitingTeamRows.length - visibleRecruitingTeams.length,
  )

  function updateField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function persistJoinRequests(next: TeamJoinRequest[]) {
    setJoinRequests(next)
    window.localStorage.setItem(TEAM_JOIN_REQUESTS_KEY, JSON.stringify(next))
  }

  function persistApplications(next: HackathonApplication[]) {
    setApplications(next)
    window.localStorage.setItem(HACKATHON_APPLICATIONS_KEY, JSON.stringify(next))
  }

  function applyToHackathon() {
    if (!applicationForm.agreedRules || !applicationForm.agreedSchedule) {
      setTeamFlowMessage('필수 동의사항(규정/일정)을 체크해야 참가 신청이 가능합니다.')
      return
    }

    const now = new Date().toISOString()
    const existing = applications.find((item) => item.hackathonSlug === slug && item.viewerId === viewerId)
    if (existing) {
      const next = applications.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              participationMode: applicationForm.participationMode,
              agreedRules: true,
              agreedSchedule: true,
              createdAt: now,
            }
          : item,
      )
      persistApplications(next)
      setTeamFlowMessage('참가 신청 정보가 갱신되었습니다.')
      return
    }

    const next = [
      ...applications,
      {
        id: `apply-${Date.now()}`,
        viewerId,
        hackathonSlug: slug,
        participationMode: applicationForm.participationMode,
        agreedRules: true,
        agreedSchedule: true,
        createdAt: now,
      },
    ]
    persistApplications(next)
    setTeamFlowMessage('참가 신청이 완료되었습니다.')
  }

  function requestJoinTeam(teamCode: string, teamName: string) {
    if (!myApplication) {
      setTeamFlowMessage('먼저 위에서 해커톤 참가 신청을 완료해주세요.')
      return
    }
    const targetTeam = teamRows.find((team) => team.teamCode === teamCode)
    if (!targetTeam) {
      setTeamFlowMessage('해당 팀 정보를 찾을 수 없습니다.')
      return
    }
    if (!targetTeam.isOpen) {
      setTeamFlowMessage('모집이 마감된 팀입니다.')
      return
    }
    if (getCurrentMembers(targetTeam) >= getTotalMembers(targetTeam)) {
      setTeamFlowMessage('해당 팀은 정원이 가득 차서 합류 요청을 보낼 수 없습니다.')
      return
    }
    const exists = joinRequests.find(
      (item) =>
        item.hackathonSlug === slug &&
        item.teamCode === teamCode &&
        item.requesterId === viewerId &&
        item.status === 'pending',
    )
    if (exists) {
      setTeamFlowMessage('이미 해당 팀에 합류 요청을 보냈습니다.')
      return
    }
    const next = [
      ...joinRequests,
      {
        id: `join-${crypto.randomUUID()}`,
        hackathonSlug: slug,
        teamCode,
        teamName,
        requesterId: viewerId,
        status: 'pending' as const,
        createdAt: new Date().toISOString(),
      },
    ]
    persistJoinRequests(next)
    setTeamFlowMessage('팀 합류 요청을 보냈습니다. 팀장 승인 대기 중입니다.')
  }

  function decideJoinRequest(requestId: string, decision: 'approved' | 'rejected') {
    const target = joinRequests.find((item) => item.id === requestId)
    if (!target) return
    const isLeader = myLeaderTeams.some((team) => team.teamCode === target.teamCode)
    if (!isLeader) {
      setTeamFlowMessage('해당 요청을 처리할 권한이 없습니다.')
      return
    }

    if (decision === 'approved') {
      const targetTeam = teams.find((team) => team.teamCode === target.teamCode)
      if (!targetTeam) {
        setTeamFlowMessage('팀 정보를 찾을 수 없어 요청을 완료할 수 없습니다.')
        return
      }
      const current = getCurrentMembers(targetTeam)
      const total = getTotalMembers(targetTeam)
      if (current >= total) {
        setTeamFlowMessage(`정원이 가득 차서 수락할 수 없습니다. (${current}/${total})`)
        return
      }
      const nextRequests = joinRequests.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: decision,
            }
          : item,
      )
      persistJoinRequests(nextRequests)
      const nextTeams = teams.map((team) =>
        team.teamCode === target.teamCode
          ? {
              ...team,
              currentMemberCount: current + 1,
              totalMemberCount: Math.max(total, current + 1),
              memberCount: current + 1,
              isOpen: current + 1 < total ? team.isOpen : false,
              updatedAt: new Date().toISOString(),
            }
          : team,
      )
      setTeams(nextTeams)
      setTeamFlowMessage(`합류 요청을 수락했습니다. 현재/총 인원: ${current + 1}/${total}`)
    } else {
      const nextRequests = joinRequests.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: decision,
            }
          : item,
      )
      persistJoinRequests(nextRequests)
      setTeamFlowMessage('합류 요청을 거절했습니다.')
    }
  }

  function saveSubmission(mode: 'draft' | 'submitted') {
    if (!form.teamName.trim()) {
      setMessage('팀명을 입력해주세요.')
      return
    }
    if (mode === 'submitted' && !form.webUrl.trim()) {
      setMessage('최종 제출에는 웹 URL이 필요합니다.')
      return
    }

    const now = new Date().toISOString()
    const newSubmission = {
      id: `sub-${Date.now()}`,
      hackathonSlug: slug,
      teamName: form.teamName.trim(),
      planTitle: form.planTitle.trim(),
      webUrl: form.webUrl.trim(),
      pdfUrl: form.pdfUrl.trim(),
      notes: form.notes.trim(),
      status: mode,
      submittedAt: now,
      scoreBreakdown:
        form.participant !== '' && form.judge !== ''
          ? {
              participant: Number(form.participant),
              judge: Number(form.judge),
            }
          : undefined,
    }

    setSubmissions([...submissions, newSubmission])

    if (mode === 'submitted') {
      const score = computeScore(form.participant, form.judge)
      const nextBoards = [...leaderboards]
      let target = nextBoards.find((item) => item.hackathonSlug === slug)

      if (!target) {
        target = { hackathonSlug: slug, updatedAt: now, entries: [] }
        nextBoards.push(target)
      }

      const existing = target.entries.find((item) => item.teamName === newSubmission.teamName)
      const nextEntry = {
        teamName: newSubmission.teamName,
        score,
        submittedAt: now,
        scoreBreakdown: newSubmission.scoreBreakdown,
        artifacts: {
          webUrl: newSubmission.webUrl,
          pdfUrl: newSubmission.pdfUrl,
          planTitle: newSubmission.planTitle,
        },
      }

      if (existing) {
        Object.assign(existing, nextEntry)
      } else {
        target.entries.push(nextEntry)
      }

      target.entries = target.entries
        .sort((a, b) => b.score - a.score)
        .map((item, idx) => ({ ...item, rank: idx + 1 }))
      target.updatedAt = now

      setLeaderboards(nextBoards)
      setMessage('제출이 완료되어 리더보드가 업데이트되었습니다.')
    } else {
      setMessage('임시 저장되었습니다. 제출 버튼을 누르면 리더보드에 반영됩니다.')
    }
  }

  return (
    <section className={`stack-lg ${styles.pageDockLayout}`}>
      <aside className={styles.sectionSidebar}>
        <section className={styles.sidebarPanel}>
          <button
            type="button"
            className={styles.sidebarToggle}
            onClick={() => setIsTocExpanded((prev) => !prev)}
            aria-expanded={isTocExpanded}
            aria-controls="hackathon-section-toc"
          >
            <p className={styles.sidebarTitle}>섹션 목차</p>
            <span
              className={
                isTocExpanded
                  ? `${styles.sidebarToggleIcon} ${styles.sidebarToggleIconOpen}`
                  : styles.sidebarToggleIcon
              }
              aria-hidden="true"
            >
              ▾
            </span>
          </button>
          <div
            id="hackathon-section-toc"
            className={
              isTocExpanded
                ? `${styles.sidebarCollapsible} ${styles.sidebarCollapsibleOpen}`
                : styles.sidebarCollapsible
            }
          >
            <div className={styles.sidebarCollapsibleInner}>
              <ul className={styles.sidebarList}>
                {SECTION_LINKS.map((item, index) => (
                  <li key={item.id}>
                    <a
                      className={
                        activeSection === item.id
                          ? `${styles.sidebarLink} ${styles.sidebarLinkActive}`
                          : styles.sidebarLink
                      }
                      href={`#${item.id}`}
                      onClick={(event) => {
                        event.preventDefault()
                        handleSidebarNavigate(item.id)
                      }}
                    >
                      <span className={styles.sidebarIndex}>{String(index + 1).padStart(2, '0')}</span>
                      <span className={styles.sidebarCopy}>
                        <span className={styles.sidebarLabel}>{item.label}</span>
                        <span className={styles.sidebarHint}>{item.hint}</span>
                      </span>
                      <span className={styles.sidebarDot} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.sidebarPanel}>
          <div className={styles.sidebarHead}>
            <p className={styles.sidebarTitle}>진행 바</p>
            <span className={styles.sidebarCount}>{funnelDoneCount}/{funnelSteps.length}</span>
          </div>
          <ol className={styles.sidebarProgressList}>
            {funnelSteps.map((item, index) => {
              const isCurrent = !item.done && index === funnelDoneCount
              return (
                <li
                  key={item.key}
                  className={
                    item.done
                      ? `${styles.sidebarProgressItem} ${styles.sidebarProgressItemDone}`
                      : isCurrent
                        ? `${styles.sidebarProgressItem} ${styles.sidebarProgressItemCurrent}`
                        : styles.sidebarProgressItem
                  }
                >
                  <span className={styles.sidebarProgressDot} aria-hidden="true" />
                  <div className={styles.sidebarProgressCopy}>
                    <span className={styles.sidebarProgressLabel}>{item.label}</span>
                    <span className={styles.sidebarProgressState}>
                      {item.done ? '완료' : isCurrent ? '진행 중' : '대기'}
                    </span>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      </aside>

      <header className={`page-header detail-header ${styles.hero}`}>
        <div className={styles.heroTopRow}>
          <p className={`status-chip status-${hackathon.status} ${styles.heroStatusChip}`}>
            {STATUS_LABEL[hackathon.status as keyof typeof STATUS_LABEL] || hackathon.status}
          </p>
          <h1 className={styles.heroTitle}>{hackathon.title}</h1>
        </div>

        <section className={styles.heroProgressBand} aria-label="진행도">
          <div className={styles.heroProgressHead}>
            <strong>
              진행도 {funnelDoneCount}/{funnelSteps.length}
            </strong>
            <span>{progressPercent}%</span>
          </div>
          <div className={styles.heroProgressTrack} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
            <span className={styles.heroProgressFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <p className={styles.heroProgressMeta}>
            제출 마감: {formatDate(submissionDeadline)}
            {deadlineDaysLeft !== null
              ? deadlineDaysLeft < 0
                ? ' · 마감 종료'
                : deadlineDaysLeft === 0
                  ? ' · D-Day'
                  : ` · D-${deadlineDaysLeft}`
              : ''}
          </p>
        </section>
      </header>

      <div className={styles.sectionContent}>
          <article className={`panel ${styles.bodySection} ${styles.teamsSection}`} id="teams">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionEmoji} aria-hidden="true">
                👥
              </span>
              팀
            </h2>
            <div className={styles.sectionShell}>
              <div className={styles.sectionCore}>
                <div className={styles.teamControlPanel}>
                  <p className={styles.blockLead}>참가 신청 후 팀을 만들거나, 모집 중인 팀에 합류 요청을 보낼 수 있습니다.</p>
                  <div className={styles.choiceRow}>
                    <button
                      className={
                        applicationForm.participationMode === 'personal'
                          ? `button secondary ${styles.choiceActive}`
                          : 'button ghost'
                      }
                      type="button"
                      onClick={() =>
                        setApplicationForm((prev) => ({
                          ...prev,
                          participationMode: 'personal',
                        }))
                      }
                    >
                      개인 참가
                    </button>
                    <button
                      className={
                        applicationForm.participationMode === 'team'
                          ? `button secondary ${styles.choiceActive}`
                          : 'button ghost'
                      }
                      type="button"
                      onClick={() =>
                        setApplicationForm((prev) => ({
                          ...prev,
                          participationMode: 'team',
                        }))
                      }
                    >
                      팀 참가
                    </button>
                    <button className="button" type="button" onClick={applyToHackathon}>
                      참가 신청
                    </button>
                  </div>

                  <div className={styles.teamPolicyChecks}>
                    <label className={styles.checkLine}>
                      <input
                        type="checkbox"
                        checked={applicationForm.agreedRules}
                        onChange={(e) =>
                          setApplicationForm((prev) => ({
                            ...prev,
                            agreedRules: e.target.checked,
                          }))
                        }
                      />
                      대회 규정 동의
                    </label>
                    <label className={styles.checkLine}>
                      <input
                        type="checkbox"
                        checked={applicationForm.agreedSchedule}
                        onChange={(e) =>
                          setApplicationForm((prev) => ({
                            ...prev,
                            agreedSchedule: e.target.checked,
                          }))
                        }
                      />
                      일정/마감 동의
                    </label>
                    <span className={styles.badgeStatus}>
                      현재 상태:{' '}
                      {myApplication
                        ? `${myApplication.participationMode === 'team' ? '팀 참가' : '개인 참가'} 신청 완료`
                        : '미신청'}
                    </span>
                  </div>
                </div>

                {pendingRequestsForMyTeams.length ? (
                  <div className={styles.pendingBox}>
                    <h4>내 팀 합류 요청</h4>
                    {pendingRequestsForMyTeams.map((request) => (
                      <div key={request.id} className={styles.pendingRow}>
                        <span>
                          요청자: {request.requesterId} / 팀: {request.teamName}
                        </span>
                        <div className={styles.pendingActions}>
                          <button
                            className="button secondary"
                            type="button"
                            onClick={() => decideJoinRequest(request.id, 'approved')}
                          >
                            수락
                          </button>
                          <button
                            className={`button ghost ${styles.rejectButton}`}
                            type="button"
                            onClick={() => decideJoinRequest(request.id, 'rejected')}
                          >
                            거절
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {teamFlowMessage ? <p className="alert">{teamFlowMessage}</p> : null}

                <p className={styles.teamSummaryLine}>
                  현재 모집 중인 팀 {recruitingTeamRows.length}개
                  {usingDummyRecruitingTeams
                    ? ` · 실데이터 ${realRecruitingTeamRows.length} / 더미 ${dummyInjectedCount}`
                    : ''}
                </p>

                {recruitingTeamRows.length ? (
                  <div className={styles.teamActionList}>
                    {visibleRecruitingTeams.map((item) => {
                      const { team, currentMembers, totalMembers, openSlots, roleList, isDummy } = item
                      const rolePreview = roleList.slice(0, 3)
                      const hiddenRoleCount = Math.max(0, roleList.length - rolePreview.length)

                      return (
                        <article key={team.teamCode} className={styles.teamActionCard}>
                          <div className={styles.teamActionHead}>
                            <strong>{team.name}</strong>
                            <span className={styles.teamOpenBadge}>모집 중</span>
                          </div>

                          <div className={styles.teamMetaRow}>
                            <span className={styles.teamCountRow}>
                              멤버 <strong>{currentMembers}/{totalMembers}</strong>
                            </span>
                            <span className={styles.teamSlotBadge}>남은 자리 {openSlots}</span>
                          </div>

                          <div className={styles.roleChipRow}>
                            {rolePreview.length ? (
                              rolePreview.map((role) => (
                                <span key={role} className={styles.roleChip}>
                                  {role}
                                </span>
                              ))
                            ) : (
                              <span className={styles.roleChip}>포지션 미지정</span>
                            )}
                            {hiddenRoleCount ? (
                              <span className={styles.roleChip}>+{hiddenRoleCount}</span>
                            ) : null}
                          </div>

                          <div
                            className={
                              team.contact?.url
                                ? styles.teamPrimaryActions
                                : `${styles.teamPrimaryActions} ${styles.teamPrimaryActionsSingle}`
                            }
                          >
                            {team.contact?.url ? (
                              <a
                                className={styles.contactButton}
                                href={team.contact.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                연락하기
                              </a>
                            ) : null}
                            <button
                              className={styles.joinButton}
                              type="button"
                              onClick={() => requestJoinTeam(team.teamCode, team.name)}
                              disabled={!item.isRecruiting || Boolean(isDummy)}
                            >
                              {isDummy ? '테스트 더미' : '팀 합류 요청'}
                            </button>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                ) : (
                  <p className={styles.emptyLine}>현재 모집 중인 팀이 없습니다.</p>
                )}

                {hiddenRecruitingTeamCount > 0 || showAllRecruitingTeams ? (
                  <div className={styles.teamMoreActions}>
                    <button
                      type="button"
                      className={styles.teamMoreButton}
                      onClick={() => setShowAllRecruitingTeams((prev) => !prev)}
                    >
                      {showAllRecruitingTeams
                        ? '모집 팀 접기'
                        : `모집 팀 ${hiddenRecruitingTeamCount}개 더 보기`}
                    </button>
                  </div>
                ) : null}

                <p className={styles.teamListHint}>
                  {usingDummyRecruitingTeams
                    ? '현재는 UI 점검을 위해 부족한 수만큼 test01~test10 더미 팀을 함께 표시 중입니다.'
                    : '상세 프로필은 아래 "이 해커톤 팀 리스트 보기"에서 확인할 수 있습니다.'}
                </p>

                <div className={styles.teamFooterActions}>
                  <Link className="button secondary" to={`/camp?hackathon=${slug}&open=create`}>
                    팀 만들기
                  </Link>
                  <Link className="button ghost" to={`/camp?hackathon=${slug}`}>
                    팀 리스트 보기
                  </Link>
                </div>
              </div>
            </div>
          </article>

          <article className={`panel ${styles.bodySection} ${styles.overviewSection}`} id="overview">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionEmoji} aria-hidden="true">
                📖
              </span>
              개요
            </h2>
            <div className={styles.sectionShell}>
              <div className={styles.sectionCore}>
                <p className={styles.overviewSummary}>{section.overview?.summary || '개요 정보가 없습니다.'}</p>
                <article className={styles.overviewCard}>
                  <h3>팀 정책</h3>
                  <dl className={styles.policyRows}>
                    <div>
                      <dt>개인 참가:</dt>
                      <dd>{section.overview?.teamPolicy?.allowSolo ? '가능' : '불가'}</dd>
                    </div>
                    <div>
                      <dt>최대 팀 크기:</dt>
                      <dd>{section.overview?.teamPolicy?.maxTeamSize ?? '-'}명</dd>
                    </div>
                  </dl>
                </article>
              </div>
            </div>
          </article>

          <article className={`panel ${styles.bodySection} ${styles.evalSection}`} id="eval">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionEmoji} aria-hidden="true">
                ⭐
              </span>
              평가 기준
            </h2>
            <div className={styles.sectionShell}>
              <div className={styles.sectionCore}>
                <article className={styles.evalCompactCard}>
                  <p className={styles.evalMetricLine}>
                    <span>평가 지표</span>
                    <strong>
                      {metricDisplay}
                      {section.eval?.metricName && metricDisplay !== section.eval.metricName
                        ? ` (${section.eval.metricName})`
                        : ''}
                    </strong>
                  </p>

                  {evalBreakdown.length ? (
                    <div className={styles.evalInlineWeights}>
                      {evalBreakdown.map((item) => (
                        <span key={item.key} className={styles.evalWeightChip}>
                          {item.label} {item.weightPercent}%
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.evalLimitInline}>
                    <span>최대 실행 시간: {evalLimits?.maxRuntimeSec ? `${evalLimits.maxRuntimeSec}초` : '-'}</span>
                    <span>일일 제출 한도: {evalLimits?.maxSubmissionsPerDay ? `${evalLimits.maxSubmissionsPerDay}회` : '-'}</span>
                  </div>

                  {(section.eval?.description || evalBreakdown.length) ? (
                    <details className={styles.evalDetailsBox}>
                      <summary>세부 기준 보기</summary>
                      {section.eval?.description ? (
                        <p className={styles.evalDetailsText}>{section.eval.description}</p>
                      ) : null}
                      {evalBreakdown.length ? (
                        <ul className={styles.evalDetailsList}>
                          {evalBreakdown.map((item) => (
                            <li key={`detail-${item.key}`}>
                              {item.label} <strong>{item.weightPercent}%</strong>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </details>
                  ) : null}
                </article>

                <p className={styles.softHint}>자세한 평가 기준은 규정을 참고해주세요.</p>
              </div>
            </div>
          </article>

          <article className={`panel ${styles.bodySection} ${styles.prizeSection}`} id="prize">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionEmoji} aria-hidden="true">
                🏆
              </span>
              상금
            </h2>
            <div className={styles.sectionShell}>
              <div className={styles.sectionCore}>
                {prizeItems.length ? (
                  <div className={styles.prizeGrid}>
                    {prizeItems.map((item, index) => (
                      <article
                        key={item.place}
                        className={
                          index === 0
                            ? `${styles.prizeCard} ${styles.prizeFirst}`
                            : index === 1
                              ? `${styles.prizeCard} ${styles.prizeSecond}`
                              : `${styles.prizeCard} ${styles.prizeThird}`
                        }
                      >
                        <p className={styles.prizeMedal} aria-hidden="true">
                          {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                        </p>
                        <p className={styles.prizePlace}>{formatPlaceLabel(item.place)}</p>
                        <p className={styles.prizeAmount}>₩{item.amountKRW?.toLocaleString('ko-KR') ?? '-'}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.emptyLine}>상금 정보는 아직 공개되지 않았습니다.</p>
                )}
              </div>
            </div>
          </article>

          <article className={`panel ${styles.bodySection} ${styles.infoSection}`} id="info">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionEmoji} aria-hidden="true">
                ℹ️
              </span>
              안내
            </h2>
            <div className={styles.sectionShell}>
              <div className={styles.sectionCore}>
                <div className={styles.noticeBox}>
                  <p className={styles.noticeTitle}>📢 공지사항</p>
                  <ul className={styles.noticeList}>
                    {noticeItems.length ? (
                      noticeItems.map((notice) => <li key={notice}>{notice}</li>)
                    ) : (
                      <li>등록된 공지사항이 없습니다.</li>
                    )}
                  </ul>
                </div>

                <div className={styles.relatedLinks}>
                  <p className={styles.relatedTitle}>관련 링크</p>
                  <div className={styles.relatedGrid}>
                    {section.info?.links?.rules ? (
                      <a className={styles.relatedCard} href={section.info.links.rules} target="_blank" rel="noreferrer">
                        <span aria-hidden="true">📋</span>
                        <strong>규정</strong>
                      </a>
                    ) : (
                      <div className={styles.relatedCardMuted}>
                        <span aria-hidden="true">📋</span>
                        <strong>규정</strong>
                      </div>
                    )}
                    {section.info?.links?.faq ? (
                      <a className={styles.relatedCard} href={section.info.links.faq} target="_blank" rel="noreferrer">
                        <span aria-hidden="true">❓</span>
                        <strong>FAQ</strong>
                      </a>
                    ) : (
                      <div className={styles.relatedCardMuted}>
                        <span aria-hidden="true">❓</span>
                        <strong>FAQ</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </article>

          <article className={`panel ${styles.bodySection} ${styles.scheduleSection}`} id="schedule">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionEmoji} aria-hidden="true">
                🗓️
              </span>
              일정
            </h2>
            <div className={styles.sectionShell}>
              <div className={styles.sectionCore}>
                {milestoneItems.length ? (
                  <ul className={styles.timelineList}>
                    {milestoneItems.map((item) => {
                      const isEnded = new Date(item.at).getTime() < Date.now()
                      return (
                        <li key={`${item.name}-${item.at}`} className={styles.timelineItem}>
                          <span className={styles.timelineDot} aria-hidden="true" />
                          <div className={styles.timelineContent}>
                            <p className={styles.timelineName}>{item.name}</p>
                            <p className={styles.timelineDate}>{formatDate(item.at)}</p>
                            <span className={isEnded ? styles.timelineBadgeEnded : styles.timelineBadgeUpcoming}>
                              {isEnded ? '종료' : '예정'}
                            </span>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className={styles.emptyLine}>아직 공개된 일정이 없습니다.</p>
                )}
                <p className={styles.timelineNotice}>⏰ 모든 시간은 한국 표준시(KST) 기준입니다.</p>
              </div>
            </div>
          </article>

          <section className={`panel ${styles.bodySection} ${styles.submitSection}`} id="submit">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionEmoji} aria-hidden="true">
                📩
              </span>
              제출
            </h2>
            <div className={styles.sectionShell}>
              <div className={styles.sectionCore}>
                <p className={styles.blockLead}>재제출 정책: 같은 팀명으로 다시 제출하면 버전이 누적되고 최신 버전이 리더보드에 반영됩니다.</p>

                <form
                  className={styles.submitForm}
                  onSubmit={(e) => {
                    e.preventDefault()
                    saveSubmission('submitted')
                  }}
                >
                  <label className={styles.submitLabel}>
                    팀 이름 *
                    <input
                      className={styles.submitInput}
                      value={form.teamName}
                      onChange={(e) => updateField('teamName', e.target.value)}
                      placeholder="팀의 이름을 입력하세요"
                    />
                  </label>

                  <label className={styles.submitLabel}>
                    웹사이트 URL
                    <input
                      className={styles.submitInput}
                      value={form.webUrl}
                      onChange={(e) => updateField('webUrl', e.target.value)}
                      placeholder="https://example.com"
                    />
                  </label>

                  <label className={styles.submitLabel}>
                    PDF URL
                    <input
                      className={styles.submitInput}
                      value={form.pdfUrl}
                      onChange={(e) => updateField('pdfUrl', e.target.value)}
                      placeholder="https://example.com/solution.pdf"
                    />
                  </label>

                  <div className={styles.submitActions}>
                    <button className={styles.submitMainButton} type="submit">
                      제출하기
                    </button>
                    <button className={styles.submitDraftButton} type="button" onClick={() => saveSubmission('draft')}>
                      임시 저장
                    </button>
                  </div>
                </form>

                {(section.submit?.guide || []).length ? (
                  <ul className={styles.submitGuideList}>
                    {(section.submit?.guide || []).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}

                {message ? (
                  <p className="alert" role="status" aria-live="polite">
                    {message}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className={`panel ${styles.bodySection} ${styles.leaderboardSection}`} id="leaderboard">
            <h2 className={styles.sectionTitle}>
              <span className={styles.sectionEmoji} aria-hidden="true">
                📊
              </span>
              리더보드
            </h2>
            <div className={styles.sectionShell}>
              <div className={styles.sectionCore}>
                <p className={styles.blockLead}>마지막 업데이트: {board?.updatedAt ? formatDate(board.updatedAt) : '기록 없음'}</p>

                {entries.length ? (
                  <div className={styles.boardTableWrap}>
                    <table className={styles.boardTable}>
                      <thead>
                        <tr>
                          <th>순위</th>
                          <th>팀 이름</th>
                          <th>점수</th>
                          <th>점수 상세</th>
                          <th>제출일</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry) => (
                          <tr key={`${entry.teamName}-${entry.submittedAt}`}>
                            <td>
                              {rankBadge(entry.rank)} {entry.rank}
                            </td>
                            <td>{entry.teamName}</td>
                            <td className={styles.scoreCell}>{entry.score.toFixed(2)}</td>
                            <td>
                              {entry.scoreBreakdown
                                ? `참가자 ${entry.scoreBreakdown.participant} / 심사위원 ${entry.scoreBreakdown.judge}`
                                : '-'}
                            </td>
                            <td>{formatDate(entry.submittedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className={styles.emptyLine}>아직 리더보드 기록이 없습니다.</p>
                )}
              </div>
            </div>
          </section>
      </div>
    </section>
  )
}
