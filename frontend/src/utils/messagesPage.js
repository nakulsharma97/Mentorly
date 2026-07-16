export function filterConversationsBySearch(
  conversations = [],
  searchTerm = "",
) {
  const normalized = String(searchTerm || "")
    .trim()
    .toLowerCase();
  if (!normalized) {
    return conversations;
  }

  return conversations.filter((item) => {
    const conv = item?.conversation || item || {};
    const haystack = [
      item?.title,
      item?.subtitle,
      item?.role,
      conv.participantName,
      conv.sessionTitle,
      conv.participantEmail,
      conv.lastMessagePreview,
      item?.participantName,
      item?.lastMessagePreview,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}
