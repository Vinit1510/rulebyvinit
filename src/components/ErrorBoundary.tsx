import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/40 bg-destructive/5 my-6 mx-auto max-w-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              {this.props.fallbackTitle || "Something went wrong in this section"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              An unexpected error occurred while rendering this component. You can try clicking "Try Again" or reviewing the error message below.
            </p>

            {this.state.error && (
              <div className="bg-background border rounded-md p-3 overflow-x-auto text-[11px] font-mono text-destructive">
                <strong>Error details:</strong> {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={this.handleReset} className="text-xs">
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Try Again
              </Button>
              <Button size="sm" variant="default" onClick={() => window.location.reload()} className="text-xs">
                Reload Page
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
