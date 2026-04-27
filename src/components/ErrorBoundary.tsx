import React from 'react';

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallbackTitle?: string;
}

interface ErrorBoundaryState {
    error: Error | null;
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    state: ErrorBoundaryState = {
        error: null,
    };

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            error,
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Render error boundary caught an error:', error, errorInfo);
    }

    render() {
        const { error } = this.state;

        if (error) {
            return (
                <div className='rounded-medium border border-danger/30 bg-danger/10 p-4 text-danger'>
                    <div className='mb-2 font-semibold'>{this.props.fallbackTitle ?? 'Window render failed'}</div>
                    <pre className='whitespace-pre-wrap break-words text-sm'>{`${error.name}: ${error.message}`}</pre>
                </div>
            );
        }

        return this.props.children;
    }
}
