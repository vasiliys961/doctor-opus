'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  /** Название компонента для отладки */
  componentName?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Универсальный Error Boundary для обёртки критических компонентов.
 * Ловит ошибки рендера и показывает fallback UI вместо краша всего приложения.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`❌ [ErrorBoundary${this.props.componentName ? ': ' + this.props.componentName : ''}]`, error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-center my-4">
          <div className="text-3xl mb-3">⚠️</div>
          <h3 className="text-lg font-bold text-red-800 mb-2">
            Произошла ошибка{this.props.componentName ? ` в "${this.props.componentName}"` : ''}
          </h3>
          <p className="text-sm text-red-600 mb-4">
            {this.state.error?.message || 'Неизвестная ошибка'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
          >
            Попробовать снова
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
