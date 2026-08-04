import { useParams } from "react-router";
import MessageApp from "../modules/messages/MessageApp";
import "../modules/messages/messages.css";

/**
 * Learner messaging — thin wrapper around the shared three-column
 * <MessageApp /> (conversation list · chat · details).
 *
 * The optional `:conversationId` route param deep-links straight into a
 * conversation; the app auto-selects it once the list has loaded.
 */
export default function LearnerMessagesPage({ profile, notify }) {
  const { conversationId } = useParams();
  return (
    <MessageApp
      profile={profile}
      notify={notify}
      variant="LEARNER"
      initialConversationId={conversationId}
    />
  );
}
