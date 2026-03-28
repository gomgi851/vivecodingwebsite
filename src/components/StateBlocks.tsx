import type { ReactNode } from 'react'
import styles from './StateBlocks.module.css'

export function LoadingState({ title = '불러오는 중...' }: { title?: string }) {
  return (
    <section className={styles.stateBlock} role="status" aria-live="polite">
      <h2>{title}</h2>
      <p>데이터를 불러오고 있습니다. 잠시만 기다려주세요.</p>
    </section>
  )
}

interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export function ErrorState({ title = '오류가 발생했습니다.', message, onRetry }: ErrorStateProps) {
  return (
    <section className={`${styles.stateBlock} ${styles.error}`} role="alert" aria-live="assertive">
      <h2>{title}</h2>
      <p>{message || '요청을 처리하지 못했습니다. 네트워크 상태를 확인한 뒤 다시 시도해주세요.'}</p>
      {onRetry ? (
        <button className="button secondary" type="button" onClick={onRetry}>
          다시 시도
        </button>
      ) : null}
    </section>
  )
}

interface EmptyStateProps {
  title?: string
  message?: string
  action?: ReactNode
}

export function EmptyState({ title = '데이터가 없습니다.', message, action }: EmptyStateProps) {
  return (
    <section className={styles.stateBlock} role="status" aria-live="polite">
      <h2>{title}</h2>
      <p>{message || '표시할 항목이 없습니다.'}</p>
      {action}
    </section>
  )
}
