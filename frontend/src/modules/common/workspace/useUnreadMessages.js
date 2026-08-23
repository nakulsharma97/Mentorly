import { useEffect, useState } from "react";
import {
  getUnreadMessages,
  subscribeUnreadMessages,
} from "../../messages/unreadMessagesStore";

/**
 * Live subscription to the global unread message count. Re-renders only when
 * the value actually changes (store dedupes identical values).
 *
 * The polling that populates this store is now handled by ChatProvider
 * (see context/ChatContext.jsx), which fetches both chat conversation
 * endpoints once at the layout level and publishes the derived total.
 * This hook is ONLY the read-subscriber — it never fetches itself.
 */
export function useUnreadMessageCount() {
  const [count, setCount] = useState(getUnreadMessages);

  useEffect(() => {
    return subscribeUnreadMessages(setCount);
  }, []);

  return count;
}
