import { useEffect, useRef, useState } from "react";
import { Loader2, Send, X } from "lucide-react";
import client from "../../../../api/client";
import ModalShell from "./ModalShell";
import LqrButton from "./LqrButton";
import { mentorName } from "./requestsConfig";

/**
 * RequestReplyModal — lets a learner reply to a mentor after a request is
 * resolved (e.g. negotiate after a decline).
 */
export default function RequestReplyModal({ request, onClose, onSent }) {
  const [message, setMessage] = useState(request?.replyMessage || "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef(null);

  // Focus the textarea once the dialog is mounted
  useEffect(() => {
    const t = window.setTimeout(() => textareaRef.current?.focus(), 100);
    return () => window.clearTimeout(t);
  }, []);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setError("");
    try {
      await client.post(`/api/v1/session-requests/${request.id}/reply`, { message: trimmed });
      onSent?.(request, trimmed);
      onClose?.();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not send reply. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell
      title={`Reply to ${mentorName(request.mentor, request.mentorId)}`}
      subtitle="Send a follow-up message to the mentor"
      closeLabel="Close reply"
      onClose={onClose}
      busy={sending}
      footer={
        <>
          <LqrButton variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </LqrButton>
          <LqrButton
            variant="primary"
            icon={sending ? Loader2 : Send}
            disabled={sending || !message.trim()}
            onClick={submit}
          >
            {sending ? "Sending…" : "Send Reply"}
          </LqrButton>
        </>
      }
    >
      {request.status === "DECLINED" && request.declineReason && (
        <div className="lqr-note lqr-note--danger">
          <strong>Mentor said</strong>
          {request.declineReason}
        </div>
      )}
      {error && (
        <div className="lqr-pay-note lqr-pay-note--error">
          <X size={16} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </div>
      )}
      <div className="lqr-field">
        <label className="lqr-field__label" htmlFor={`lqr-reply-${request.id}`}>
          Your reply
        </label>
        <textarea
          id={`lqr-reply-${request.id}`}
          ref={textareaRef}
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Write your reply to the mentor…"
        />
      </div>
    </ModalShell>
  );
}
