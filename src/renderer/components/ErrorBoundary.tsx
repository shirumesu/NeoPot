import React from 'react'
import { logger } from '@/renderer/lib/logger'
import i18n from '@/renderer/i18n'
import ErrorPanel from './ErrorPanel'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackTitle?: string
}

interface ErrorBoundaryState {
  error: Error | null
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      error,
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('Render error boundary caught an error.', error, {
      componentStack: errorInfo.componentStack,
    })
  }

  render() {
    const { error } = this.state

    if (error) {
      return (
        <ErrorPanel
          title={this.props.fallbackTitle ?? i18n.t('errors.window_render_failed_generic')}
        >
          {`${error.name}: ${error.message}`}
        </ErrorPanel>
      )
    }

    return this.props.children
  }
}
