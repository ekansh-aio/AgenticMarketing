/**
 * M13: Ethics Reviewer Dashboard
 *
 * Workflow:
 *  1. Pick a campaign from the queue (status: approved | ethics_review)
 *  2. Generate its creatives / website
 *  3. Flag ethical issues — type + description + suggested fix
 *  4. Request AI regeneration with those notes
 *  5. Repeat until satisfied → Clear for Publishing (sets status: ethics_cleared)
 *
 * Tabs (URL-driven):
 *   /ethics | /ethics/review  → Review queue + detail panel
 *   /ethics/documents         → Ethical guideline management
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  PageWithSidebar, SectionCard, MetricSummaryCard, CampaignStatusBadge,
} from "../shared/Layout";
import { adsAPI, documentsAPI } from "../../services/api";
import {
  Shield, FileText, AlertTriangle, CheckCircle, RotateCcw,
  Eye, Image, Plus, X, Sparkles, Globe, Zap, Download,
  Flag, CheckCircle2, AlertCircle, Loader2, Upload, File, Trash2,
} from "lucide-react";

// ─── Progress utility ─────────────────────────────────────────────────────────
function useProgressMap() {
  const [map, setMap] = useState({});
  const timers  = useRef({});
  const started = useRef({});

  const tick = useCallback((key, durMs) => {
    const elapsed = Date.now() - started.current[key];
    const pct = Math.min(92, 92 * (1 - Math.exp(-(elapsed / durMs) * 2)));
    setMap((m) => ({ ...m, [key]: Math.round(pct) }));
  }, []);

  const start = useCallback((key, estimatedMs = 20000) => {
    if (timers.current[key]) clearInterval(timers.current[key]);
    started.current[key] = Date.now();
    setMap((m) => ({ ...m, [key]: 2 }));
    timers.current[key] = setInterval(() => tick(key, estimatedMs), 250);
  }, [tick]);

  const complete = useCallback((key) => {
    clearInterval(timers.current[key]);
    setMap((m) => ({ ...m, [key]: 100 }));
    setTimeout(() => setMap((m) => { const n = { ...m }; delete n[key]; return n; }), 700);
  }, []);

  const fail = useCallback((key) => {
    clearInterval(timers.current[key]);
    setMap((m) => { const n = { ...m }; delete n[key]; return n; });
  }, []);

  useEffect(() => () => Object.values(timers.current).forEach(clearInterval), []);
  return { map, start, complete, fail };
}

function InlineProgress({ progress }) {
  if (!progress) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
      <div style={{ flex: 1, maxWidth: "180px", height: "4px", background: "rgba(0,0,0,0.08)", borderRadius: "50px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progress}%`, background: "var(--color-accent)", borderRadius: "50px", transition: "width 0.25s ease" }} />
      </div>
      <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--color-accent)", whiteSpace: "nowrap" }}>
        {progress === 100 ? "✓" : `${progress}%`}
      </span>
    </div>
  );
}

// ─── Issue type catalog ───────────────────────────────────────────────────────
const ISSUE_TYPES = [
  { value: "misleading",     label: "Misleading Claims",          color: "#ef4444" },
  { value: "discrimination", label: "Discrimination / Bias",      color: "#f97316" },
  { value: "privacy",        label: "Privacy Concern",            color: "#eab308" },
  { value: "harmful",        label: "Harmful Content",            color: "#dc2626" },
  { value: "stereotype",     label: "Stereotyping",               color: "#f97316" },
  { value: "fear_urgency",   label: "Exploiting Fear / Urgency",  color: "#ca8a04" },
  { value: "environmental",  label: "Unverified Env. Claim",      color: "#16a34a" },
  { value: "children",       label: "Inappropriate for Minors",   color: "#7c3aed" },
  { value: "other",          label: "Other Concern",              color: "#6b7280" },
];

const issueColor = (type) => ISSUE_TYPES.find((t) => t.value === type)?.color ?? "#6b7280";
const issueLabel = (type) => ISSUE_TYPES.find((t) => t.value === type)?.label ?? type;

const TAB_PATHS = {
  "/ethics":           "review",
  "/ethics/review":    "review",
  "/ethics/documents": "documents",
};

const hasType = (ad, type) =>
  Array.isArray(ad.ad_type) ? ad.ad_type.includes(type) : ad.ad_type === type;

// ─── Root component ───────────────────────────────────────────────────────────
export default function EthicsDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const tab = TAB_PATHS[location.pathname] || "review";

  const [ads,     setAds]     = useState([]);
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Per-campaign flagged issues  { [adId]: [{id, type, description, suggestion}] }
  const [issuesByAd, setIssuesByAd] = useState({});
  const [newIssue,   setNewIssue]   = useState({ type: "misleading", description: "", suggestion: "" });
  const [regenNotes, setRegenNotes] = useState("");

  // Loading states
  const [generating,   setGenerating]   = useState(null); // { id, type }
  const [regenerating, setRegenerating] = useState(false);
  const [clearing,     setClearing]     = useState(false);
  const genProgress = useProgressMap();

  // Doc form
  const [pendingFile, setPendingFile] = useState(null);
  const [fileError,   setFileError]   = useState("");
  const [savingDoc,   setSavingDoc]   = useState(false);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    Promise.all([
      adsAPI.list(),
      documentsAPI.list("ethical_guideline"),
    ])
      .then(([adList, docList]) => { setAds(adList); setDocs(docList); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const reviewQueue  = ads.filter((a) => ["approved", "ethics_review", "ethics_cleared"].includes(a.status));
  const pendingCount = ads.filter((a) => ["approved", "ethics_review"].includes(a.status)).length;
  const clearedCount = ads.filter((a) => a.status === "ethics_cleared").length;
  const currentIssues = selected ? (issuesByAd[selected.id] || []) : [];

  // ── Content generation ───────────────────────────────────────────────────
  const handleGenerateCreatives = async () => {
    const key = `${selected.id}_creatives`;
    setGenerating({ id: selected.id, type: "creatives" });
    genProgress.start(key, 60000);
    try {
      const updated = await adsAPI.generateCreatives(selected.id);
      genProgress.complete(key);
      setAds((p) => p.map((a) => (a.id === selected.id ? updated : a)));
      setSelected(updated);
    } catch (err) { genProgress.fail(key); alert(err.message); }
    finally { setGenerating(null); }
  };

  const handleGenerateWebsite = async () => {
    const key = `${selected.id}_website`;
    setGenerating({ id: selected.id, type: "website" });
    genProgress.start(key, 35000);
    try {
      const updated = await adsAPI.generateWebsite(selected.id);
      genProgress.complete(key);
      setAds((p) => p.map((a) => (a.id === selected.id ? updated : a)));
      setSelected(updated);
    } catch (err) { genProgress.fail(key); alert(err.message); }
    finally { setGenerating(null); }
  };

  // ── Issue management ─────────────────────────────────────────────────────
  const addIssue = () => {
    if (!newIssue.description.trim()) return;
    const issue = { id: Date.now().toString(), ...newIssue };
    setIssuesByAd((p) => ({
      ...p,
      [selected.id]: [...(p[selected.id] || []), issue],
    }));
    setNewIssue({ type: "misleading", description: "", suggestion: "" });
  };

  const removeIssue = (issueId) => {
    setIssuesByAd((p) => ({
      ...p,
      [selected.id]: (p[selected.id] || []).filter((i) => i.id !== issueId),
    }));
  };

  // ── Regenerate with ethics notes ─────────────────────────────────────────
  const handleRegenerate = async () => {
    setRegenerating(true);
    const key = `${selected.id}_regen`;
    genProgress.start(key, 50000);
    try {
      const updated = await adsAPI.regenerateWithEthics(selected.id, {
        issues: currentIssues,
        notes:  regenNotes,
      });
      genProgress.complete(key);
      setAds((p) => p.map((a) => (a.id === selected.id ? updated : a)));
      setSelected(updated);
      setIssuesByAd((p) => ({ ...p, [selected.id]: [] }));
      setRegenNotes("");
    } catch (err) { genProgress.fail(key); alert(err.message); }
    finally { setRegenerating(false); }
  };

  // ── Clear for publishing ─────────────────────────────────────────────────
  const handleClear = async () => {
    setClearing(true);
    try {
      const updated = await adsAPI.ethicsClear(selected.id, regenNotes);
      setAds((p) => p.map((a) => (a.id === selected.id ? updated : a)));
      setSelected(updated);
      setIssuesByAd((p) => ({ ...p, [selected.id]: [] }));
      setRegenNotes("");
    } catch (err) { alert(err.message); }
    finally { setClearing(false); }
  };

  // ── Guideline management ─────────────────────────────────────────────────
  const ACCEPTED = ["application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain", "text/markdown"];

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type && !ACCEPTED.includes(file.type)) {
      setFileError("Unsupported format. Use PDF, DOCX, DOC, or TXT.");
      return;
    }
    setFileError("");
    setPendingFile(file);
  };

  const clearFile = () => {
    setPendingFile(null);
    setFileError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleAddDoc = async () => {
    if (!pendingFile) return;
    setSavingDoc(true);
    try {
      const title = pendingFile.name.replace(/\.[^.]+$/, "");
      const doc = await documentsAPI.upload("ethical_guideline", title, pendingFile);
      setDocs((p) => [...p, doc]);
      clearFile();
    } catch (err) { alert(err.message); }
    finally { setSavingDoc(false); }
  };

  const handleDeleteDoc = async (docId) => {
    setDeletingDoc(docId);
    try {
      await documentsAPI.delete(docId);
      setDocs((p) => p.filter((d) => d.id !== docId));
    } catch (err) { alert(err.message); }
    finally { setDeletingDoc(null); }
  };

  const fileSizeStr = (bytes) => {
    if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + " MB";
    if (bytes >= 1_000)     return (bytes / 1_000).toFixed(0) + " KB";
    return bytes + " B";
  };

  if (loading) return (
    <PageWithSidebar>
      <div className="flex items-center justify-center py-40"><div className="spinner--dark" /></div>
    </PageWithSidebar>
  );

  return (
    <PageWithSidebar>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>

      <div className="page-header">
        <div>


        <h1 className="page-header__title">Ethics Manager Dashboard</h1>
        <p className="page-header__subtitle">
          Review campaigns, flag ethical issues, request AI fixes, and approve content for publishing
        </p>


        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <MetricSummaryCard label="Pending Review" value={pendingCount} icon={Shield} />
        <MetricSummaryCard label="Cleared"        value={clearedCount} icon={CheckCircle} />
        <MetricSummaryCard label="Guidelines"     value={docs.length}  icon={FileText} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => navigate("/ethics/review")}
          className={`${tab === "review" ? "filter-tab--active" : "filter-tab"} flex items-center gap-1.5`}
        >
          <Shield size={14} /> Review Queue
        </button>
        <button
          onClick={() => navigate("/ethics/documents")}
          className={`${tab === "documents" ? "filter-tab--active" : "filter-tab"} flex items-center gap-1.5`}
        >
          <FileText size={14} /> Guidelines
        </button>
      </div>

      {/* ── Review Tab ── */}
      {tab === "review" && (
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: "20px", alignItems: "start" }}>

          {/* Campaign queue */}
          <div style={{ position: "sticky", top: "20px" }}>
            <SectionCard
              title="Review Queue"
              subtitle={`${reviewQueue.length} campaign${reviewQueue.length !== 1 ? "s" : ""}`}
            >
              {reviewQueue.length === 0 ? (
                <div style={{ padding: "24px 0", textAlign: "center" }}>
                  <Shield size={32} style={{ color: "var(--color-sidebar-text)", opacity: 0.3, margin: "0 auto 10px", display: "block" }} />
                  <p style={{ fontSize: "0.82rem", color: "var(--color-sidebar-text)" }}>
                    No campaigns pending ethics review
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {reviewQueue.map((ad) => {
                    const flags = (issuesByAd[ad.id] || []).length;
                    const isActive = selected?.id === ad.id;
                    return (
                      <button
                        key={ad.id}
                        onClick={() => setSelected(ad)}
                        style={{
                          display: "flex", flexDirection: "column", gap: "6px",
                          width: "100%", padding: "12px 14px", borderRadius: "10px",
                          textAlign: "left", cursor: "pointer",
                          border: `2px solid ${isActive ? "var(--color-accent)" : "var(--color-card-border)"}`,
                          backgroundColor: isActive
                            ? "rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.06)"
                            : "var(--color-card-bg)",
                          transition: "border-color 0.15s, background-color 0.15s",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "6px" }}>
                          <p style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--color-input-text)", flex: 1, textAlign: "left" }}>
                            {ad.title}
                          </p>
                          <CampaignStatusBadge status={ad.status} />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <p style={{ fontSize: "0.71rem", color: "var(--color-sidebar-text)" }}>
                            {Array.isArray(ad.ad_type) ? ad.ad_type.join(", ") : ad.ad_type}
                          </p>
                          {flags > 0 && (
                            <span style={{
                              fontSize: "0.64rem", fontWeight: 700, padding: "1px 6px", borderRadius: "50px",
                              backgroundColor: "rgba(239,68,68,0.12)", color: "#ef4444",
                            }}>
                              {flags} flag{flags !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Detail panel */}
          {selected ? (
            <div className="space-y-5">
              <ContentPanel
                ad={selected}
                generating={generating}
                progressMap={genProgress.map}
                onGenerateCreatives={handleGenerateCreatives}
                onGenerateWebsite={handleGenerateWebsite}
              />
              <EthicsPanel
                ad={selected}
                issues={currentIssues}
                newIssue={newIssue}
                regenNotes={regenNotes}
                regenerating={regenerating}
                clearing={clearing}
                regenProgress={genProgress.map[`${selected.id}_regen`]}
                onNewIssueChange={setNewIssue}
                onAddIssue={addIssue}
                onRemoveIssue={removeIssue}
                onRegenNotesChange={setRegenNotes}
                onRegenerate={handleRegenerate}
                onClear={handleClear}
              />
            </div>
          ) : (
            <SectionCard>
              <div className="empty-state">
                <Shield size={40} className="empty-state__icon" />
                <p className="empty-state__text">Select a campaign from the queue to begin review</p>
              </div>
            </SectionCard>
          )}
        </div>
      )}

      {/* ── Guidelines Tab ── */}
      {tab === "documents" && (
        <div className="space-y-6 max-w-2xl">
          <SectionCard
            title="Upload Ethical Guideline"
            subtitle="Guidelines are injected as AI context during content generation and regeneration"
          >
            <div className="space-y-4">
              {!pendingFile ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed rounded-lg py-8 flex flex-col items-center gap-2"
                  style={{ borderColor: "var(--color-input-border)", backgroundColor: "transparent", cursor: "pointer" }}
                >
                  <Upload size={24} style={{ color: "var(--color-sidebar-text)" }} />
                  <span style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--color-sidebar-text)" }}>Click to upload guideline</span>
                  <span style={{ fontSize: "0.72rem", color: "var(--color-sidebar-text)", opacity: 0.6 }}>PDF · DOCX · DOC · TXT</span>
                </button>
              ) : (
                <div style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "12px 14px", borderRadius: "10px",
                  border: "1px solid var(--color-accent)",
                  backgroundColor: "rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.07)",
                }}>
                  <div style={{
                    width: "38px", height: "38px", borderRadius: "7px", flexShrink: 0,
                    backgroundColor: "rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <File size={16} style={{ color: "var(--color-accent)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-input-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {pendingFile.name}
                    </p>
                    <p style={{ fontSize: "0.72rem", color: "var(--color-sidebar-text)" }}>
                      {fileSizeStr(pendingFile.size)}
                    </p>
                  </div>
                  <button type="button" onClick={clearFile} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", display: "flex" }}>
                    <X size={14} style={{ color: "var(--color-sidebar-text)" }} />
                  </button>
                </div>
              )}

              {fileError && (
                <p style={{ fontSize: "0.75rem", color: "#ef4444" }}>{fileError}</p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.txt,.md"
                onChange={handleFileChange}
                className="hidden"
              />

              <button
                onClick={handleAddDoc}
                disabled={!pendingFile || savingDoc}
                className="btn--accent"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", opacity: !pendingFile ? 0.5 : 1 }}
              >
                {savingDoc
                  ? <><Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Uploading…</>
                  : <><Upload size={13} /> Upload Guideline</>}
              </button>
            </div>
          </SectionCard>

          <SectionCard title={`Saved Guidelines (${docs.length})`}>
            {docs.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--color-sidebar-text)", padding: "8px 0" }}>
                No guidelines uploaded yet
              </p>
            ) : (
              docs.map((doc) => (
                <div key={doc.id} className="table-row px-1" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div style={{
                    width: "34px", height: "34px", borderRadius: "6px", flexShrink: 0,
                    backgroundColor: "var(--color-page-bg)",
                    border: "1px solid var(--color-card-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <FileText size={14} style={{ color: "var(--color-sidebar-text)" }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p className="table-row__title">{doc.title}</p>
                    {doc.file_path && (
                      <p className="table-row__meta">{doc.file_path.split("/").pop()}</p>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexShrink: 0 }}>
                    {doc.file_path && (
                      <a
                        href={documentsAPI.getFileUrl(doc.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="btn--inline-action--ghost"
                      >
                        <Download size={11} /> View
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteDoc(doc.id)}
                      disabled={deletingDoc === doc.id}
                      className="btn--inline-action--ghost"
                      style={{ color: "#ef4444", borderColor: "rgba(239,68,68,0.3)" }}
                    >
                      {deletingDoc === doc.id
                        ? <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} />
                        : <Trash2 size={11} />}
                    </button>
                  </div>
                </div>
              ))
            )}
          </SectionCard>
        </div>
      )}
    </PageWithSidebar>
  );
}

// ─── Content generation + preview panel ──────────────────────────────────────
function ContentPanel({ ad, generating, progressMap, onGenerateCreatives, onGenerateWebsite }) {
  const isAds     = hasType(ad, "ads");
  const isWebsite = hasType(ad, "website");
  const hasCreatives = ad.output_files?.length > 0;
  const hasWebsite   = !!ad.output_url;
  const genCreatives = generating?.id === ad.id && generating?.type === "creatives";
  const genWebsite   = generating?.id === ad.id && generating?.type === "website";

  return (
    <SectionCard
      title={ad.title}
      subtitle={`${Array.isArray(ad.ad_type) ? ad.ad_type.join(", ") : ad.ad_type} · Budget: $${ad.budget != null ? Number(ad.budget).toLocaleString() : "N/A"}`}
    >
      {/* Generate buttons */}
      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "20px", alignItems: "center" }}>
        {isAds && (
          <>
            <button
              className={hasCreatives ? "btn--inline-action--ghost" : "btn--inline-action--accent"}
              disabled={!!generating}
              onClick={onGenerateCreatives}
            >
              {genCreatives
                ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</>
                : <><Zap size={12} /> {hasCreatives ? "Regenerate Creatives" : "Generate Creatives"}</>}
            </button>
            {genCreatives && <InlineProgress progress={progressMap?.[`${ad.id}_creatives`]} />}
          </>
        )}
        {isWebsite && (
          <>
            <button
              className={hasWebsite ? "btn--inline-action--ghost" : "btn--inline-action--success"}
              disabled={!!generating}
              onClick={onGenerateWebsite}
            >
              {genWebsite
                ? <><div className="spinner" style={{ width: 10, height: 10 }} /> Generating…</>
                : <><Globe size={12} /> {hasWebsite ? "Regenerate Website" : "Generate Website"}</>}
            </button>
            {genWebsite && <InlineProgress progress={progressMap?.[`${ad.id}_website`]} />}
          </>
        )}
      </div>

      {/* Creatives preview strip */}
      {hasCreatives && (
        <div style={{ marginBottom: "20px" }}>
          <p style={{
            fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.06em", color: "var(--color-sidebar-text)", marginBottom: "8px",
          }}>
            Ad Creatives — {ad.output_files.length} generated
          </p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {ad.output_files.slice(0, 8).map((c, i) => (
              <div key={i} style={{
                width: "96px", height: "72px", borderRadius: "7px", flexShrink: 0,
                border: "1px solid var(--color-card-border)",
                backgroundColor: "var(--color-page-bg)", overflow: "hidden",
              }}>
                {c.image_url
                  ? <img src={c.image_url} alt={c.headline} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Image size={20} style={{ color: "var(--color-sidebar-text)", opacity: 0.3 }} />
                    </div>}
              </div>
            ))}
          </div>
          {ad.output_files[0]?.headline && (
            <p style={{ fontSize: "0.75rem", color: "var(--color-sidebar-text)", marginTop: "8px", fontStyle: "italic" }}>
              "{ad.output_files[0].headline}"
            </p>
          )}
        </div>
      )}

      {/* Website preview row */}
      {hasWebsite && (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "10px 14px", borderRadius: "8px",
          border: "1px solid var(--color-card-border)", backgroundColor: "var(--color-card-bg)",
        }}>
          <Globe size={14} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
          <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--color-input-text)", flex: 1 }}>
            Landing page generated
          </p>
          <a href={adsAPI.websitePreviewUrl(ad.id)} target="_blank" rel="noreferrer" className="btn--inline-action--ghost">
            <Eye size={11} /> Preview
          </a>
          <a href={adsAPI.websiteDownloadUrl(ad.id)} className="btn--inline-action--ghost">
            <Download size={11} /> Download
          </a>
        </div>
      )}

      {/* Nothing yet */}
      {!hasCreatives && !hasWebsite && (
        <div style={{
          padding: "18px", borderRadius: "10px", textAlign: "center",
          border: "1px dashed var(--color-card-border)", backgroundColor: "var(--color-page-bg)",
        }}>
          <p style={{ fontSize: "0.82rem", color: "var(--color-sidebar-text)" }}>
            No content generated yet — use the buttons above to generate creatives or website first
          </p>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Ethics flagging + actions panel ─────────────────────────────────────────
function EthicsPanel({
  ad, issues, newIssue, regenNotes, regenerating, clearing, regenProgress,
  onNewIssueChange, onAddIssue, onRemoveIssue, onRegenNotesChange, onRegenerate, onClear,
}) {
  const isCleared  = ad.status === "ethics_cleared";
  const isAds      = hasType(ad, "ads");
  const isWebsite  = hasType(ad, "website");
  const missingContent = [
    ...(isWebsite && !ad.output_url        ? ["website"]       : []),
    ...(isAds     && !ad.output_files?.length ? ["ad creatives"] : []),
  ];
  const canClear = missingContent.length === 0;

  const inputStyle = {
    width: "100%", padding: "8px 12px", borderRadius: "8px", fontSize: "0.83rem",
    border: "1px solid var(--color-card-border)", backgroundColor: "var(--color-input-bg)",
    color: "var(--color-input-text)", outline: "none", fontFamily: "inherit",
  };
  const labelStyle = {
    fontSize: "0.72rem", fontWeight: 600, color: "var(--color-sidebar-text)",
    display: "block", marginBottom: "5px",
  };
  const sectionHead = {
    fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.07em", color: "var(--color-sidebar-text)",
    display: "flex", alignItems: "center", gap: "5px", marginBottom: "12px",
  };

  return (
    <SectionCard
      title="Ethical Review"
      subtitle="Flag concerns, request AI fixes, then clear for publishing"
    >
      {/* ── Already cleared banner ── */}
      {isCleared && (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "14px 16px", borderRadius: "10px", marginBottom: "20px",
          border: "1px solid rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.35)",
          backgroundColor: "rgba(var(--color-accent-r),var(--color-accent-g),var(--color-accent-b),0.07)",
        }}>
          <CheckCircle2 size={16} style={{ color: "var(--color-accent)", flexShrink: 0 }} />
          <p style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--color-accent)" }}>
            Cleared for publishing — visible to the Publisher role
          </p>
        </div>
      )}

      {/* ── Flag new issue form ── */}
      {!isCleared && (
        <>
          <p style={sectionHead}><Flag size={11} /> Flag an Issue</p>
          <div style={{ display: "grid", gridTemplateColumns: "190px 1fr", gap: "12px", marginBottom: "10px" }}>
            <div>
              <label style={labelStyle}>Issue Type</label>
              <select
                value={newIssue.type}
                onChange={(e) => onNewIssueChange((p) => ({ ...p, type: e.target.value }))}
                className="field-select"
              >
                {ISSUE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Describe the concern</label>
              <input
                type="text"
                style={inputStyle}
                placeholder="What is ethically problematic about this content?"
                value={newIssue.description}
                onChange={(e) => onNewIssueChange((p) => ({ ...p, description: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && onAddIssue()}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Suggested Fix <span style={{ fontWeight: 400, opacity: 0.7 }}>(optional)</span></label>
              <input
                type="text"
                style={inputStyle}
                placeholder="What specific change should the AI make to address this?"
                value={newIssue.suggestion}
                onChange={(e) => onNewIssueChange((p) => ({ ...p, suggestion: e.target.value }))}
              />
            </div>
          </div>
          <button
            onClick={onAddIssue}
            disabled={!newIssue.description.trim()}
            className="btn--inline-action--accent"
            style={{ marginBottom: "24px" }}
          >
            <Plus size={12} /> Add Flag
          </button>
        </>
      )}

      {/* ── Flagged issues list ── */}
      {issues.length > 0 && (
        <>
          <p style={sectionHead}><AlertTriangle size={11} /> Flagged Issues ({issues.length})</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "24px" }}>
            {issues.map((issue) => (
              <div key={issue.id} style={{
                display: "flex", gap: "12px", padding: "12px 14px", borderRadius: "10px",
                border: `1px solid ${issueColor(issue.type)}33`,
                backgroundColor: `${issueColor(issue.type)}0d`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px" }}>
                    <span style={{
                      fontSize: "0.65rem", fontWeight: 700, padding: "2px 8px",
                      borderRadius: "50px",
                      border: `1px solid ${issueColor(issue.type)}55`,
                      color: issueColor(issue.type),
                      whiteSpace: "nowrap",
                    }}>
                      {issueLabel(issue.type)}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.83rem", color: "var(--color-input-text)", marginBottom: issue.suggestion ? "4px" : 0 }}>
                    {issue.description}
                  </p>
                  {issue.suggestion && (
                    <p style={{ fontSize: "0.75rem", color: "var(--color-sidebar-text)", fontStyle: "italic" }}>
                      Fix: {issue.suggestion}
                    </p>
                  )}
                </div>
                {!isCleared && (
                  <button
                    onClick={() => onRemoveIssue(issue.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--color-sidebar-text)", padding: "2px 4px", flexShrink: 0, display: "flex", alignItems: "flex-start" }}
                    title="Remove flag"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Notes + actions ── */}
      {!isCleared && (
        <>
          <p style={sectionHead}><Sparkles size={11} /> Regeneration Notes</p>
          <textarea
            style={{ ...inputStyle, resize: "vertical", minHeight: "72px", marginBottom: "16px" }}
            placeholder="Any overall instructions for the AI beyond the specific flags above (optional)…"
            value={regenNotes}
            onChange={(e) => onRegenNotesChange(e.target.value)}
          />

          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {issues.length > 0 && (
              <>
                <button
                  onClick={onRegenerate}
                  disabled={regenerating}
                  className="btn--revise"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", opacity: regenerating ? 0.65 : 1 }}
                >
                  {regenerating
                    ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                    : <RotateCcw size={14} />}
                  {regenerating
                    ? "Regenerating…"
                    : `Regenerate with ${issues.length} Fix${issues.length !== 1 ? "es" : ""}`}
                </button>
                {regenerating && regenProgress && <InlineProgress progress={regenProgress} />}
              </>
            )}

            <button
              onClick={onClear}
              disabled={clearing || !canClear}
              className="btn--approve"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", opacity: (clearing || !canClear) ? 0.45 : 1 }}
              title={!canClear ? `Generate ${missingContent.join(" and ")} before clearing` : undefined}
            >
              {clearing
                ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />
                : <CheckCircle size={14} />}
              {clearing ? "Clearing…" : "Clear for Publishing"}
            </button>
            {!canClear && (
              <p style={{ fontSize: "0.72rem", color: "var(--color-sidebar-text)", marginTop: "6px" }}>
                Generate {missingContent.join(" and ")} first before clearing for publishing.
              </p>
            )}
          </div>
        </>
      )}
    </SectionCard>
  );
}
