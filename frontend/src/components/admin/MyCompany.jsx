/**
 * M11: My Company
 * Owner: Frontend Dev 2
 * Dependencies: documentsAPI
 *
 * Manage company documents: USP, Compliances, Policies, Marketing Goals, etc.
 * DOC_TYPES is imported from Constants — single source of truth shared with
 * UploadDocumentsStep (onboarding). Adding a document mirrors the same
 * category-pill → file-upload flow used during onboarding.
 *
 * Styles: use classes from index.css only — no raw Tailwind color utilities.
 */

import React, { useState, useEffect, useRef } from "react";
import { PageWithSidebar, SectionCard } from "../shared/Layout";
import { documentsAPI } from "../../services/api";
import { FileText, Plus, Pencil, Trash2, Upload, X, File, CheckCircle2 } from "lucide-react";
import { DOC_TYPES, ACCEPTED_DOC_FORMATS, ACCEPTED_DOC_MIME } from "../onboarding/Constants";

// ── File helpers (mirrors UploadDocumentsStep) ─────────────────────────────
const FILE_LABEL = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
};
function fileTypeLabel(mime) { return FILE_LABEL[mime] ?? "FILE"; }
function fileSizeStr(bytes) {
  if (bytes < 1024)        return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Add-document form (same UX as onboarding UploadDocumentsStep) ──────────
function AddDocumentForm({ existingDocs, onAdd, onCancel, loading }) {
  const fileInputRef                = useRef(null);
  const [selectedType, setSelected] = useState(null);
  const [customLabel,  setCustom]   = useState("");
  const [pendingFile,  setPending]  = useState(null);
  const [fileError,    setFileErr]  = useState("");

  const isOther  = selectedType === "other";
  const chosen   = DOC_TYPES.find((t) => t.value === selectedType);
  const docTitle = isOther ? customLabel.trim() : chosen?.label ?? "";
  const canAdd   = selectedType && pendingFile && (!isOther || customLabel.trim());

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!ACCEPTED_DOC_MIME.includes(file.type)) {
      setFileErr("Unsupported format. Please use PDF, DOCX, DOC, or TXT.");
      return;
    }
    setFileErr("");
    setPending(file);
  };

  const clearFile = () => {
    setPending(null);
    setFileErr("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const selectCategory = (value) => {
    setSelected(value);
    setCustom("");
    clearFile();
  };

  const handleAdd = () => {
    if (!canAdd) return;
    onAdd({
      doc_type:  selectedType,
      title:     docTitle,
      file:      pendingFile,
      file_name: pendingFile.name,
      file_size: pendingFile.size,
      file_type: pendingFile.type,
    });
  };

  return (
    <div className="space-y-4">

      {/* Category pills */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2"
          style={{ color: "var(--color-sidebar-text)" }}>
          Document Category
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {DOC_TYPES.map((t) => {
            const active       = selectedType === t.value;
            const alreadyAdded = t.value !== "other" && existingDocs.some((d) => d.doc_type === t.value);
            return (
              <button key={t.value} type="button"
                onClick={() => selectCategory(t.value)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "6px 12px", borderRadius: "999px", fontSize: "0.78rem",
                  fontWeight: active ? 600 : 400, cursor: "pointer",
                  border: `1px solid ${active ? "var(--color-accent)" : "var(--color-input-border)"}`,
                  backgroundColor: active ? "rgba(16,185,129,0.1)" : "var(--color-input-bg)",
                  color: active ? "var(--color-accent)" : "var(--color-input-text)",
                  opacity: (alreadyAdded && !active) ? 0.45 : 1,
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>{t.icon}</span>
                {t.label}
                {alreadyAdded && (
                  <CheckCircle2 size={11} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Custom label for "Other" */}
      {isOther && (
        <input
          placeholder="Document name (e.g. Brand Story, Org Chart…) *"
          value={customLabel}
          onChange={(e) => setCustom(e.target.value)}
          className="field-input"
          autoFocus
        />
      )}

      {/* File upload zone — visible once a category is picked */}
      {selectedType && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--color-sidebar-text)" }}>
            Upload File
          </p>

          {!pendingFile ? (
            <button type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed rounded-lg py-7 flex flex-col items-center gap-2"
              style={{ borderColor: "var(--color-input-border)", backgroundColor: "transparent", cursor: "pointer" }}
            >
              <Upload size={22} style={{ color: "var(--color-sidebar-text)" }} />
              <span style={{ fontSize: "0.85rem", color: "var(--color-sidebar-text)" }}>Click to upload</span>
              <span style={{ fontSize: "0.72rem", color: "var(--color-sidebar-text)", opacity: 0.6 }}>
                PDF · DOCX · DOC · TXT
              </span>
            </button>
          ) : (
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "10px 14px", borderRadius: "10px",
              border: "1px solid var(--color-accent)",
              backgroundColor: "rgba(16,185,129,0.07)",
            }}>
              <div style={{
                width: "36px", height: "36px", borderRadius: "6px", flexShrink: 0,
                backgroundColor: "rgba(16,185,129,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.6rem", fontWeight: 700, color: "var(--color-accent)", letterSpacing: "0.03em",
              }}>
                {fileTypeLabel(pendingFile.type)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-input-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {pendingFile.name}
                </p>
                <p style={{ fontSize: "0.72rem", color: "var(--color-sidebar-text)" }}>
                  {fileSizeStr(pendingFile.size)}{docTitle ? ` · "${docTitle}"` : ""}
                </p>
              </div>
              <button type="button" onClick={clearFile}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex" }}>
                <X size={14} style={{ color: "var(--color-sidebar-text)" }} />
              </button>
            </div>
          )}

          {fileError && (
            <p style={{ fontSize: "0.75rem", color: "#ef4444", marginTop: "6px" }}>{fileError}</p>
          )}
          <input ref={fileInputRef} type="file"
            accept={ACCEPTED_DOC_FORMATS} onChange={handleFileChange} className="hidden" />
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn--ghost">
          Cancel
        </button>
        <button type="button" onClick={handleAdd} disabled={!canAdd || loading} className="btn--accent">
          <File size={15} />
          {loading ? "Adding…" : "Add Document"}
        </button>
      </div>
    </div>
  );
}

// ── Edit-document form (title + content only; doc_type is locked) ──────────
function EditDocumentForm({ doc, onSave, onCancel, loading }) {
  const [title,   setTitle]   = useState(doc.title);
  const [content, setContent] = useState(doc.content || "");

  const typeInfo  = DOC_TYPES.find((t) => t.value === doc.doc_type);
  const typeLabel = typeInfo ? `${typeInfo.icon ?? ""} ${typeInfo.label}`.trim() : doc.doc_type;

  return (
    <div className="space-y-4">

      {/* Locked type indicator */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        padding: "5px 12px", borderRadius: "999px", fontSize: "0.78rem",
        border: "1px solid var(--color-accent)",
        backgroundColor: "rgba(16,185,129,0.1)", color: "var(--color-accent)", fontWeight: 600,
      }}>
        {typeLabel}
      </div>

      <input
        placeholder="Document Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="field-input"
      />

      <textarea
        placeholder="Document Content (optional notes or extracted text)"
        rows={5}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="field-textarea"
      />

      <div className="flex gap-3">
        <button type="button" onClick={onCancel} className="btn--ghost">Cancel</button>
        <button
          type="button"
          onClick={() => onSave({ title: title.trim(), content })}
          disabled={!title.trim() || loading}
          className="btn--primary"
        >
          {loading ? "Saving…" : "Update"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function MyCompany() {
  const [docs,       setDocs]       = useState([]);
  const [filter,     setFilter]     = useState("");
  const [mode,       setMode]       = useState(null);    // null | "add" | "edit"
  const [editingDoc, setEditingDoc] = useState(null);
  const [saving,     setSaving]     = useState(false);

  useEffect(() => {
    documentsAPI.list(filter || undefined).then(setDocs).catch(console.error);
  }, [filter]);

  const closeForm = () => { setMode(null); setEditingDoc(null); };

  // ── Add (file upload path) ──────────────────────────────────────────────
  const handleAdd = async (entry) => {
    setSaving(true);
    try {
      // TODO: when backend accepts multipart, pass entry.file directly.
      // For now create with title + doc_type; content populated server-side after parsing.
      const created = await documentsAPI.create({
        doc_type: entry.doc_type,
        title:    entry.title,
        content:  "",
      });
      setDocs((p) => [...p, created]);
      closeForm();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  // ── Edit (title + content) ──────────────────────────────────────────────
  const handleSaveEdit = async ({ title, content }) => {
    setSaving(true);
    try {
      const updated = await documentsAPI.update(editingDoc.id, { title, content });
      setDocs((p) => p.map((d) => (d.id === editingDoc.id ? updated : d)));
      closeForm();
    } catch (err) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this document?")) return;
    await documentsAPI.delete(id);
    setDocs((p) => p.filter((d) => d.id !== id));
  };

  // Filter tabs: All + every named type (exclude "other" — it's for ad-hoc uploads)
  const filterTabs = [{ value: "", label: "All" }, ...DOC_TYPES.filter((t) => t.value !== "other")];

  return (
    <PageWithSidebar>
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="page-header__title">My Company</h1>
          <p className="page-header__subtitle">Manage company documents and policies</p>
        </div>
        {mode === null && (
          <button onClick={() => setMode("add")} className="btn--accent">
            <Plus size={16} /> Add Document
          </button>
        )}
      </div>

      {/* Add form */}
      {mode === "add" && (
        <SectionCard title="New Document" className="mb-6">
          <AddDocumentForm
            existingDocs={docs}
            onAdd={handleAdd}
            onCancel={closeForm}
            loading={saving}
          />
        </SectionCard>
      )}

      {/* Edit form */}
      {mode === "edit" && editingDoc && (
        <SectionCard title="Edit Document" className="mb-6">
          <EditDocumentForm
            doc={editingDoc}
            onSave={handleSaveEdit}
            onCancel={closeForm}
            loading={saving}
          />
        </SectionCard>
      )}

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6" style={{ flexWrap: "wrap" }}>
        {filterTabs.map((t) => (
          <button key={t.value} onClick={() => setFilter(t.value)}
            className={filter === t.value ? "filter-tab--active" : "filter-tab"}>
            {t.icon && <span style={{ marginRight: "4px" }}>{t.icon}</span>}
            {t.label}
          </button>
        ))}
      </div>

      {/* Document list */}
      <div className="space-y-3">
        {docs.length === 0 && (
          <div className="page-card page-card__body" style={{ textAlign: "center", padding: "40px 20px" }}>
            <FileText size={32} style={{ color: "var(--color-sidebar-text)", margin: "0 auto 12px" }} />
            <p style={{ color: "var(--color-sidebar-text)", fontSize: "0.875rem" }}>
              No documents yet. Click <strong>Add Document</strong> to upload one.
            </p>
          </div>
        )}

        {docs.map((doc) => {
          const typeInfo = DOC_TYPES.find((t) => t.value === doc.doc_type);
          return (
            <div key={doc.id} className="page-card page-card__body flex items-start justify-between">
              <div className="flex gap-4" style={{ flex: 1, minWidth: 0 }}>
                {/* Category emoji badge */}
                <div style={{
                  width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
                  backgroundColor: "rgba(16,185,129,0.12)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1rem",
                }}>
                  {typeInfo?.icon ?? <FileText size={16} style={{ color: "var(--color-sidebar-text)" }} />}
                </div>

                <div style={{ minWidth: 0, flex: 1 }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--color-input-text)" }}>
                    {doc.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--color-sidebar-text)" }}>
                    {typeInfo?.label ?? doc.doc_type?.replace(/_/g, " ")}
                    {" · "}v{doc.version}
                    {doc.file_name && ` · ${doc.file_name}`}
                  </p>
                  {doc.content && (
                    <p className="text-sm mt-2 line-clamp-2" style={{ color: "#4b5563" }}>{doc.content}</p>
                  )}
                </div>
              </div>

              <div className="flex gap-1" style={{ flexShrink: 0, marginLeft: "12px" }}>
                <button onClick={() => { setEditingDoc(doc); setMode("edit"); }} className="btn--icon">
                  <Pencil size={16} />
                </button>
                <button onClick={() => handleDelete(doc.id)} className="btn--icon-danger">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </PageWithSidebar>
  );
}