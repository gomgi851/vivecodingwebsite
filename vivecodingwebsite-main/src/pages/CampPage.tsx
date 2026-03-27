import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlocks'
import { MainSidebarSection } from '../maincomponent/MainSidebarSection'
import { MainStatList } from '../maincomponent/MainStatList'
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

function normalizeSort(value: string | null) {
  if (value === 'open') return 'open'
  if (value === 'members') return 'members'
  return 'recent'
}

function asBooleanFlag(value: string | null) {
  return value === '1'
}

export function CampPage() {
  const { loading, error, refresh, hackathons, teams, setTeams } = useAppData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [viewerId] = useState<string>(() => getOrCreateViewerId())
  const queryHackathon = searchParams.get('hackathon') || 'all'
  const openMode = searchParams.get('open')
  const queryKeyword = searchParams.get('q') || ''
  const querySort = normalizeSort(searchParams.get('sort'))
  const queryMine = asBooleanFlag(searchParams.get('mine'))
  const queryOpenOnly = asBooleanFlag(searchParams.get('openOnly'))
  const queryMessaged = asBooleanFlag(searchParams.get('messaged'))
  const [lockedHackathon] = useState(() => (queryHackathon !== 'all' ? queryHackathon : ''))
  const isQueryLocked = Boolean(lockedHackathon)
  const shouldOpenCreate = openMode === 'create'
  const effectiveHackathonFilter = isQueryLocked ? lockedHackathon : queryHackathon
  const keyword = queryKeyword
  const sortBy = querySort
  const onlyMine = queryMine
  const onlyOpen = queryOpenOnly
  const onlyMessaged = queryMessaged
  const [form, setForm] = useState({
    hackathonSlug: effectiveHackathonFilter !== 'all' ? effectiveHackathonFilter : '',
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
  const [copiedView, setCopiedView] = useState(false)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => {
      setNotice('')
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const next = new URLSearchParams()
    if (isQueryLocked && effectiveHackathonFilter !== 'all') {
      next.set('hackathon', effectiveHackathonFilter)
    }
    if (isEditorOpen) next.set('open', 'create')
    if (keyword.trim()) next.set('q', keyword.trim())
    if (sortBy !== 'recent') next.set('sort', sortBy)
    if (onlyMine) next.set('mine', '1')
    if (onlyOpen) next.set('openOnly', '1')
    if (onlyMessaged) next.set('messaged', '1')

    const currentQuery = searchParams.toString()
    const nextQuery = next.toString()
    if (currentQuery !== nextQuery) {
      setSearchParams(next, { replace: true })
    }
  }, [effectiveHackathonFilter, isEditorOpen, isQueryLocked, keyword, onlyMessaged, onlyMine, onlyOpen, searchParams, setSearchParams, sortBy])

  const sentTeamCodes = useMemo(
    () =>
      new Set(
        messageSnapshot
          .filter((item) => item.senderId === viewerId && item.teamCode)
          .map((item) => item.teamCode as string),
      ),
    [messageSnapshot, viewerId],
  )
  const unreadInboxCount = useMemo(
    () => messageSnapshot.filter((item) => item.recipientId === viewerId && !item.readAt).length,
    [messageSnapshot, viewerId],
  )

  const visibleTeams = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    const rows = teams.filter((team) => {
      if (effectiveHackathonFilter !== 'all' && team.hackathonSlug !== effectiveHackathonFilter) return false
      if (onlyMine && team.ownerId !== viewerId) return false
      if (onlyOpen && !(team.isOpen && getCurrentMembers(team) < getTotalMembers(team))) return false
      if (onlyMessaged && !sentTeamCodes.has(team.teamCode)) return false
      if (!normalizedKeyword) return true
      const text = `${team.name} ${team.intro} ${(team.lookingFor || []).join(' ')}`.toLowerCase()
      return text.includes(normalizedKeyword)
    })

    return [...rows].sort((a, b) => {
      if (sortBy === 'members') return getCurrentMembers(b) - getCurrentMembers(a)
      if (sortBy === 'open') return Number(b.isOpen) - Number(a.isOpen)
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })
  }, [effectiveHackathonFilter, keyword, onlyMessaged, onlyMine, onlyOpen, sentTeamCodes, sortBy, teams, viewerId])

  const openCount = useMemo(
    () => visibleTeams.filter((team) => team.isOpen && getCurrentMembers(team) < getTotalMembers(team)).length,
    [visibleTeams],
  )
  const myCount = useMemo(
    () => visibleTeams.filter((team) => team.ownerId === viewerId).length,
    [viewerId, visibleTeams],
  )
  const hasActiveFilter =
    Boolean(keyword.trim()) ||
    effectiveHackathonFilter !== 'all' ||
    sortBy !== 'recent' ||
    onlyMine ||
    onlyOpen ||
    onlyMessaged
  const activeFilterCount =
    Number(Boolean(keyword.trim())) +
    Number(effectiveHackathonFilter !== 'all') +
    Number(sortBy !== 'recent') +
    Number(onlyMine) +
    Number(onlyOpen) +
    Number(onlyMessaged)
  const hackathonTitleBySlug = useMemo(
    () => new Map(hackathons.map((item) => [item.slug, item.title])),
    [hackathons],
  )
  const myTeamsAll = useMemo(() => teams.filter((team) => team.ownerId === viewerId), [teams, viewerId])
  const myOpenTeams = useMemo(
    () => myTeamsAll.filter((team) => team.isOpen && getCurrentMembers(team) < getTotalMembers(team)),
    [myTeamsAll],
  )
  const fullTeamCount = useMemo(
    () => teams.filter((team) => getCurrentMembers(team) >= getTotalMembers(team)).length,
    [teams],
  )
  const noOwnerTeamCount = useMemo(() => teams.filter((team) => !team.ownerId).length, [teams])
  const avgFillRate = myTeamsAll.length
    ? Math.round(
        (myTeamsAll.reduce((acc, team) => acc + getCurrentMembers(team) / getTotalMembers(team), 0) / myTeamsAll.length) *
          100,
      )
    : 0
  const contextLabel =
    effectiveHackathonFilter === 'all' ? '전체 해커톤' : getHackathonLabel(effectiveHackathonFilter)
  const contextRecruitingCount = useMemo(
    () =>
      teams.filter((team) => {
        if (effectiveHackathonFilter !== 'all' && team.hackathonSlug !== effectiveHackathonFilter) return false
        return team.isOpen && getCurrentMembers(team) < getTotalMembers(team)
      }).length,
    [effectiveHackathonFilter, teams],
  )

  if (loading) return <LoadingState title="팀 모집 정보를 불러오는 중..." />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  function changeFilter(value: string) {
    if (isQueryLocked) return
    const next = new URLSearchParams(searchParams)
    if (value === 'all') next.delete('hackathon')
    else next.set('hackathon', value)
    setSearchParams(next, { replace: true })
    setForm((prev) => ({
      ...prev,
      hackathonSlug: value === 'all' ? '' : value,
    }))
  }

  function updateQueryValue(key: 'q' | 'sort' | 'mine' | 'openOnly' | 'messaged', value: string) {
    const next = new URLSearchParams(searchParams)
    const defaults = {
      q: '',
      sort: 'recent',
      mine: '0',
      openOnly: '0',
      messaged: '0',
    }
    if (!value || value === defaults[key]) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  function resetAllFilters() {
    const next = new URLSearchParams(searchParams)
    next.delete('q')
    next.delete('sort')
    next.delete('mine')
    next.delete('openOnly')
    next.delete('messaged')
    if (!isQueryLocked) next.delete('hackathon')
    setSearchParams(next, { replace: true })
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

  async function copyCurrentView() {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.clipboard) return
    const query = new URLSearchParams()
    if (effectiveHackathonFilter !== 'all') query.set('hackathon', effectiveHackathonFilter)
    if (isEditorOpen) query.set('open', 'create')
    if (keyword.trim()) query.set('q', keyword.trim())
    if (sortBy !== 'recent') query.set('sort', sortBy)
    if (onlyMine) query.set('mine', '1')
    if (onlyOpen) query.set('openOnly', '1')
    if (onlyMessaged) query.set('messaged', '1')
    const queryText = query.toString()
    const targetUrl = `${window.location.origin}${window.location.pathname}${queryText ? `?${queryText}` : ''}`
    try {
      await navigator.clipboard.writeText(targetUrl)
      setCopiedView(true)
      window.setTimeout(() => setCopiedView(false), 1500)
    } catch {
      setCopiedView(false)
    }
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
          <MainSidebarSection title="빠른 액션">
            <div className={styles.sidebarActions}>
              <button className="button" type="button" onClick={openCreateEditor}>
                팀 생성하기
              </button>
              <button
                className={onlyMine ? 'button secondary' : 'button ghost'}
                type="button"
                onClick={() => updateQueryValue('mine', onlyMine ? '0' : '1')}
              >
                {onlyMine ? '내 등록글 보기 해제' : '내 등록글만 보기'}
              </button>
              <button
                className={onlyOpen ? 'button secondary' : 'button ghost'}
                type="button"
                onClick={() => updateQueryValue('openOnly', onlyOpen ? '0' : '1')}
              >
                {onlyOpen ? '모집중만 해제' : '모집중만 보기'}
              </button>
              <button
                className={onlyMessaged ? 'button secondary' : 'button ghost'}
                type="button"
                onClick={() => updateQueryValue('messaged', onlyMessaged ? '0' : '1')}
              >
                {onlyMessaged ? '쪽지 보낸 팀 해제' : '쪽지 보낸 팀 보기'}
              </button>
              <button className="button ghost" type="button" onClick={resetAllFilters}>
                필터 전체 해제
              </button>
            </div>
          </MainSidebarSection>

          <MainSidebarSection title="내 상태">
            <MainStatList
              items={[
                { label: '내 등록글', value: myTeamsAll.length },
                { label: '내 모집중', value: myOpenTeams.length },
                { label: '평균 충원율', value: `${avgFillRate}%` },
                { label: '정원 마감 팀', value: fullTeamCount },
              ]}
              className={styles.sidebarStats}
            />
          </MainSidebarSection>

          <MainSidebarSection title="현재 컨텍스트">
            <p className={styles.contextStrong}>{contextLabel}</p>
            <p className="muted">필터 결과 {visibleTeams.length}팀</p>
            <p className="muted">모집중 팀 {contextRecruitingCount}팀</p>
            {isQueryLocked ? <p className={styles.lockBadge}>해커톤 필터 잠금중</p> : null}
          </MainSidebarSection>

          <MainSidebarSection title="요청/알림">
            <ul className={styles.sidebarAlerts}>
              <li>미확인 받은 쪽지 {unreadInboxCount}</li>
              <li>내가 쪽지 보낸 팀 {sentTeamCodes.size}</li>
              <li>수신대상 미확인 팀 {noOwnerTeamCount}</li>
            </ul>
          </MainSidebarSection>

          <MainSidebarSection title="모집글 가이드">
            <ul className={styles.sidebarGuide}>
              <li>팀 목표를 1~2문장으로 명확하게 쓰기</li>
              <li>연락 링크와 모집 포지션을 구체적으로 적기</li>
              <li>총 팀원 수를 현실적으로 잡고 상태 관리하기</li>
            </ul>
          </MainSidebarSection>
        </aside>

        <div className={styles.mainColumn}>
          <div className={styles.headerSection}>
            <div className={styles.insightChips}>
              <span className={styles.insightChip}>현재 목록 {visibleTeams.length}</span>
              <span className={`${styles.insightChip} ${styles.insightChipOpen}`}>모집중 {openCount}</span>
              <span className={`${styles.insightChip} ${styles.insightChipMine}`}>내 등록글 {myCount}</span>
            </div>
          </div>

          <button type="button" className={styles.createTeamBtn} onClick={openCreateEditor}>
            {isEditorOpen ? '닫기' : '+ 팀 만들기'}
          </button>

          {isEditorOpen ? (
            <div className={styles.formCard}>
              <h2 className={styles.formTitle}>{editingTeamCode ? '팀 수정' : '새 팀 생성'}</h2>
              <form onSubmit={submitTeam} className={styles.form}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>연결 해커톤</label>
                  <select
                    className={styles.input}
                    value={form.hackathonSlug}
                    onChange={(e) => updateForm('hackathonSlug', e.target.value)}
                  >
                    <option value="">미연결 (공통 팀)</option>
                    {hackathons.map((hackathon) => (
                      <option key={hackathon.slug} value={hackathon.slug}>
                        {hackathon.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>팀 이름 *</label>
                  <input className={styles.input} value={form.name} onChange={(e) => updateForm('name', e.target.value)} />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>소개 *</label>
                  <textarea className={styles.textarea} rows={4} value={form.intro} onChange={(e) => updateForm('intro', e.target.value)} />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>모집 역할 (쉼표 구분)</label>
                  <input
                    className={styles.input}
                    value={form.lookingFor}
                    onChange={(e) => updateForm('lookingFor', e.target.value)}
                    placeholder="Frontend, Designer"
                  />
                </div>
                <div className={styles.ownerRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>총 팀원 수</label>
                    <input
                      className={styles.input}
                      type="number"
                      min="1"
                      value={form.totalMemberCount}
                      onChange={(e) => updateForm('totalMemberCount', e.target.value)}
                    />
                  </div>
                  <label className={styles.label}>
                    <input
                      type="checkbox"
                      checked={form.isOpen}
                      onChange={(e) => updateForm('isOpen', e.target.checked)}
                      className={styles.checkbox}
                    />
                    현재 모집 중
                  </label>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>연락 URL *</label>
                  <input
                    className={styles.input}
                    value={form.contactUrl}
                    onChange={(e) => updateForm('contactUrl', e.target.value)}
                    placeholder="https://open.kakao.com/..."
                  />
                </div>

                <button type="submit" className={styles.submitBtn}>
                  {editingTeamCode ? '팀 수정 완료' : '팀 생성하기'}
                </button>
              </form>
            </div>
          ) : null}

          <div className={styles.toolbar}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="팀명, 소개, 역할로 검색"
              value={keyword}
              onChange={(e) => updateQueryValue('q', e.target.value)}
              aria-label="팀 검색"
            />
            <select
              className={styles.toolbarBtn}
              value={effectiveHackathonFilter}
              onChange={(e) => changeFilter(e.target.value)}
              disabled={isQueryLocked}
            >
              <option value="all">전체 해커톤</option>
              {hackathons.map((hackathon) => (
                <option key={hackathon.slug} value={hackathon.slug}>
                  {hackathon.title}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${sortBy === 'recent' ? styles.toolbarBtnActive : ''}`}
              onClick={() => updateQueryValue('sort', 'recent')}
            >
              최신순
            </button>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${sortBy === 'open' ? styles.toolbarBtnActive : ''}`}
              onClick={() => updateQueryValue('sort', 'open')}
            >
              모집우선
            </button>
            <button
              type="button"
              className={`${styles.toolbarBtn} ${sortBy === 'members' ? styles.toolbarBtnActive : ''}`}
              onClick={() => updateQueryValue('sort', 'members')}
            >
              인원순
            </button>
            <button className={styles.toolbarBtn} type="button" onClick={resetAllFilters}>
              필터 초기화
            </button>
            <button className={styles.toolbarBtn} type="button" onClick={copyCurrentView}>
              {copiedView ? '뷰 링크 복사됨' : '현재 뷰 링크 복사'}
            </button>
          </div>

          {notice ? <div className={styles.success}>{notice}</div> : null}
          {visibleTeams.length ? (
            <div className={styles.grid}>
              {visibleTeams.map((team) => {
                const currentMembers = getCurrentMembers(team)
                const totalMembers = getTotalMembers(team)
                const isRecruiting = team.isOpen && currentMembers < totalMembers
                return (
                  <div key={team.teamCode} id={`team-card-${team.teamCode}`} className={styles.teamCard}>
                    <div className={styles.cardHeader}>
                      <h3 className={styles.teamName}>{team.name}</h3>
                      <div className={styles.headerActions}>
                        <span className={`${styles.status} ${isRecruiting ? styles.open : styles.closed}`}>
                          {isRecruiting ? '모집중' : '모집완료'}
                        </span>
                      </div>
                    </div>
                    <p className={styles.intro}>{team.intro}</p>
                    <div className={styles.info}>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>해커톤</span>
                        <span className={styles.value}>{getHackathonLabel(team.hackathonSlug)}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.label}>인원</span>
                        <span className={styles.value}>{currentMembers}/{totalMembers}명</span>
                      </div>
                    </div>
                    {(team.lookingFor || []).length ? (
                      <div className={styles.roles}>
                        {(team.lookingFor || []).map((role) => (
                          <span key={`${team.teamCode}-${role}`} className={styles.roleTag}>
                            {role}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className={styles.cardFooter}>
                      <a className={styles.actionBtn} href={team.contact?.url} target="_blank" rel="noreferrer">
                        연락하기
                      </a>
                      {team.hackathonSlug ? (
                        <Link className={styles.actionBtn} to={`/hackathons/${team.hackathonSlug}`}>
                          연결 해커톤
                        </Link>
                      ) : null}
                      {team.ownerId === viewerId ? (
                        <>
                          <button className={styles.actionBtn} type="button" onClick={() => startEdit(team)}>
                            팀 수정
                          </button>
                          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} type="button" onClick={() => requestDelete(team)}>
                            팀 삭제
                          </button>
                        </>
                      ) : (
                        <button className={styles.actionBtn} type="button" onClick={() => openMessageModal(team)}>
                          쪽지 보내기
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState title="팀이 없습니다" message="조건에 맞는 팀이 없어요. 새 팀을 만들어 시작해보세요." />
          )}
        </div>
      </section>
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


