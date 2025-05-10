import os
import shutil
import logging
from datetime import timedelta # Added timedelta for token expiry
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm # Added OAuth2
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from typing import List, Dict, Any, Optional
import io
import re
from fastapi.concurrency import run_in_threadpool
from datetime import date # Add date for daily puzzle

from . import config # Use relative import
# Import placeholder modules (will create these next)
from . import ocr      # Use relative import
from . import solver   # Use relative import
from . import speech   # Use relative import
from . import utils    # Use relative import
from . import graphing # Import the new graphing module
from . import auth_utils # Added import for auth_utils
from .database import get_db # ADDED
from sqlalchemy.orm import Session # ADDED
from . import crud # ADDED
from .models import User as UserModel # NEW Import, assuming User is now in backend/models/user.py and exported via backend/models/__init__.py
from . import schemas # ADDED (Ensure this path is correct for your Pydantic schemas)
from .routers import bookmarks as bookmarks_router # NEW: Import the bookmarks router
from .routers import cs_router # Corrected relative import

# NEW: Import get_current_user and oauth2_scheme from auth_utils if they are still used by endpoints in main.py
# If not used by any endpoint in main.py anymore, these lines can be removed.
from .auth_utils import get_current_user, oauth2_scheme # <-- IMPORT MOVED FUNCTION

# ---> MOVE Logging Setup UP <---
# --- Logging Setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
# ---> END MOVE <---

# ---> ADD Gemini Import and Configuration <---
genai = None
try:
    import google.generativeai as genai_import
    if config.GOOGLE_API_KEY:
        genai_import.configure(api_key=config.GOOGLE_API_KEY)
        genai = genai_import # Assign only if key exists
        logger.info("Google Generative AI configured successfully (for main.py).")
    else:
        logger.warning("Google API Key not found in config/env. Some Gemini features in main.py might be disabled.")
except ImportError:
    logger.warning("google-generativeai package not installed. Gemini features in main.py disabled.")
except Exception as e:
    logger.error(f"Error configuring Google Generative AI in main.py: {e}")
# ---> END ADDITION <---

# --- FastAPI App Initialization ---
app = FastAPI(
    title="Math Wiz Assistant API",
    description="API for solving math problems from text or images.",
    version="0.1.0",
)
print("!!! DEBUG: FastAPI app object created !!!")

# Include the new router
app.include_router(bookmarks_router.router) # NEW
app.include_router(cs_router.router) # Include the new CS router

# --- CORS Configuration ---
# List of origins that are allowed to make requests.
# Use ["*"] for development to allow all origins,
# or be specific in production e.g., ["http://localhost:5173", "https://yourdomain.com"]
# Note: Check the actual port your Vite/React dev server runs on (often 5173 or 3000)
origins = [
    "http://localhost:8003", # The origin shown in your error
    "http://127.0.0.1:8003", # Might as well allow this too
    "http://localhost:5173", # Common Vite default port - CHECK YOURS!
    "http://localhost:3000",  # Common React default port - CHECK YOURS!
    # Add the actual origin of your frontend if it's different
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Allows specific origins
    allow_credentials=True, # Allows cookies/authorization headers
    allow_methods=["*"],    # Allows all methods (GET, POST, PUT, etc.)
    allow_headers=["*"],    # Allows all headers
)

# --- Ensure Upload Directory Exists ---
os.makedirs(config.UPLOAD_FOLDER, exist_ok=True)

# --- Helper Functions (Consider moving to utils.py later) ---
def is_allowed_file(filename: str):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in config.ALLOWED_EXTENSIONS

# --- Pydantic Models for Request/Response --- ARE NOW MOVED TO schemas.py ---
# Ensure the following definitions (DailyPuzzleResponse, _FullPuzzleStore, etc.)
# are DELETED from main.py if they were not already removed in the previous big refactor.

# --- Global Cache for Daily Puzzle (remains the same if _FullPuzzleStore is now imported via schemas) ---
# This line should now correctly use schemas._FullPuzzleStore
_cached_daily_puzzle: Optional[schemas._FullPuzzleStore] = None

# ---> XP System Constants <---
XP_FOR_SOLVING_PROBLEM = 10
XP_FOR_EXPLAINING_STEP = 5
XP_FOR_PRACTICE_PROBLEM = 30 # Example value, adjust as needed
# ---> END XP System Constants <---

# --- OAuth2 Scheme --- (REMOVED - Now in auth_utils.py)
# oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/login")

# --- Dependency to Get Current User from Token --- (REMOVED - Now in auth_utils.py)
# async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> UserModel:
#     logger.info(f"get_current_user: Attempting to validate token (first 30 chars): {token[:30]}...")
#     credentials_exception = HTTPException(
#         status_code=401, # Unauthorized
#         detail="Could not validate credentials",
#         headers={"WWW-Authenticate": "Bearer"},
#     )
#     try:
#         payload = auth_utils.jwt.decode(
#             token, auth_utils.SECRET_KEY, algorithms=[auth_utils.ALGORITHM]
#         )
#         logger.info(f"get_current_user: Token decoded successfully. Payload: {payload}")
#         email: Optional[str] = payload.get("sub")
#         if email is None:
#             logger.warning("get_current_user: Token decoding failed - 'sub' (email) not found in token payload.")
#             raise credentials_exception
#         logger.info(f"get_current_user: Email from token 'sub': {email}")
#     except auth_utils.JWTError as e:
#         logger.warning(f"get_current_user: Token decoding JWTError: {e}")
#         raise credentials_exception
#     except Exception as e:
#         logger.error(f"get_current_user: Unexpected error during token decoding: {e}", exc_info=True)
#         raise credentials_exception
#     
#     user = crud.get_user_by_email(db, email=email) # NEW: Fetch from DB using CRUD
# 
#     if user is None:
#         logger.warning(f"get_current_user: Token validation failed - User '{email}' from token not found in DB.")
#         raise credentials_exception
#     
#     logger.info(f"get_current_user: User '{email}' found in DB. Returning user object.")
#     return user # Now returns SQLAlchemy UserModel instance

