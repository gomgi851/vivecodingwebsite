import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlocks'
import { useAppData } from '../store/AppDataContext'
import type { Leaderboard } from '../types'
import styles from './HackathonDetailPage.module.css'

const TEAM_ACTIONS_KEY = 'team_actions'
const TEAM_JOIN_REQUESTS_KEY = 'team_join_requests'
const HACKATHON_APPLICATIONS_KEY = 'hackathon_applications'
const VIEWER_ID_KEY = 'vivecoder_viewer_id'

type TeamActionStatus = 'none' | 'invited' | 'accepted' | 'rejected'
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
  { id: 'info', label: '안내', hint: '공지 · 링크' },
  { id: 'eval', label: '평가', hint: '기준 · 배점' },
  { id: 'prize', label: '상금', hint: '보상 · 혜택' },
  { id: 'schedule', label: '일정', hint: '마일스톤' },
  { id: 'submit', label: '제출', hint: '폼 · 검증 상태' },
  { id: 'leaderboard', label: '리더보드', hint: '순위 · 점수' },
] as const

function formatDate(value?: string) {
  if (!value) return '-'
  return new Date(value).toLocaleString('ko-KR')
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

function findLeaderboardBySlug(leaderboards: Leaderboard[], slug: string) {
  return leaderboards.find((item) => item.hackathonSlug === slug)
}

function getTeamActionMap() {
  if (typeof window === 'undefined') return {} as Record<string, TeamActionStatus>
  try {
    const raw = window.localStorage.getItem(TEAM_ACTIONS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as Record<string, TeamActionStatus>
  } catch {
    return {}
  }
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
  const [teamActions, setTeamActions] = useState<Record<string, TeamActionStatus>>(() => getTeamActionMap())
  const [viewerId] = useState<string>(() => getOrCreateViewerId())
  const [joinRequests, setJoinRequests] = useState<TeamJoinRequest[]>(() => readJoinRequests())
  const [applications, setApplications] = useState<HackathonApplication[]>(() => readApplications())
  const [teamFlowMessage, setTeamFlowMessage] = useState('')
  const [applicationForm, setApplicationForm] = useState({
    agreedRules: false,
    agreedSchedule: false,
    participationMode: 'personal' as 'personal' | 'team',
  })

  useEffect(() => {
    const sectionNodes = SECTION_LINKS.map((item) => document.getElementById(item.id)).filter(
      Boolean,
    ) as HTMLElement[]
    if (!sectionNodes.length) return

    const updateActiveSection = () => {
      const topOffset = 128
      const cursor = window.scrollY + topOffset
      const atPageBottom =
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4

      if (atPageBottom) {
        const last = sectionNodes[sectionNodes.length - 1]
        setActiveSection(last.id as (typeof SECTION_LINKS)[number]['id'])
        return
      }

      let current = sectionNodes[0].id
      for (const node of sectionNodes) {
        if (node.offsetTop <= cursor) {
          current = node.id
        } else {
          break
        }
      }

      setActiveSection(current as (typeof SECTION_LINKS)[number]['id'])
    }

    updateActiveSection()
    window.addEventListener('scroll', updateActiveSection, { passive: true })
    window.addEventListener('resize', updateActiveSection)
    return () => {
      window.removeEventListener('scroll', updateActiveSection)
      window.removeEventListener('resize', updateActiveSection)
    }
  }, [slug, loading, error])

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
  const previewScore = computeScore(form.participant, form.judge)
  const readinessItems = [
    { label: '팀명 입력', done: Boolean(form.teamName.trim()) },
    { label: '기획서 제목 입력', done: Boolean(form.planTitle.trim()) },
    { label: '웹 URL 입력', done: Boolean(form.webUrl.trim()) },
    { label: '메모(선택)', done: Boolean(form.notes.trim()) },
  ]
  const readinessCount = readinessItems.filter((item) => item.done).length

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

  function getActionKey(teamCode: string) {
    return `${slug}:${teamCode}`
  }

  function updateTeamAction(teamCode: string, nextStatus: TeamActionStatus) {
    const key = getActionKey(teamCode)
    const next = { ...teamActions, [key]: nextStatus }
    setTeamActions(next)
    window.localStorage.setItem(TEAM_ACTIONS_KEY, JSON.stringify(next))
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
    <section className="stack-lg">
      <header className={`page-header detail-header ${styles.hero}`}>
        <p className={`status-chip status-${hackathon.status}`}>
          {STATUS_LABEL[hackathon.status as keyof typeof STATUS_LABEL] || hackathon.status}
        </p>
        <h1>{hackathon.title}</h1>
        <p>slug: {slug}</p>
        <div className="detail-meta-grid">
          <article className="metric-card">
            <p className="metric-label">연결 팀 수</p>
            <p className="metric-value">{teamRows.length}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">리더보드 엔트리</p>
            <p className="metric-value">{entries.length}</p>
          </article>
          <article className="metric-card">
            <p className="metric-label">최근 제출</p>
            <p className="metric-value">{recentSubmissions.length}</p>
          </article>
        </div>
      </header>

      <section className={styles.detailLayout}>
        <aside className={styles.sectionSidebar}>
          <div className={styles.sidebarHead}>
            <p className={styles.sidebarTitle}>섹션 목차</p>
            <span className={styles.sidebarCount}>{SECTION_LINKS.length} Sections</span>
          </div>
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
        </aside>

        <div className={styles.sectionContent}>
          <article className={`panel ${styles.teamsTopPanel}`} id="teams">
            <h2>팀</h2>
            <p>연결된 팀: {teamRows.length}개</p>
            <section className={styles.teamFlowPanel}>
              <h3>1) 해커톤 선택 & 참가 신청</h3>
              <p className="muted">참가하고 싶은 해커톤을 선택하고 동의 후 참가 신청을 완료하세요.</p>
              <ul className="list">
                <li>원하는 해커톤 탐색 및 선택</li>
                <li>대회 규정, 일정 등 필수 동의사항 확인</li>
                <li>개인 또는 팀 참가 방식 선택</li>
              </ul>
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
              </div>
              <label className="checkbox">
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
              <label className="checkbox">
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
              <div className="inline-actions">
                <button className="button" type="button" onClick={applyToHackathon}>
                  참가 신청 완료
                </button>
                <span className={styles.badgeStatus}>
                  현재 상태:{' '}
                  {myApplication
                    ? `${myApplication.participationMode === 'team' ? '팀 참가' : '개인 참가'} 신청 완료`
                    : '미신청'}
                </span>
              </div>
            </section>

            <section className={styles.teamFlowPanel}>
              <h3>2) 팀 구성</h3>
              <p className="muted">
                팀 없이 개인으로 먼저 참가 신청한 후, 나중에 팀을 구성하거나 합류할 수 있습니다.
              </p>
              <ul className="list">
                <li>새로운 팀 생성하기</li>
                <li>또는 모집 중인 팀에 합류하기</li>
                <li>팀장 동의 후 팀 확정</li>
              </ul>
              <div className="inline-actions">
                <Link className="button secondary" to={`/camp?hackathon=${slug}&open=create`}>
                  이 해커톤 팀 만들기
                </Link>
                <Link className="button ghost" to={`/camp?hackathon=${slug}`}>
                  이 해커톤 팀 리스트 보기
                </Link>
              </div>

              {pendingRequestsForMyTeams.length ? (
                <div className={styles.pendingBox}>
                  <h4>내 팀 합류 요청 (팀장 승인)</h4>
                  {pendingRequestsForMyTeams.map((request) => (
                    <div key={request.id} className={styles.pendingRow}>
                      <span>
                        요청자: {request.requesterId} / 팀: {request.teamName}
                      </span>
                      <div className="inline-actions">
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
            </section>

            {teamRows.length ? (
              <div className={styles.teamActionList}>
                {teamRows.map((team) => {
                  const actionStatus = teamActions[getActionKey(team.teamCode)] || 'none'
                  const currentMembers = getCurrentMembers(team)
                  const totalMembers = getTotalMembers(team)
                  const isTeamFull = currentMembers >= totalMembers
                  const isRecruiting = team.isOpen && !isTeamFull
                  return (
                    <div key={team.teamCode} className={styles.teamActionCard}>
                      <div className={styles.teamActionHead}>
                        <strong>
                          {team.name} ({currentMembers}/{totalMembers}명)
                        </strong>
                        <span className={isRecruiting ? 'open-pill' : 'closed-pill'}>
                          {isRecruiting ? '모집 중' : '모집 마감'}
                        </span>
                      </div>
                      <p className="muted">{team.intro}</p>
                      {isTeamFull ? <p className="muted">정원 마감 팀입니다.</p> : null}
                      <p>포지션: {(team.lookingFor || []).join(', ') || '-'}</p>
                      <div className="inline-actions">
                        <button
                          className="button"
                          type="button"
                          onClick={() => requestJoinTeam(team.teamCode, team.name)}
                          disabled={!isRecruiting}
                        >
                          팀 합류 요청
                        </button>
                        <button
                          className="button ghost"
                          type="button"
                          onClick={() => updateTeamAction(team.teamCode, 'invited')}
                          disabled={actionStatus === 'invited'}
                        >
                          초대
                        </button>
                        {actionStatus === 'invited' ? (
                          <>
                            <button
                              className="button secondary"
                              type="button"
                              onClick={() => updateTeamAction(team.teamCode, 'accepted')}
                            >
                              수락
                            </button>
                            <button
                              className={`button ghost ${styles.rejectButton}`}
                              type="button"
                              onClick={() => updateTeamAction(team.teamCode, 'rejected')}
                            >
                              거절
                            </button>
                          </>
                        ) : (
                          <span className={styles.teamActionHint}>초대 받은 상태에서만 수락/거절 가능</span>
                        )}
                        <span className={styles.teamActionStatus}>
                          상태:{' '}
                          {actionStatus === 'invited'
                            ? '초대됨'
                            : actionStatus === 'accepted'
                              ? '수락됨'
                              : actionStatus === 'rejected'
                                ? '거절됨'
                                : '대기'}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p>아직 등록된 팀이 없습니다.</p>
            )}
            <div className="inline-actions">
              <Link className="button secondary" to={`/camp?hackathon=${slug}&open=create`}>
                이 해커톤 팀 만들기
              </Link>
              <Link className="button ghost" to={`/camp?hackathon=${slug}`}>
                이 해커톤 팀 리스트 보기
              </Link>
            </div>
          </article>

          <article className="panel" id="overview">
            <h2>개요</h2>
            <p>{section.overview?.summary || '개요 정보가 없습니다.'}</p>
            <p>개인 참가: {section.overview?.teamPolicy?.allowSolo ? '가능' : '불가'}</p>
            <p>최대 팀 인원: {section.overview?.teamPolicy?.maxTeamSize ?? '-'}</p>
          </article>

          <article className="panel" id="info">
            <h2>안내</h2>
            <ul className="list">
              {(section.info?.notice || []).map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
            <p>
              <a href={section.info?.links?.rules} target="_blank" rel="noreferrer">
                규정
              </a>{' '}
              |{' '}
              <a href={section.info?.links?.faq} target="_blank" rel="noreferrer">
                FAQ
              </a>
            </p>
          </article>

          <article className="panel" id="eval">
            <h2>평가</h2>
            <p>{section.eval?.description || '평가 기준 정보가 없습니다.'}</p>
            <p>지표명: {section.eval?.metricName || '-'}</p>
            {section.eval?.scoreDisplay?.breakdown ? (
              <ul className="list">
                {section.eval.scoreDisplay.breakdown.map((item) => (
                  <li key={item.key}>
                    {item.label} {item.weightPercent}%
                  </li>
                ))}
              </ul>
            ) : null}
          </article>

          <article className="panel" id="prize">
            <h2>상금</h2>
            {(section.prize?.items || []).length ? (
              <ul className="list">
                {section.prize.items.map((item) => (
                  <li key={item.place}>
                    {item.place}: {item.amountKRW?.toLocaleString('ko-KR')}원
                  </li>
                ))}
              </ul>
            ) : (
              <p>상금 정보는 아직 공개되지 않았습니다.</p>
            )}
          </article>

          <article className="panel" id="schedule">
            <h2>일정</h2>
            <ul className="list">
              {(section.schedule?.milestones || []).map((item) => (
                <li key={`${item.name}-${item.at}`}>
                  {item.name}: {formatDate(item.at)}
                </li>
              ))}
            </ul>
          </article>

          <section className={`panel ${styles.submitPanel}`} id="submit">
            <h2>제출(Submit)</h2>
            <ul className="list">
              {(section.submit?.guide || []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <section className="submit-readiness">
              <h3>제출 준비도</h3>
              <p className="muted">
                {readinessCount}/{readinessItems.length} 완료 · 점수 미리보기 {previewScore}
              </p>
              <ul className="list">
                {readinessItems.map((item) => (
                  <li key={item.label}>
                    {item.done ? '완료' : '미완료'} - {item.label}
                  </li>
                ))}
              </ul>
            </section>

            <form
              className="form-grid"
              onSubmit={(e) => {
                e.preventDefault()
                saveSubmission('submitted')
              }}
            >
              <label>
                팀명*
                <input
                  value={form.teamName}
                  onChange={(e) => updateField('teamName', e.target.value)}
                  placeholder="예: 404found"
                />
              </label>
              <label>
                기획서 제목
                <input
                  value={form.planTitle}
                  onChange={(e) => updateField('planTitle', e.target.value)}
                  placeholder="예: 팀 기획서"
                />
              </label>
              <label>
                웹 URL*
                <input
                  value={form.webUrl}
                  onChange={(e) => updateField('webUrl', e.target.value)}
                  placeholder="https://your-team.vercel.app"
                />
              </label>
              <label>
                PDF URL
                <input
                  value={form.pdfUrl}
                  onChange={(e) => updateField('pdfUrl', e.target.value)}
                  placeholder="https://example.com/solution.pdf"
                />
              </label>
              <label>
                참가자 점수(선택)
                <input
                  type="number"
                  value={form.participant}
                  onChange={(e) => updateField('participant', e.target.value)}
                />
              </label>
              <label>
                심사위원 점수(선택)
                <input
                  type="number"
                  value={form.judge}
                  onChange={(e) => updateField('judge', e.target.value)}
                />
              </label>
              <label className="span-2">
                메모
                <textarea value={form.notes} onChange={(e) => updateField('notes', e.target.value)} rows={3} />
              </label>
              <div className="inline-actions span-2">
                <button className="button secondary" type="button" onClick={() => saveSubmission('draft')}>
                  임시 저장
                </button>
                <button className="button" type="submit">
                  저장/제출
                </button>
              </div>
            </form>
            {message ? <p className="alert">{message}</p> : null}
          </section>

          <article className="panel">
            <h2>최근 제출 히스토리</h2>
            {recentSubmissions.length ? (
              <ul className="list">
                {recentSubmissions.map((item) => (
                  <li key={item.id}>
                    {item.teamName} · {item.status} · {formatDate(item.submittedAt)}
                  </li>
                ))}
              </ul>
            ) : (
              <p>아직 제출 기록이 없습니다.</p>
            )}
          </article>

          <section className="panel" id="leaderboard">
            <h2>리더보드</h2>
            <p className="muted">업데이트: {board?.updatedAt ? formatDate(board.updatedAt) : '기록 없음'}</p>
            {entries.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>팀명</th>
                      <th>점수</th>
                      <th>제출 시각</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={`${entry.teamName}-${entry.submittedAt}`}>
                        <td>{entry.rank}</td>
                        <td>{entry.teamName}</td>
                        <td>{entry.score}</td>
                        <td>{formatDate(entry.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>아직 리더보드 기록이 없습니다.</p>
            )}
          </section>
        </div>
      </section>
    </section>
  )
}
