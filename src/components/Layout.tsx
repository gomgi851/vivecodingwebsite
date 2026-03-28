import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import styles from './Layout.module.css'

const warmupRoutes = [
  () => import('../pages/HackathonsPage'),
  () => import('../pages/HackathonDetailPage'),
  () => import('../pages/CampPage'),
  () => import('../pages/RankingsPage'),
]

export function Layout() {
  const location = useLocation()

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)
  const isHome = location.pathname === '/'
  const isHackathons = isActive('/hackathons') && !isHome
  const isCamp = isActive('/camp')
  const isRankings = isActive('/rankings')

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

  return (
    <div className={styles.appShell}>
      <a className={styles.skipLink} href="#main-content">
        본문으로 바로 이동
      </a>
      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link to="/" className={styles.logo}>
            <span className={styles.logoIcon} aria-hidden="true">
              ⚡
            </span>
            VibeCoder
          </Link>

          <nav className={styles.topnav} aria-label="주요 메뉴">
            <Link
              to="/"
              className={`${styles.menuItem} ${isHome ? styles.menuItemActive : ''}`}
              aria-current={isHome ? 'page' : undefined}
            >
              메인
            </Link>
            <Link
              to="/hackathons"
              className={`${styles.menuItem} ${isHackathons ? styles.menuItemActive : ''}`}
              aria-current={isHackathons ? 'page' : undefined}
            >
              해커톤 보기
            </Link>
            <Link
              to="/camp"
              className={`${styles.menuItem} ${isCamp ? styles.menuItemActive : ''}`}
              aria-current={isCamp ? 'page' : undefined}
            >
              팀 찾기
            </Link>
            <Link
              to="/rankings"
              className={`${styles.menuItem} ${isRankings ? styles.menuItemActive : ''}`}
              aria-current={isRankings ? 'page' : undefined}
            >
              랭킹 보기
            </Link>
          </nav>
        </div>
      </header>

      <main className={`${styles.pageMain} ${isHome ? styles.pageMainHome : ''}`} id="main-content">
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <p>Data: JSON + localStorage | Deploy target: Vercel</p>
      </footer>
    </div>
  )
}
