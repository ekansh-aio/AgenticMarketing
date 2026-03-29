"""
Profile Routes — self-service for any authenticated user.
All roles can GET/PATCH their own profile and change their password.
"""

import random
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import User, Company
from app.schemas.schemas import ProfileOut, ProfileUpdate, PasswordChange
from app.core.security import get_current_user, hash_password, verify_password
from app.core.email import send_otp_email

router = APIRouter(prefix="/profile", tags=["Profile"])

# In-memory OTP store: { user_id: { "otp": str, "expires_at": datetime } }
# Suitable for single-process deployments (SQLite / dev).
# For multi-process production, replace with Redis or a DB table.
_otp_store: dict[str, dict] = {}


def _generate_otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


async def _profile_response(user: User, db: AsyncSession) -> dict:
    """Build the ProfileOut payload, fetching company name."""
    result = await db.execute(select(Company).where(Company.id == user.company_id))
    company = result.scalar_one_or_none()
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at,
        "company_name": company.name if company else None,
    }


# ─── GET /api/profile/me ─────────────────────────────────────────────────────

@router.get("/me", response_model=ProfileOut)
async def get_profile(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the authenticated user's profile."""
    return await _profile_response(user, db)


# ─── PATCH /api/profile/me ───────────────────────────────────────────────────

@router.patch("/me", response_model=ProfileOut)
async def update_profile(
    body: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the authenticated user's display name."""
    user.full_name = body.full_name.strip()
    await db.flush()
    return await _profile_response(user, db)


# ─── POST /api/profile/me/request-otp ───────────────────────────────────────

@router.post("/me/request-otp")
async def request_otp(
    user: User = Depends(get_current_user),
):
    """Generate and email a 6-digit OTP to the user's registered address."""
    otp = _generate_otp()
    _otp_store[user.id] = {
        "otp": otp,
        "expires_at": datetime.utcnow() + timedelta(minutes=10),
    }
    await send_otp_email(user.email, user.full_name, otp)
    # Mask email for display: j***@example.com
    local, _, domain = user.email.partition("@")
    masked = local[:1] + "***@" + domain
    return {"message": "Verification code sent", "masked_email": masked}


# ─── POST /api/profile/me/change-password ───────────────────────────────────

@router.post("/me/change-password")
async def change_password(
    body: PasswordChange,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Verify OTP and update the user's password."""
    record = _otp_store.get(user.id)

    if not record:
        raise HTTPException(
            status_code=400,
            detail="No verification code found. Please request a new one.",
        )

    if datetime.utcnow() > record["expires_at"]:
        _otp_store.pop(user.id, None)
        raise HTTPException(
            status_code=400,
            detail="Verification code has expired. Please request a new one.",
        )

    if record["otp"] != body.otp:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    if verify_password(body.new_password, user.hashed_pw):
        raise HTTPException(
            status_code=400,
            detail="New password must be different from your current password.",
        )

    user.hashed_pw = hash_password(body.new_password)
    _otp_store.pop(user.id, None)
    await db.flush()
    return {"message": "Password changed successfully."}
