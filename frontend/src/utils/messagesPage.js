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
    const haystack = [
      item?.title,
      item?.subtitle,
      item?.role,
      item?.conversation?.participantName,
      item?.conversation?.sessionTitle,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}