# --- Placeholder Gemini API Interaction Functions ---
# Replace these with your actual Gemini API calls

def call_gemini_for_solution(problem: str) -> Dict[str, Any]:
    """
    Placeholder function to simulate calling Gemini for a step-by-step solution.
    """
    print(f"Simulating Gemini call for problem: {problem[:50]}...")
    # TODO: Implement actual Gemini API call here
    # Construct the prompt asking for numbered steps in JSON format
    # Make the API request using your key/SDK
    # Parse the response

    # Example Simulated Response Structure (replace with actual API result)
    if "fail" in problem.lower(): # Simulate an error case
         return {"error": "Simulated Gemini error: Could not process the request."}
    elif "simple" in problem.lower():
        return {
            "problem": problem,
            "steps": [
                {"step_number": 1, "explanation": "Identify the operation (addition)."},
                {"step_number": 2, "explanation": "Perform the addition: 1 + 1 = 2."}
            ],
            "final_answer": "2"
        }
    else:
        return {
            "problem": problem,
            "steps": [
                {"step_number": 1, "explanation": "This is the first complex step."},
                {"step_number": 2, "explanation": "This is the second complex step, building on the first."},
                {"step_number": 3, "explanation": "This is the final complex step."}
            ],
            "final_answer": "Complex Result"
        }

def call_gemini_for_explanation(
    problem: str,
    all_steps: List[Dict], # Pass raw dicts if needed by API
    step_to_explain: Dict,
    query_type: str
    ) -> Dict[str, Any]:
    """
    Placeholder function to simulate calling Gemini for a step explanation.
    """
    step_num = step_to_explain.get("step_number", "N/A")
    print(f"Simulating Gemini call to explain step {step_num} ({query_type}) for problem: {problem[:50]}...")
    # TODO: Implement actual Gemini API call here
    # Construct the prompt providing context:
    # - Original problem
    # - All original steps
    # - The specific step text/number
    # - Ask Gemini to explain 'why' or 'how' for that step, acting as a tutor.
    # Make the API request

    # Example Simulated Response (replace with actual API result)
    if query_type == "why":
        explanation_text = f"Simulated 'Why' Explanation for Step {step_num}: This step is necessary because it sets up the calculation needed for the subsequent step ({step_num + 1}). It follows logically from Step {step_num - 1}."
    elif query_type == "how":
        explanation_text = f"Simulated 'How' Explanation for Step {step_num}: This step was performed by applying the standard formula/method for [relevant concept] to the result of Step {step_num - 1}."
    else:
        explanation_text = f"Simulated generic explanation for Step {step_num}."

    return {"explanation": explanation_text}

# ---> ADD Placeholder Recognition Function <---
# --- Placeholder Recognition API Function ---
async def call_recognition_service(image_data_url: str) -> Dict[str, Any]:
    """
    Placeholder function to simulate processing drawing data.
    Later, this will decode the data URL and send it to Mathpix/Google Vision/etc.
    """
    logger.info(f"Simulating recognition for image data: {image_data_url[:100]}...")
    # TODO: Decode base64 data URL
    # TODO: Send decoded image data to actual recognition API (e.g., Mathpix)
    # TODO: Handle API response

    # Simulate success or error based on input (e.g., data length)
    if len(image_data_url) < 100: # Arbitrary check for empty/small data
        return {"error": "Simulated error: Invalid image data received."}
    else:
        # Simulate successful recognition
        return {"recognized_text": "x^2 + y^2 = z^2 (simulated)"}
# ---> END ADDITION <---

