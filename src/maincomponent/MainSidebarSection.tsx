import type { ReactNode } from 'react'
import styles from './MainSidebarSection.module.css'

type MainSidebarSectionProps = {
  title: string
  children: ReactNode
  className?: string
}

export function MainSidebarSection({ title, children, className }: MainSidebarSectionProps) {
  return (
    <article className={className ? `${styles.section} ${className}` : styles.section}>
      <h2 className={styles.title}>{title}</h2>
      {children}
    </article>
  )
}
