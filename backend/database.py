# backend/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
#from .core.config import settings # Assuming you'll put DATABASE_URL in config

# SQLALCHEMY_DATABASE_URL = "sqlite:///./math_wiz_app.db" # Example for SQLite
# Or, for PostgreSQL:
# SQLALCHEMY_DATABASE_URL = "postgresql://user:password@postgresserver/db"

SQLALCHEMY_DATABASE_URL = "sqlite:///./math_wiz_app.db" # Matches your alembic.ini

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False} # Needed for SQLite with FastAPI's default threading
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()