# ---> REPLACE Placeholder Practice Problem Function with Gemini Implementation <---
async def call_gemini_for_practice(topic: str, previous_problem: Optional[str] = None) -> Dict[str, Any]:
    """
    Calls Gemini to generate a practice problem and its solution/explanation for a given topic,
    optionally considering a previous problem to generate a different one.
    """
    log_context = f"topic: {topic}" + (f", excluding: {previous_problem[:60]}..." if previous_problem else "")
    logger.info(f"Generating practice problem with Gemini for {log_context}")

    if not genai:
        logger.error("Gemini API client not configured or key is missing for practice generation.")
        return {"error": "Practice problem generation via AI model is not configured on the server."}

    try:
        model = genai.GenerativeModel('gemini-1.5-flash-latest') # Use a capable model

        # Construct the prompt, adding context if a previous problem was given
        prompt = f"""You are a math tutor.
Generate a practice problem suitable for a student learning about "{topic}".
Clearly state the problem.
"""

        if previous_problem:
            prompt += f"""
The student was just given the following problem:
Previous Problem: {previous_problem}
Please generate a DIFFERENT practice problem on the same topic ("{topic}") with a similar difficulty level.
"""
        else:
             prompt += """
This is the first practice problem requested for this topic.
"""
        
        prompt += """
Then, provide a detailed step-by-step solution and explanation for the specific new problem you generated.

Format your response like this:

Problem:
[State the practice problem here]

Solution & Explanation:
[Provide the full solution steps and explanation here]
"""

        logger.info(f"Sending request to Gemini model ({model.model_name}) for practice problem.")
        response = await model.generate_content_async(prompt)

        if response and hasattr(response, 'text'):
            raw_response_text = response.text
            logger.info(f"Received practice problem response from Gemini. Length: {len(raw_response_text)}")
            logger.debug(f"Gemini Raw Practice Response:\n{raw_response_text}")

            # Basic parsing based on the requested format
            problem_part = None
            solution_explanation_part = None

            problem_marker = "Problem:"
            solution_marker = "Solution & Explanation:"

            problem_match = re.search(rf"^{re.escape(problem_marker)}\s*(.*?)\s*(?:{re.escape(solution_marker)}|$)", raw_response_text, re.IGNORECASE | re.DOTALL)
            solution_match = re.search(rf"{re.escape(solution_marker)}\s*(.*)", raw_response_text, re.IGNORECASE | re.DOTALL)

            if problem_match:
                problem_part = problem_match.group(1).strip()
            
            if solution_match:
                solution_explanation_part = solution_match.group(1).strip()
            
            # Fallback if parsing fails - return the whole text as explanation?
            if not problem_part or not solution_explanation_part:
                 logger.warning("Could not parse Gemini response using markers. Returning full text as solution/explanation.")
                 # Decide on fallback behavior. Maybe return full text as explanation?
                 # Or try to split based on first newline?
                 parts = raw_response_text.split('\n', 1)
                 problem_part = parts[0] # Guess first line is problem
                 solution_explanation_part = parts[1] if len(parts) > 1 else raw_response_text # Rest is solution

            return {
                "problem": problem_part,
                "solution_explanation": solution_explanation_part,
                "error": None
            }

        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            logger.error(f"Gemini practice request blocked for topic '{topic}'. Reason: {block_reason}")
            return {"error": f"Content generation blocked by API. Reason: {block_reason}"}
        else:
            logger.error(f"Gemini practice response format unexpected or empty for topic '{topic}'. Response: {response}")
            return {"error": "AI model returned an unexpected or empty response."}

    except Exception as e:
        logger.error(f"Gemini practice generation failed for topic '{topic}': {e}", exc_info=True)
        err_str = str(e).lower()
        if "api key" in err_str or "permission denied" in err_str or "authentication" in err_str:
             return {"error": "AI Model Error: Authentication or Permission Issue."}
        else:
            return {"error": f"Failed to generate practice problem using AI model: {str(e)}"}
# ---> END REPLACEMENT <---

# NEW: Function to call Gemini for conversational chat
async def call_gemini_for_chat_message(user_question: str, chat_history: Optional[List[schemas.ChatMessageSchema]] = None) -> str:
    """
    Calls Gemini to get a conversational response to a user's math-related question,
    optionally considering the chat history for context.
    """
    logger.info(f"call_gemini_for_chat_message: Received question: {user_question[:100]}...")
    if chat_history:
        logger.info(f"call_gemini_for_chat_message: Received history with {len(chat_history)} messages.")

    if not genai:
        logger.error("Gemini API client not configured or key is missing for chat functionality.")
        # Consider raising an HTTPException here or returning an error string
        # that the endpoint can then package into a proper error response.
        return "Error: The AI chat service is not configured on the server."

    try:
        model = genai.GenerativeModel('gemini-1.5-flash-latest') # Or your preferred chat model
        
        # Construct the prompt with history
        prompt_parts = []
        prompt_parts.append("You are a friendly and helpful Math Wiz Assistant.")
        prompt_parts.append("Your goal is to provide clear, conversational, and helpful responses to math-related questions.")
        prompt_parts.append("When providing explanations or steps, ensure they are easy to understand.")
        prompt_parts.append("IMPORTANT: For any mathematical expressions or formulas, use KaTeX formatting. For inline math, enclose it in single dollar signs (e.g., $E=mc^2$). For block-level math, enclose it in double dollar signs (e.g., $$\sum_{{i=1}}^{{n}} i = \frac{{n(n+1)}}{{2}}$$).")

        if chat_history:
            prompt_parts.append("\nHere is the recent conversation history for context (last user message is the current question):")
            for message in chat_history:
                # Simple formatting for history. More sophisticated role mapping might be needed for some models.
                if message.sender == 'user':
                    prompt_parts.append(f'User previously asked: "{message.text}"')
                elif message.sender == 'ai':
                    prompt_parts.append(f'You previously responded: "{message.text}"')
        
        prompt_parts.append(f'\nUser\'s current question: "{user_question}"')
        prompt_parts.append("Your response:")
        
        full_prompt = "\n".join(prompt_parts)

        logger.info(f"Sending chat request to Gemini model ({model.model_name}). Prompt includes KaTeX instructions and history if provided.")
        logger.debug(f"Full prompt to Gemini:\n{full_prompt}") # Log the full prompt for debugging

        response = await model.generate_content_async(full_prompt)

        if response and hasattr(response, 'text'):
            ai_response_text = response.text.strip()
            logger.info(f"Received chat response from Gemini. Length: {len(ai_response_text)}")
            return ai_response_text
        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            logger.error(f"Gemini chat request blocked. Reason: {block_reason}")
            return f"Error: My response was blocked by the content safety filter (Reason: {block_reason}). Please try rephrasing your question."
        else:
            logger.error(f"Gemini chat response format unexpected or empty. Response: {response}")
            return "Error: The AI model returned an unexpected or empty response."

    except Exception as e:
        logger.error(f"Gemini chat generation failed: {e}", exc_info=True)
        err_str = str(e).lower()
        if "api key" in err_str or "permission denied" in err_str or "authentication" in err_str:
            return "AI Model Error: Authentication or Permission Issue. Please check server configuration."
        else:
            return f"Error: Failed to get a response from the AI model due to an internal server issue."

