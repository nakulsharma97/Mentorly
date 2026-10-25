import { useParams } from "react-router";
import MessageApp from "../modules/messages/MessageApp";
import HeroSection from "../components/HeroSection";
import "../modules/messages/messages.css";

/**
 * Mentor messaging — unified page hero + the shared three-column
 * <MessageApp /> (conversation list · chat · details). The hero uses the
 * exact same design system as every other page; only the copy differs.
 *
 * The optional `:conversationId` route param deep-links straight into a
 * conversation (e.g. TeachingPage's "Message learner"); the app auto-selects
 * it once the list has loaded — same contract as LearnerMessagesPage.
 */
export default function MessagesPage({ profile, notify }) {
  const { conversationId } = useParams();
  return (
    <div className="ms-page">
      <HeroSection
        className="hero-section--compact"
        badge="Messages"
        title="Messages"
        subtitle="Chat with learners and mentors, manage session requests, and keep every conversation in one place."
        illustration={
          <div className="hero-section__watermark" aria-hidden="true">
            <span className="material-symbols-outlined">forum</span>
          </div>
        }
      />
      <MessageApp
        profile={profile}
        notify={notify}
        variant="MENTOR"
        initialConversationId={conversationId}
      />
    </div>
  );
}
