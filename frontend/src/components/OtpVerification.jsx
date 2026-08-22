import React, { useState, useRef, useEffect, useCallback } from "react";
import "./OtpVerification.css";

/**
 * OTP Verification component for email verification during signup.
 * Shows 6 input boxes for OTP entry with auto-focus and paste support.
 */
export default function OtpVerification({
  email,
  onVerify,
  onResend,
  onChangeEmail,
  loading,
  error,
}) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef([]);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown((prev) => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendCooldown]);

  // Handle OTP input change
  const handleChange = (index, value) => {
    // Only allow digits
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];

    // Handle paste (multiple characters)
    if (value.length > 1) {
      const pastedChars = value.slice(0, 6).split("");
      pastedChars.forEach((char, i) => {
        if (index + i < 6) {
          newOtp[index + i] = char;
        }
      });
      setOtp(newOtp);

      // Focus next empty input or last input
      const nextEmptyIndex = newOtp.findIndex((val) => val === "");
      const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
      inputRefs.current[focusIndex]?.focus();

      // Auto-submit if all fields filled
      if (newOtp.every((val) => val !== "")) {
        onVerify(newOtp.join(""));
      }
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all fields filled
    if (newOtp.every((val) => val !== "")) {
      onVerify(newOtp.join(""));
    }
  };

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = "";
      setOtp(newOtp);
    }
  };

  // Handle paste
  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pastedData) {
      const newOtp = pastedData.split("").concat(Array(6).fill("")).slice(0, 6);
      setOtp(newOtp);

      // Focus next empty or last
      const nextEmptyIndex = newOtp.findIndex((val) => val === "");
      const focusIndex = nextEmptyIndex === -1 ? 5 : nextEmptyIndex;
      inputRefs.current[focusIndex]?.focus();

      // Auto-submit if all fields filled
      if (newOtp.every((val) => val !== "")) {
        onVerify(newOtp.join(""));
      }
    }
  };

  // Handle resend
  const handleResend = useCallback(() => {
    if (canResend) {
      setResendCooldown(60);
      setCanResend(false);
      onResend();
    }
  }, [canResend, onResend]);

  // Format time remaining
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Mask email for display
  const maskEmail = (email) => {
    if (!email) return "";
    const [username, domain] = email.split("@");
    if (username.length <= 2) return email;
    return `${username[0]}${"*".repeat(username.length - 2)}${username[username.length - 1]}@${domain}`;
  };

  return (
    <div className="otp-verification">
      <div className="otp-header">
        <h2>Verify Your Email</h2>
        <p>
          We sent a 6-digit verification code to
          <br />
          <strong>{maskEmail(email)}</strong>
        </p>
      </div>

      <div className="otp-input-container">
        {otp.map((digit, index) => (
          <input
            key={index}
            ref={(el) => (inputRefs.current[index] = el)}
            type="text"
            inputMode="numeric"
            maxLength={6}
            className={`otp-input ${digit ? "filled" : ""} ${error ? "error" : ""}`}
            value={digit}
            onChange={(e) => handleChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            disabled={loading}
            aria-label={`Digit ${index + 1}`}
          />
        ))}
      </div>

      {error && <div className="otp-error">{error}</div>}

      <div className="otp-timer">
        {resendCooldown > 0 ? (
          <span>Code expires in {formatTime(resendCooldown)}</span>
        ) : (
          <span>Code expired</span>
        )}
      </div>

      <button
        type="button"
        className="otp-verify-btn"
        onClick={() => onVerify(otp.join(""))}
        disabled={loading || otp.some((digit) => !digit)}
      >
        {loading ? "Verifying..." : "Verify Email"}
      </button>

      <div className="otp-actions">
        <button
          type="button"
          className="otp-resend-btn"
          onClick={handleResend}
          disabled={!canResend || loading}
        >
          {canResend ? "Resend Code" : `Resend in ${formatTime(resendCooldown)}`}
        </button>

        <button
          type="button"
          className="otp-change-email-btn"
          onClick={onChangeEmail}
          disabled={loading}
        >
          Change Email
        </button>
      </div>
    </div>
  );
}
