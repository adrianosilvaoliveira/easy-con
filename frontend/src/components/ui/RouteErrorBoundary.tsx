import { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class RouteErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('Route render error', error);
  }

  private handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] w-full flex-col items-center justify-center gap-4 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <div>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              Algo deu errado ao carregar esta tela
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Tente novamente. Se o problema persistir, recarregue a página.
            </p>
          </div>
          <Button variant="secondary" onClick={this.handleReset}>
            <RotateCcw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
