import { useId, type ReactNode } from "react";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
  /** Receives the props to spread onto the control so label/hint/error stay linked to it. */
  children: (control: { id: string; "aria-describedby"?: string; "aria-invalid"?: true }) => ReactNode;
}

export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const noteId = `${id}-note`;
  const note = error ?? hint;
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children({ id, "aria-describedby": note ? noteId : undefined, "aria-invalid": error ? true : undefined })}
      {note && (
        <span id={noteId} className={error ? "field__error" : "field__hint"} role={error ? "alert" : undefined}>
          {note}
        </span>
      )}
    </div>
  );
}
