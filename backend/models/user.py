from sqlalchemy import Column, Integer, String, Boolean # Add Boolean for disabled if needed
from backend.database import Base # Import Base from your database.py

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    current_xp = Column(Integer, default=0, nullable=False)
    # is_active = Column(Boolean, default=True) # Optional: if you have user activation
