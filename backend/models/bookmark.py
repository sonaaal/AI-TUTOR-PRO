from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func # For server_default=func.now()
from ..database import Base # Assuming your Base is in backend/database.py

class Bookmark(Base):
    __tablename__ = "bookmarks"

    id = Column(Integer, primary_key=True, index=True)
    question_text = Column(String, nullable=False)
    question_source = Column(String, nullable=True) # e.g., "practice_algebra", "main_solver_ocr", etc.
    # For more complex metadata, like the steps of a solved problem, or the original image_url if applicable
    metadata_json = Column(JSON, nullable=True) # Use JSON type if your DB supports it (SQLite does with JSON1 extension)
                                            # Alternatively, use String and store JSON as text.

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    owner = relationship("User") # Defines the relationship to the User model

    def __repr__(self):
        return f"<Bookmark(id={self.id}, text='{self.question_text[:30]}...', user_id={self.user_id})>" 