import type { ButtonHTMLAttributes } from "react";
import { cx } from "../lib/helpers";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "quiet" | "danger";
  size?: "md" | "sm";
  /** Shows a spinner, keeps the width, and blocks further clicks. */
  loading?: boolean;
  /** Square button that only contains an icon — must have an aria-label. */
  iconOnly?: boolean;
}

export function Button({ variant = "default", size = "md", loading, iconOnly, className, type = "button", disabled, ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={cx("btn", variant !== "default" && `btn--${variant}`, size === "sm" && "btn--sm", iconOnly && "btn--icon", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    />
  );
}
