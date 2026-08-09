import MessageApp from "../modules/messages/MessageApp";
import HeroSection from "../components/HeroSection";
import "../modules/messages/messages.css";

/**
 * Mentor messaging — unified page hero + the shared three-column
 * <MessageApp /> (conversation list · chat · details). The hero uses the
 * exact same design system as every other page; only the copy differs.
 */
export default function MessagesPage({ profile, notify }) {
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
      <MessageApp profile={profile} notify={notify} variant="MENTOR" />
    </div>
  );
}
