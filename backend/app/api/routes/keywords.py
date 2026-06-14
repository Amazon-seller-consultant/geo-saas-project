from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.keyword import Keyword
from app.models.rank_history import RankHistory
from app.models.user import User
from app.schemas.keyword import KeywordCreate, KeywordOut, KeywordUpdate, RankHistoryOut
from app.schemas.rank_tracker import RankCheckResult
from app.services.rank_tracker import check_keyword_mention

router = APIRouter(prefix="/keywords", tags=["keywords"])


def _get_owned_keyword(keyword_id: int, user: User, db: Session) -> Keyword:
    keyword = db.get(Keyword, keyword_id)
    if keyword is None or keyword.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Keyword not found")
    return keyword


@router.post("", response_model=KeywordOut, status_code=status.HTTP_201_CREATED)
def create_keyword(
    payload: KeywordCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Keyword:
    keyword = Keyword(
        user_id=user.id,
        keyword_text=payload.keyword_text,
        target_domain=payload.target_domain,
        competitor_domains=payload.competitor_domains,
    )
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
    return keyword


@router.get("", response_model=list[KeywordOut])
def list_keywords(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[Keyword]:
    return db.query(Keyword).filter(Keyword.user_id == user.id).order_by(Keyword.created_at.desc()).all()


@router.get("/{keyword_id}", response_model=KeywordOut)
def get_keyword(
    keyword_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Keyword:
    return _get_owned_keyword(keyword_id, user, db)


@router.patch("/{keyword_id}", response_model=KeywordOut)
def update_keyword(
    keyword_id: int,
    payload: KeywordUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Keyword:
    keyword = _get_owned_keyword(keyword_id, user, db)
    keyword.competitor_domains = payload.competitor_domains
    db.add(keyword)
    db.commit()
    db.refresh(keyword)
    return keyword


@router.delete("/{keyword_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_keyword(
    keyword_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> None:
    keyword = _get_owned_keyword(keyword_id, user, db)
    db.delete(keyword)
    db.commit()


@router.post("/{keyword_id}/check", response_model=RankCheckResult)
def check_keyword(
    keyword_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> RankCheckResult:
    keyword = _get_owned_keyword(keyword_id, user, db)
    return check_keyword_mention(keyword, db)


@router.get("/{keyword_id}/history", response_model=list[RankHistoryOut])
def get_keyword_history(
    keyword_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[RankHistory]:
    keyword = _get_owned_keyword(keyword_id, user, db)
    return (
        db.query(RankHistory)
        .filter(RankHistory.keyword_id == keyword.id)
        .order_by(RankHistory.checked_at.desc())
        .all()
    )
