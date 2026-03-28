import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useRef } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../components/StateBlocks'
import { MainSidebarSection } from '../maincomponent/MainSidebarSection'
import { MainStatList } from '../maincomponent/MainStatList'
import { useAppData } from '../store/AppDataContext'
import styles from './CampPage.module.css'
import type { Team } from '../types'

const VIEWER_ID_KEY = 'vivecoder_viewer_id'
const FAVORITE_TEAMS_KEY = 'favorite_team_codes'
const HACKATHON_LABEL_PREVIEW_LENGTH = 18

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

function readStoredFavoriteTeamCodes() {
  if (typeof window === 'undefined') return [] as string[]
  try {
    const raw = window.localStorage.getItem(FAVORITE_TEAMS_KEY)
    if (!raw) return [] as string[]
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return [] as string[]
    return parsed.filter((item) => typeof item === 'string') as string[]
  } catch {
    return [] as string[]
  }
}

function getCurrentMembers(team: Team) {
  return Math.max(1, Number(team.currentMemberCount ?? team.memberCount ?? 1) || 1)
}

function getTotalMembers(team: Team) {
  const current = getCurrentMembers(team)
  return Math.max(current, Number(team.totalMemberCount ?? current) || current)
}

function isTeamRecruiting(team: Team) {
  return Boolean(team.isOpen) && getCurrentMembers(team) < getTotalMembers(team)
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
  const [lockedHackathon] = useState(() => (queryHackathon !== 'all' ? queryHackathon : ''))
  const isQueryLocked = Boolean(lockedHackathon)
  const shouldOpenCreate = openMode === 'create'
  const effectiveHackathonFilter = isQueryLocked ? lockedHackathon : queryHackathon
  const keyword = queryKeyword
  const sortBy = querySort
  const onlyMine = queryMine
  const onlyOpen = queryOpenOnly
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
  const [memberDetailTarget, setMemberDetailTarget] = useState<Team | null>(null)
  const [hackathonDetailTarget, setHackathonDetailTarget] = useState<{
    teamName: string
    label: string
  } | null>(null)
  const [isHackathonMenuOpen, setIsHackathonMenuOpen] = useState(false)
  const [isSidebarWaveActive, setIsSidebarWaveActive] = useState(false)
  const [sidebarWaveDirection, setSidebarWaveDirection] = useState<'up' | 'down'>('down')
  const sidebarWaveTimeoutRef = useRef<number | null>(null)
  const lastSidebarScrollYRef = useRef(0)
  const lastSidebarWaveAtRef = useRef(0)
  const [favoriteTeamCodes, setFavoriteTeamCodes] = useState<Set<string>>(
    () => new Set(readStoredFavoriteTeamCodes()),
  )

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

    const currentQuery = searchParams.toString()
    const nextQuery = next.toString()
    if (currentQuery !== nextQuery) {
      setSearchParams(next, { replace: true })
    }
  }, [effectiveHackathonFilter, isEditorOpen, isQueryLocked, keyword, onlyMine, onlyOpen, searchParams, setSearchParams, sortBy])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(FAVORITE_TEAMS_KEY, JSON.stringify(Array.from(favoriteTeamCodes)))
  }, [favoriteTeamCodes])

  useEffect(() => {
    if (!isHackathonMenuOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Element)) return
      if (!target.closest('[data-hackathon-filter-root="true"]')) {
        setIsHackathonMenuOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsHackathonMenuOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isHackathonMenuOpen])

  useEffect(() => {
    if (isQueryLocked) {
      setIsHackathonMenuOpen(false)
    }
  }, [isQueryLocked])

  useEffect(() => {
    if (typeof window === 'undefined') return
    lastSidebarScrollYRef.current = window.scrollY

    function onScroll() {
      const currentY = window.scrollY
      const delta = currentY - lastSidebarScrollYRef.current
      if (Math.abs(delta) < 2) return

      lastSidebarScrollYRef.current = currentY
      const now = window.performance.now()
      if (now - lastSidebarWaveAtRef.current < 110) return
      lastSidebarWaveAtRef.current = now

      const direction: 'up' | 'down' = delta > 0 ? 'down' : 'up'
      setSidebarWaveDirection(direction)
      setIsSidebarWaveActive(false)
      window.requestAnimationFrame(() => {
        setIsSidebarWaveActive(true)
      })

      if (sidebarWaveTimeoutRef.current !== null) {
        window.clearTimeout(sidebarWaveTimeoutRef.current)
      }
      sidebarWaveTimeoutRef.current = window.setTimeout(() => {
        setIsSidebarWaveActive(false)
      }, 320)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (sidebarWaveTimeoutRef.current !== null) {
        window.clearTimeout(sidebarWaveTimeoutRef.current)
      }
    }
  }, [])

  const visibleTeams = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase()
    const rows = teams.filter((team) => {
      if (effectiveHackathonFilter !== 'all' && team.hackathonSlug !== effectiveHackathonFilter) return false
      if (onlyMine && team.ownerId !== viewerId) return false
      if (onlyOpen && !(team.isOpen && getCurrentMembers(team) < getTotalMembers(team))) return false
      if (!normalizedKeyword) return true
      const text = `${team.name} ${team.intro} ${(team.lookingFor || []).join(' ')}`.toLowerCase()
      return text.includes(normalizedKeyword)
    })

    return [...rows].sort((a, b) => {
      const recruitingPriority = Number(isTeamRecruiting(b)) - Number(isTeamRecruiting(a))
      if (recruitingPriority !== 0) return recruitingPriority
      if (sortBy === 'members') return getCurrentMembers(b) - getCurrentMembers(a)
      if (sortBy === 'open') {
        const openDiff = Number(b.isOpen) - Number(a.isOpen)
        if (openDiff !== 0) return openDiff
      }
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    })
  }, [effectiveHackathonFilter, keyword, onlyMine, onlyOpen, sortBy, teams, viewerId])

  const openCount = useMemo(
    () => visibleTeams.filter((team) => isTeamRecruiting(team)).length,
    [visibleTeams],
  )
  const myCount = useMemo(
    () => visibleTeams.filter((team) => team.ownerId === viewerId).length,
    [viewerId, visibleTeams],
  )
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
  const favoriteCount = favoriteTeamCodes.size
  const avgFillRate = myTeamsAll.length
    ? Math.round(
        (myTeamsAll.reduce((acc, team) => acc + getCurrentMembers(team) / getTotalMembers(team), 0) / myTeamsAll.length) *
          100,
      )
    : 0
  const detailCurrentMembers = memberDetailTarget ? getCurrentMembers(memberDetailTarget) : 0
  const detailTotalMembers = memberDetailTarget ? getTotalMembers(memberDetailTarget) : 0
  const detailRemainingSeats = Math.max(detailTotalMembers - detailCurrentMembers, 0)
  const detailRecruiting = memberDetailTarget ? isTeamRecruiting(memberDetailTarget) : false
  const detailRoles = memberDetailTarget?.lookingFor || []
  const filterMotionKey = `${effectiveHackathonFilter}|${keyword.trim()}|${sortBy}|${onlyMine ? '1' : '0'}|${onlyOpen ? '1' : '0'}`

  if (loading) return <LoadingState title="팀 모집 정보를 불러오는 중..." />
  if (error) return <ErrorState message={error} onRetry={refresh} />

  function changeFilter(value: string) {
    if (isQueryLocked) return
    const next = new URLSearchParams(searchParams)
    if (value === 'all') next.delete('hackathon')
    else next.set('hackathon', value)
    setSearchParams(next, { replace: true })
    setIsHackathonMenuOpen(false)
    setForm((prev) => ({
      ...prev,
      hackathonSlug: value === 'all' ? '' : value,
    }))
  }

  function updateQueryValue(key: 'q' | 'sort' | 'mine' | 'openOnly', value: string) {
    const next = new URLSearchParams(searchParams)
    const defaults = {
      q: '',
      sort: 'recent',
      mine: '0',
      openOnly: '0',
    }
    if (!value || value === defaults[key]) next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true })
  }

  function updateForm(key: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function getHackathonLabel(slug?: string) {
    if (!slug) return '미연결(공통 팀)'
    return hackathonTitleBySlug.get(slug) || slug
  }

  function getHackathonFilterLabel(slug: string) {
    if (slug === 'all') return '전체 해커톤'
    return getHackathonLabel(slug)
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
    resetForm()
  }

  function openCreateEditor() {
    setEditingTeamCode(null)
    resetForm()
    setIsEditorOpen(true)
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

  function openMemberDetail(team: Team) {
    setMemberDetailTarget(team)
  }

  function openHackathonDetail(team: Team, label: string) {
    setHackathonDetailTarget({
      teamName: team.name,
      label,
    })
  }

  function toggleFavorite(teamCode: string) {
    setFavoriteTeamCodes((prev) => {
      const next = new Set(prev)
      if (next.has(teamCode)) next.delete(teamCode)
      else next.add(teamCode)
      return next
    })
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
        <aside
          className={`${styles.sidebar} ${styles.stageSidebar} ${isSidebarWaveActive ? styles.sidebarWaveActive : ''} ${
            sidebarWaveDirection === 'up' ? styles.sidebarWaveUp : styles.sidebarWaveDown
          }`}
        >
          <MainSidebarSection title="지금 포커스" className={styles.sidebarSection}>
            <MainStatList
              items={[
                { label: '표시 팀', value: visibleTeams.length },
                { label: '모집중 팀', value: openCount },
                { label: '내 등록글', value: myTeamsAll.length },
                { label: '즐겨찾기 팀', value: favoriteCount },
              ]}
              className={styles.sidebarStats}
            />
          </MainSidebarSection>

          <MainSidebarSection title="빠른 제어" className={styles.sidebarSection}>
            <div className={styles.sidebarActions}>
              <button className="button secondary" type="button" onClick={openCreateEditor}>
                + 팀 생성
              </button>
              <button
                className={onlyMine ? 'button secondary' : 'button ghost'}
                type="button"
                onClick={() => updateQueryValue('mine', onlyMine ? '0' : '1')}
              >
                {onlyMine ? '내 글 필터 해제' : '내 글만 보기'}
              </button>
              <button
                className={onlyOpen ? 'button secondary' : 'button ghost'}
                type="button"
                onClick={() => updateQueryValue('openOnly', onlyOpen ? '0' : '1')}
              >
                {onlyOpen ? '모집중 필터 해제' : '모집중만 보기'}
              </button>
            </div>
          </MainSidebarSection>

          <MainSidebarSection title="운영 인사이트" className={styles.sidebarSection}>
            <MainStatList
              items={[
                { label: '내 모집중', value: myOpenTeams.length },
                { label: '평균 충원율', value: `${avgFillRate}%` },
                { label: '즐겨찾기 팀', value: favoriteCount },
                { label: '정원 마감 팀', value: fullTeamCount },
              ]}
              className={styles.sidebarStats}
            />
          </MainSidebarSection>

        </aside>

        <div className={styles.mainColumn}>
          <div className={styles.entryBanner}>
            <div className={styles.entryCopy}>
              <strong className={styles.entryTitle}>TEAM FINDER</strong>
              <span className={styles.entryHint}>모집중 팀을 우선 탐색하고 바로 연결하세요</span>
            </div>
          </div>
          <div className={`${styles.headerStrip} ${styles.stageHeader}`}>
            <div className={styles.headerRow}>
              <div className={styles.summaryBar}>
                <div className={styles.summaryItem}>
                  <span className={styles.summaryLabel}>현재 목록</span>
                  <strong className={styles.summaryValue}>{visibleTeams.length}</strong>
                </div>
                <div className={`${styles.summaryItem} ${styles.summaryItemOpen}`}>
                  <span className={styles.summaryLabel}>모집중</span>
                  <strong className={styles.summaryValue}>{openCount}</strong>
                </div>
                <div className={`${styles.summaryItem} ${styles.summaryItemMine}`}>
                  <span className={styles.summaryLabel}>내 등록글</span>
                  <strong className={styles.summaryValue}>{myCount}</strong>
                </div>
              </div>
              <button
                type="button"
                className={styles.createTeamBtn}
                onClick={openCreateEditor}
              >
                + 팀 만들기
              </button>
            </div>
          </div>

          <div className={`${styles.toolbar} ${styles.stageToolbar}`}>
            <input
              type="search"
              className={styles.searchInput}
              placeholder="팀명, 소개, 역할로 검색"
              value={keyword}
              onChange={(e) => updateQueryValue('q', e.target.value)}
              aria-label="팀 검색"
            />
            <div className={styles.hackathonFilter} data-hackathon-filter-root="true">
              <button
                type="button"
                className={`${styles.toolbarBtn} ${styles.hackathonTrigger} ${isHackathonMenuOpen ? styles.hackathonTriggerOpen : ''}`}
                onClick={() => setIsHackathonMenuOpen((prev) => !prev)}
                disabled={isQueryLocked}
                aria-haspopup="listbox"
                aria-expanded={isHackathonMenuOpen}
              >
                <span className={styles.hackathonTriggerLabel}>{getHackathonFilterLabel(effectiveHackathonFilter)}</span>
                <span className={styles.hackathonChevron} aria-hidden="true">
                  ▾
                </span>
              </button>
              {isHackathonMenuOpen ? (
                <div className={styles.hackathonMenu} role="listbox" aria-label="해커톤 선택 목록">
                  <button
                    type="button"
                    className={`${styles.hackathonOption} ${effectiveHackathonFilter === 'all' ? styles.hackathonOptionActive : ''}`}
                    onClick={() => changeFilter('all')}
                    role="option"
                    aria-selected={effectiveHackathonFilter === 'all'}
                  >
                    전체 해커톤
                  </button>
                  {hackathons.map((hackathon) => (
                    <button
                      type="button"
                      key={hackathon.slug}
                      className={`${styles.hackathonOption} ${
                        effectiveHackathonFilter === hackathon.slug ? styles.hackathonOptionActive : ''
                      }`}
                      onClick={() => changeFilter(hackathon.slug)}
                      role="option"
                      aria-selected={effectiveHackathonFilter === hackathon.slug}
                    >
                      {hackathon.title}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
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
          </div>

          {notice ? <div className={styles.success}>{notice}</div> : null}
          {visibleTeams.length ? (
            <div key={filterMotionKey} className={`${styles.grid} ${styles.stageGrid}`}>
              {visibleTeams.map((team) => {
                const currentMembers = getCurrentMembers(team)
                const totalMembers = getTotalMembers(team)
                const isRecruiting = isTeamRecruiting(team)
                const isFavorite = favoriteTeamCodes.has(team.teamCode)
                const hackathonLabel = getHackathonLabel(team.hackathonSlug)
                const hackathonPreview =
                  hackathonLabel.length > HACKATHON_LABEL_PREVIEW_LENGTH
                    ? `${hackathonLabel.slice(0, HACKATHON_LABEL_PREVIEW_LENGTH)}...`
                    : hackathonLabel
                return (
                  <div
                    key={team.teamCode}
                    id={`team-card-${team.teamCode}`}
                    className={`${styles.teamCard} ${!isRecruiting ? styles.teamCardClosed : ''}`.trim()}
                  >
                    <button
                      type="button"
                      className={`${styles.favoriteBtn} ${isFavorite ? styles.favoriteBtnActive : ''}`}
                      onClick={() => toggleFavorite(team.teamCode)}
                      aria-label={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    >
                      {isFavorite ? '★' : '☆'}
                    </button>
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
                      <button
                        type="button"
                        className={`${styles.infoItem} ${styles.infoButton}`}
                        onClick={() => openHackathonDetail(team, hackathonLabel)}
                      >
                        <span className={styles.label}>해커톤</span>
                        <span className={`${styles.value} ${styles.hackathonValue}`}>{hackathonPreview}</span>
                        <small className={styles.memberHint}>클릭해서 상세 보기</small>
                      </button>
                      <button type="button" className={`${styles.infoItem} ${styles.infoButton}`} onClick={() => openMemberDetail(team)}>
                        <span className={styles.label}>인원</span>
                        <span className={`${styles.value} ${styles.memberValue}`}>{currentMembers}/{totalMembers}명</span>
                        <small className={styles.memberHint}>클릭해서 상세 보기</small>
                      </button>
                    </div>
                    <div className={styles.cardFooter}>
                      {isRecruiting ? (
                        <a className={styles.actionBtn} href={team.contact?.url} target="_blank" rel="noreferrer">
                          연락하기
                        </a>
                      ) : (
                        <span className={`${styles.actionBtn} ${styles.actionBtnDisabled}`} aria-disabled="true">
                          연락하기
                        </span>
                      )}
                      {team.hackathonSlug ? (
                        isRecruiting ? (
                          <Link className={styles.actionBtn} to={`/hackathons/${team.hackathonSlug}`}>
                            연결 해커톤
                          </Link>
                        ) : (
                          <span className={`${styles.actionBtn} ${styles.actionBtnDisabled}`} aria-disabled="true">
                            연결 해커톤
                          </span>
                        )
                      ) : null}
                      {team.ownerId === viewerId ? (
                        <>
                          <button className={`${styles.actionBtn} ${styles.actionBtnEdit}`} type="button" onClick={() => startEdit(team)}>
                            팀 수정
                          </button>
                          <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} type="button" onClick={() => requestDelete(team)}>
                            팀 삭제
                          </button>
                        </>
                      ) : null}
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
      {isEditorOpen ? (
        <div className={`${styles.modalBackdrop} ${styles.editorBackdrop}`} role="presentation" onClick={cancelEdit}>
          <section
            className={`${styles.modalCard} ${styles.editorModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.editorHeader}>
              <h3 id="editor-title" className={styles.editorTitle}>
                {editingTeamCode ? '팀 수정' : '새 팀 생성'}
              </h3>
              <button type="button" className={`button ghost ${styles.editorCloseBtn}`} onClick={cancelEdit}>
                닫기
              </button>
            </div>
            <form onSubmit={submitTeam} className={`${styles.form} ${styles.editorForm}`}>
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
                <div className={styles.formGroup}>
                  <label className={styles.label}>모집 상태</label>
                  <label className={styles.openToggle}>
                    <input
                      type="checkbox"
                      checked={form.isOpen}
                      onChange={(e) => updateForm('isOpen', e.target.checked)}
                      className={styles.checkbox}
                    />
                    <span>현재 모집 중</span>
                  </label>
                </div>
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

              <div className={styles.editorActions}>
                <button className="button ghost" type="button" onClick={cancelEdit}>
                  닫기
                </button>
                <button type="submit" className={`${styles.submitBtn} ${editingTeamCode ? styles.submitBtnEdit : ''}`}>
                  {editingTeamCode ? '팀 수정 완료' : '팀 생성하기'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
      {memberDetailTarget ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setMemberDetailTarget(null)}>
          <section
            className={`${styles.modalCard} ${styles.memberModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="member-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="member-detail-title">{memberDetailTarget.name} 인원/모집 상세</h3>
            <p className={styles.memberMeta}>해커톤: {getHackathonLabel(memberDetailTarget.hackathonSlug)}</p>

            <div className={styles.memberGrid}>
              <div className={styles.memberBlock}>
                <span className={styles.memberBlockLabel}>현재 구성</span>
                <strong className={styles.memberBlockValue}>{detailCurrentMembers}명 합류</strong>
                <p className={styles.memberBlockText}>
                  팀장 포함 {detailCurrentMembers}명 / 멤버 {Math.max(detailCurrentMembers - 1, 0)}명
                </p>
              </div>
              <div className={styles.memberBlock}>
                <span className={styles.memberBlockLabel}>모집 현황</span>
                <strong className={styles.memberBlockValue}>
                  {detailRecruiting ? `남은 자리 ${detailRemainingSeats}명` : '모집 완료'}
                </strong>
                <p className={styles.memberBlockText}>
                  정원 {detailTotalMembers}명 {detailRecruiting ? `· 현재 모집중` : '· 추가 모집 없음'}
                </p>
              </div>
            </div>

            <div className={styles.memberRoles}>
              <p className={styles.memberRolesTitle}>모집 중 역할</p>
              {detailRoles.length ? (
                <div className={styles.memberRoleList}>
                  {detailRoles.map((role) => (
                    <span key={`${memberDetailTarget.teamCode}-detail-${role}`} className={styles.memberRoleTag}>
                      {role}
                    </span>
                  ))}
                </div>
              ) : (
                <p className={styles.memberEmpty}>세부 역할이 등록되지 않았습니다.</p>
              )}
            </div>

            <div className="inline-actions">
              <button className="button ghost" type="button" onClick={() => setMemberDetailTarget(null)}>
                닫기
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {hackathonDetailTarget ? (
        <div className={styles.modalBackdrop} role="presentation" onClick={() => setHackathonDetailTarget(null)}>
          <section
            className={`${styles.modalCard} ${styles.hackathonModalCard}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="hackathon-detail-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="hackathon-detail-title">연결 해커톤 전체 내용</h3>
            <p className={styles.hackathonMeta}>팀: {hackathonDetailTarget.teamName}</p>
            <p className={styles.hackathonFullText}>{hackathonDetailTarget.label}</p>
            <div className="inline-actions">
              <button className="button ghost" type="button" onClick={() => setHackathonDetailTarget(null)}>
                닫기
              </button>
            </div>
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

      {notice ? (
        <div className={styles.toast} role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}
    </section>
  )
}