# --- API Endpoints ---
@app.post("/upload-image", response_model=schemas.ImageUploadResponse)
async def upload_image_for_ocr(file: UploadFile = File(...)):
    """
    Accepts an image file (JPG, PNG, PDF), performs OCR, and returns the extracted text.
    """
    if not is_allowed_file(file.filename):
        logger.warning(f"Upload attempt with disallowed file type: {file.filename}")
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed types: {config.ALLOWED_EXTENSIONS}")

    temp_file_path = os.path.join(config.UPLOAD_FOLDER, file.filename)
    logger.info(f"Receiving file: {file.filename}")

    try:
        # Save the uploaded file temporarily
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        logger.info(f"File saved temporarily to: {temp_file_path}")

        # Perform OCR
        extracted_text = await ocr.extract_text_from_image(temp_file_path)
        logger.info(f"OCR successful for {file.filename}. Text: {extracted_text[:50]}...")
        return schemas.ImageUploadResponse(status="success", extracted_text=extracted_text)

    except HTTPException as e:
        # Re-raise HTTP exceptions from OCR module
        logger.error(f"HTTPException during OCR for {file.filename}: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Error processing file {file.filename}: {e}", exc_info=True)
        # Return a generic error response
        return schemas.ImageUploadResponse(status="error", error=f"Failed to process image: {str(e)}")
    finally:
        # Clean up the temporary file
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
                logger.info(f"Temporary file deleted: {temp_file_path}")
            except Exception as e:
                logger.error(f"Error deleting temporary file {temp_file_path}: {e}")
        # Close the file handle explicitly
        await file.close()

