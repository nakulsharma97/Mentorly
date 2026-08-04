import MessageApp from "../modules/messages/MessageApp";
import "../modules/messages/messages.css";

/**
 * Mentor messaging — thin wrapper around the shared three-column
 * <MessageApp /> (conversation list · chat · details).
 */
export default function MessagesPage({ profile, notify }) {
  return <MessageApp profile={profile} notify={notify} variant="MENTOR" />;
}
