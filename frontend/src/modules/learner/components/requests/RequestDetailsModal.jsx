import { Link } from "react-router";
import {
  Calendar,
  Clock,
  ExternalLink,
  Hourglass,
  MessageSquare,
  Send,
  Wallet,
} from "lucide-react";
import ModalShell from "./ModalShell";
import StatusBadge from "./StatusBadge";
import LqrButton from "./LqrButton";
import SkillChips from "./SkillChips";
import { avatarInitial, formatRequestDate, formatRequestTime, mentorName } from "./requestsConfig";

/**
 * RequestDetailsModal — full detail view for a request (message, preferred
 * time, budget, decline reason, mentor reply).
 */
export default function RequestDetailsModal({ request, onClose, onReply }) {
  const mentor = request.mentor || {};
  const name = mentorName(mentor, request.mentorId ?? mentor.id);
  const declined = request.status === "DECLINED";

  return (
    <ModalShell
      title="Request Details"
      subtitle={`Sent ${formatRequestDate(request.createdAt)} at ${formatRequestTime(request.createdAt)}`}
      label={`Request details — ${name}`}
      closeLabel="Close details"
      onClose={onClose}
      footer={
        <>
          {request.sessionId && (
            <LqrButton variant="primary" icon={ExternalLink} to="/learner/sessions">
              View Session
            </LqrButton>
          )}
          {declined && (
            <LqrButton variant="secondary" icon={Send} onClick={() => onReply?.(request)}>
              {request.replyMessage ? "Edit Reply" : "Reply to Mentor"}
            </LqrButton>
          )}
          <LqrButton variant="ghost" onClick={onClose}>
            Close
          </LqrButton>
        </>
      }
    >
      <div className="lqr-modal__mentor">
        <span className="lqr-modal__mentor-avatar">
          {mentor.profileImageUrl ? (
            <img src={mentor.profileImageUrl} alt="" />
          ) : (
            avatarInitial(name)
          )}
        </span>
        <div style={{ minWidth: 0 }}>
          <Link to={`/mentors/${mentor.id || request.mentorId}`}>
            <p className="lqr-modal__mentor-name">{name}</p>
          </Link>
          <p className="lqr-modal__mentor-meta">{mentor.headline || mentor.title || "Mentor"}</p>
        </div>
        <span style={{ marginLeft: "auto" }}>
          <StatusBadge status={request.status} />
        </span>
      </div>

      <div className="lqr-detail">
        {request.subject && (
          <div className="lqr-detail__item lqr-detail__item--wide">
            <p className="lqr-detail__k"><MessageSquare size={13} /> Topic</p>
            <p className="lqr-detail__v">{request.subject}</p>
          </div>
        )}

        <div className="lqr-detail__item lqr-detail__item--wide">
          <p className="lqr-detail__k"><MessageSquare size={13} /> Your message</p>
          <p className="lqr-detail__v" style={{ fontWeight: 500, lineHeight: 1.6 }}>
            {request.message?.trim() || "No message provided."}
          </p>
        </div>

        {request.preferredDate && (
          <div className="lqr-detail__item">
            <p className="lqr-detail__k"><Calendar size={13} /> Preferred date</p>
            <p className="lqr-detail__v">{request.preferredDate}</p>
          </div>
        )}
        {request.preferredTime && (
          <div className="lqr-detail__item">
            <p className="lqr-detail__k"><Clock size={13} /> Preferred time</p>
            <p className="lqr-detail__v">{request.preferredTime}</p>
          </div>
        )}
        {request.preferredDuration && (
          <div className="lqr-detail__item">
            <p className="lqr-detail__k"><Hourglass size={13} /> Duration</p>
            <p className="lqr-detail__v">{request.preferredDuration} min</p>
          </div>
        )}
        {request.budget && (
          <div className="lqr-detail__item">
            <p className="lqr-detail__k"><Wallet size={13} /> Budget</p>
            <p className="lqr-detail__v">{request.budget}</p>
          </div>
        )}
      </div>

      <SkillChips skills={mentor.skills} limit={6} />

      {declined && request.declineReason && (
        <div className="lqr-note lqr-note--danger">
          <strong>Mentor&apos;s response</strong>
          {request.declineReason}
        </div>
      )}
      {request.replyMessage && (
        <div className="lqr-note lqr-note--info">
          <strong>Your reply</strong>
          &ldquo;{request.replyMessage}&rdquo;
        </div>
      )}
    </ModalShell>
  );
}