@app.post("/solve-text", response_model=schemas.SolutionResponse)
async def solve_math_from_text(request: schemas.SolveTextRequest, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """
    Accepts math problem text, solves it, and returns the solution, steps, and explanation.
    NOW REQUIRES AUTHENTICATION.
    """
    logger.info(f"User '{current_user.email}' requested to solve: {request.question_text}")
    
    question = request.question_text
    if not question:
        raise HTTPException(status_code=400, detail="No question text provided.")

    updated_xp_value: Optional[int] = None # For the response

    try:
        solver_result = await solver.solve_math_problem(question)
        logger.info(f"Successfully solved: {question} for user {current_user.email}")

        # --- XP Increment Logic (DB based) ---
        if not solver_result.get("error"): # If solving was successful
            updated_user_model = crud.increment_user_xp(db=db, user_id=current_user.id, amount=XP_FOR_SOLVING_PROBLEM) # NEW
            if updated_user_model:
                updated_xp_value = updated_user_model.current_xp
                logger.info(f"Awarded {XP_FOR_SOLVING_PROBLEM} XP to {current_user.email}. New XP: {updated_xp_value}")
            else:
                logger.warning(f"Could not find/update user {current_user.email} (ID: {current_user.id}) in DB to update XP after solving.")
        # --- End XP Increment Logic ---

        if solver_result.get("error"):
            return schemas.SolutionResponse(
                original_problem=question,
                steps=[], 
                error=solver_result["error"],
                updated_xp=updated_xp_value
            )

        formatted_steps: List[schemas.Step] = []
        raw_steps = solver_result.get("steps")
        if raw_steps and isinstance(raw_steps, list):
            for i, step_text in enumerate(raw_steps):
                if isinstance(step_text, str):
                    formatted_steps.append(schemas.Step(step_number=i + 1, explanation=step_text))
        
        final_answer_str: Optional[str] = None
        raw_solution = solver_result.get("solution")
        if raw_solution:
             if isinstance(raw_solution, list):
                 final_answer_str = ", ".join(map(str, raw_solution))
             else:
                  final_answer_str = str(raw_solution)

        return schemas.SolutionResponse(
            original_problem=question,
            steps=formatted_steps,
            final_answer=final_answer_str,
            error=None,
            updated_xp=updated_xp_value
        )
    except HTTPException as e:
        logger.error(f"HTTPException during solving '{question}' for user {current_user.email}: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Error solving question '{question}' for user {current_user.email}: {e}", exc_info=True)
        return schemas.SolutionResponse(
            original_problem=question, 
            steps=[], 
            error=f"Failed to solve the math problem: {str(e)}",
            updated_xp=updated_xp_value
        )

@app.get("/text-to-speech")
async def get_text_to_speech(text: str = Query(..., min_length=1)):
    """
    (Optional) Converts the provided text into speech (MP3 audio).
    """
    logger.info(f"Received request for text-to-speech: {text[:50]}...")
    if not text:
        raise HTTPException(status_code=400, detail="No text provided for TTS.")

    try:
        audio_stream = await speech.text_to_speech(text)
        logger.info(f"Generated speech for: {text[:50]}...")
        return StreamingResponse(audio_stream, media_type="audio/mpeg")
    except Exception as e:
        logger.error(f"Error generating speech for '{text[:50]}...': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate speech: {str(e)}")

@app.post("/generate-solution", response_model=schemas.SolutionResponse)
async def generate_solution(request: schemas.ProblemRequest):
    """
    Receives a problem, asks the solver module for a solution/steps/explanation,
    and formats it for the frontend.
    """
    if not request.problem_text.strip():
        raise HTTPException(status_code=400, detail="Problem text cannot be empty.")

    try:
        # Call the ACTUAL solver function from solver.py
        solver_result = await solver.solve_math_problem(request.problem_text)

        if solver_result.get("error"):
             logger.error(f"Solver returned an error: {solver_result['error']}")
             # Return error in the expected SolutionResponse format
             return schemas.SolutionResponse(original_problem=request.problem_text, steps=[], error=solver_result["error"])

        # Adapt the solver result (Dict[str, Any]) to the SolutionResponse model
        formatted_steps: List[schemas.Step] = []
        if solver_result.get("steps"):
            for i, step_text in enumerate(solver_result["steps"]):
                formatted_steps.append(schemas.Step(step_number=i + 1, explanation=step_text))
        
        final_answer_str: Optional[str] = None
        if solver_result.get("solution"):
             # Join list of solutions into a single string if needed
             if isinstance(solver_result["solution"], list):
                 final_answer_str = ", ".join(map(str, solver_result["solution"]))
             else:
                  final_answer_str = str(solver_result["solution"])

        # Note: solver_result["explanation"] is ignored as SolutionResponse doesn't have a field for it

        return schemas.SolutionResponse(
            original_problem=request.problem_text, 
            steps=formatted_steps, 
            final_answer=final_answer_str,
            error=None # Explicitly set error to None on success
        )

    except HTTPException as e:
        # Re-raise HTTP exceptions (e.g., from solver config issues)
        raise e 
    except Exception as e:
        logger.error(f"Error calling solver or formatting result: {e}", exc_info=True)
        # Return error in the SolutionResponse format
        return schemas.SolutionResponse(
            original_problem=request.problem_text, 
            steps=[], 
            error=f"An unexpected error occurred: {str(e)}"
        )

@app.post("/explain-step", response_model=schemas.ExplanationResponse)
async def explain_step(request: schemas.ExplanationRequest, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """
    Receives problem context and a step number, asks Gemini for an explanation.
    NOW REQUIRES AUTHENTICATION.
    """
    logger.info(f"User '{current_user.email}' requested explanation for step {request.step_number_to_explain} of problem: {request.problem_text[:50]}...")
    if not request.problem_text or not request.all_steps:
         raise HTTPException(status_code=400, detail="Missing problem context or steps.")

    step_to_explain_data = next((step for step in request.all_steps if step.step_number == request.step_number_to_explain), None)

    if step_to_explain_data is None:
        raise HTTPException(status_code=404, detail=f"Step number {request.step_number_to_explain} not found.")

    updated_xp_value: Optional[int] = None # For the response

    try:
        # Convert Pydantic models back to dicts if your Gemini function expects them
        all_steps_dicts = [step.dict() for step in request.all_steps]
        step_to_explain_dict = step_to_explain_data.dict()

        # Replace with actual Gemini call
        gemini_response = call_gemini_for_explanation(
            problem=request.problem_text,
            all_steps=all_steps_dicts,
            step_to_explain=step_to_explain_dict,
            query_type=request.query_type
        )

        # --- XP Increment Logic (DB based) ---
        if not gemini_response.get("error"): # If explanation was successful
            updated_user_model = crud.increment_user_xp(db=db, user_id=current_user.id, amount=XP_FOR_EXPLAINING_STEP) # NEW
            if updated_user_model:
                updated_xp_value = updated_user_model.current_xp
                logger.info(f"Awarded {XP_FOR_EXPLAINING_STEP} XP to {current_user.email} for explaining. New XP: {updated_xp_value}")
            else:
                logger.warning(f"Could not find/update user {current_user.email} (ID: {current_user.id}) in DB to update XP after explaining.")
        # --- End XP Increment Logic ---

        if gemini_response.get("error"):
             return schemas.ExplanationResponse(explanation="", error=gemini_response["error"], updated_xp=updated_xp_value)

        return schemas.ExplanationResponse(
            explanation=gemini_response.get("explanation", ""), 
            error=gemini_response.get("error"), 
            updated_xp=updated_xp_value
        )

    except Exception as e:
        print(f"Error explaining step: {e}")
        raise HTTPException(status_code=500, detail="Failed to get explanation due to an internal error.")

# ---> ADD Drawing Recognition Endpoint <---
@app.post("/recognize-drawing", response_model=schemas.RecognitionResponse)
async def recognize_drawing(request: schemas.DrawingRequest):
    """
    Receives drawing data URL, simulates recognition, returns text.
    """
    if not request.drawing_data_url or not request.drawing_data_url.startswith('data:image'):
        # Basic validation
        logger.warning("Received invalid drawing data URL.")
        raise HTTPException(status_code=400, detail="Invalid or missing drawing data URL.")

    try:
        # Call the placeholder (or later, the real) recognition function
        recognition_result = await call_recognition_service(request.drawing_data_url)

        if recognition_result.get("error"):
            logger.warning(f"Recognition simulation failed: {recognition_result['error']}")
            return schemas.RecognitionResponse(error=recognition_result["error"])
        else:
            recognized_text = recognition_result.get("recognized_text")
            logger.info(f"Recognition simulation successful. Text: {recognized_text}")
            return schemas.RecognitionResponse(recognized_text=recognized_text)

    except Exception as e:
        logger.error(f"Error recognizing drawing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to recognize drawing due to an internal error.")
# ---> END ADDITION <---

# ---> ADD Practice Problem Endpoint <---
@app.post("/generate-practice-problem", response_model=schemas.PracticeResponse)
async def generate_practice_problem(request: schemas.PracticeRequest, db: Session = Depends(get_db), current_user: UserModel = Depends(get_current_user)):
    """
    Receives a topic (and optionally a previous problem), asks Gemini 
    to generate a practice problem and solution.
    NOW REQUIRES AUTHENTICATION.
    """
    logger.info(f"User '{current_user.email}' requested practice problem for topic: {request.topic}")
    if not request.topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")

    updated_xp_value: Optional[int] = None # For the response

    try:
        # Call the practice generation function, passing the optional previous problem
        practice_result = await call_gemini_for_practice(
            request.topic, 
            request.previous_problem # Pass previous_problem if provided
        )

        # --- XP Increment Logic (DB based) ---
        if not practice_result.get("error"): # If practice problem generation was successful
            updated_user_model = crud.increment_user_xp(db=db, user_id=current_user.id, amount=XP_FOR_PRACTICE_PROBLEM) # NEW
            if updated_user_model:
                updated_xp_value = updated_user_model.current_xp
                logger.info(f"Awarded {XP_FOR_PRACTICE_PROBLEM} XP to {current_user.email} for practice. New XP: {updated_xp_value}")
            else:
                logger.warning(f"Could not find/update user {current_user.email} (ID: {current_user.id}) in DB to update XP after practice.")
        # --- End XP Increment Logic ---

        if practice_result.get("error"):
            logger.warning(f"Practice generation failed: {practice_result['error']}")
            return schemas.PracticeResponse(error=practice_result["error"], updated_xp=updated_xp_value)
        else:
            return schemas.PracticeResponse(
                problem=practice_result.get("problem"),
                solution_explanation=practice_result.get("solution_explanation"),
                updated_xp=updated_xp_value
            )

    except Exception as e:
        logger.error(f"Error generating practice problem for topic {request.topic}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate practice problem: {str(e)}")
# ---> END ADDITION <---

# ---> ADD Graph Generation Endpoint <---
@app.post("/generate-graph", response_model=schemas.GraphResponse)
async def generate_graph_endpoint(request: schemas.GraphRequest):
    logger.info(f"Received graph generation request for equation: {request.equation}")
    try:
        # Call the synchronous function in a thread pool
        image_data_url = await run_in_threadpool(graphing.generate_graph, request.equation)
        if image_data_url:
            return schemas.GraphResponse(image_data_url=image_data_url)
        else:
            # This case should ideally be handled by an exception in generate_graph_image
            logger.error("Graph generation returned no data and no exception.")
            raise HTTPException(status_code=500, detail="Failed to generate graph image.")
    except HTTPException as e:
        logger.error(f"HTTPException during graph generation: {e.detail}")
        raise e # Re-raise HTTPException
    except Exception as e:
        logger.error(f"Error generating graph: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate graph: {str(e)}")
# ---> END ADDITION <---

# ---> ADD Endpoint for Mistake Diagnosis <---
@app.post("/diagnose-solution", response_model=schemas.DiagnoseSolutionResponse)
async def diagnose_solution_endpoint(request: schemas.DiagnoseSolutionRequest):
    logger.info(f"Received mistake diagnosis request for problem: {request.problem_text[:60]}...")
    try:
        result = await solver.diagnose_user_solution(
            problem_text=request.problem_text,
            user_steps_str=request.user_steps
        )
        if result.get("error"):
            # This case might occur if diagnose_user_solution returns an error in its dict 
            # instead of raising an HTTPException for some reason (though it should raise)
            raise HTTPException(status_code=500, detail=result["error"])
        return schemas.DiagnoseSolutionResponse(feedback=result["feedback"])
    except HTTPException as e:
        logger.error(f"HTTPException during mistake diagnosis: {e.detail}")
        raise e # Re-raise HTTPException
    except Exception as e:
        logger.error(f"Error during mistake diagnosis: {e}", exc_info=True)
        # Check if it's an API key related error from the solver (if not caught as HTTPException there)
        err_str = str(e).lower()
        if "api key" in err_str or "authentication" in err_str:
            raise HTTPException(status_code=401, detail="AI API Error: Invalid API Key or Authentication Failed.")
        raise HTTPException(status_code=500, detail=f"Failed to diagnose solution: {str(e)}")
# ---> END ADDITION <---

# ---> ADD User Registration Endpoint <---
@app.post("/api/register", response_model=schemas.RegistrationResponse, status_code=201)
async def register_user(request: schemas.UserRegistrationRequest, db: Session = Depends(get_db)):
    logger.info(f"Registration attempt for email: {request.email}")
    
    # Check if user already exists in DB
    existing_user = crud.get_user_by_email(db, email=request.email)
    if existing_user:
        logger.warning(f"Registration failed: Email {request.email} already exists.")
        raise HTTPException(
            status_code=400, 
            detail="Email already registered."
        )

    # Create and store the new user in DB
    user_create_schema = schemas.UserCreate(name=request.name, email=request.email, password=request.password) # CORRECTED: pass plain password
    new_db_user = crud.create_user(db=db, user=user_create_schema) # NEW: Create in DB
    
    logger.info(f"User {new_db_user.email} registered successfully.")
    
    return schemas.RegistrationResponse(
        message="User registered successfully",
        user={"name": new_db_user.name, "email": new_db_user.email} # Don't return password
    )
# ---> END ADDITION <---

# ---> MODIFY User Login Endpoint to return JWT <---
@app.post("/api/login", response_model=schemas.TokenResponse) # Changed response_model
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)): # ADDED db session
    logger.info(f"Login attempt for email (username from form): {form_data.username}")
    user_in_db = crud.get_user_by_email(db, email=form_data.username) # NEW: Fetch from DB
    
    if not user_in_db:
        logger.warning(f"Login failed: User {form_data.username} not found.")
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    if not auth_utils.verify_password(form_data.password, user_in_db.hashed_password):
        logger.warning(f"Login failed: Incorrect password for user {form_data.username}.")
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=auth_utils.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = auth_utils.create_access_token(
        data={"sub": user_in_db.email}, expires_delta=access_token_expires
    )
    
    logger.info(f"User {user_in_db.email} logged in successfully. Token issued.")
    return schemas.TokenResponse(
        access_token=access_token, 
        token_type="bearer",
        user=schemas.UserResponse(id=user_in_db.id, name=user_in_db.name, email=user_in_db.email, current_xp=user_in_db.current_xp)
    )
