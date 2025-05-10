import os
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any

from jose import JWTError, jwt
from passlib.context import CryptContext
import bcrypt # We'll continue to use bcrypt for password hashing/checking for now

# NEW IMPORTS for get_current_user
import logging # For logger
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
# Assuming these relative imports will work from auth_utils.py's location
from .database import get_db # To get DB session
from . import crud          # To fetch user by email
from .models import User as UserModel # To type hint the returned user

# --- Configuration ---
# !!IMPORTANT!!: Generate a strong, random secret key and store it securely (e.g., env variable)
# For demonstration, we'll use a hardcoded key. DO NOT DO THIS IN PRODUCTION.
SECRET_KEY = os.environ.get("JWT_SECRET_KEY", "your-super-secret-random-string-for-jwt-32-chars-long")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30 # Token validity period

# NEW: Define logger if not already defined (or ensure it's configured globally)
logger = logging.getLogger(__name__) # Create a logger instance for this module

# NEW: OAuth2 Scheme (moved from main.py)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login") # Ensure tokenUrl matches your login route in main.py

# Password hashing context (we'll stick to bcrypt directly for verification for now)
# pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- JWT Token Functions ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# --- Password Verification --- 
# (We are using bcrypt directly in main.py for now, but this is where it could go)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    # This uses passlib if you switch to pwd_context for hashing new passwords
    # return pwd_context.verify(plain_password, hashed_password)
    # For current setup with bcrypt directly:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# --- Get Password Hash ---
# (If you decide to centralize hashing here)
def get_password_hash(password: str) -> str:
   """Hashes a password using bcrypt."""
   password_bytes = password.encode('utf-8')
   salt = bcrypt.gensalt()
   hashed_password_bytes = bcrypt.hashpw(password_bytes, salt)
   return hashed_password_bytes.decode('utf-8')


# --- Decode/Verify JWT for Protected Routes (Example, more robust version needed for FastAPI Depends) ---
# This is a basic decode, FastAPI integration usually involves a dependency function.
def decode_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

# More to come here for FastAPI dependency injection for protected routes.

# NEW: get_current_user function (moved from main.py)
async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserModel:
    logger.info(f"get_current_user (auth_utils): Attempting to validate token (first 30 chars): {token[:30]}...")
    credentials_exception = HTTPException(
        status_code=401, # Unauthorized
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, SECRET_KEY, algorithms=[ALGORITHM] # SECRET_KEY and ALGORITHM are already in auth_utils.py
        )
        logger.info(f"get_current_user (auth_utils): Token decoded successfully. Payload: {payload}")
        email: Optional[str] = payload.get("sub")
        if email is None:
            logger.warning("get_current_user (auth_utils): Token decoding failed - 'sub' (email) not found in token payload.")
            raise credentials_exception
        logger.info(f"get_current_user (auth_utils): Email from token 'sub': {email}")
    except JWTError as e:
        logger.warning(f"get_current_user (auth_utils): Token decoding JWTError: {e}")
        raise credentials_exception
    except Exception as e: # Catch any other unexpected errors during decoding
        logger.error(f"get_current_user (auth_utils): Unexpected error during token decoding: {e}", exc_info=True)
        raise credentials_exception
    
    user = crud.get_user_by_email(db, email=email)

    if user is None:
        logger.warning(f"get_current_user (auth_utils): Token validation failed - User '{email}' from token not found in DB.")
        raise credentials_exception
    
    logger.info(f"get_current_user (auth_utils): User '{email}' found in DB. Returning user object.")
    return user 