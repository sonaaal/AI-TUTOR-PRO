from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from .. import crud, schemas, models # Use .. to go up one level to access backend package modules
from ..database import get_db
from ..auth_utils import get_current_user # Assuming get_current_user is in auth_utils and returns SQLAlchemy User

router = APIRouter(
    prefix="/api/bookmarks",
    tags=["bookmarks"],
    dependencies=[Depends(get_current_user)] # All routes in this router will require authentication
)

@router.post("/", response_model=schemas.BookmarkResponse, status_code=status.HTTP_201_CREATED)
async def create_new_bookmark(
    bookmark_in: schemas.BookmarkCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user) # Get the authenticated SQLAlchemy User model
):
    """
    Create a new bookmark for the authenticated user.
    """
    db_bookmark = crud.create_bookmark(db=db, bookmark_data=bookmark_in, user_id=current_user.id)
    return db_bookmark

@router.get("/", response_model=List[schemas.BookmarkResponse])
async def read_user_bookmarks(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Retrieve all bookmarks for the authenticated user.
    """
    bookmarks = crud.get_bookmarks_by_user(db=db, user_id=current_user.id, skip=skip, limit=limit)
    return bookmarks

@router.delete("/{bookmark_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bookmark(
    bookmark_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """
    Delete a specific bookmark owned by the authenticated user.
    """
    deleted_bookmark = crud.delete_bookmark(db=db, bookmark_id=bookmark_id, user_id=current_user.id)
    if not deleted_bookmark:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bookmark with id {bookmark_id} not found or you do not have permission to delete it."
        )
    # No content is returned on successful deletion with 204 status
    return 