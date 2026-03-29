/**
 * My Profile — self-service profile page for all roles.
 *
 * Sections:
 *   1. Profile card  — avatar, name, email, role, company, member since
 *   2. Edit name     — inline update
 *   3. Change password — 3-step OTP flow:
 *        Step 1 → Request OTP (sends to registered email)
 *        Step 2 → Enter 6-digit code
 *        Step 3 → Enter + confirm new password
 */

import React, { useState, useEffect } from "react";
import { PageWithSidebar, SectionCard } from "./Layout";
import { profileAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  User, Mail, Shield, Building2, Calendar,
  KeyRound, Loader2, CheckCircle2, AlertCircle,
  Eye, EyeOff, Send,
} from "lucide-react";

// ─── Role display helpers ─────────────────────────────────────────────────────

const ROLE_LABEL = {
  admin:           "Admin",
  reviewer:        "Reviewer",
  ethics_reviewer: "Ethics Reviewer",
  publisher:       "Publisher",
};

const ROLE_COLOR = {
  admin:           { bg: "var(--color-accent-subtle)", text: "var(--color-accent-text)", dot: "var(--color-accent)" },
  reviewer:        { bg: "#eef2ff",                    text: "#3730a3",                  dot: "#6366f1" },
  ethics_reviewer: { bg: "#fff7ed",                    text: "#9a3412",                  dot: "#f97316" },
  publisher:       { bg: "#fdf4ff",                    text: "#6b21a8",                  dot: "#a855f7" },
};

const AVATAR_BG = {
  admin:           "var(--color-accent)",
  reviewer:        "#6366f1",
  ethics_reviewer: "#f97316",
  publisher:       "#a855f7",
};

// ─── Tiny shared sub-components ───────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid var(--color-card-border)" }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "var(--color-input-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={15} style={{ color: "var(--color-sidebar-text)" }} />
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: "0.68rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--color-sidebar-text)", margin: 0 }}>{label}</p>
        <p style={{ fontSize: "0.9rem", color: "var(--color-input-text)", fontWeight: 500, margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</p>
      </div>
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, id }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "9px 38px 9px 12px",
          border: "1px solid var(--color-input-border)",
          borderRadius: "var(--radius-input)",
          backgroundColor: "var(--color-input-bg)",
          color: "var(--color-input-text)",
          fontSize: "0.875rem",
          outline: "none",
        }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--color-sidebar-text)", display: "flex" }}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

