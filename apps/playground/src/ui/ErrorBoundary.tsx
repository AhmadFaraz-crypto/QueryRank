import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { error: Error | null }

/**
 * Keeps one failing view (a chart that hits bad data, say) from blanking the
 * whole app. Catches render errors in its subtree and shows a recoverable
 * message instead of an empty screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[QueryRank] view error:', error)
  }

  reset = () => this.setState({ error: null })

  render() {
    if (!this.state.error) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div
        role="alert"
        style={{
          margin: 'auto',
          maxWidth: 420,
          padding: 32,
          textAlign: 'center',
          color: 'var(--ink, #1a1a2e)',
        }}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 18 }}>This view hit a snag</h2>
        <p style={{ margin: '0 0 20px', opacity: 0.7, fontSize: 14, lineHeight: 1.5 }}>
          Something went wrong rendering this screen. Your data is safe — try again.
        </p>
        <button
          onClick={this.reset}
          style={{
            padding: '8px 18px',
            borderRadius: 8,
            border: '1px solid currentColor',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          Try again
        </button>
      </div>
    )
  }
}
