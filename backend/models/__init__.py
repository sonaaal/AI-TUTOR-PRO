# backend/models/__init__.py
from .user import User         # Assuming User model is in backend/models/user.py
from .bookmark import Bookmark   # Assuming Bookmark model is in backend/models/bookmark.py

# This makes Base available if you import it from backend.models later,
# though typically Base is imported directly from backend.database
# from ..database import Base 