# ---> END ADDITION <---

# ---> ADD Endpoint for /user/data <---
@app.get("/user/data", response_model=schemas.UserDataResponse)
async def get_user_profile_data(current_user: UserModel = Depends(get_current_user)):
    logger.info(f"Fetching data for user: {current_user.email} for /user/data endpoint")
    
    # current_user is now an SQLAlchemy model instance. current_xp is directly accessible.
    return schemas.UserDataResponse(
        id=current_user.id, # Added id
        name=current_user.name,
        email=current_user.email,
        current_xp=current_user.current_xp
    )
# ---> END ADDITION <---

# ---> ADD Example Protected Endpoint <---
@app.get("/api/users/me", response_model=schemas.UserResponse)
async def read_users_me(current_user: UserModel = Depends(get_current_user)):
    logger.info(f"Accessing /api/users/me for user: {current_user.email}")
    return schemas.UserResponse(
        id=current_user.id, # Added id
        name=current_user.name,
        email=current_user.email,
        current_xp=current_user.current_xp
    )

# ---> ADD Daily Puzzle Endpoint <--
async def _get_or_create_daily_puzzle(current_user: UserModel = Depends(get_current_user)) -> schemas._FullPuzzleStore:
    """
    Helper function to get the cached daily puzzle or generate a new one.
    Requires authentication via current_user dependency.
    """
    global _cached_daily_puzzle
    today = date.today()
    logger.info(f"User {current_user.email} requesting daily puzzle. Today: {today}.")

    if _cached_daily_puzzle is None or _cached_daily_puzzle.generated_on_date != today:
        logger.info(f"No cache or outdated puzzle for {today}. Generating new one.")
        try:
            puzzle_data = await solver.generate_daily_math_puzzle() # Defined in solver.py
            if not puzzle_data or "question" not in puzzle_data or "answer" not in puzzle_data:
                logger.error(f"Failed to generate valid puzzle data from solver. Data: {puzzle_data}")
                raise HTTPException(status_code=500, detail="AI service failed to return valid puzzle data.")

            _cached_daily_puzzle = schemas._FullPuzzleStore(
                puzzle_id=today.isoformat(),
                question=puzzle_data["question"],
                answer=puzzle_data["answer"],
                difficulty=puzzle_data.get("difficulty"), # Handles if difficulty is missing
                generated_on_date=today
            )
            logger.info(f"New daily puzzle generated and cached for {today}. ID: {_cached_daily_puzzle.puzzle_id}")
        except HTTPException as http_exc: # Re-raise HTTPExceptions from solver
            logger.error(f"HTTPException from solver.generate_daily_math_puzzle: {http_exc.detail}")
            raise http_exc
        except Exception as e: # Catch any other unexpected errors during generation
            logger.error(f"Unexpected error generating daily puzzle: {e}", exc_info=True)
            raise HTTPException(status_code=500, detail=f"Could not generate daily puzzle: {str(e)}")
    else:
        logger.info(f"Serving cached daily puzzle for {today}. ID: {_cached_daily_puzzle.puzzle_id}")
    
    return _cached_daily_puzzle

