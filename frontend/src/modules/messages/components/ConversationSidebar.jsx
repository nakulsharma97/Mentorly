import ConversationCard from "./ConversationCard";
import MessageRequestCard from "./MessageRequestCard";
import { ConversationListSkeleton } from "./LoadingSkeleton";
import EmptyConversation from "./EmptyConversation";
import ConversationSearch from "./ConversationSearch";
import ConversationFilter from "./ConversationFilter";

export default function ConversationSidebar({
  loading,
  conversations,
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  quickFilter,
  onQuickFilterChange,
  sort,
  onSortChange,
  searchTerm,
  onSearchChange,
  searchResults,
  searching,
  searchError,
  onClearSearch,
  messageRequests,
  requestActioningId,
  onRequestAction,
  requestsLoading,
  typingByConv,
  onNewChat,
}) {
  const shown = searchResults ? searchResults : conversations;

  return (
    <aside className="ms-sidebar" aria-label="Conversations">
      <div className="ms-sidebar__head">
        <div className="ms-sidebar__title-row">
          <h1 className="ms-sidebar__title">Messages</h1>
          <button
            type="button"
            className="ms-new-chat-btn"
            onClick={onNewChat}
            title="Start a new conversation"
          >
            <span className="material-symbols-outlined">add</span>
            <span>New Chat</span>
          </button>
        </div>

        <ConversationSearch
          value={searchTerm}
          onChange={onSearchChange}
          onClear={onClearSearch}
        />

        <ConversationFilter
          tab={filter}
          onTab={onFilterChange}
          quickFilter={quickFilter}
          onQuickFilter={onQuickFilterChange}
          sort={sort}
          onSort={onSortChange}
        />
      </div>

      <div className="ms-sidebar__scroll">
        {/* Message requests */}
        {!searchResults && (
          <section className="ms-requests" aria-label="Message requests">
            {requestsLoading ? (
              <p className="ms-requests__hint" style={{ fontSize: "0.78rem", color: "var(--ms-muted)" }}>
                Loading requests…
              </p>
            ) : messageRequests.length > 0 ? (
              <>
                <p className="ms-requests__label">Requests</p>
                {messageRequests.slice(0, 4).map((req) => (
                  <MessageRequestCard
                    key={req.id}
                    request={req}
                    busy={requestActioningId === req.id}
                    onAccept={(r) => onRequestAction(r.id, "accept")}
                    onDecline={(r) => onRequestAction(r.id, "decline")}
                  />
                ))}
              </>
            ) : null}
          </section>
        )}

        {/* Conversation list */}
        {loading ? (
          <ConversationListSkeleton />
        ) : shown.length > 0 ? (
          <div className="ms-conv-list">
            {shown.map((row) => {
              const rowId =
                row.id ??
                `${row.kind}-${row.id ?? row.conversationId ?? row.bookingId ?? ""}`;
              const convId = String(
                row.conversationId ?? row.bookingId ?? row.id ?? "",
              );
              return (
                <ConversationCard
                  key={rowId}
                  conversation={row}
                  selected={String(selectedId) === String(rowId)}
                  onSelect={onSelect}
                  typing={Boolean(typingByConv[convId])}
                  searchTerm={searchResults ? searchTerm : ""}
                />
              );
            })}
          </div>
        ) : searching ? (
          <div className="ms-sidebar__empty">
            <span className="ms-spinner" aria-hidden="true" />
            <p>Searching…</p>
          </div>
        ) : searchResults ? (
          <EmptyConversation
            icon="search_off"
            title="No conversations found"
            description={searchError || `Nothing matches "${searchTerm}".`}
            actions={
              <button
                type="button"
                className="ms-btn ms-btn--outline ms-btn--sm"
                onClick={onClearSearch}
              >
                Clear search
              </button>
            }
          />
        ) : (
          <EmptyConversation
            icon="forum"
            title="No conversations found"
            description="Start by creating a new conversation request."
            actions={
              <button
                type="button"
                className="ms-btn ms-btn--primary ms-btn--sm"
                onClick={onNewChat}
              >
                <span className="material-symbols-outlined">add_comment</span>
                New Chat
              </button>
            }
          />
        )}
      </div>
    </aside>
  );
}
