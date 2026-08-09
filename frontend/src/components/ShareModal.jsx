import { useCallback, useEffect, useRef, useState } from "react";
import Icon from "../modules/common/dashboard/Icon";
import "./ShareModal.css";

/**
 * Reusable non-monetary share modal.
 *
 * Used for "Share this mentor" on the public mentor profile and the
 * "Invite Friends" cards on the mentor/learner dashboards. There is no
 * referral reward, code, tracking, or platform-specific sharing involved —
 * it simply copies the URL or opens the browser's native share sheet.
 *
 * @param {object} props
 * @param {string} props.title          Heading, e.g. "Invite Friends"
 * @param {string} props.subtitle       Sub-heading, e.g. "Share SkillSwap with them."
 * @param {string} props.url            The URL to share (always the real app URL)
 * @param {string} props.text           Optional share text used with navigator.share()
 * @param {string} props.copyLabel      Label of the copy button (default "Copy Link")
 * @param {string} props.copyDoneLabel  Success label after copying (default "Link copied!")
 * @param {Function} props.onClose
 */
export default function ShareModal({
  title,
  subtitle,
  url,
  text,
  copyLabel = "Copy Link",
  copyDoneLabel = "Link copied!",
  onClose,
}) {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  const close = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    copyTimer.current = setTimeout(() => setCopied(false), 2000);
  }, [url]);

  /**
   * Native Web Share API when supported. Fallback (no navigator.share):
   * copy the link to the clipboard — never platform-specific buttons.
   */
  const share = async () => {
    if (typeof navigator === "undefined" || !navigator.share) {
      copyLink();
      return;
    }
    try {
      await navigator.share({ title, text, url });
    } catch {
      // user cancelled the native sheet — do nothing
    }
  };

  return (
    <div
      className="sm-overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sm-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sm-modal__head">
          <span className="sm-modal__icon">
            <Icon name="share" />
          </span>
          <div className="sm-modal__titles">
            <h3 className="sm-modal__title">{title}</h3>
            {subtitle && <p className="sm-modal__subtitle">{subtitle}</p>}
          </div>
          <button
            type="button"
            className="sm-modal__close"
            onClick={close}
            aria-label="Close share dialog"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="sm-modal__body">
          <button
            type="button"
            className="sm-option sm-option--copy"
            onClick={copyLink}
            aria-live="polite"
          >
            <span className="sm-option__icon">
              <Icon name={copied ? "check_circle" : "content_copy"} />
            </span>
            <span className="sm-option__label">
              {copied ? copyDoneLabel : copyLabel}
            </span>
          </button>
          <button type="button" className="sm-option sm-option--share" onClick={share}>
            <span className="sm-option__icon">
              <Icon name="ios_share" />
            </span>
            <span className="sm-option__label">Share</span>
          </button>
        </div>
      </div>
    </div>
  );
}
