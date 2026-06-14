from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.schemas.audit import AuditCreate, AuditOut
from app.services.content_auditor import analyze_content, fetch_url_content

router = APIRouter(prefix="/audits", tags=["audits"])


@router.post("", response_model=AuditOut, status_code=status.HTTP_201_CREATED)
def create_audit(
    payload: AuditCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AuditLog:
    if payload.url:
        try:
            fetched_title, content = fetch_url_content(payload.url)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"Could not fetch URL: {exc}"
            ) from exc
        title = payload.title or fetched_title
    else:
        content = payload.content or ""
        title = payload.title or "Untitled content"

    result = analyze_content(content)

    audit_log = AuditLog(
        user_id=user.id,
        content_title=title,
        geo_score=result.geo_score,
        suggestions_json={"suggestions": [s.model_dump() for s in result.suggestions]},
    )
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log


@router.get("", response_model=list[AuditOut])
def list_audits(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[AuditLog]:
    return (
        db.query(AuditLog)
        .filter(AuditLog.user_id == user.id)
        .order_by(AuditLog.created_at.desc())
        .all()
    )


@router.get("/{audit_id}", response_model=AuditOut)
def get_audit(
    audit_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> AuditLog:
    audit_log = db.get(AuditLog, audit_id)
    if audit_log is None or audit_log.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")
    return audit_log
