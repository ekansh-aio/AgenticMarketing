"""
Email utility — OTP delivery for password-change verification.
Falls back to console logging in development (when SMTP_HOST is not set).
"""

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


async def send_otp_email(to_email: str, full_name: str, otp: str) -> None:
    """Send a 6-digit OTP to the user's email address.

    If SMTP_HOST is not configured the code is printed to stdout so
    developers can complete the flow without a mail server.
    """
    subject = "Your Password Change Verification Code"
    first_name = full_name.split()[0] if full_name else "there"

    plain_body = (
        f"Hi {first_name},\n\n"
        f"Your verification code is:\n\n"
        f"  {otp}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you did not request a password change, you can safely ignore this email.\n\n"
        f"— AgenticMarketing"
    )

    html_body = f"""
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;background:#f9fafb;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;
              padding:32px;border:1px solid #e5e7eb;">
    <h2 style="color:#111827;margin-top:0;">Password Change Request</h2>
    <p style="color:#374151;">Hi {first_name},</p>
    <p style="color:#374151;">Use the code below to verify your identity. It expires in
       <strong>10 minutes</strong>.</p>
    <div style="text-align:center;margin:28px 0;">
      <span style="display:inline-block;background:#f3f4f6;border-radius:8px;
                   padding:14px 32px;font-size:2rem;font-weight:700;
                   letter-spacing:0.25em;color:#111827;">{otp}</span>
    </div>
    <p style="color:#6b7280;font-size:0.85rem;">
      If you did not request a password change, ignore this email — your account
      remains secure.
    </p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="color:#9ca3af;font-size:0.78rem;margin:0;">AgenticMarketing Platform</p>
  </div>
</body>
</html>
"""

    if not settings.SMTP_HOST:
        # Dev / no-SMTP fallback — log OTP so developers can test the flow.
        logger.info(
            "[EMAIL — dev mode] To: %s | Subject: %s | OTP: %s",
            to_email, subject, otp,
        )
        print(f"\n{'='*50}\n[DEV] OTP for {to_email}: {otp}\n{'='*50}\n")
        return

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = to_email
        msg.attach(MIMEText(plain_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.ehlo()
            if settings.SMTP_TLS:
                server.starttls()
                server.ehlo()
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD or "")
            server.sendmail(settings.SMTP_FROM, to_email, msg.as_string())

        logger.info("OTP email sent to %s", to_email)
    except Exception as exc:
        # Log and swallow — the OTP is still stored; user can retry.
        logger.error("Failed to send OTP email to %s: %s", to_email, exc)
