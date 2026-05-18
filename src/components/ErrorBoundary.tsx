import { Component, type ErrorInfo, type ReactNode } from 'react'

type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[hamac] Erreur interface:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <main className="section section--cream" style={{ padding: '4rem 1.5rem', minHeight: '60vh' }}>
          <div className="container" style={{ maxWidth: '40rem' }}>
            <p className="eyebrow">Erreur</p>
            <h1 className="section-title">Le site n&apos;a pas pu se charger</h1>
            <p className="prose">
              Rechargez la page. Si le problème persiste, vérifiez la console du navigateur ou contactez l&apos;équipe
              technique.
            </p>
            <p style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn--primary" onClick={() => window.location.reload()}>
                Recharger
              </button>
            </p>
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
