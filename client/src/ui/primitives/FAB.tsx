import type { ReactNode } from "react";
import { useHaptics } from "../hooks/useHaptics";

interface Props {
  onClick: () => void;
  children: ReactNode;
  ariaLabel: string;
  testId?: string;
}

export function FAB({ onClick, children, ariaLabel, testId }: Props) {
  const haptics = useHaptics();
  return (
    <button
      className="app-fab"
      aria-label={ariaLabel}
      data-testid={testId}
      onClick={() => { haptics("tap"); onClick(); }}
    >
      {children}
    </button>
  );
}
