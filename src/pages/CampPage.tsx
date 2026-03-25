import { useEffect, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlocks'
import { useAppData } from '../store/AppDataContext'
import styles from './CampPage.module.css'
import type { DirectMessage, Team } from '../types'

const VIEWER_ID_KEY = 'vivecoder_viewer_id'
const DIRECT_MESSAGES_KEY = 'direct_messages'

function makeTeamCode() {
  return `T-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function getOrCreateViewerId() {
  if (typeof window === 'undefined') return 'viewer-anon'
  const existing = window.localStorage.getItem(VIEWER_ID_KEY)
  if (existing) return existing
  const created = `viewer-${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem(VIEWER_ID_KEY, created)
  return created
}

function readStoredMessages() {
  if (typeof window === 'undefined') return [] as DirectMessage[]
  try {
    const raw = window.localStorage.getItem(DIRECT_MESSAGES_KEY)
    if (!raw) return [] as DirectMessage[]
    return JSON.parse(raw) as DirectMessage[]
  } catch {
    return [] as DirectMessage[]
  }
}

function getCurrentMembers(team: Team) {
  return Math.max(1, Number(team.currentMemberCount ?? team.memberCount ?? 1) || 1)
}

function getTotalMembers(team: Team) {
  const current = getCurrentMembers(team)
  return Math.max(current, Number(team.totalMemberCount ?? current) || current)
}

function parseTotalMembers(value: string | number) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  return Math.max(1, Math.trunc(parsed))
}

export function CampPage() {
  const { loading, error, refresh, hackathons, teams, setTeams } = useAppData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewerId] = useState<string>(() => getOrCreateViewerId())
  const queryHackathon = searchParams.get('hackathon')
  const openMode = searchParams.get('open')
  const isQueryLocked = Boolean(queryHackathon)
  const shouldOpenCreate = openMode === 'create'
  const initialHackathon = queryHackathon || 'all'
  const [hackathonFilter, setHackathonFilter] = useState(initialHackathon)
  const [keyword, setKeyword] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [onlyMine, setOnlyMine] = useState(false)
  const [onlyOpen, setOnlyOpen] = useState(false)
  const [onlyMessaged, setOnlyMessaged] = useState(false)
  const [form, setForm] = useState({
    hackathonSlug: initialHackathon !== 'all' ? initialHackathon : '',
    name: '',
    intro: '',
    isOpen: true,
    totalMemberCount: 4,
    lookingFor: '',
    contactUrl: '',
  })
  const [notice, setNotice] = useState('')
  const [editingTeamCode, setEditingTeamCode] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(shouldOpenCreate)
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null)
  const [messageTarget, setMessageTarget] = useState<Team | null>(null)
  const [messageText, setMessageText] = useState('')
  const [messageSnapshot, setMessageSnapshot] = useState<DirectMessage[]>(() => readStoredMessages())

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  if (loading) return <LoadingState title="팀 모집 정보를 불러오는 중..." />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  const effectiveHackathonFilter = isQueryLocked ? queryHackathon || 'all' : hackathonFilter
  const sentTeamCodes = new Set(
    messageSnapshot.filter((item) => item.senderId === viewerId && item.teamCode).map((item) => item.teamCode as string),
  )
  const unreadInboxCount = messageSnapshot.filter((item) => item.recipientId === viewerId && !item.readAt).length

  let visibleTeams = teams.filter((team) => {
    if (effectiveHackathonFilter !== 'all' && team.hackathonSlug !== effectiveHackathonFilter) return false
    if (onlyMine && team.ownerId !== viewerId) return false
    if (onlyOpen && !(team.isOpen && getCurrentMembers(team) < getTotalMembers(team))) return false
    if (onlyMessaged && !sentTeamCodes.has(team.teamCode)) return false
    const q = keyword.trim().toLowerCase()
    if (!q) return true
    const text = `${team.name} ${team.intro} ${(team.lookingFor || []).join(' ')}`.toLowerCase()
    return text.includes(q)
  })

  visibleTeams = [...visibleTeams].sort((a, b) => {
    if (sortBy === 'members') return getCurrentMembers(b) - getCurrentMembers(a)
    if (sortBy === 'open') return Number(b.isOpen) - Number(a.isOpen)
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })

  const openCount = visibleTeams.filter((team) => team.isOpen && getCurrentMembers(team) < getTotalMembers(team)).length
  const myCount = visibleTeams.filter((team) => team.ownerId === viewerId).length
  const hasActiveFilter =
    Boolean(keyword.trim()) ||
    effectiveHackathonFilter !== 'all' ||
    sortBy !== 'recent' ||
    onlyMine ||
    onlyOpen ||
    onlyMessaged
  const hackathonTitleBySlug = new Map(hackathons.map((item) => [item.slug, item.title]))
  const myTeamsAll = teams.filter((team) => team.ownerId === viewerId)
  const myOpenTeams = myTeamsAll.filter((team) => team.isOpen && getCurrentMembers(team) < getTotalMembers(team))
  const fullTeamCount = teams.filter((team) => getCurrentMembers(team) >= getTotalMembers(team)).length
  const noOwnerTeamCount = teams.filter((team) => !team.ownerId).length
  const avgFillRate = myTeamsAll.length
    ? Math.round(
        (myTeamsAll.reduce((acc, team) => acc + getCurrentMembers(team) / getTotalMembers(team), 0) / myTeamsAll.length) *
          100,
      )
    : 0
  const contextLabel =
    effectiveHackathonFilter === 'all' ? '전체 해커톤' : getHackathonLabel(effectiveHackathonFilter)
  const contextRecruitingCount = teams.filter((team) => {
    if (effectiveHackathonFilter !== 'all' && team.hackathonSlug !== effectiveHackathonFilter) return false
    return team.isOpen && getCurrentMembers(team) < getTotalMembers(team)
  }).length

  function changeFilter(value: string) {
    if (isQueryLocked) return
    setHackathonFilter(value)
    if (value === 'all') {
      setSearchParams({})
    } else {
      setSearchParams({ hackathon: value })
    }
    setForm((prev) => ({
      ...prev,
      hackathonSlug: value === 'all' ? '' : value,
    }))
  }

  function resetAllFilters() {
    setKeyword('')
    setSortBy('recent')
    setOnlyMine(false)
    setOnlyOpen(false)
    setOnlyMessaged(false)
    if (!isQueryLocked) {
      changeFilter('all')
    }
  }

  function updateForm(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function getHackathonLabel(slug?: string) {
    if (!slug) return '미연결(공통 팀)'
    return hackathonTitleBySlug.get(slug) || slug
  }

  function resetForm() {
    const linkedHackathonSlug = effectiveHackathonFilter === 'all' ? '' : effectiveHackathonFilter
    setForm({
      hackathonSlug: linkedHackathonSlug,
      name: '',
      intro: '',
      isOpen: true,
      totalMemberCount: 4,
      lookingFor: '',
      contactUrl: '',
    })
  }

  function startEdit(team: Team) {
    if (team.ownerId !== viewerId) {
      setNotice('내가 등록한 팀 글만 수정할 수 있습니다.')
      return
    }
    setEditingTeamCode(team.teamCode)
    setIsEditorOpen(true)
    setNotice('수정 모드입니다. 내용을 수정한 뒤 저장하세요.')
    setForm({
      hackathonSlug: team.hackathonSlug || '',
      name: team.name || '',
      intro: team.intro || '',
      isOpen: Boolean(team.isOpen),
      totalMemberCount: getTotalMembers(team),
      lookingFor: (team.lookingFor || []).join(', '),
      contactUrl: team.contact?.url || '',
    })
  }

  function cancelEdit() {
    setEditingTeamCode(null)
    setIsEditorOpen(false)
    setNotice('팀 편집 창을 닫았습니다.')
    resetForm()
  }

  function openCreateEditor() {
    setEditingTeamCode(null)
    resetForm()
    setIsEditorOpen(true)
    setNotice('팀 생성 모드입니다.')
  }

  function requestDelete(team: Team) {
    if (team.ownerId !== viewerId) {
      setNotice('내가 등록한 팀 글만 삭제할 수 있습니다.')
      return
    }
    setDeleteTarget(team)
  }

  function confirmDelete() {
    if (!deleteTarget) return
    const target = teams.find((team) => team.teamCode === deleteTarget.teamCode)
    if (!target || target.ownerId !== viewerId) {
      setDeleteTarget(null)
      setNotice('삭제 권한이 없습니다.')
      return
    }

    const nextTeams = teams.filter((team) => team.teamCode !== deleteTarget.teamCode)
    setTeams(nextTeams)
    if (editingTeamCode === deleteTarget.teamCode) {
      setEditingTeamCode(null)
      setIsEditorOpen(false)
      resetForm()
    }
    setNotice('팀 글이 삭제되었습니다.')
    setDeleteTarget(null)
  }

  function openMessageModal(team: Team) {
    if (!team.ownerId) {
      setNotice('해당 팀은 수신 대상을 확인할 수 없어 쪽지를 보낼 수 없습니다.')
      return
    }
    if (team.ownerId === viewerId) {
      setNotice('내가 등록한 팀에는 쪽지를 보낼 수 없습니다.')
      return
    }
    setMessageTarget(team)
    setMessageText('')
  }

  function sendMessage() {
    if (!messageTarget) return
    if (!messageText.trim()) {
      setNotice('쪽지 내용을 입력해주세요.')
      return
    }
    if (!messageTarget.ownerId) {
      setNotice('쪽지 수신 대상을 찾을 수 없습니다.')
      setMessageTarget(null)
      return
    }

    const nextMessages = [
      ...messageSnapshot,
      {
        id: `msg-${crypto.randomUUID()}`,
        senderId: viewerId,
        recipientId: messageTarget.ownerId,
        content: messageText.trim(),
        createdAt: new Date().toISOString(),
        teamCode: messageTarget.teamCode,
        teamName: messageTarget.name,
        hackathonSlug: messageTarget.hackathonSlug,
      },
    ]
    window.localStorage.setItem(DIRECT_MESSAGES_KEY, JSON.stringify(nextMessages))
    setMessageSnapshot(nextMessages)
    setNotice(`${messageTarget.name} 팀장에게 쪽지를 보냈습니다.`)
    setMessageTarget(null)
    setMessageText('')
  }

  function submitTeam(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.name.trim() || !form.intro.trim() || !form.contactUrl.trim()) {
      setNotice('팀명, 소개, 연락 링크는 필수입니다.')
      return
    }
    const totalMemberCount = parseTotalMembers(form.totalMemberCount)

    const lookingFor = form.lookingFor
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)

    if (editingTeamCode) {
      const editableTeam = teams.find((team) => team.teamCode === editingTeamCode)
      if (!editableTeam || editableTeam.ownerId !== viewerId) {
        setNotice('내가 등록한 팀 글만 수정할 수 있습니다.')
        setEditingTeamCode(null)
        resetForm()
        return
      }
      const nextTeams = teams.map((team) =>
        team.teamCode === editingTeamCode
          ? {
              ...team,
              hackathonSlug: form.hackathonSlug,
              name: form.name.trim(),
              isOpen: form.isOpen,
              currentMemberCount: getCurrentMembers(team),
              totalMemberCount: Math.max(totalMemberCount, getCurrentMembers(team)),
              memberCount: getCurrentMembers(team),
              lookingFor,
              intro: form.intro.trim(),
              contact: {
                type: 'link',
                url: form.contactUrl.trim(),
              },
              updatedAt: new Date().toISOString(),
            }
          : team,
      )
      if (totalMemberCount < getCurrentMembers(editableTeam)) {
        setNotice(`총 팀원 수는 현재 팀원 수(${getCurrentMembers(editableTeam)}명)보다 작을 수 없어 자동 보정되었습니다.`)
      } else {
        setNotice('팀 정보가 수정되었습니다.')
      }
      setTeams(nextTeams)
      setEditingTeamCode(null)
      setIsEditorOpen(false)
      resetForm()
      return
    }

    const nextTeams = [
      ...teams,
      {
        teamCode: makeTeamCode(),
        hackathonSlug: form.hackathonSlug,
        name: form.name.trim(),
        isOpen: form.isOpen,
        currentMemberCount: 1,
        totalMemberCount,
        memberCount: 1,
        lookingFor,
        intro: form.intro.trim(),
        contact: {
          type: 'link',
          url: form.contactUrl.trim(),
        },
        ownerId: viewerId,
        createdAt: new Date().toISOString(),
      },
    ]

    setTeams(nextTeams)
    setNotice('팀이 등록되었습니다.')
    setIsEditorOpen(false)
    resetForm()
  }

  return (
    <section className="stack-lg">
      <section className={styles.campLayout}>
        <aside className={styles.sidebar}>
          <article className={styles.sidebarCard}>
            <p className={styles.sidebarTitle}>빠른 액션</p>
            <div className={styles.sidebarActions}>
              <button className="button" type="button" onClick={openCreateEditor}>
                팀 생성하기
              </button>
              <button
                className={onlyMine ? 'button secondary' : 'button ghost'}
                type="button"
                onClick={() => setOnlyMine((prev) => !prev)}
              >
                {onlyMine ? '내 등록글 보기 해제' : '내 등록글만 보기'}
              </button>
              <button
                className={onlyOpen ? 'button secondary' : 'button ghost'}
                type="button"
                onClick={() => setOnlyOpen((prev) => !prev)}
              >
                {onlyOpen ? '모집중만 해제' : '모집중만 보기'}
              </button>
              <button
                className={onlyMessaged ? 'button secondary' : 'button ghost'}
                type="button"
                onClick={() => setOnlyMessaged((prev) => !prev)}
              >
                {onlyMessaged ? '쪽지 보낸 팀 해제' : '쪽지 보낸 팀 보기'}
              </button>
              <button className="button ghost" type="button" onClick={resetAllFilters}>
                필터 전체 해제
              </button>
            </div>
          </article>

          <article className={styles.sidebarCard}>
            <p className={styles.sidebarTitle}>내 상태</p>
            <ul className={styles.sidebarStats}>
              <li>
                <span>내 등록글</span>
                <strong>{myTeamsAll.length}</strong>
              </li>
              <li>
                <span>내 모집중</span>
                <strong>{myOpenTeams.length}</strong>
              </li>
              <li>
                <span>평균 충원율</span>
                <strong>{avgFillRate}%</strong>
              </li>
              <li>
                <span>정원 마감 팀</span>
                <strong>{fullTeamCount}</strong>
              </li>
            </ul>
          </article>

          <article className={styles.sidebarCard}>
            <p className={styles.sidebarTitle}>현재 컨텍스트</p>
            <p className={styles.contextStrong}>{contextLabel}</p>
            <p className="muted">필터 결과 {visibleTeams.length}팀</p>
            <p className="muted">모집중 팀 {contextRecruitingCount}팀</p>
            {isQueryLocked ? <p className={styles.lockBadge}>해커톤 필터 잠금중</p> : null}
          </article>

          <article className={styles.sidebarCard}>
            <p className={styles.sidebarTitle}>요청/알림</p>
            <ul className={styles.sidebarAlerts}>
              <li>미확인 받은 쪽지 {unreadInboxCount}</li>
              <li>내가 쪽지 보낸 팀 {sentTeamCodes.size}</li>
              <li>수신대상 미확인 팀 {noOwnerTeamCount}</li>
            </ul>
          </article>

          <article className={styles.sidebarCard}>
            <p className={styles.sidebarTitle}>모집글 가이드</p>
            <ul className={styles.sidebarGuide}>
              <li>팀 목표를 1~2문장으로 명확하게 쓰기</li>
              <li>연락 링크와 모집 포지션을 구체적으로 적기</li>
              <li>총 팀원 수를 현실적으로 잡고 상태 관리하기</li>
            </ul>
          </article>
        </aside>

        <div className={styles.mainColumn}>
          <header className={`page-header ${styles.headerBar}`}>
            <div className={styles.insightChips}>
              <span className={styles.insightChip}>현재 목록 {visibleTeams.length}</span>
              <span className={`${styles.insightChip} ${styles.insightChipOpen}`}>모집중 {openCount}</span>
              <span className={`${styles.insightChip} ${styles.insightChipMine}`}>내 등록글 {myCount}</span>
            </div>
          </header>

          <section className={`controls controls-4 ${styles.filterWrap}`}>
            <label>
              검색
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="팀명, 소개, 모집 포지션"
              />
            </label>
            <label>
              해커톤 필터
              <select
                value={effectiveHackathonFilter}
                onChange={(e) => changeFilter(e.target.value)}
                disabled={isQueryLocked}
              >
                <option value="all">전체</option>
                {hackathons.map((hackathon) => (
                  <option key={hackathon.slug} value={hackathon.slug}>
                    {hackathon.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              정렬
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="recent">최신 생성순</option>
                <option value="open">모집중 우선</option>
                <option value="members">인원 많은순</option>
              </select>
            </label>
            <button className="button ghost align-end" type="button" onClick={resetAllFilters}>
              필터 초기화
            </button>
          </section>
          {isQueryLocked ? (
            <p className={`muted ${styles.queryNotice}`}>
              쿼리 필터 적용 중: <strong>{queryHackathon}</strong> (해당 해커톤 팀만 표시)
            </p>
          ) : null}
          {hasActiveFilter ? (
            <section className={styles.activeFilters} aria-label="현재 적용 필터">
              {keyword.trim() ? (
                <button className={styles.activeFilterChip} type="button" onClick={() => setKeyword('')}>
                  검색: {keyword} ×
                </button>
              ) : null}
              {effectiveHackathonFilter !== 'all' && !isQueryLocked ? (
                <button className={styles.activeFilterChip} type="button" onClick={() => changeFilter('all')}>
                  해커톤: {effectiveHackathonFilter} ×
                </button>
              ) : null}
              {sortBy !== 'recent' ? (
                <button className={styles.activeFilterChip} type="button" onClick={() => setSortBy('recent')}>
                  정렬: {sortBy === 'open' ? '모집중 우선' : '인원 많은순'} ×
                </button>
              ) : null}
              {onlyMine ? (
                <button className={styles.activeFilterChip} type="button" onClick={() => setOnlyMine(false)}>
                  내 등록글만 ×
                </button>
              ) : null}
              {onlyOpen ? (
                <button className={styles.activeFilterChip} type="button" onClick={() => setOnlyOpen(false)}>
                  모집중만 ×
                </button>
              ) : null}
              {onlyMessaged ? (
                <button className={styles.activeFilterChip} type="button" onClick={() => setOnlyMessaged(false)}>
                  쪽지 보낸 팀 ×
                </button>
              ) : null}
            </section>
          ) : null}

          <section>
            <article className="panel">
              <div className={styles.listHeader}>
                <h2>팀 리스트</h2>
                <button className="button" type="button" onClick={openCreateEditor}>
                  팀 생성하기
                </button>
              </div>
              {visibleTeams.length ? (
                <div className={styles.teamGrid}>
                  {visibleTeams.map((team) => {
                    const currentMembers = getCurrentMembers(team)
                    const totalMembers = getTotalMembers(team)
                    const isRecruiting = team.isOpen && currentMembers < totalMembers
                    return (
                      <div key={team.teamCode} className={`team-card ${styles.teamCard}`}>
                        {team.ownerId === viewerId ? <span className={styles.ownerTag}>내 등록글</span> : null}
                        <div className={styles.cardMedia} aria-hidden="true">
                          <span className={styles.mediaFallback}>
                            {team.hackathonSlug ? getHackathonLabel(team.hackathonSlug) : '공통 팀 모집'}
                          </span>
                        </div>
                        <div className="between">
                          <div className={styles.teamNameWrap}>
                            <strong>{team.name}</strong>
                            {editingTeamCode === team.teamCode ? <span className={styles.editingTag}>수정 중</span> : null}
                          </div>
                          <span className={isRecruiting ? 'open-pill' : 'closed-pill'}>
                            {isRecruiting ? '모집 중' : '마감'}
                          </span>
                        </div>
                        <p className="muted">해커톤: {getHackathonLabel(team.hackathonSlug)}</p>
                        <p className={styles.teamIntro}>{team.intro}</p>
                        <div className={styles.metaChips}>
                          <span className={styles.metaChip}>
                            현재 {currentMembers} / 총 {totalMembers}
                          </span>
                          <span className={styles.metaChip}>포지션 {(team.lookingFor || []).length || 0}</span>
                        </div>
                        <div className={styles.positionTags}>
                          {(team.lookingFor || []).length ? (
                            (team.lookingFor || []).map((position) => (
                              <span key={`${team.teamCode}-${position}`} className="tag">
                                {position}
                              </span>
                            ))
                          ) : (
                            <span className="tag">포지션 미기재</span>
                          )}
                        </div>
                        <div className={styles.cardFooter}>
                          <a className="button ghost" href={team.contact?.url} target="_blank" rel="noreferrer">
                            연락 링크
                          </a>
                          {team.hackathonSlug ? (
                            <Link className="button secondary" to={`/hackathons/${team.hackathonSlug}`}>
                              연결 해커톤 보기
                            </Link>
                          ) : null}
                          {team.ownerId === viewerId ? (
                            <>
                              <button className="button secondary" type="button" onClick={() => startEdit(team)}>
                                이 팀 수정
                              </button>
                              <button
                                className={`button ghost ${styles.deleteButton}`}
                                type="button"
                                onClick={() => requestDelete(team)}
                              >
                                이 팀 삭제
                              </button>
                            </>
                          ) : (
                            <button className="button secondary" type="button" onClick={() => openMessageModal(team)}>
                              쪽지 보내기
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState title="팀이 없습니다." message="새 팀을 생성해보세요." />
              )}
            </article>
          </section>
        </div>
      </section>

      {isEditorOpen ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section
            id="team-editor"
            className={`${styles.modalCard} ${styles.editorModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
          >
            <h3 id="editor-title">{editingTeamCode ? '팀 수정' : '팀 생성'}</h3>
            <form className="form-grid" onSubmit={submitTeam}>
              <label>
                연결 해커톤
                <select
                  value={form.hackathonSlug}
                  onChange={(e) => updateForm('hackathonSlug', e.target.value)}
                >
                  <option value="">미연결(공통 팀)</option>
                  {hackathons.map((hackathon) => (
                    <option key={hackathon.slug} value={hackathon.slug}>
                      {hackathon.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                팀명*
                <input value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
              </label>
              <label>
                총 팀원 수
                <input
                  type="number"
                  min="1"
                  value={form.totalMemberCount}
                  onChange={(e) => updateForm('totalMemberCount', e.target.value)}
                />
              </label>
              <p className="muted span-2">현재 팀원 수는 합류 승인에 따라 자동으로 반영됩니다.</p>
              <label>
                모집 포지션 (쉼표 구분)
                <input
                  value={form.lookingFor}
                  onChange={(e) => updateForm('lookingFor', e.target.value)}
                  placeholder="Frontend, Designer"
                />
              </label>
              <label className="span-2">
                소개*
                <textarea value={form.intro} rows={3} onChange={(e) => updateForm('intro', e.target.value)} />
              </label>
              <label className="span-2">
                연락 링크*
                <input
                  value={form.contactUrl}
                  onChange={(e) => updateForm('contactUrl', e.target.value)}
                  placeholder="https://open.kakao.com/..."
                />
              </label>
              <label className="checkbox span-2">
                <input
                  type="checkbox"
                  checked={form.isOpen}
                  onChange={(e) => updateForm('isOpen', e.target.checked)}
                />
                모집 중 여부(isOpen)
              </label>
              <div className="inline-actions span-2">
                <button className="button" type="submit">
                  {editingTeamCode ? '수정 저장' : '팀 등록'}
                </button>
                <button className="button ghost" type="button" onClick={cancelEdit}>
                  취소
                </button>
              </div>
            </form>
            <p className="muted">이 브라우저에서 등록한 팀 글만 수정/삭제할 수 있습니다.</p>
            <p className="muted">
              상세 페이지로 돌아가려면{' '}
              <Link to={form.hackathonSlug ? `/hackathons/${form.hackathonSlug}` : '/hackathons'}>
                해커톤 상세/목록
              </Link>{' '}
              으로 이동하세요.
            </p>
          </section>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <h3 id="delete-title">팀 글 삭제</h3>
            <p>
              <strong>{deleteTarget.name}</strong> 글을 삭제할까요?
            </p>
            <p className="muted">삭제하면 되돌릴 수 없습니다.</p>
            <div className="inline-actions">
              <button className="button ghost" type="button" onClick={() => setDeleteTarget(null)}>
                취소
              </button>
              <button className={`button ${styles.dangerButton}`} type="button" onClick={confirmDelete}>
                삭제
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {messageTarget ? (
        <div className={styles.modalBackdrop} role="presentation">
          <section className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="msg-title">
            <h3 id="msg-title">쪽지 보내기</h3>
            <p>
              대상 팀: <strong>{messageTarget.name}</strong>
            </p>
            <label className={styles.messageLabel}>
              내용
              <textarea rows={4} value={messageText} onChange={(e) => setMessageText(e.target.value)} />
            </label>
            <div className="inline-actions">
              <button className="button ghost" type="button" onClick={() => setMessageTarget(null)}>
                취소
              </button>
              <button className="button" type="button" onClick={sendMessage}>
                전송
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {notice ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}
    </section>
  )
}
