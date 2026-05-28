interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  formatValue?: (v: number) => string;
  onChange: (v: number) => void;
  testId?: string;
}

export function Slider({ label, value, min, max, step = 1, formatValue, onChange, testId }: Props) {
  const display = formatValue ? formatValue(value) : String(value);
  return (
    <div className="app-slider">
      <div className="app-slider-label">
        <span>{label}</span>
        <span className="value">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        data-testid={testId}
      />
    </div>
  );
}
