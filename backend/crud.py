from sqlalchemy.orm import Session
from . import schemas # Ensure this matches your Pydantic schemas location
from .models.user import User as UserModel # Corrected import
from .schemas import UserCreate, BookmarkCreate # Import BookmarkCreate
from . import auth_utils # CHANGED: Import the module itself
from typing import Optional, List
from .models.bookmark import Bookmark as BookmarkModel # Import Bookmark model
from passlib.context import CryptContext

# --- User CRUD Operations ---

def get_user(db: Session, user_id: int) -> Optional[UserModel]: # Use UserModel
    """Fetches a user by their ID."""
    return db.query(UserModel).filter(UserModel.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[UserModel]: # Use UserModel
    """Fetches a user by their email address."""
    return db.query(UserModel).filter(UserModel.email == email).first()

def create_user(db: Session, user: UserCreate) -> UserModel: # Type hint uses the imported UserCreate
    """Creates a new user in the database."""
    hashed_password = auth_utils.get_password_hash(user.password) # CHANGED: Call using auth_utils.get_password_hash
    db_user = UserModel( # Use UserModel
        name=user.name, 
        email=user.email, 
        hashed_password=hashed_password,
        current_xp=0  # Initialize XP, User model should have default too
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def increment_user_xp(db: Session, user_id: int, amount: int) -> Optional[UserModel]: # Use UserModel
    """Increments the XP for a given user and returns the updated user."""
    db_user = db.query(UserModel).filter(UserModel.id == user_id).first() # Use UserModel
    if db_user:
        # Ensure current_xp is not None if your model allows it (though it defaults to 0)
        current_xp = db_user.current_xp if db_user.current_xp is not None else 0
        db_user.current_xp = current_xp + amount
        db.commit()
        db.refresh(db_user)
        return db_user
    return None

# --- Bookmark CRUD Operations ---

def create_bookmark(db: Session, bookmark_data: BookmarkCreate, user_id: int) -> BookmarkModel:
    """Creates a new bookmark for a user."""
    db_bookmark = BookmarkModel(
        **bookmark_data.dict(), # Spread fields from Pydantic model
        user_id=user_id
    )
    db.add(db_bookmark)
    db.commit()
    db.refresh(db_bookmark)
    return db_bookmark

def get_bookmarks_by_user(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[BookmarkModel]:
    """Retrieves all bookmarks for a specific user with pagination."""
    return (
        db.query(BookmarkModel)
        .filter(BookmarkModel.user_id == user_id)
        .order_by(BookmarkModel.created_at.desc()) # Show newest first
        .offset(skip)
        .limit(limit)
        .all()
    )

def delete_bookmark(db: Session, bookmark_id: int, user_id: int) -> Optional[BookmarkModel]:
    """Deletes a specific bookmark owned by a user."""
    db_bookmark = (
        db.query(BookmarkModel)
        .filter(BookmarkModel.id == bookmark_id, BookmarkModel.user_id == user_id)
        .first()
    )
    if db_bookmark:
        db.delete(db_bookmark)
        db.commit()
        return db_bookmark # Return the deleted item (or just True/None)
    return None

# --- Admin CRUD Operations (New) ---

def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[UserModel]: # Use UserModel
    """Retrieves a list of all users, with pagination."""
    return db.query(UserModel).offset(skip).limit(limit).all()

# You might add other CRUD functions here later, e.g., update_user, delete_user 