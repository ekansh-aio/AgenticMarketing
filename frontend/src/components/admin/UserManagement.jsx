/**
 * M11: User Management
 * Owner: Frontend Dev 2
 * Dependencies: usersAPI
 *
 * Add/manage users with roles: Admin, Reviewer, Ethics Reviewer, Publisher
 * Styles: use classes from index.css only — no raw Tailwind color utilities.
 */

import React, { useState, useEffect, useRef } from "react";
import { PageWithSidebar, SectionCard } from "../shared/Layout";
import { usersAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import {
  UserPlus, Shield, Eye, Send, Settings,
  Trash2, ChevronDown, Loader2, AlertTriangle, X,
} from "lucide-react";

const ROLES = [
  { value: "study_coordinator", label: "Study Coordinator", icon: Settings },
  { value: "project_manager",   label: "Project Manager",   icon: Eye },
  { value: "ethics_manager",    label: "Ethics Manager",    icon: Shield },
  { value: "publisher",         label: "Publisher",         icon: Send },
];

const ROLE_STYLE = {
  admin:           { bg: "var(--color-accent-subtle)", text: "var(--color-accent-text)", dot: "var(--color-accent)" },
  reviewer:        { bg: "#eef2ff", text: "#3730a3", dot: "#6366f1" },
  ethics_reviewer: { bg: "#fff7ed", text: "#9a3412", dot: "#f97316" },
  publisher:       { bg: "#fdf4ff", text: "#6b21a8", dot: "#a855f7" },
};

// ─── Confirm-delete modal ────────────────────────────────────────────────────

function DeleteModal({ user, onConfirm, onCancel, loading }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50,
      backgroundColor: "rgba(0,0,0,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }}>
      <div style={{
        background: "var(--color-card-bg)", borderRadius: 14,
        padding: 28, maxWidth: 400, width: "100%",
        boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: "#fef2f2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <AlertTriangle size={20} style={{ color: "#ef4444" }} />
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-input-text)", margin: "0 0 4px" }}>Delete User</p>
            <p style={{ fontSize: "0.85rem", color: "var(--color-sidebar-text)", margin: 0, lineHeight: 1.5 }}>
              Are you sure you want to permanently delete{" "}
              <strong style={{ color: "var(--color-input-text)" }}>{user.full_name}</strong>?
              This action cannot be undone.
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} className="btn--ghost" disabled={loading}>Cancel</button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: "var(--radius-btn)",
              border: "none", cursor: loading ? "not-allowed" : "pointer",
              backgroundColor: "#ef4444", color: "#fff",
              fontSize: "0.875rem", fontWeight: 600, opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline role dropdown ────────────────────────────────────────────────────

function RoleDropdown({ currentRole, userId, onRoleChange, disabled }) {
  const [open, setOpen]       = useState(false);
  const [saving, setSaving]   = useState(false);
  const ref                   = useRef(null);
  const style                 = ROLE_STYLE[currentRole] || ROLE_STYLE.reviewer;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  async function select(newRole) {
    if (newRole === currentRole) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      await onRoleChange(userId, newRole);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled || saving}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 20,
          border: "1px solid var(--color-card-border)",
          backgroundColor: style.bg, color: style.text,
          cursor: disabled ? "not-allowed" : "pointer",
          fontSize: "0.78rem", fontWeight: 600,
          opacity: disabled ? 0.5 : 1,
          transition: "opacity 0.15s",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: style.dot, flexShrink: 0 }} />
        {saving ? <Loader2 size={12} className="animate-spin" /> : null}
        {currentRole.replace(/_/g, " ")}
        {!disabled && <ChevronDown size={12} style={{ opacity: 0.7 }} />}
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20,
          background: "var(--color-card-bg)", borderRadius: 10,
          border: "1px solid var(--color-card-border)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
          minWidth: 170, overflow: "hidden",
        }}>
          {ROLES.map((r) => {
            const rs = ROLE_STYLE[r.value];
            const active = r.value === currentRole;
            return (
              <button
                key={r.value}
                onClick={() => select(r.value)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 9,
                  padding: "9px 14px", border: "none", cursor: "pointer", textAlign: "left",
                  backgroundColor: active ? rs.bg : "transparent",
                  color: active ? rs.text : "var(--color-input-text)",
                  fontSize: "0.82rem", fontWeight: active ? 600 : 400,
                  transition: "background-color 0.1s",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = "var(--color-input-bg)"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: rs.dot, flexShrink: 0 }} />
                {r.label}
                {active && <span style={{ marginLeft: "auto", fontSize: "0.7rem", opacity: 0.6 }}>current</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function UserManagement() {
  const { user: currentUser } = useAuth();

  const [users,    setUsers]    = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ email: "", password: "", full_name: "", role: "project_manager" });
  const [loading,  setLoading]  = useState(false);
  const [toDelete, setToDelete] = useState(null);   // user object pending deletion
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState(null);

  useEffect(() => { usersAPI.list().then(setUsers).catch(console.error); }, []);

  // ── Create user ───────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await usersAPI.create(form);
      setUsers((p) => [...p, user]);
      setShowForm(false);


setForm({ email: "", password: "", full_name: "", role: "project_manager" });
} catch (err) {
  setError(err.message);
} finally {
  setLoading(false);
}
// ── Change role ───────────────────────────────────────────────────────────
const handleRoleChange = async (userId, newRole) => {
  try {
    const updated = await usersAPI.changeRole(userId, newRole);
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? updated : u))
    );
  } catch (err) {
    setError(err.message);
  }
};

