import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Star, XCircle } from "lucide-react";
import client from "../api/client";
import HeroSection from "../components/HeroSection";
import {
  AuBadge,
  AuEmpty,
  AuModal,
  AuPagination,
  AuSkeleton,
  AuTable,
  AuToolbar,
  errorMessage,
  formatDate,
  toneFor,
} from "../modules/admin/ui";

const TABS = [
  { value: "PENDING", label: "Pending" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

const PAGE_SIZE = 20;

/**
 * Admin moderation for platform-wide site reviews ("Share your review").
 * Tabbed by status; approve/reject open a modal with an optional note the
 * reviewer can see. Every action is audit-logged server-side.
 */
export default function AdminSiteReviewsPage({ notify }) {
  const [status, setStatus] = useState("PENDING");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [totalElements, setTotalElements] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modal state — { id, action: "approve" | "reject", review }
  const [dialog, setDialog] = useState(null);
  const [note, setNote] = useState("");
  const [acting, setActing] = useState(false);

  const loadReviews = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", status);
      params.set("page", String(page));
      params.set("size", String(PAGE_SIZE));
      const res = await client.get(`/api/v1/admin/site-reviews?${params}`);
      const data = res?.data?.data;
      setItems(data?.content || []);
      setTotalPages(data?.totalPages || 0);
      setTotalElements(data?.totalElements || 0);
    } catch (err) {
      notify?.({
        type: "error",
        title: "Site reviews unavailable",
        message: errorMessage(err, "Could not load site reviews."),
      });
    } finally {
      setLoading(false);
    }
  }, [notify, status, page]);

  useEffect(() => {
    setPage(0);
  }, [status]);
  useEffect(() => {
    loadReviews();
  }, [loadReviews]);

  const openDialog = (review, action) => {
    setDialog({ id: review.id, action, review });
    setNote(review.adminNote || "");
  };

  const confirmAction = async () => {
    if (!dialog || acting) return;
    setActing(true);
    try {
      await client.patch(
        `/api/v1/admin/site-reviews/${dialog.id}/${dialog.action}`,
        { adminNote: note.trim() || null },
      );
      notify?.({
        type: "success",
        title: dialog.action === "approve" ? "Review approved" : "Review rejected",
        message: `Review by ${dialog.review?.reviewerName || "user"} ${
          dialog.action === "approve"
            ? "is now visible on the landing page."
            : "has been hidden."
        }`,
      });
      setDialog(null);
      setNote("");
      loadReviews();
    } catch (err) {
      notify?.({
        type: "error",
        title: "Action failed",
        message: errorMessage(err, "Could not update the review."),
      });
    } finally {
      setActing(false);
    }
  };

  const term = search.trim().toLowerCase();
  const rows = term
    ? items.filter(
        (r) =>
          (r.reviewerName || "").toLowerCase().includes(term) ||
          (r.title || "").toLowerCase().includes(term) ||
          (r.comment || "").toLowerCase().includes(term),
      )
    : items;

  return (
    <div className="au au-page">
      <div className="au-inner">
        <HeroSection
          className="hero-section--compact"
          badge="MODERATION"
          title="Site Reviews"
          subtitle="Moderate the platform-wide reviews submitted from the “Share your review” page. Approved reviews appear in the landing page testimonial section."
          illustration={
            <div className="hero-section__watermark" aria-hidden="true">
              <span className="material-symbols-outlined">rate_review</span>
            </div>
          }
        />

        {/* Status tabs */}
        <div className="admin-tabs" role="tablist" aria-label="Filter site reviews by status">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              className={`admin-tab${status === tab.value ? " admin-tab--active" : ""}`}
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <AuToolbar
          search={search}
          onSearchChange={setSearch}
          placeholder="Search by reviewer or text..."
          count={`${totalElements} ${status.toLowerCase()}`}
        />

        {loading ? (
          <AuSkeleton rows={5} label="Loading site reviews" />
        ) : rows.length === 0 ? (
          <div className="au-table-card">
            <AuEmpty
              icon={Star}
              title={`No ${status.toLowerCase()} site reviews`}
              description={
                status === "PENDING"
                  ? "New reviews submitted by learners and mentors will appear here for moderation."
                  : `There are no site reviews with the ${status.toLowerCase()} status.`
              }
            />
          </div>
        ) : (
          <>
            <AuTable
              columns={[
                { key: "reviewer", label: "Reviewer" },
                { key: "rating", label: "Rating" },
                { key: "review", label: "Review" },
                { key: "status", label: "Status" },
                { key: "created", label: "Submitted" },
                { key: "actions", label: "Actions", style: { textAlign: "right" } },
              ]}
              busy={loading}
              minWidth={980}
            >
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.reviewerName || "Unknown"}</strong>
                    <br />
                    <AuBadge tone={toneFor(r.reviewerRole)}>
                      {r.reviewerRole || "—"}
                    </AuBadge>
                  </td>
                  <td>
                    <span
                      aria-label={`${r.rating} out of 5 stars`}
                      style={{ color: "#f59e0b", fontVariantNumeric: "tabular-nums" }}
                    >
                      {"★".repeat(r.rating || 0)}
                      <span style={{ color: "var(--au-text-3)" }}>
                        {"★".repeat(5 - (r.rating || 0))}
                      </span>
                    </span>
                  </td>
                  <td style={{ maxWidth: 340 }}>
                    {r.title && <strong>{r.title} — </strong>}
                    <span style={{ color: "var(--au-text-2)" }}>
                      {(r.comment || "").length > 160
                        ? `${r.comment.slice(0, 160)}…`
                        : r.comment}
                    </span>
                    {r.adminNote && (
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 12,
                          color: "var(--au-text-3)",
                        }}
                      >
                        Note: {r.adminNote}
                      </div>
                    )}
                  </td>
                  <td>
                    <AuBadge tone={toneFor(r.status)} dot>
                      {r.status}
                    </AuBadge>
                  </td>
                  <td style={{ fontSize: 13, color: "var(--au-text-2)" }}>
                    {formatDate(r.createdAt)}
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        justifyContent: "flex-end",
                      }}
                    >
                      {r.status !== "APPROVED" && (
                        <button
                          type="button"
                          className="au-btn au-btn--primary au-btn--sm"
                          onClick={() => openDialog(r, "approve")}
                        >
                          <CheckCircle2 size={15} /> Approve
                        </button>
                      )}
                      {r.status !== "REJECTED" && (
                        <button
                          type="button"
                          className="au-btn au-btn--danger au-btn--sm"
                          onClick={() => openDialog(r, "reject")}
                        >
                          <XCircle size={15} /> Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </AuTable>
            <AuPagination
              page={page}
              totalPages={totalPages}
              totalElements={totalElements}
              pageSize={PAGE_SIZE}
              onChange={setPage}
              loading={loading}
            />
          </>
        )}
      </div>

      {dialog && (
        <AuModal
          open
          icon={dialog.action === "approve" ? CheckCircle2 : XCircle}
          tone={dialog.action === "approve" ? "primary" : "danger"}
          title={
            dialog.action === "approve"
              ? "Approve this review?"
              : "Reject this review?"
          }
          description={
            dialog.action === "approve"
              ? "It will become visible in the landing page testimonials right away."
              : "It will stay hidden from the landing page. The reviewer can edit and resubmit."
          }
          confirmLabel={dialog.action === "approve" ? "Approve" : "Reject"}
          busy={acting}
          onClose={() => {
            setDialog(null);
            setNote("");
          }}
          onConfirm={confirmAction}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <blockquote
              style={{
                margin: 0,
                padding: "10px 12px",
                borderRadius: 10,
                background: "var(--au-hover)",
                border: "1px solid var(--au-border)",
                fontSize: 13,
                color: "var(--au-text-2)",
              }}
            >
              {dialog.review?.title ? <strong>{dialog.review.title} — </strong> : null}
              {dialog.review?.comment}
            </blockquote>
            <label
              htmlFor="sr-admin-note"
              style={{ fontSize: 13, fontWeight: 700 }}
            >
              Note for the reviewer{" "}
              <span style={{ fontWeight: 500, color: "var(--au-text-3)" }}>
                (optional)
              </span>
            </label>
            <textarea
              id="sr-admin-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please remove promotional links before we can publish this."
              style={{
                width: "100%",
                resize: "vertical",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid var(--au-border)",
                background: "var(--au-bg, var(--au-hover))",
                color: "inherit",
                font: "inherit",
                fontSize: 13,
              }}
            />
          </div>
        </AuModal>
      )}
    </div>
  );
}
