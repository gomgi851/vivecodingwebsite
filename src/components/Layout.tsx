import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAppData } from '../store/AppDataContext'
import styles from './Layout.module.css'
import type { DirectMessage } from '../types'

const VIEWER_ID_KEY = 'vivecoder_viewer_id'
const DIRECT_MESSAGES_KEY = 'direct_messages'

const warmupRoutes = [
  () => import('../pages/HackathonsPage'),
  () => import('../pages/HackathonDetailPage'),
  () => import('../pages/CampPage'),
  () => import('../pages/RankingsPage'),
]

const menuItems = [
  { to: '/hackathons', label: '해커톤 보러가기' },
  { to: '/camp', label: '팀 찾기' },
  { to: '/rankings', label: '랭킹 보기' },
]

function getOrCreateViewerId() {
  if (typeof window === 'undefined') return 'viewer-anon'
  const existing = window.localStorage.getItem(VIEWER_ID_KEY)
  if (existing) return existing
  const created = `viewer-${Math.random().toString(36).slice(2, 10)}`
  window.localStorage.setItem(VIEWER_ID_KEY, created)
  return created
}

function readMessages() {
  if (typeof window === 'undefined') return [] as DirectMessage[]
  try {
    const raw = window.localStorage.getItem(DIRECT_MESSAGES_KEY)
    if (!raw) return []
    return JSON.parse(raw) as DirectMessage[]
  } catch {
    return []
  }
}

export function Layout() {
  const navigate = useNavigate()
  const { hackathons } = useAppData()
  const [quickInput, setQuickInput] = useState('')
  const [viewerId] = useState(() => getOrCreateViewerId())
  const [messages, setMessages] = useState<DirectMessage[]>(() => readMessages())
  const [inboxOpen, setInboxOpen] = useState(false)

  const quickTargets = useMemo(
    () => [
      { key: '메인', to: '/' },
      { key: '해커톤', to: '/hackathons' },
      { key: '팀 찾기', to: '/camp' },
      { key: '랭킹', to: '/rankings' },
      ...hackathons.map((item) => ({ key: item.title, to: `/hackathons/${item.slug}` })),
    ],
    [hackathons],
  )

  const ongoingCount = hackathons.filter((item) => item.status === 'ongoing').length
  const upcomingCount = hackathons.filter((item) => item.status === 'upcoming').length

  const inboxMessages = [...messages]
    .filter((item) => item.recipientId === viewerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const unreadCount = inboxMessages.filter((item) => !item.readAt).length

  useEffect(() => {
    let cancelled = false
    const browserWindow = window as Window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number
      cancelIdleCallback?: (id: number) => void
    }
    const run = () => {
      if (cancelled) return
      warmupRoutes.forEach((load) => {
        void load()
      })
    }

    if (typeof window === 'undefined') return
    if (typeof browserWindow.requestIdleCallback === 'function') {
      const id = browserWindow.requestIdleCallback(run, { timeout: 1200 })
      return () => {
        cancelled = true
        if (typeof browserWindow.cancelIdleCallback === 'function') {
          browserWindow.cancelIdleCallback(id)
        }
      }
    }

    const fallback = window.setTimeout(run, 450)
    return () => {
      cancelled = true
      window.clearTimeout(fallback)
    }
  }, [])

  function submitQuickJump(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const q = quickInput.trim().toLowerCase()
    if (!q) return
    const match = quickTargets.find((item) => item.key.toLowerCase().includes(q))
    navigate(match ? match.to : '/hackathons')
    setQuickInput('')
  }

  function toggleInbox() {
    if (!inboxOpen) {
      const now = new Date().toISOString()
      const next = messages.map((item) =>
        item.recipientId === viewerId && !item.readAt
          ? {
              ...item,
              readAt: now,
            }
          : item,
      )
      setMessages(next)
      window.localStorage.setItem(DIRECT_MESSAGES_KEY, JSON.stringify(next))
    }
    setInboxOpen((prev) => !prev)
  }

  return (
    <div className={styles.appShell}>
      <a className={styles.skipLink} href="#main-content">
        본문으로 바로 이동
      </a>
      <header className={styles.topbar}>
        <div className={styles.leftCluster}>
          <Link to="/" className={styles.brandWrap}>
            <div className={styles.brandBadge}>VC</div>
            <div className={styles.brandTextWrap}>
              <p className={styles.brandTitle}>VibeCoder Hackathon</p>
              <p className={styles.brandSubtitle}>Build fast. Ship clean. Rank high.</p>
            </div>
          </Link>

          <nav className={styles.topnav} aria-label="주요 메뉴">
            {menuItems.map((item) => (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? `${styles.menuItem} ${styles.menuItemActive}` : styles.menuItem
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className={styles.rightControls}>
          <div className={styles.statusRibbon} aria-label="현재 플랫폼 상태">
            <span>진행 {ongoingCount}</span>
            <span>예정 {upcomingCount}</span>
          </div>
          <button
            type="button"
            className={styles.inboxButton}
            onClick={toggleInbox}
            aria-label="쪽지함 열기"
            aria-expanded={inboxOpen}
            aria-controls="inbox-panel"
          >
            쪽지
            {unreadCount > 0 ? <span className={styles.unreadBadge}>{unreadCount}</span> : null}
          </button>
          {inboxOpen ? (
            <section className={styles.inboxPanel} id="inbox-panel" role="region" aria-label="받은 쪽지함">
              <h3>쪽지함</h3>
              {inboxMessages.length ? (
                <ul>
                  {inboxMessages.slice(0, 10).map((msg) => (
                    <li key={msg.id}>
                      <p className={styles.msgMeta}>
                        {msg.teamName ? `${msg.teamName} · ` : ''}
                        {new Date(msg.createdAt).toLocaleString('ko-KR')}
                      </p>
                      <p className={styles.msgContent}>{msg.content}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyInbox}>받은 쪽지가 없습니다.</p>
              )}
            </section>
          ) : null}

          <form className={styles.quickJump} onSubmit={submitQuickJump}>
            <input
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder="해커톤/페이지 빠른 이동"
              aria-label="빠른 이동 검색"
              list="quick-jump-list"
            />
            <datalist id="quick-jump-list">
              {quickTargets.map((item) => (
                <option key={`${item.to}-${item.key}`} value={item.key} />
              ))}
            </datalist>
          </form>
        </div>
      </header>

      <main className={styles.pageMain} id="main-content">
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>Data: JSON + localStorage | Deploy target: Vercel</p>
      </footer>
    </div>
  )
}