@app.get("/api/daily-puzzle", response_model=schemas.DailyPuzzleResponse)
async def get_daily_puzzle_endpoint(
    current_user: UserModel = Depends(get_current_user), # Protects endpoint
    puzzle_store: schemas._FullPuzzleStore = Depends(_get_or_create_daily_puzzle) # Gets/creates puzzle
):
    """
    Provides the daily math puzzle. Requires authentication.
    Generates a new puzzle if it's a new day or if no puzzle is cached.
    """
    logger.info(f"Endpoint /api/daily-puzzle accessed by {current_user.email}. Puzzle ID: {puzzle_store.puzzle_id}")
    return schemas.DailyPuzzleResponse(
        puzzle_id=puzzle_store.puzzle_id,
        question=puzzle_store.question,
        difficulty=puzzle_store.difficulty
    )
# ---> END ADDITION <--

# ---> ADD Daily Puzzle Submission Endpoint <--
@app.post("/api/submit-puzzle", response_model=schemas.SubmitPuzzleResponse)
async def submit_daily_puzzle_answer(
    request: schemas.SubmitPuzzleRequest,
    current_user: UserModel = Depends(get_current_user)
    # We can inject _cached_daily_puzzle directly if we ensure it's today's using the helper
    # Or fetch it again using the helper to ensure it's today's context.
    # Let's use the helper to ensure we are validating against the correct puzzle.
):
    """
    Allows a user to submit an answer for the current daily puzzle.
    Validates the answer and provides feedback.
    Requires authentication.
    """
    logger.info(f"User {current_user.email} attempting to submit answer for puzzle ID: {request.puzzle_id}")

    # Get the current day's puzzle to validate against
    # This also implicitly checks if a puzzle exists for today
    try:
        # We don't strictly need the full puzzle_store from Depends if we call the helper here,
        # but it ensures we operate on a potentially refreshed puzzle if accessed at midnight.
        # Alternatively, access the global _cached_daily_puzzle and verify its date.
        active_puzzle = await _get_or_create_daily_puzzle(current_user) # Ensures it's today's puzzle
    except HTTPException as e:
        logger.error(f"Failed to retrieve active puzzle for submission by {current_user.email}: {e.detail}")
        # This might happen if Gemini fails when _get_or_create_daily_puzzle is called
        raise HTTPException(status_code=e.status_code, detail=f"Could not retrieve current daily puzzle: {e.detail}")

    if active_puzzle.puzzle_id != request.puzzle_id:
        logger.warning(
            f"User {current_user.email} submitted for puzzle_id {request.puzzle_id}, "
            f"but active puzzle_id is {active_puzzle.puzzle_id}."
        )
        raise HTTPException(
            status_code=400, 
            detail=f"Submission is for an outdated or incorrect puzzle ID. Please fetch the latest puzzle."
        )

    # Normalize answers for comparison (e.g., lowercase, strip whitespace)
    user_answer_normalized = request.user_answer.strip().lower()
    correct_answer_normalized = active_puzzle.answer.strip().lower()

    is_correct = (user_answer_normalized == correct_answer_normalized)

    if is_correct:
        logger.info(f"User {current_user.email} correctly answered puzzle {active_puzzle.puzzle_id}.")
        # TODO: Store attempt (user_id, puzzle_id, answer, is_correct, timestamp) in DB
        return schemas.SubmitPuzzleResponse(
            is_correct=True,
            message="Congratulations! Your answer is correct.",
            puzzle_id=active_puzzle.puzzle_id
        )
    else:
        logger.info(f"User {current_user.email} incorrectly answered puzzle {active_puzzle.puzzle_id}. Expected: '{correct_answer_normalized}', Got: '{user_answer_normalized}'.")
        # TODO: Store attempt in DB
        return schemas.SubmitPuzzleResponse(
            is_correct=False,
            message="Sorry, that's not the correct answer. Try again tomorrow or review the solution!",
            correct_answer=active_puzzle.answer, # Reveal correct answer
            puzzle_id=active_puzzle.puzzle_id
        )