function Alert({ type, message }) {
  const isError = type === "error";
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 8,
      padding: "10px 12px", borderRadius: 8, marginTop: 12,
      backgroundColor: isError ? "#fef2f2" : "var(--color-accent-subtle)",
      border: `1px solid ${isError ? "#fecaca" : "var(--color-accent)"}`,
      opacity: 0.9,
    }}>
      {isError
        ? <AlertCircle size={15} style={{ color: "#ef4444", flexShrink: 0, marginTop: 1 }} />
        : <CheckCircle2 size={15} style={{ color: "var(--color-accent)", flexShrink: 0, marginTop: 1 }} />
      }
      <p style={{ fontSize: "0.82rem", color: isError ? "#b91c1c" : "var(--color-accent-text)", margin: 0, lineHeight: 1.5 }}>{message}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MyProfile() {
  const { role, updateUser } = useAuth();

  const [profile, setProfile]     = useState(null);
  const [loadErr, setLoadErr]      = useState(null);

  // Edit name state
  const [editName, setEditName]    = useState("");
  const [nameLoading, setNL]       = useState(false);
  const [nameMsg, setNameMsg]      = useState(null); // { type, text }

  // Change password state  — step: "idle" | "sending" | "otp" | "password" | "done"
  const [pwStep, setPwStep]        = useState("idle");
  const [maskedEmail, setMasked]   = useState("");
  const [otp, setOtp]              = useState("");
  const [newPw, setNewPw]          = useState("");
  const [confirmPw, setConfirmPw]  = useState("");
  const [pwLoading, setPwLoading]  = useState(false);
  const [pwMsg, setPwMsg]          = useState(null);  // { type, text }

  // ── Load profile ────────────────────────────────────────────────────────────
  useEffect(() => {
    profileAPI.getMe()
      .then((data) => {
        setProfile(data);
        setEditName(data.full_name);
      })
      .catch((e) => setLoadErr(e.message));
  }, []);

  // ── Edit name ───────────────────────────────────────────────────────────────
  async function handleSaveName() {
    if (!editName.trim() || editName.trim() === profile.full_name) return;
    setNL(true);
    setNameMsg(null);
    try {
      const updated = await profileAPI.updateMe({ full_name: editName.trim() });
      setProfile(updated);
      setEditName(updated.full_name);
      updateUser({ fullName: updated.full_name });
      setNameMsg({ type: "success", text: "Name updated successfully." });
    } catch (e) {
      setNameMsg({ type: "error", text: e.message });
    } finally {
      setNL(false);
    }
  }

  // ── OTP request ─────────────────────────────────────────────────────────────
  async function handleRequestOtp() {
    setPwLoading(true);
    setPwMsg(null);
    setPwStep("sending");
    try {
      const res = await profileAPI.requestOtp();
      setMasked(res.masked_email);
      setPwStep("otp");
    } catch (e) {
      setPwMsg({ type: "error", text: e.message });
      setPwStep("idle");
    } finally {
      setPwLoading(false);
    }
  }

  // ── Verify OTP ──────────────────────────────────────────────────────────────
  function handleVerifyOtp() {
    if (otp.length !== 6) {
      setPwMsg({ type: "error", text: "Please enter the full 6-digit code." });
      return;
    }
    setPwMsg(null);
    setPwStep("password");
  }

  // ── Change password ──────────────────────────────────────────────────────────
  async function handleChangePassword() {
    if (newPw.length < 8) {
      setPwMsg({ type: "error", text: "Password must be at least 8 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwMsg({ type: "error", text: "Passwords do not match." });
      return;
    }
    setPwLoading(true);
    setPwMsg(null);
    try {
      await profileAPI.changePassword(otp, newPw);
      setPwStep("done");
      setPwMsg({ type: "success", text: "Password changed successfully! Your next login will use the new password." });
    } catch (e) {
      setPwMsg({ type: "error", text: e.message });
      // If OTP was invalid, rewind to OTP entry
      if (e.message.toLowerCase().includes("invalid") || e.message.toLowerCase().includes("expired")) {
        setPwStep("otp");
        setOtp("");
      }
    } finally {
      setPwLoading(false);
    }
  }

  function resetPwFlow() {
    setPwStep("idle");
    setOtp("");
    setNewPw("");
    setConfirmPw("");
    setPwMsg(null);
    setMasked("");
  }

  // ── Avatar ──────────────────────────────────────────────────────────────────
  const initials = (profile?.full_name || "?")
    .split(" ").slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  const roleColors  = ROLE_COLOR[role] || ROLE_COLOR.admin;
  const avatarColor = AVATAR_BG[role]  || AVATAR_BG.admin;

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loadErr) {
    return (
      <PageWithSidebar>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#ef4444", marginTop: 32 }}>
          <AlertCircle size={18} />
          <p>Failed to load profile: {loadErr}</p>
        </div>
      </PageWithSidebar>
    );
  }

  if (!profile) {
    return (
      <PageWithSidebar>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 40, color: "var(--color-sidebar-text)" }}>
          <Loader2 size={20} className="animate-spin" />
          <p>Loading profile…</p>
        </div>
      </PageWithSidebar>
    );
  }

  return (
    <PageWithSidebar>
      <h1 className="page-header__title">My Profile</h1>
      <p style={{ fontSize: "0.875rem", color: "var(--color-sidebar-text)", marginTop: 4, marginBottom: 28 }}>
        Manage your personal information and account security.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>

        {/* ── Left: Identity card ───────────────────────────────────────── */}
        <div className="page-card" style={{ padding: 24, textAlign: "center" }}>
          {/* Avatar */}
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            backgroundColor: avatarColor, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.75rem", fontWeight: 700, margin: "0 auto 16px",
            letterSpacing: "0.02em",
          }}>
            {initials}
          </div>

          {/* Name */}
          <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-input-text)", margin: "0 0 4px" }}>
            {profile.full_name}
          </p>

          {/* Role badge */}
          <span style={{
            display: "inline-block", padding: "3px 10px", borderRadius: 999,
            fontSize: "0.72rem", fontWeight: 600,
            backgroundColor: roleColors.bg, color: roleColors.text,
            marginBottom: 20,
          }}>
            <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", backgroundColor: roleColors.dot, marginRight: 5, verticalAlign: "middle" }} />
            {ROLE_LABEL[role] || role}
          </span>

          {/* Info rows */}
          <div style={{ textAlign: "left" }}>
            <InfoRow icon={Mail}      label="Email"       value={profile.email} />
            <InfoRow icon={Building2} label="Company"     value={profile.company_name || "—"} />
            <InfoRow icon={Calendar}  label="Member Since" value={new Date(profile.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} />
            <div style={{ borderBottom: "none" }}>
              <InfoRow icon={Shield} label="Account Status" value={profile.is_active ? "Active" : "Inactive"} />
            </div>
          </div>
        </div>

        {/* ── Right: Edit sections ──────────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Display Name */}
          <SectionCard
            title="Display Name"
            subtitle="Update how your name appears across the platform."
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-input-text)" }}>
                Full Name
              </label>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setNameMsg(null); }}
                  placeholder="Your full name"
                  style={{
                    flex: 1, padding: "9px 12px",
                    border: "1px solid var(--color-input-border)",
                    borderRadius: "var(--radius-input)",
                    backgroundColor: "var(--color-input-bg)",
                    color: "var(--color-input-text)",
                    fontSize: "0.875rem", outline: "none",
                  }}
                />
                <button
                  onClick={handleSaveName}
                  disabled={nameLoading || !editName.trim() || editName.trim() === profile.full_name}
                  className="btn--accent"
                  style={{ whiteSpace: "nowrap", minWidth: 90, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  {nameLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                  Save
                </button>
              </div>
              {nameMsg && <Alert type={nameMsg.type} message={nameMsg.text} />}
            </div>
          </SectionCard>

          {/* Email — read-only */}
          <SectionCard
            title="Email Address"
            subtitle="Your email is used to log in and receive notifications. Contact your admin to change it."
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 12px", borderRadius: "var(--radius-input)",
              border: "1px solid var(--color-input-border)",
              backgroundColor: "var(--color-input-bg)",
            }}>
              <Mail size={15} style={{ color: "var(--color-sidebar-text)", flexShrink: 0 }} />
              <span style={{ fontSize: "0.875rem", color: "var(--color-sidebar-text)" }}>{profile.email}</span>
              <span style={{ marginLeft: "auto", fontSize: "0.72rem", backgroundColor: "var(--color-card-border)", color: "var(--color-sidebar-text)", borderRadius: 4, padding: "2px 6px" }}>Read-only</span>
            </div>
          </SectionCard>

          {/* Change Password */}
          <SectionCard
            title="Change Password"
            subtitle="A verification code will be sent to your registered email address."
          >
            {pwStep === "idle" && (
              <div>
                <p style={{ fontSize: "0.85rem", color: "var(--color-sidebar-text)", marginBottom: 16, lineHeight: 1.6 }}>
                  To change your password, we'll send a 6-digit verification code to{" "}
                  <strong style={{ color: "var(--color-input-text)" }}>{profile.email}</strong>.
                </p>
                <button
                  onClick={handleRequestOtp}
                  disabled={pwLoading}
                  className="btn--accent"
                  style={{ display: "flex", alignItems: "center", gap: 8 }}
                >
                  <Send size={14} />
                  Send Verification Code
                </button>
                {pwMsg && <Alert type={pwMsg.type} message={pwMsg.text} />}
              </div>
            )}

            {pwStep === "sending" && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--color-sidebar-text)", padding: "8px 0" }}>
                <Loader2 size={18} className="animate-spin" />
                <p style={{ fontSize: "0.875rem" }}>Sending verification code…</p>
              </div>
            )}

            {pwStep === "otp" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: "0.85rem", color: "var(--color-sidebar-text)", margin: 0, lineHeight: 1.6 }}>
                  A 6-digit code was sent to <strong style={{ color: "var(--color-input-text)" }}>{maskedEmail}</strong>.
                  Enter it below.
                </p>

                {/* OTP boxes */}
                <OtpInput value={otp} onChange={setOtp} />

                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button
                    onClick={handleVerifyOtp}
                    disabled={otp.length !== 6}
                    className="btn--accent"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <KeyRound size={14} />
                    Verify Code
                  </button>
                  <button onClick={resetPwFlow} className="btn--ghost">Cancel</button>
                  <button
                    onClick={handleRequestOtp}
                    disabled={pwLoading}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.82rem", color: "var(--color-accent)", textDecoration: "underline", padding: 0 }}
                  >
                    Resend code
                  </button>
                </div>
                {pwMsg && <Alert type={pwMsg.type} message={pwMsg.text} />}
              </div>
            )}

            {pwStep === "password" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <p style={{ fontSize: "0.85rem", color: "var(--color-sidebar-text)", margin: 0 }}>
                  Code verified. Enter your new password.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-input-text)" }}>New Password</label>
                  <PasswordInput value={newPw} onChange={setNewPw} placeholder="Min. 8 characters" id="new-pw" />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--color-input-text)" }}>Confirm New Password</label>
                  <PasswordInput value={confirmPw} onChange={setConfirmPw} placeholder="Repeat new password" id="confirm-pw" />
                </div>

                {/* Strength hint */}
                {newPw.length > 0 && (
                  <PasswordStrength password={newPw} />
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={handleChangePassword}
                    disabled={pwLoading || !newPw || !confirmPw}
                    className="btn--accent"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {pwLoading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                    Change Password
                  </button>
                  <button onClick={resetPwFlow} className="btn--ghost">Cancel</button>
                </div>
                {pwMsg && <Alert type={pwMsg.type} message={pwMsg.text} />}
              </div>
            )}

            {pwStep === "done" && (
              <div>
                {pwMsg && <Alert type={pwMsg.type} message={pwMsg.text} />}
                <button onClick={resetPwFlow} className="btn--ghost" style={{ marginTop: 14 }}>
                  Change Password Again
                </button>
              </div>
            )}
          </SectionCard>

        </div>
      </div>
    </PageWithSidebar>
  );
}

