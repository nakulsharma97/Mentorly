import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import client from "../../../../api/client";
import ModalShell from "./ModalShell";
import LqrButton from "./LqrButton";
import { avatarInitial, mentorName } from "./requestsConfig";

/**
 * RequestPaymentModal — completes payment for an accepted custom session via
 * Razorpay. Mirrors the booking payment flow: finds the booking, creates a
 * payment intent, then opens the Razorpay checkout.
 */
export default function RequestPaymentModal({ request, onClose, onPaid }) {
  const mentor = request.mentor || {};
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handlePay = async () => {
    setSending(true);
    setError("");
    try {
      // 1. Find the booking for this session
      const bookingsRes = await client.get("/api/v1/bookings");
      // Paginated response — unwrap .content from the Page object.
      const allBookings = bookingsRes?.data?.data?.content || [];
      const booking = allBookings.find(
        (b) =>
          String(b.session?.id) === String(request.sessionId) ||
          String(b.sessionId) === String(request.sessionId),
      );
      if (!booking) {
        setError("Could not find booking. Please contact support.");
        return;
      }

      // 2. Get the price from the session
      let priceAmount = 0;
      try {
        const sessionRes = await client.get(`/api/v1/sessions/${request.sessionId}`);
        priceAmount = Number(sessionRes?.data?.data?.priceAmount || 0);
      } catch {
        priceAmount = 0;
      }

      if (priceAmount <= 0) {
        setSuccess("This session is free — no payment needed. You can view it in your sessions.");
        return;
      }

      // 3. Create payment intent
      const idempotencyKey = `request_pay_${request.id}_${Date.now()}`;
      const paymentRes = await client.post(
        "/api/v1/payments/intent",
        { bookingId: booking.id, amount: priceAmount, gateway: "razorpay" },
        { headers: { "Idempotency-Key": idempotencyKey } },
      );
      const payment = paymentRes?.data?.data;

      if (!payment?.gatewayResponse?.id) {
        setError("Payment gateway not available. Please try again.");
        return;
      }

      // 4. Fail closed on missing/placeholder Razorpay key
      const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID || "";
      if (!razorpayKeyId || razorpayKeyId === "rzp_test_xxxxxxxxxxxx") {
        setError("Online payments are not configured yet. Please try again later or contact support.");
        return;
      }

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.async = true;
          script.onload = resolve;
          script.onerror = () => reject(new Error("Failed to load Razorpay"));
          document.body.appendChild(script);
        });
      }

      const rzpOptions = {
        key: razorpayKeyId,
        amount: payment.gatewayResponse.amount || priceAmount * 100,
        currency: payment.gatewayResponse.currency || "INR",
        name: "Mentorly",
        description: `Payment for session with ${mentorName(mentor)}`,
        order_id: payment.gatewayResponse.id,
        theme: { color: "#0f766e" },
        handler: async (response) => {
          try {
            await client.post("/api/v1/payments/verify", {
              paymentId: payment.id,
              gatewayPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              extraParams: { razorpay_order_id: response.razorpay_order_id },
            });
            setSuccess("Payment successful! Your session is confirmed.");
          } catch {
            setSuccess("Booking confirmed! Payment verification may be pending.");
          }
          onPaid?.();
        },
        modal: { confirm_close: true },
      };

      const rzp = new window.Razorpay(rzpOptions);
      rzp.on("payment.failed", (resp) => {
        setError(resp.error?.description || "Payment failed. Please try again.");
      });
      rzp.open();
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Payment could not be processed.";
      setError(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell
      title="Complete Payment"
      subtitle="Secure checkout with Razorpay"
      closeLabel="Close payment"
      onClose={onClose}
      busy={sending}
      footer={
        <>
          <LqrButton variant="ghost" onClick={onClose} disabled={sending}>
            Cancel
          </LqrButton>
          {!success && (
            <LqrButton
              variant="primary"
              icon={sending ? Loader2 : CreditCard}
              disabled={sending}
              onClick={handlePay}
            >
              {sending ? "Processing…" : "Pay Now"}
            </LqrButton>
          )}
          {success && (
            <LqrButton variant="secondary" icon={Lock} to="/learner/sessions">
              Go to Sessions
            </LqrButton>
          )}
        </>
      }
    >
      <div className="lqr-modal__mentor">
        <span className="lqr-modal__mentor-avatar">
          {mentor.profileImageUrl ? (
            <img src={mentor.profileImageUrl} alt="" />
          ) : (
            avatarInitial(mentorName(mentor))
          )}
        </span>
        <div>
          <p className="lqr-modal__mentor-name">{mentorName(mentor)}</p>
          <p className="lqr-modal__mentor-meta">Custom session request</p>
        </div>
        <ShieldCheck size={20} style={{ marginLeft: "auto", color: "var(--lqr-success)" }} aria-hidden="true" />
      </div>

      {request.subject && (
        <div className="lqr-note lqr-note--info">
          <strong>Topic</strong>
          {request.subject}
        </div>
      )}

      {success ? (
        <div className="lqr-pay-note lqr-pay-note--success">
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span>{success}</span>
        </div>
      ) : (
        <>
          <p className="lqr-detail__v" style={{ fontSize: "0.86rem", fontWeight: 500, lineHeight: 1.6 }}>
            Complete your payment to confirm the session. Your payment is secure and protected.
          </p>
          {error && (
            <div className="lqr-pay-note lqr-pay-note--error">
              <X size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{error}</span>
            </div>
          )}
        </>
      )}
    </ModalShell>
  );
}
