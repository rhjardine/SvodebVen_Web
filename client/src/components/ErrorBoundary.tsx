import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = Readonly<{ children: ReactNode }>;
type State = Readonly<{ error: Error | null }>;

/** Nunca expone trazas en producción: solo en desarrollo, para depurar. */
export default class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) console.error(error, info.componentStack);
  }

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div
        role="alert"
        className="flex min-h-dvh items-center justify-center bg-mist p-8"
      >
        <div className="max-w-lg text-center">
          <AlertTriangle
            size={44}
            className="mx-auto text-danger"
            aria-hidden="true"
          />
          <h1 className="display mt-6 text-4xl">
            Algo no salió como esperábamos.
          </h1>
          <p className="mt-4 text-lg text-ink-soft">
            Recarga la página para intentarlo de nuevo.
          </p>
          {import.meta.env.DEV && (
            <pre className="mt-6 max-h-64 overflow-auto rounded-xl bg-white p-4 text-left text-xs">
              {error.stack}
            </pre>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn btn-primary mt-8"
          >
            <RotateCcw size={17} aria-hidden="true" /> Recargar
          </button>
        </div>
      </div>
    );
  }
}
