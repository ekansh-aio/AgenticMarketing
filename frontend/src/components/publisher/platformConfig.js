/**
 * Platform definitions for Publisher deploy & distribute flows.
 * profileFields  → stored in Settings as named profiles (credentials, account IDs, etc.)
 * campaignFields → entered per-campaign at post/deploy time (caption, tweet text, etc.)
 */

export const DEPLOY_PLATFORMS = [
  {
    id: "vercel",
    label: "Vercel",
    description: "Deploy to Vercel edge network",
    profileFields: [
      { key: "token",        label: "Vercel Token",  type: "password", placeholder: "eyJhbGci…" },
      { key: "project_name", label: "Project Name",  type: "text",     placeholder: "my-campaign" },
    ],
  },
  {
    id: "netlify",
    label: "Netlify",
    description: "Deploy to Netlify CDN",
    profileFields: [
      { key: "token",     label: "Personal Access Token", type: "password", placeholder: "nfp_…" },
      { key: "site_name", label: "Site Name (optional)",  type: "text",     placeholder: "my-campaign" },
    ],
  },
  {
    id: "render",
    label: "Render",
    description: "Deploy to Render static sites",
    profileFields: [
      { key: "api_key",    label: "API Key",    type: "password", placeholder: "rnd_…" },
      { key: "service_id", label: "Service ID", type: "text",     placeholder: "srv-…" },
    ],
  },
  {
    id: "github_pages",
    label: "GitHub Pages",
    description: "Host on GitHub Pages",
    profileFields: [
      { key: "token",  label: "GitHub Token", type: "password", placeholder: "ghp_…" },
      { key: "repo",   label: "Repository",   type: "text",     placeholder: "username/repo" },
      { key: "branch", label: "Branch",       type: "text",     placeholder: "gh-pages" },
    ],
  },
  {
    id: "custom",
    label: "Custom Domain",
    description: "Deploy via FTP/SFTP to your own server",
    profileFields: [
      { key: "domain",      label: "Domain",                 type: "text",     placeholder: "https://mysite.com" },
      { key: "ftp_host",    label: "FTP/SFTP Host",          type: "text",     placeholder: "ftp.mysite.com" },
      { key: "ftp_user",    label: "Username",               type: "text",     placeholder: "" },
      { key: "ftp_pass",    label: "Password",               type: "password", placeholder: "" },
      { key: "remote_path", label: "Remote Path (optional)", type: "text",     placeholder: "/public_html" },
    ],
  },
];

// Credentials live in Settings (profileFields).
// The distribute form only collects budget, audience targets, schedule, and creative selection.
export const SOCIAL_PLATFORMS = {
  "Google Ads": {
    id: "google_ads",
    profileFields: [
      { key: "customer_id",     label: "Customer ID",     type: "text",     placeholder: "123-456-7890" },
      { key: "developer_token", label: "Developer Token", type: "password", placeholder: "" },
    ],
  },
  "Meta/Instagram": {
    id: "meta",
    profileFields: [
      { key: "access_token",  label: "Access Token",  type: "password", placeholder: "EAA…" },
      { key: "ad_account_id", label: "Ad Account ID", type: "text",     placeholder: "act_…" },
    ],
  },
  "YouTube": {
    id: "youtube",
    profileFields: [
      { key: "api_key",    label: "YouTube API Key", type: "password", placeholder: "AIza…" },
      { key: "channel_id", label: "Channel ID",      type: "text",     placeholder: "UC…" },
    ],
  },
  "LinkedIn": {
    id: "linkedin",
    profileFields: [
      { key: "access_token",    label: "Access Token",     type: "password", placeholder: "" },
      { key: "organization_id", label: "Organization URN", type: "text",     placeholder: "urn:li:organization:…" },
    ],
  },
  "Twitter/X": {
    id: "twitter",
    profileFields: [
      { key: "api_key",      label: "API Key",      type: "password", placeholder: "" },
      { key: "api_secret",   label: "API Secret",   type: "password", placeholder: "" },
      { key: "access_token", label: "Access Token", type: "password", placeholder: "" },
    ],
  },
  "TikTok": {
    id: "tiktok",
    profileFields: [
      { key: "access_token",  label: "Access Token",  type: "password", placeholder: "" },
      { key: "advertiser_id", label: "Advertiser ID", type: "text",     placeholder: "" },
    ],
  },
  "Email": {
    id: "email",
    profileFields: [
      { key: "smtp_host",  label: "SMTP Host",  type: "text", placeholder: "smtp.gmail.com" },
      { key: "smtp_port",  label: "Port",       type: "text", placeholder: "587" },
      { key: "from_email", label: "From Email", type: "text", placeholder: "hello@company.com" },
    ],
  },
};

// ─── Profile persistence (localStorage) ──────────────────────────────────────
const PROFILES_KEY = "pub_platform_profiles";

export function loadProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || "{}"); }
  catch { return {}; }
}

export function saveProfiles(profiles) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
}
