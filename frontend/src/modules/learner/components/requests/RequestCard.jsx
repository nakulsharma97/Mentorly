import { motion } from "framer-motion";
import { Link } from "react-router";
import {
  Calendar,
  Clock,
  Eye,
  Briefcase,
  CreditCard,
  ExternalLink,
  Loader2,
  MessageSquare,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import StatusBadge from "./StatusBadge";
import SkillChips from "./SkillChips";
import LqrButton from "./LqrButton";
import { avatarInitial, formatRequestDate, formatRequestTime, mentorName } from "./requestsConfig";

/**
 * RequestCard — one premium request card. Renders a 5-column grid
 * (mentor / message / status / date / actions) that collapses to 4, 2 and
 * 1 column responsively.
 */
export default function RequestCard({
  request,
  index = 0,
  highlighted = false,
  innerRef,
  cancelling = false,
  onCancel,
  onViewDetails,
  onPay,
  onReply,
}) {
  const mentor = request.mentor || {};
  const status = request.status || "PENDING";
  const name = mentorName(mentor, request.mentorId ?? mentor.id);
  const role = mentor.headline || mentor.title || null;
  const rating = Number(mentor.averageRating || request.averageRating || 0);
  const message = request.message?.trim();

  const actions = buildActions(request, { cancelling, onCancel, onViewDetails, onPay, onReply });

  return (
    <motion.article
      ref={innerRef}
      className={`lqr-request lqr-request--${status}${highlighted ? " lqr-request--highlight" : ""}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10, transition: { duration: 0.18 } }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
    >
      {/* Column 1 — Mentor */}
      <div className="lqr-mentor">
        <span className="lqr-mentor__avatar" aria-hidden="true">
          {mentor.profileImageUrl ? (
            <img src={mentor.profileImageUrl} alt="" loading="lazy" />
          ) : (
            avatarInitial(name)
          )}
        </span>
        <div className="lqr-mentor__info">
          <h3 className="lqr-mentor__name">
            <Link to={`/mentors/${mentor.id || request.mentorId}`}>{name}</Link>
          </h3>
          <div className="lqr-mentor__meta">
            {rating > 0 && (
              <span className="lqr-rating">
                <span className="lqr-rating__stars" aria-hidden="true">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={13} fill={n <= Math.round(rating) ? "currentColor" : "none"} />
                  ))}
                </span>
                <span aria-label={`Rated ${rating.toFixed(1)} out of 5`}>{rating.toFixed(1)}</span>
              </span>
            )}
            {role && (
              <span className="lqr-mentor__role" title={role}>
                <Briefcase size={14} aria-hidden="true" />
                {role}
              </span>
            )}
          </div>
          <SkillChips skills={mentor.skills} limit={3} />
        </div>
      </div>

      {/* Column 2 — Message */}
      <div className="lqr-message">
        <span className="lqr-message__icon" aria-hidden="true">
          <MessageSquare size={17} />
        </span>
        <div className="lqr-message__body">
          <p className="lqr-message__label">Your message</p>
          <p className="lqr-message__text">{message || "No message provided"}</p>
          {request.subject && <p className="lqr-message__subject">{request.subject}</p>}
        </div>
      </div>

      {/* Column 3 — Status */}
      <div className="lqr-status">
        <StatusBadge status={status} />
        {status === "ACCEPTED" && !request.sessionId && (
          <span className="lqr-status__hint">Awaiting session setup by mentor</span>
        )}
        {status === "DECLINED" && request.declineReason && (
          <span className="lqr-status__hint" title={request.declineReason}>
            Mentor replied
          </span>
        )}
      </div>

      {/* Column 4 — Date */}
      <div className="lqr-date">
        <span className="lqr-date__item">
          <Calendar size={15} aria-hidden="true" />
          {formatRequestDate(request.createdAt)}
        </span>
        <span className="lqr-date__item">
          <Clock size={15} aria-hidden="true" />
          {formatRequestTime(request.createdAt)}
        </span>
      </div>

      {/* Column 5 — Actions */}
      <div className="lqr-actions">{actions}</div>
    </motion.article>
  );
}

/** Build the vertical action buttons for a request based on its status. */
function buildActions(request, { cancelling = false, onCancel, onViewDetails, onPay, onReply }) {
  const { status, sessionId } = request;
  const viewSession = (
    <LqrButton
      key="view-session"
      variant="primary"
      icon={ExternalLink}
      to="/learner/sessions"
      aria-label={`View session for request ${request.id}`}
    >
      View Session
    </LqrButton>
  );

  switch (status) {
    case "PENDING":
      return [
        <LqrButton key="details" variant="primary" icon={Eye} onClick={() => onViewDetails?.(request)}>
          View Details
        </LqrButton>,
        <LqrButton
          key="cancel"
          variant="danger"
          icon={cancelling ? Loader2 : Trash2}
          disabled={cancelling}
          onClick={() => onCancel?.(request)}
          aria-label={`Cancel request ${request.id}`}
        >
          {cancelling ? "Cancelling…" : "Cancel Request"}
        </LqrButton>,
      ];

    case "ACCEPTED":
      if (sessionId) {
        return [
          viewSession,
          <LqrButton key="pay" variant="secondary" icon={CreditCard} onClick={() => onPay?.(request)}>
            Pay Now
          </LqrButton>,
        ];
      }
      // Accepted but not yet scheduled — allow viewing details and replying
      return [
        <LqrButton key="details" variant="primary" icon={Eye} onClick={() => onViewDetails?.(request)}>
          View Details
        </LqrButton>,
        <LqrButton key="reply" variant="secondary" icon={Send} onClick={() => onReply?.(request)}>
          {request.replyMessage ? "Edit Reply" : "Reply"}
        </LqrButton>,
      ];

    case "DECLINED":
      return [
        <LqrButton key="details" variant="primary" icon={Eye} onClick={() => onViewDetails?.(request)}>
          View Details
        </LqrButton>,
        <LqrButton key="reply" variant="secondary" icon={Send} onClick={() => onReply?.(request)}>
          {request.replyMessage ? "Edit Reply" : "Reply"}
        </LqrButton>,
      ];

    case "COMPLETED":
      return [
        viewSession,
        <LqrButton
          key="review"
          variant="secondary"
          icon={Star}
          to={`/mentors/${request.mentor?.id || request.mentorId}?review=1`}
        >
          Leave Review
        </LqrButton>,
      ];

    default: // CANCELLED / unknown
      return [
        <LqrButton key="details" variant="ghost" icon={Eye} disabled>
          View Details
        </LqrButton>,
      ];
  }
}
