from pydantic import BaseModel, EmailStr, constr, Field
from typing import Optional, List, Dict, Any, Literal, Union
from datetime import date, datetime # For _FullPuzzleStore if moved here

# --- Base User Schemas (not directly used by API usually, but good for inheritance) ---
class UserBase(BaseModel):
    email: EmailStr
    name: Optional[str] = None

# --- Schema for User Creation (used by POST /api/register -> crud.create_user) ---
class UserCreate(UserBase):
    password: str  # Plain password from the registration request

# --- Schema for User Update (if you implement user updates later) ---
# class UserUpdate(UserBase):
#     pass

# --- Schema for representing a user as stored in DB (used by get_current_user if it returned Pydantic model)
# Your get_current_user currently returns the SQLAlchemy model directly, which is fine.
# This Pydantic UserInDB was used for the fake_users_db list.
# For consistency with SQLAlchemy model, ensure fields match.
class UserInDB(UserBase):
    id: int # Assuming your SQLAlchemy User model will have an id from the DB
    hashed_password: str # This would be from the DB
    current_xp: int = 0
    # disabled: Optional[bool] = None # If you add this to your DB model

    class Config:
        from_attributes = True

# --- Schemas for API Responses --- 
class UserResponse(UserBase):  # For public user data (e.g., in TokenResponse, /api/users/me)
    id: int
    # name: str # Already in UserBase
    # email: EmailStr # Already in UserBase
    current_xp: int # Often useful to return current_xp

    class Config:
        from_attributes = True

class UserDataResponse(UserBase): # For /user/data endpoint
    id: int # Usually good to include the ID
    # name: str # Already in UserBase
    # email: EmailStr # Already in UserBase
    current_xp: int

    class Config:
        from_attributes = True

# --- Token Schemas --- 
class TokenData(BaseModel):
    email: Optional[str] = None # Or user_id, depending on what's in JWT 'sub'

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse # Embeds the UserResponse schema

# --- Schemas for API Requests (specific to operations, can also be here) ---
class UserRegistrationRequest(BaseModel):
    name: str
    email: EmailStr
    password: constr(min_length=6)

class RegistrationResponse(BaseModel):
    message: str
    user: Optional[Dict[str, Any]] = None # Example: { "name": "John Doe", "email": "jdoe@example.com" }
    error: Optional[str] = None

# --- Schemas for Math Solver & Explanations (can be moved here from main.py) ---
class Step(BaseModel):
    step_number: int
    explanation: str

class SolutionResponse(BaseModel):
    original_problem: Optional[str] = None
    steps: List[Step]
    final_answer: Optional[str] = None
    error: Optional[str] = None
    updated_xp: Optional[int] = None
    class Config:
        from_attributes = True

class ExplanationRequest(BaseModel):
    problem_text: str
    all_steps: List[Step]
    step_number_to_explain: int
    query_type: str

class ExplanationResponse(BaseModel):
    explanation: str
    error: Optional[str] = None
    updated_xp: Optional[int] = None
    class Config:
        from_attributes = True

class PracticeRequest(BaseModel):
    topic: str
    previous_problem: Optional[str] = None

class PracticeResponse(BaseModel):
    problem: Optional[str] = None
    solution_explanation: Optional[str] = None
    error: Optional[str] = None
    updated_xp: Optional[int] = None
    class Config:
        from_attributes = True

# --- Daily Puzzle Schemas (Moved from main.py) ---
class DailyPuzzleResponse(BaseModel):
    puzzle_id: str
    question: str
    difficulty: Optional[str] = None
    class Config:
        from_attributes = True # Good practice, though may not be directly from DB always

class _FullPuzzleStore(BaseModel): # Internal, not for API response directly but used by _cached_daily_puzzle
    puzzle_id: str
    question: str
    answer: str
    difficulty: Optional[str]
    generated_on_date: date # Ensure date is imported from datetime at the top
    class Config:
        from_attributes = True

class SubmitPuzzleRequest(BaseModel):
    puzzle_id: str
    user_answer: str

class SubmitPuzzleResponse(BaseModel):
    is_correct: bool
    message: str
    correct_answer: Optional[str] = None
    puzzle_id: str
    class Config:
        from_attributes = True

# --- Schemas for Image Upload / OCR ---
class ImageUploadResponse(BaseModel):
    status: str
    extracted_text: Optional[str] = None
    error: Optional[str] = None
    # class Config: # Not strictly necessary if not mapping from DB model directly
    #     from_attributes = True # Pydantic V2 style

class SolveTextRequest(BaseModel):
    question_text: str

class ProblemRequest(BaseModel): # This might be used by /generate-solution
    problem_text: str

# --- Schemas for Drawing Recognition ---
class DrawingRequest(BaseModel):
    drawing_data_url: str

class RecognitionResponse(BaseModel):
    recognized_text: Optional[str] = None
    error: Optional[str] = None
    # class Config:
    #     from_attributes = True

# --- Schemas for Graphing ---
class GraphRequest(BaseModel):
    equation: str