// ── Delete user ───────────────────────────────────────────────────────────
const handleDeleteConfirm = async () => {
  if (!toDelete) return;
  setDeleting(true);
  try {
    await usersAPI.delete(toDelete.id);
    setUsers((prev) =>
      prev.filter((u) => u.id !== toDelete.id)
    );
    setToDelete(null);
  } catch (err) {
    setError(err.message);
    setToDelete(null);
  } finally {
    setDeleting(false);
  }
};

  return (
    <PageWithSidebar>
      {toDelete && (
        <DeleteModal
          user={toDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setToDelete(null)}
          loading={deleting}
        />
      )}

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">User Management</h1>
          <p className="page-header__subtitle">Add and manage team members for your company</p>
        </div>
        <button onClick={() => { setShowForm(!showForm); setError(null); }} className="btn--accent">
          <UserPlus size={16} /> Add User
        </button>
      </div>

      {/* Global error banner */}
      {error && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 10, padding: "10px 16px", borderRadius: 10, marginBottom: 16,
          backgroundColor: "#fef2f2", border: "1px solid #fecaca",
        }}>
          <p style={{ fontSize: "0.85rem", color: "#b91c1c", margin: 0 }}>{error}</p>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#b91c1c", display: "flex" }}>
            <X size={15} />
          </button>
        </div>
      )}

      {/* Add user form */}
      {showForm && (
        <SectionCard title="Add New User" className="mb-6">
          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="Full Name"
              value={form.full_name}
              onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              className="field-input"
            />
            <input
              placeholder="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              className="field-input"
            />
            <input
              placeholder="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              className="field-input"
            />
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
              className="field-select"
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          <button
            onClick={handleCreate}
            disabled={loading || !form.email || !form.full_name}
            className="btn--primary mt-4"
          >
            {loading ? <><span className="spinner" /> Creating…</> : "Create User"}
          </button>
        </SectionCard>
      )}

      {/* Team member list */}
      <SectionCard title={`Team Members (${users.length})`}>
        <div className="space-y-2">
          {users.map((u) => {
            const isSelf = u.id === currentUser?.id;
            return (
              <div key={u.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px", borderRadius: 10,
                border: "1px solid var(--color-card-border)",
                backgroundColor: "var(--color-card-bg)",
                gap: 12,
              }}>
                {/* Left: avatar + name + email */}
                <div className="flex items-center gap-3" style={{ minWidth: 0 }}>
                  <div className="user-avatar" style={{ flexShrink: 0 }}>
                    {u.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <p className="table-row__title" style={{ margin: 0 }}>{u.full_name}</p>
                      {isSelf && (
                        <span style={{
                          fontSize: "0.65rem", fontWeight: 600, padding: "1px 6px",
                          borderRadius: 999, backgroundColor: "var(--color-accent-subtle)",
                          color: "var(--color-accent-text)",
                        }}>You</span>
                      )}
                    </div>
                    <p className="table-row__meta" style={{ margin: 0 }}>{u.email}</p>
                  </div>
                </div>

                {/* Right: role dropdown + status dot + delete */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  {/* Active indicator */}
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: "0.72rem", color: "var(--color-sidebar-text)",
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      backgroundColor: u.is_active ? "var(--color-accent)" : "#f87171",
                      boxShadow: u.is_active ? "0 0 0 2px var(--color-accent-subtle)" : "none",
                    }} />
                    {u.is_active ? "Active" : "Inactive"}
                  </span>

                  {/* Role dropdown — disabled for self */}
                  <RoleDropdown
                    currentRole={u.role}
                    userId={u.id}
                    onRoleChange={handleRoleChange}
                    disabled={isSelf}
                  />

                  {/* Delete button — disabled for self */}
                  <button
                    onClick={() => setToDelete(u)}
                    disabled={isSelf}
                    title={isSelf ? "You cannot delete your own account" : `Delete ${u.full_name}`}
                    style={{
                      width: 32, height: 32, borderRadius: 8, border: "none",
                      backgroundColor: isSelf ? "transparent" : "var(--color-btn-ghost-bg)",
                      color: isSelf ? "var(--color-card-border)" : "#ef4444",
                      cursor: isSelf ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "background-color 0.15s",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { if (!isSelf) e.currentTarget.style.backgroundColor = "#fef2f2"; }}
                    onMouseLeave={(e) => { if (!isSelf) e.currentTarget.style.backgroundColor = "var(--color-btn-ghost-bg)"; }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}

          {users.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--color-sidebar-text)", fontSize: "0.875rem", padding: "24px 0" }}>
              No team members yet. Add the first user above.
            </p>
          )}
        </div>
      </SectionCard>
    </PageWithSidebar>
  );
}
