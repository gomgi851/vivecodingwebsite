import styles from './MainInsightChips.module.css'

type ChipTone = 'default' | 'success' | 'warning' | 'accent'

interface ChipItem {
  label: string
  tone?: ChipTone
}

interface MainInsightChipsProps {
  items: ChipItem[]
  className?: string
}

export function MainInsightChips({ items, className = '' }: MainInsightChipsProps) {
  return (
    <div className={`${styles.wrap} ${className}`.trim()}>
      {items.map((item, index) => (
        <span
          key={`${item.label}-${index}`}
          className={`${styles.chip} ${
            item.tone === 'success'
              ? styles.success
              : item.tone === 'warning'
                ? styles.warning
                : item.tone === 'accent'
                  ? styles.accent
                  : ''
          }`}
        >
          {item.label}
        </span>
      ))}
    </div>
  )
}
