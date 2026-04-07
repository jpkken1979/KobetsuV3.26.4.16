import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary]", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-destructive/30 bg-destructive/5 py-16 px-8">
          <div className="rounded-2xl bg-destructive/10 p-4">
            <AlertTriangle className="h-8 w-8 text-destructive/60" />
          </div>
          <p className="mt-4 text-base font-semibold text-foreground">
            エラーが発生しました
          </p>
          <p className="mt-2 max-w-md text-center text-xs text-muted-foreground/60 leading-relaxed">
            {this.state.error?.message || "予期しないエラーが発生しました。"}
          </p>
          <button
            onClick={this.handleReset}
            className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border/60 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            再試行
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
