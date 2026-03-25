import { Link } from 'react-router-dom'
import styles from '../components/StateBlocks.module.css'

export function NotFoundPage() {
  return (
    <section className={styles.stateBlock}>
      <h1>404</h1>
      <p>요청한 페이지를 찾을 수 없습니다.</p>
      <Link className="button" to="/">
        메인으로 이동
      </Link>
    </section>
  )
}
