export default function MaintenancePage({ isAdmin = false }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "40px 20px",
        textAlign: "center",
        fontFamily: "'Inter', 'Manrope', sans-serif",
        background: isAdmin
          ? "linear-gradient(135deg, #0f172a 0%, #155e75 100%)"
          : "linear-gradient(135deg, #0f172a 0%, #1a1a2e 55%, #16213e 100%)",
        color: "#fff",
      }}
    >
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: "linear-gradient(135deg, #f59e0b, #d97706)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          marginBottom: 24,
          boxShadow: "0 12px 32px -8px rgba(245, 158, 11, 0.4)",
        }}
      >
        🔧
      </div>

      <h1
        style={{
          margin: 0,
          fontSize: "clamp(1.6rem, 5vw, 2.6rem)",
          fontWeight: 800,
          letterSpacing: "-0.03em",
          fontFamily: "'Sora', 'Manrope', sans-serif",
        }}
      >
        Under Maintenance
      </h1>

      <p
        style={{
          maxWidth: 480,
          margin: "16px 0 0",
          fontSize: "1.05rem",
          lineHeight: 1.7,
          opacity: 0.8,
        }}
      >
        The Mentorly platform is currently undergoing scheduled maintenance.
        We&rsquo;ll be back shortly with improvements.
      </p>

      <div
        style={{
          display: "flex",
          gap: 12,
          marginTop: 32,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            background: "rgba(255,255,255,0.1)",
            fontSize: "0.9rem",
            fontWeight: 600,
            backdropFilter: "blur(8px)",
          }}
        >
          ⏳ Expected downtime: <strong>~1 hour</strong>
        </div>
      </div>

      <div
        style={{
          marginTop: 48,
          padding: "20px 28px",
          borderRadius: 16,
          background: "rgba(255,255,255,0.06)",
          maxWidth: 500,
          fontSize: "0.85rem",
          opacity: 0.7,
          lineHeight: 1.6,
        }}
      >
        {isAdmin
          ? "You are logged in as an administrator. You can continue using the admin panel to manage the platform."
          : "Only administrators can access the platform during maintenance. If you are an admin, please log in to access the admin panel."}
      </div>

      {/* Animated pulse dots */}
      <div style={{ display: "flex", gap: 8, marginTop: 48 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#f59e0b",
              animation: `mp-pulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @keyframes mp-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}
