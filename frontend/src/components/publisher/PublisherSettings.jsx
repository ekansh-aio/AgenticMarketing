/**
 * Publisher Platform Settings
 * Manage named credential profiles for each deploy/distribute platform.
 * Profiles are stored in localStorage so they persist across sessions.
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PageWithSidebar, SectionCard } from "../shared/Layout";
import {
  DEPLOY_PLATFORMS,
  SOCIAL_PLATFORMS,
  loadProfiles,
  saveProfiles,
} from "./platformConfig";
import { Plus, Pencil, Trash2, Check, X, Settings, ChevronRight } from "lucide-react";

// Flat list combining deploy + social platforms for the sidebar
const ALL_PLATFORMS = [
  ...DEPLOY_PLATFORMS.map((p) => ({ ...p, category: "deploy" })),
  ...Object.entries(SOCIAL_PLATFORMS).map(([name, cfg]) => ({
    ...cfg,
    label: name,
    category: "social",
  })),
];

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function PublisherSettings() {
  const [profiles, setProfilesState] = useState(loadProfiles);
  const [selectedId, setSelectedId]   = useState(ALL_PLATFORMS[0]?.id);
  // editingProfile: null | { id: string | null, data: object }
  const [editingProfile, setEditingProfile] = useState(null);

  const selectedPlatform   = ALL_PLATFORMS.find((p) => p.id === selectedId);
  const platformProfiles   = profiles[selectedId] || [];

  const persist = (updated) => {
    setProfilesState(updated);
    saveProfiles(updated);
  };

  const handleSelectPlatform = (id) => {
    setSelectedId(id);
    setEditingProfile(null);
  };

  const handleSave = (formData) => {
    const { name, ...fields } = formData;
    if (!name?.trim()) return;

    if (editingProfile.id) {
      persist({
        ...profiles,
        [selectedId]: (profiles[selectedId] || []).map((p) =>
          p.id === editingProfile.id ? { ...p, name, ...fields } : p
        ),
      });
    } else {
      const newProfile = { id: `${Date.now()}`, name, ...fields };
      persist({
        ...profiles,
        [selectedId]: [...(profiles[selectedId] || []), newProfile],
      });
    }
    setEditingProfile(null);
  };

  const handleDelete = (profileId) => {
    persist({
      ...profiles,
      [selectedId]: (profiles[selectedId] || []).filter((p) => p.id !== profileId),
    });
  };

  return (
    <PageWithSidebar>
      <div className="page-header">
        <div>
          <h1 className="page-header__title">Platform Settings</h1>
          <p className="page-header__subtitle">
            Save credential profiles for each platform — select them at deploy/distribute time
          </p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "210px 1fr", gap: "20px", alignItems: "start" }}>

        {/* ── Platform list ────────────────────────────────────────────────── */}
        <div style={{ position: "sticky", top: "20px" }}>
          <SidebarGroup label="Deploy Platforms" platforms={ALL_PLATFORMS.filter((p) => p.category === "deploy")} profiles={profiles} selected={selectedId} onSelect={handleSelectPlatform} />
          <SidebarGroup label="Social Platforms"  platforms={ALL_PLATFORMS.filter((p) => p.category === "social")} profiles={profiles} selected={selectedId} onSelect={handleSelectPlatform} style={{ marginTop: "16px" }} />
        </div>

        {/* ── Profile panel ────────────────────────────────────────────────── */}
        {selectedPlatform && (
          <SectionCard
            title={`${selectedPlatform.label} Profiles`}
            subtitle={selectedPlatform.description || `Manage saved credentials for ${selectedPlatform.label}`}
          >
            {/* Profile list */}
            {platformProfiles.length === 0 && !editingProfile && (
              <div style={{ padding: "20px 0 12px", textAlign: "center" }}>
                <p style={{ fontSize: "0.85rem", color: "var(--color-sidebar-text)", marginBottom: "4px" }}>
                  No profiles saved for {selectedPlatform.label} yet
                </p>
                <p style={{ fontSize: "0.75rem", color: "var(--color-sidebar-text)", opacity: 0.7 }}>
                  Add a profile so you can select it when deploying or distributing
                </p>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: platformProfiles.length > 0 ? "16px" : 0 }}>
              {platformProfiles.map((profile) =>
                editingProfile?.id === profile.id ? (
                  <ProfileForm
                    key={profile.id}
                    title="Edit Profile"
                    fields={selectedPlatform.profileFields}
                    initialData={editingProfile.data}
                    onSave={handleSave}
                    onCancel={() => setEditingProfile(null)}
                  />
                ) : (
                  <ProfileCard
                    key={profile.id}
                    profile={profile}
                    fields={selectedPlatform.profileFields}
                    onEdit={() => setEditingProfile({ id: profile.id, data: { ...profile } })}
                    onDelete={() => handleDelete(profile.id)}
                  />
                )
              )}
            </div>

            {/* Add form or add button */}
            {editingProfile?.id === null ? (
              <ProfileForm
                title="New Profile"
                fields={selectedPlatform.profileFields}
                initialData={editingProfile.data}
                onSave={handleSave}
                onCancel={() => setEditingProfile(null)}
              />
            ) : !editingProfile && (
              <button
                className="btn--ghost"
                onClick={() => setEditingProfile({ id: null, data: {} })}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Plus size={14} /> Add Profile
              </button>
            )}
          </SectionCard>
        )}
      </div>
    </PageWithSidebar>
  );
}

