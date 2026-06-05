import React from 'react'

interface ErrorPanelProps {
  title: React.ReactNode
  children: React.ReactNode
  className?: string
  messageClassName?: string
}

export default function ErrorPanel({
  title,
  children,
  className = '',
  messageClassName = 'wrap-break-word text-sm',
}: ErrorPanelProps) {
  return (
    <div
      className={`rounded-medium border border-danger/30 bg-danger/10 p-4 text-danger ${className}`}
    >
      <div className="mb-2 font-semibold">{title}</div>
      <pre className={`whitespace-pre-wrap ${messageClassName}`}>{children}</pre>
    </div>
  )
}
