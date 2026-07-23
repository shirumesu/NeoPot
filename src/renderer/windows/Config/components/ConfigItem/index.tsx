import React from 'react'

type ConfigItemProps = {
  title?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export default function ConfigItem({ title, children, className = '' }: ConfigItemProps) {
  return (
    <div className={`config-item ${className}`.trim()}>
      {title !== undefined && <h3>{title}</h3>}
      {children}
    </div>
  )
}