// ─── Sidebar group ────────────────────────────────────────────────────────────
function SidebarGroup({ label, platforms, profiles, selected, onSelect, style }) {
  return (
    <div style={style}>
      <p style={{
        fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "var(--color-sidebar-text)",
        marginBottom: "6px", padding: "0 4px",
      }}>
        {label}
      </p>
      {platforms.map((platform) => {
        const count    = (profiles[platform.id] || []).length;
        const isActive = selected === platform.id;
        return (
          <button
            key={platform.id}
            onClick={() => onSelect(platform.id)}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", padding: "8px 10px", borderRadius: "8px", textAlign: "left",
              background: isActive
                ? "rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.1)"
                : "transparent",
              border: isActive
                ? "1px solid rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.3)"
                : "1px solid transparent",
              cursor: "pointer", marginBottom: "2px",
              transition: "background 0.15s, border-color 0.15s",
            }}
          >
            <span style={{
              fontSize: "0.83rem",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--color-accent)" : "var(--color-input-text)",
            }}>
              {platform.label}
            </span>
            {count > 0 && (
              <span style={{
                fontSize: "0.65rem", fontWeight: 700, padding: "2px 7px", borderRadius: "50px",
                background: isActive
                  ? "rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.18)"
                  : "var(--color-card-border)",
                color: isActive ? "var(--color-accent)" : "var(--color-sidebar-text)",
              }}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Profile card ─────────────────────────────────────────────────────────────
function ProfileCard({ profile, fields, onEdit, onDelete }) {
  const summary = fields
    .map((f) => {
      const v = profile[f.key];
      if (!v) return null;
      return f.type === "password"
        ? `${f.label}: ${"•".repeat(8)}`
        : `${f.label}: ${v}`;
    })
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "12px",
      padding: "12px 16px", borderRadius: "10px",
      border: "1px solid var(--color-card-border)",
      backgroundColor: "var(--color-card-bg)",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--color-input-text)", marginBottom: "3px" }}>
          {profile.name}
        </p>
        <p style={{
          fontSize: "0.71rem", color: "var(--color-sidebar-text)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {summary || "No credentials saved"}
        </p>
      </div>
      <button onClick={onEdit}   className="btn--icon" title="Edit"><Pencil size={13} /></button>
      <button
        onClick={onDelete}
        className="btn--icon"
        title="Delete"
        style={{ color: "rgba(239,68,68,0.75)" }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Profile add/edit form ────────────────────────────────────────────────────
function ProfileForm({ title, fields, initialData, onSave, onCancel }) {
  const [data, setData] = useState({ name: "", ...initialData });

  const inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "0.83rem",
    border: "1px solid var(--color-card-border)", backgroundColor: "var(--color-input-bg)",
    color: "var(--color-input-text)", outline: "none", fontFamily: "inherit",
  };
  const labelStyle = {
    fontSize: "0.72rem", fontWeight: 600, color: "var(--color-sidebar-text)",
    display: "block", marginBottom: "5px",
  };

  return (
    <div style={{
      padding: "20px", borderRadius: "12px",
      border: "1px solid var(--color-card-border)",
      backgroundColor: "var(--color-page-bg)",
    }}>
      <p style={{ fontSize: "0.88rem", fontWeight: 700, color: "var(--color-input-text)", marginBottom: "16px" }}>
        {title}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <div>
          <label style={labelStyle}>Profile Name *</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="e.g. Meta Business Account 1"
            value={data.name || ""}
            onChange={(e) => setData((p) => ({ ...p, name: e.target.value }))}
          />
        </div>
        {fields.map((field) => (
          <div key={field.key}>
            <label style={labelStyle}>{field.label}</label>
            <input
              type={field.type === "textarea" ? "text" : field.type}
              style={inputStyle}
              placeholder={field.placeholder}
              value={data[field.key] || ""}
              onChange={(e) => setData((p) => ({ ...p, [field.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={() => onSave(data)}
          disabled={!data.name?.trim()}
          className="btn--accent"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <Check size={13} /> Save Profile
        </button>
        <button
          onClick={onCancel}
          className="btn--ghost"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <X size={13} /> Cancel
        </button>
      </div>
    </div>
  );
}
