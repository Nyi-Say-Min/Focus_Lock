import { Button } from "./Button";
import { Input } from "./Input";
type Props = {
  value: number | "";
  onValueChange: (value: number) => void;
  label: string;
  disabled?: boolean;
  min?: number;
  max?: number;
};
export function NumberInput({ value, onValueChange, label, disabled, min = 1, max = 1440 }: Props) {
  const step = (delta: number) => onValueChange(Math.max(min, Math.min(max, (value === "" ? min : value) + delta)));
  return (
    <div className="number-stepper">
      <Button aria-label={`Decrease ${label}`} disabled={disabled || value === min} onClick={() => step(-1)}>
        −
      </Button>
      <span className="minute-input">
        <Input
          aria-label={label}
          type="number"
          required
          min={min}
          max={max}
          step={1}
          value={value}
          disabled={disabled}
          onChange={(event) => onValueChange(event.target.valueAsNumber)}
        />
        <span aria-hidden="true">min</span>
      </span>
      <Button aria-label={`Increase ${label}`} disabled={disabled || value === max} onClick={() => step(1)}>
        +
      </Button>
    </div>
  );
}
