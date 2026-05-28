import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  tone?: "default" | "warn" | "danger" | "success";
  showDot?: boolean;
  testId?: string;
}

export function StatusPill({ children, tone = "default", showDot, testId }: Props) {
  return (
    <div className="app-status-pill" data-tone={tone} role="status" data-testid={testId}>
      {showDot && <span className="dot" aria-hidden />}
      <span>{children}</span>
    </div>
  );
}