class GraphResponse(BaseModel):
    image_data_url: Optional[str] = None
    error: Optional[str] = None
    # class Config:
    #     from_attributes = True

# --- Schemas for Mistake Diagnosis ---
class DiagnoseSolutionRequest(BaseModel):
    problem_text: str
    user_steps: str

class DiagnoseSolutionResponse(BaseModel):
    feedback: str
    error: Optional[str] = None
    # class Config:
    #     from_attributes = True

# --- Bookmark Schemas ---
class BookmarkBase(BaseModel):
    question_text: str
    question_source: Optional[str] = None
    metadata_json: Optional[Dict[Any, Any]] = None # Or just Optional[Any] if more flexible

class BookmarkCreate(BookmarkBase):
    pass # No extra fields needed for creation beyond BookmarkBase, user_id comes from token

class BookmarkResponse(BookmarkBase):
    id: int
    user_id: int # Good to show who owns the bookmark
    created_at: datetime # To show when it was bookmarked

    class Config:
        from_attributes = True # For Pydantic V2 (was orm_mode)

# --- Schemas for Chat History (NEW) ---
class ChatMessageSchema(BaseModel):
    sender: str # "user" or "ai"
    text: str
    # We don't necessarily need timestamp or id for the history context for Gemini
    # but they could be added if useful for other backend logic.

# --- Schemas for Chat Mode --- 
class ChatRequest(BaseModel):
    question: str
    history: Optional[List[ChatMessageSchema]] = None # NEW: To send chat history

class ChatResponse(BaseModel):
    answer: str

# --- Schemas for Image Upload & OCR ---
# ... existing code ...

# ... (You can move other Pydantic models like GraphRequest etc. here too if not already done) ... 

# --- Schemas for /cs/questions ---

class CSQuestionRequest(BaseModel):
    chapter_name: str
    # user_id: Optional[str] = None # For future personalization
    requested_question_type: Optional[Literal["mcq", "coding", "theory"]] = None

# --- Response Schemas (mirroring TypeScript interfaces) ---

class MCQOptionSchema(BaseModel):
    id: str
    text: str

class BaseCSQuestionSchema(BaseModel):
    id: str = Field(..., description="Unique ID for the question")
    chapter: str = Field(..., description="Chapter/Topic the question belongs to")
    question_text: str = Field(..., description="The main text of the question")
    question_type: Literal["mcq", "coding", "theory"] # Type added to base

class MCQQuestionResponseSchema(BaseCSQuestionSchema):
    question_type: Literal["mcq"] = "mcq"
    options: List[MCQOptionSchema] = Field(..., min_items=2)

class CodingProblemResponseSchema(BaseCSQuestionSchema):
    question_type: Literal["coding"] = "coding"
    initial_code_stub: Optional[str] = None
    # language: Optional[str] = "python" 

class TheoryQuestionResponseSchema(BaseCSQuestionSchema):
    question_type: Literal["theory"] = "theory"
    
# Use Union for the response model in the endpoint definition
CSQuestionResponse = Union[MCQQuestionResponseSchema, CodingProblemResponseSchema, TheoryQuestionResponseSchema]


# --- Schemas for /cs/submit ---

class CSSubmissionRequest(BaseModel):
    question_id: str
    question_type: Literal["mcq", "coding", "theory"]
    question_text: str # ADDED: To provide context for evaluation
    answer: str # Code string, option_id, or theory text
    options: Optional[List[MCQOptionSchema]] = None # ADDED: For MCQs, to pass all presented options
    # user_id: Optional[str] = None

class CSSubmissionFeedbackResponse(BaseModel):
    correct: bool
    explanation: str
    detailed_solution: Optional[str] = None
    simulated_output: Optional[str] = None # Primarily for coding
    ai_feedback: Optional[str] = None 
    correct_option_id: Optional[str] = None # Added for MCQs
    correct_option_text: Optional[str] = None # Added for MCQs

# --- Schemas for Learning Aids ---

class LearningAidRequest(BaseModel):
    chapter_name: str
    aid_type: Literal["flashcards", "summary", "key_points"]
    # user_id: Optional[str] = None # For future personalization

class FlashcardSchema(BaseModel):
    question: str
    answer: str

class FlashcardsResponse(BaseModel):
    chapter: str
    aid_type: Literal["flashcards"] = "flashcards"
    flashcards: List[FlashcardSchema]

class SummaryResponse(BaseModel):
    chapter: str
    aid_type: Literal["summary"] = "summary"
    summary_text: str # Changed from 'summary' to 'summary_text' to avoid potential Pydantic model naming conflicts

class KeyPointsResponse(BaseModel):
    chapter: str
    aid_type: Literal["key_points"] = "key_points"
    key_points: List[str]

LearningAidResponse = Union[FlashcardsResponse, SummaryResponse, KeyPointsResponse]

# --- Schemas for Admin User View ---
class AdminUserView(UserBase): # Inherits email and name from UserBase
    id: int
    current_xp: int
    # We explicitly DO NOT include hashed_password or other sensitive fields

    class Config:
        from_attributes = True 