import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'

const CARDS = [
  {
    to: '/hackathons',
    icon: '⚡',
    title: '해커톤 보러가기',
    desc: '진행중이거나 예정된 해커톤을 탐색하고 지금 바로 참여하세요.',
    arrow: '→ /hackathons',
  },
  {
    to: '/camp',
    icon: '👥',
    title: '팀 찾기',
    desc: '함께할 팀원을 찾거나 새 팀을 만들어 모집을 시작하세요.',
    arrow: '→ /camp',
  },
  {
    to: '/rankings',
    icon: '🏆',
    title: '랭킹 보기',
    desc: '글로벌 리더보드에서 최고 팀들의 순위를 실시간으로 확인하세요.',
    arrow: '→ /rankings',
  },
]

export function HomePage() {
  return (
    <div className={`${styles.page} page-enter`}>
      <div className={styles.gridBg} />
      <div className={styles.glow} />

      <div className={styles.hero}>
        <div className={styles.tag}>
          <span className={styles.tagDot} />
          Platform v1.0 · 2026
        </div>
        <h1 className={styles.title}>
          HACK<span className={styles.titleAccent}>.</span>
          <br />
          BUILD<span className={styles.titleAccent}>.</span>
          <br />
          WIN<span className={styles.titleAccent}>.</span>
        </h1>
        <p className={styles.sub}>
          해커톤을 발견하고, 팀을 구성하고, 경쟁하세요.
          <br />
          모든 것이 하나의 플랫폼에서.
        </p>
      </div>

      <div className={styles.cards}>
        {CARDS.map(({ to, icon, title, desc, arrow }) => (
          <Link key={to} to={to} className={styles.card}>
            <div className={styles.cardIcon}>{icon}</div>
            <div className={styles.cardTitle}>{title}</div>
            <div className={styles.cardDesc}>{desc}</div>
            <div className={styles.cardArrow}>{arrow}</div>
          </Link>
        ))}
      </div>
    </div>
  )
}
