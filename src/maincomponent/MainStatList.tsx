import type { ReactNode } from 'react'
import styles from './MainStatList.module.css'

type MainStatItem = {
  label: ReactNode
  value: ReactNode
}

type MainStatListProps = {
  items: MainStatItem[]
  className?: string
  itemClassName?: string
  labelClassName?: string
  valueClassName?: string
}

export function MainStatList({
  items,
  className,
  itemClassName,
  labelClassName,
  valueClassName,
}: MainStatListProps) {
  return (
    <ul className={className ? `${styles.list} ${className}` : styles.list}>
      {items.map((item, index) => (
        <li key={index} className={itemClassName ? `${styles.item} ${itemClassName}` : styles.item}>
          <span className={labelClassName ? `${styles.label} ${labelClassName}` : styles.label}>{item.label}</span>
          <strong className={valueClassName ? `${styles.value} ${valueClassName}` : styles.value}>{item.value}</strong>
        </li>
      ))}
    </ul>
  )
}