// ─── OTP 6-box input ──────────────────────────────────────────────────────────

function OtpInput({ value, onChange }) {
  const boxes = 6;
  const digits = value.split("").concat(Array(boxes).fill("")).slice(0, boxes);

  function handleKey(e, idx) {
    const key = e.key;
    if (key === "Backspace") {
      const next = value.slice(0, idx) + value.slice(idx + 1);
      onChange(next);
      if (idx > 0) document.getElementById(`otp-${idx - 1}`)?.focus();
      return;
    }
    if (!/^\d$/.test(key)) return;
    const next = (value.slice(0, idx) + key + value.slice(idx + 1)).slice(0, boxes);
    onChange(next);
    if (idx < boxes - 1) document.getElementById(`otp-${idx + 1}`)?.focus();
  }

  function handlePaste(e) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, boxes);
    onChange(pasted);
    e.preventDefault();
    document.getElementById(`otp-${Math.min(pasted.length, boxes - 1)}`)?.focus();
  }

  return (
    <div style={{ display: "flex", gap: 8 }}>
      {digits.map((d, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          onChange={() => {}}
          onKeyDown={(e) => handleKey(e, i)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          style={{
            width: 44, height: 52, textAlign: "center",
            fontSize: "1.25rem", fontWeight: 700,
            border: `2px solid ${d ? "var(--color-accent)" : "var(--color-input-border)"}`,
            borderRadius: "var(--radius-input)",
            backgroundColor: d ? "var(--color-accent-subtle)" : "var(--color-input-bg)",
            color: "var(--color-input-text)",
            outline: "none",
            transition: "border-color 0.15s, background-color 0.15s",
          }}
        />
      ))}
    </div>
  );
}

