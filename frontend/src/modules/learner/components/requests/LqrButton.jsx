import { useCallback } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router";

const MotionLink = motion.create(Link);

/**
 * LqrButton — premium button primitive for the My Requests surface.
 * Variants: primary (teal gradient) | secondary | danger | ghost.
 * Includes a CSS ripple on pointer-down, motion tap feedback and a
 * consistent focus ring. Renders a <Link> when `to` is provided.
 */
export default function LqrButton({
  variant = "secondary",
  size = "md",
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
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      ripple.className = "lqr-ripple";
      ripple.style.width = ripple.style.height = `${size}px`;
      ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
      ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
      button.appendChild(ripple);
      window.setTimeout(() => ripple.remove(), 650);
    },
    [disabled, onPointerDown],
  );

  const classes = [
    "lqr-btn",
    `lqr-btn--${variant}`,
    size === "sm" ? "lqr-btn--sm" : "",
    fullWidth ? "lqr-btn--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      {Icon && <Icon size={18} aria-hidden="true" />}
      <span>{children}</span>
    </>
  );

  const motionProps = {
    whileTap: disabled ? undefined : { scale: 0.97 },
    transition: { duration: 0.12 },
  };

  if (to) {
    return (
      <MotionLink
        to={to}
        className={classes}
        onPointerDown={handlePointerDown}
        {...motionProps}
        {...props}
      >
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
