import { useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router";

const MotionLink = motion.create(Link);

/**
 * AuButton — the unified admin button primitive.
 * Variants: primary (teal gradient) | outline | ghost | danger | success.
 * Adds a CSS ripple on pointer-down and renders a router <Link> when `to` is set.
 */
export default function AuButton({
  variant = "ghost",
  size,
  icon: Icon,
  to,
  fullWidth,
  className = "",
  children,
  onPointerDown,
  disabled,
  ...props
}) {
  const handlePointerDown = useCallback(
    (event) => {
      onPointerDown?.(event);
      if (disabled || event.button !== 0) return;
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement("span");
      ripple.className = "au-ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      button.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 650);
    },
    [disabled, onPointerDown],
  );

  const classes = [
    "au-btn",
    `au-btn--${variant}`,
    size === "sm" ? "au-btn--sm" : "",
    fullWidth ? "au-btn--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {Icon && <Icon size={17} aria-hidden="true" />}
      <span>{children}</span>
    </>
  );

  const motionProps = {
    whileTap: disabled ? undefined : { scale: 0.97 },
    transition: { duration: 0.12 },
  };

  if (to) {
    return (
      <MotionLink to={to} className={classes} onPointerDown={handlePointerDown} {...motionProps} {...props}>
        {content}
      </MotionLink>
    );
  }

  return (
    <motion.button
      type="button"
      className={classes}
      onPointerDown={handlePointerDown}
      disabled={disabled}
      {...motionProps}
      {...props}
    >
      {content}
    </motion.button>
  );
}
