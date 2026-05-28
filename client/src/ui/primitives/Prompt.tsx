import { useEffect, useRef, useState } from "react";
import { Sheet, type SheetState } from "./Sheet";

interface Props {
  open: boolean;
  title: string;
  description?: string;
  initialValue?: string;
  placeholder?: string;
  cta?: string;          // primary button label
  maxLength?: number;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export function Prompt({
  open, title, description, initialValue = "",
  placeholder, cta = "Save", maxLength = 64,
  onSubmit, onCancel,
}: Props) {
  const [v, setV] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setV(initialValue);
      // Defer focus to next tick so the sheet has animated in.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialValue]);

  const ok = v.trim().length > 0;
  const state: SheetState = open ? "expanded" : "closed";

  return (
    <Sheet
      state={state}
      onStateChange={(next) => { if (next !== "expanded") onCancel(); }}
      expandedHeight="auto"
    >
      <div className="app-prompt">
        <h3>{title}</h3>
        {description && <p>{description}</p>}
        <input
          ref={inputRef}
          value={v}
          onChange={(e) => setV(e.target.value.slice(0, maxLength))}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && ok) onSubmit(v.trim());
            if (e.key === "Escape") onCancel();
          }}
          data-testid="prompt-input"
        />
        <div className="actions">
          <button onClick={onCancel} data-testid="prompt-cancel">Cancel</button>
          <button
            className="primary"
            disabled={!ok}
            onClick={() => onSubmit(v.trim())}
            data-testid="prompt-submit"
          >
            {cta}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
