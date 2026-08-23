import { useState } from "react";

const FAQ_MAX_HEIGHT = 480;

const faqItems = [
  {
    q: "How does Mentorly work?",
    a: "Mentorly connects learners with verified mentors for live, one-on-one sessions. Browse mentor profiles, find someone whose expertise matches your goals, book a session, and meet via the platform \u2014 with message context, session links, and follow-up tools all in one place."
  },
  {
    q: "How are mentors verified?",
    a: "Every mentor profile goes through a manual verification process. We review professional background, skill endorsements, and teaching history before approving a mentor to offer sessions on the platform. Verified mentors are clearly marked on their profiles."
  },
  {
    q: "What payment methods are supported?",
    a: "We support multiple payment methods including credit/debit cards (via Stripe), UPI (via Razorpay), and PayPal. All prices are in Indian Rupees (\u20b9). Payments are held in escrow and released to mentors after the session is completed to ensure trust on both sides."
  },
  {
    q: "Can I get a refund if I\u2019m not satisfied?",
    a: "Yes. If a session doesn\u2019t meet expectations, you can request a refund within 48 hours. Our admin team reviews each case and can issue a full or partial refund. Funds are held in escrow, so refunds are processed quickly."
  },
  {
    q: "How do I become a mentor?",
    a: "Sign up as a mentor, complete your professional profile with your skills, experience, and certifications, and submit it for verification. Once approved, you can create sessions, set your availability, and start accepting bookings from learners."
  },
  {
    q: "Are sessions recorded?",
    a: "By default, sessions are not recorded. However, mentors and learners can mutually agree to record a session. All communication and shared resources remain accessible through the platform after the session ends."
  }
];

export default function LandingFAQ() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <section className="landing-faq" id="faq">
      <div className="landing-section-heading landing-reveal">
        <span className="landing-kicker">Questions?</span>
        <h2>Frequently asked questions.</h2>
        <p>
          Everything you need to know about Mentorly. Still have questions?
          Reach out to our support team.
        </p>
      </div>
      <div className="landing-faq-grid">
        {faqItems.map((item, idx) => {
          const isOpen = openFaq === idx;
          return (
            <article
              key={idx}
              className={`landing-faq-item${isOpen ? " is-open" : ""}`}
            >
              <button
                className="landing-faq-question"
                type="button"
                onClick={() => setOpenFaq((prev) => (prev === idx ? null : idx))}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${idx}`}
              >
                <span>{item.q}</span>
                <span className="landing-faq-question-icon" aria-hidden="true">
                  {isOpen ? "\u2212" : "+"}
                </span>
              </button>
              <div
                id={`faq-answer-${idx}`}
                className={`landing-faq-answer${isOpen ? " is-open" : ""}`}
                role="region"
                style={{
                  maxHeight: isOpen ? FAQ_MAX_HEIGHT : 0,
                  opacity: isOpen ? 1 : 0,
                  overflow: "hidden",
                  transition:
                    "max-height 0.35s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.3s ease",
                }}
              >
                <p>{item.a}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