// ─── Password strength indicator ─────────────────────────────────────────────

function PasswordStrength({ password }) {
  const checks = [
    { label: "8+ characters",        ok: password.length >= 8 },
    { label: "Uppercase letter",      ok: /[A-Z]/.test(password) },
    { label: "Lowercase letter",      ok: /[a-z]/.test(password) },
    { label: "Number or symbol",      ok: /[\d\W]/.test(password) },
  ];
  const score = checks.filter((c) => c.ok).length;
  const level = score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";
  const levelColor = score <= 1 ? "#ef4444" : score === 2 ? "#f59e0b" : score === 3 ? "#10b981" : "var(--color-accent)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {/* Bar */}
      <div style={{ display: "flex", gap: 3, height: 4 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            flex: 1, borderRadius: 2,
            backgroundColor: i < score ? levelColor : "var(--color-card-border)",
            transition: "background-color 0.2s",
          }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <p style={{ fontSize: "0.75rem", color: levelColor, fontWeight: 600, margin: 0 }}>{level}</p>
        <div style={{ display: "flex", gap: 10 }}>
          {checks.map((c) => (
            <span key={c.label} style={{ fontSize: "0.68rem", color: c.ok ? "var(--color-accent)" : "var(--color-sidebar-text)" }}>
              {c.ok ? "✓" : "·"} {c.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
