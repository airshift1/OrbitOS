import { cx } from "../lib/helpers";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: { value: T; label: string }[];
  /** Names the group for assistive tech. */
  label: string;
  className?: string;
}

/** One-of-N choice (themes, window styles, categories…). */
export function Segmented<T extends string>({ value, onChange, options, label, className }: SegmentedProps<T>) {
  return (
    <div className={cx("seg", className)} role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="seg__btn" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
