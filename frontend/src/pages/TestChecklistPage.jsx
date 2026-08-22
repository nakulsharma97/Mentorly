import React, { useState } from "react";

export default function TestChecklistPage() {
  const checklist = [
    "User Signup",
    "User Login",
    "Profile Update",
    "Search Mentors",
    "Book Session",
    "Wallet Payment",
    "Send Message",
    "Receive Notifications",
    "Leave Review",
    "Mentor Dashboard",
    "Analytics Dashboard"
  ];

  const [checkedItems, setCheckedItems] = useState({});

  const toggleCheck = (item) => {
    setCheckedItems((prev) => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  return (
    <div className="min-h-screen" style={styles.container}>
      <h1 style={styles.heading}>Mentorly Testing Checklist</h1>

      {checklist.map((item) => (
        <div key={item} style={styles.card}>
          <label style={styles.label}>
            <input
              type="checkbox"
              checked={checkedItems[item] || false}
              onChange={() => toggleCheck(item)}
            />
            <span style={{ marginLeft: "10px" }}>{item}</span>
          </label>
        </div>
      ))}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "700px",
    margin: "40px auto",
    padding: "20px"
  },
  heading: {
    fontSize: "28px",
    marginBottom: "20px",
    color: "var(--text)"
  },
  card: {
    background: "var(--card-bg, #fff)",
    padding: "15px",
    borderRadius: "10px",
    marginBottom: "12px",
    boxShadow: "var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.1))",
    border: "1px solid var(--card-border, #dbe4ea)"
  },
  label: {
    display: "flex",
    alignItems: "center",
    fontSize: "18px",
    color: "var(--text)"
  }
};