# ---> END ADDITION <--

# ---> NEW: Chat Endpoint <---
@app.post("/api/chat", response_model=schemas.ChatResponse)
async def handle_chat_message(
    request: schemas.ChatRequest, 
    current_user: UserModel = Depends(get_current_user)
):
    logger.info(f"User '{current_user.email}' sent chat message: {request.question[:100]}...")
    if request.history:
        logger.info(f"Chat request includes history of {len(request.history)} messages.")
    
    # Pass both question and history to the Gemini function
    ai_answer = await call_gemini_for_chat_message(request.question, request.history)
    
    # The call_gemini_for_chat_message function already handles internal errors and 
    # returns an error message as a string. We just pass that along.
    # If it returned an HTTPException, we would not need to do this.
    # A more robust error handling might involve call_gemini_for_chat_message raising
    # specific exceptions that this endpoint catches and converts to HTTPExceptions.
    # For now, this is fine for Phase 1.

    return schemas.ChatResponse(answer=ai_answer)
# ---> END NEW Chat Endpoint <---

# --- Admin Endpoints (New) ---
@app.get("/admin/users", response_model=List[schemas.AdminUserView], tags=["Admin"], summary="Get a list of all registered users")
async def admin_get_all_users(
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db),
    current_admin_user: UserModel = Depends(auth_utils.get_current_user) # Corrected: Changed to get_current_user
):
    """
    Retrieves a list of all registered users. 
    Requires authentication (any logged-in user can access this for now).
    
    - **skip**: Number of records to skip (for pagination).
    - **limit**: Maximum number of records to return (for pagination).
    """
    # Basic role check (example - adapt to your actual role field/logic)
    # if not current_admin_user.role == "admin": # Make sure 'role' attribute exists on UserModel
    #     raise HTTPException(status_code=403, detail="Not authorized to access this resource")
    users = crud.get_users(db, skip=skip, limit=limit)
    return users

@app.get("/health")
async def health_check():
    return {"status": "ok"}

# --- Root Endpoint for Health Check ---
@app.get("/")
async def read_root():
    return {"message": "Welcome to the Math Wiz Assistant API!"}

# --- Example Usage (for running directly) ---
if __name__ == "__main__":
    import uvicorn
    logger.info("Starting Math Wiz Assistant API with Uvicorn")
    # Note: CORS origins might need adjustment if running differently than standard dev server
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info") 