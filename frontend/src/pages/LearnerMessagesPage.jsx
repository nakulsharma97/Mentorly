import { useParams } from "react-router";
import MessageApp from "../modules/messages/MessageApp";
import HeroSection from "../components/HeroSection";
import "../modules/messages/messages.css";

/**
 * Learner messaging — unified page hero + the shared three-column
 * <MessageApp /> (conversation list · chat · details).
 *
 * The optional `:conversationId` route param deep-links straight into a
 * conversation; the app auto-selects it once the list has loaded.
 */
export default function LearnerMessagesPage({ profile, notify }) {
  const { conversationId } = useParams();
  return (
    <div className="ms-page">
      <HeroSection
        badge="Messages"
        title="Messages"
        subtitle="Chat with mentors and learners, manage session requests, and keep every conversation in one place."
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">forum</span>
          </div>
        }
      />
      <MessageApp
        profile={profile}
        notify={notify}
        variant="LEARNER"
        initialConversationId={conversationId}
      />
    </div>
  );
}
