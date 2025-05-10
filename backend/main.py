import os
import shutil
import logging
from fastapi import FastAPI, File, UploadFile, HTTPException, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import io
import re
from fastapi.concurrency import run_in_threadpool

from . import config # Use relative import
# Import placeholder modules (will create these next)
from . import ocr      # Use relative import
from . import solver   # Use relative import
from . import speech   # Use relative import
from . import utils    # Use relative import
from . import graphing # Import the new graphing module

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

# --- Pydantic Models for Request/Response ---
class ImageUploadResponse(BaseModel):
    status: str
    extracted_text: str | None = None
    error: str | None = None

class SolveTextRequest(BaseModel):
    question_text: str

class SolveTextResponse(BaseModel):
    solution: List[str] | str | None = None
    steps: List[str] | None = None
    explanation: str | None = None
    error: str | None = None

class ProblemRequest(BaseModel):
    problem_text: str

class Step(BaseModel):
    step_number: int
    explanation: str

class SolutionResponse(BaseModel):
    original_problem: Optional[str] = None
    steps: List[Step]
    final_answer: Optional[str] = None
    error: Optional[str] = None

class ExplanationRequest(BaseModel):
    problem_text: str
    all_steps: List[Step] # Send all steps for context
    step_number_to_explain: int
    query_type: str # e.g., "why" or "how"

class ExplanationResponse(BaseModel):
    explanation: str
    error: Optional[str] = None

# ---> ADD Models for Drawing Recognition <---
class DrawingRequest(BaseModel):
    drawing_data_url: str # Expecting data URL like 'data:image/png;base64,...'

class RecognitionResponse(BaseModel):
    recognized_text: Optional[str] = None
    error: Optional[str] = None
# ---> END ADDITION <---

# ---> ADD Models for Practice Problem <---
class PracticeRequest(BaseModel):
    topic: str
    previous_problem: Optional[str] = None # Add optional field

class PracticeResponse(BaseModel):
    problem: Optional[str] = None
    solution_explanation: Optional[str] = None # Combined solution and explanation for simplicity
    error: Optional[str] = None
# ---> END ADDITION <---

# ---> ADD Models for Graphing <---
class GraphRequest(BaseModel):
    equation: str

class GraphResponse(BaseModel):
    image_data_url: Optional[str] = None # data:image/png;base64,... 
    error: Optional[str] = None
# ---> END ADDITION <---

# ---> ADD Models for Mistake Diagnosis <---
class DiagnoseSolutionRequest(BaseModel):
    problem_text: str
    user_steps: str # User's steps as a single string, potentially newline-separated

class DiagnoseSolutionResponse(BaseModel):
    feedback: str
    error: Optional[str] = None
# ---> END ADDITION <---

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

# --- API Endpoints ---
@app.post("/upload-image", response_model=ImageUploadResponse)
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
        return {"status": "success", "extracted_text": extracted_text}

    except HTTPException as e:
        # Re-raise HTTP exceptions from OCR module
        logger.error(f"HTTPException during OCR for {file.filename}: {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Error processing file {file.filename}: {e}", exc_info=True)
        # Return a generic error response
        return JSONResponse(
            status_code=500,
            content={"status": "error", "error": f"Failed to process image: {str(e)}"}
        )
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

@app.post("/solve-text", response_model=SolutionResponse)
async def solve_math_from_text(request: SolveTextRequest):
    """
    Accepts math problem text, solves it, and returns the solution, steps, and explanation.
    """
    question = request.question_text
    logger.info(f"Received text to solve: {question}")
    if not question:
        raise HTTPException(status_code=400, detail="No question text provided.")

    try:
        solver_result = await solver.solve_math_problem(question)
        logger.info(f"Successfully solved: {question}")

        if solver_result.get("error"):
            # Return error in the SolutionResponse format
            return SolutionResponse(
                original_problem=question,
                steps=[], 
                error=solver_result["error"]
            )

        # Adapt the solver result (Dict[str, Any]) to the SolutionResponse model
        formatted_steps: List[Step] = []
        raw_steps = solver_result.get("steps")
        if raw_steps and isinstance(raw_steps, list):
            for i, step_text in enumerate(raw_steps):
                if isinstance(step_text, str):
                    formatted_steps.append(Step(step_number=i + 1, explanation=step_text))
                # else: log or handle unexpected step format
        
        final_answer_str: Optional[str] = None
        raw_solution = solver_result.get("solution")
        if raw_solution:
             if isinstance(raw_solution, list):
                 final_answer_str = ", ".join(map(str, raw_solution))
             else:
                  final_answer_str = str(raw_solution)

        # The SolutionResponse model needs original_problem, steps, final_answer
        return SolutionResponse(
            original_problem=question,
            steps=formatted_steps,
            final_answer=final_answer_str,
            error=None # Explicitly set error to None on success
        )

    except HTTPException as e:
        logger.error(f"HTTPException during solving '{question}': {e.detail}")
        raise e
    except Exception as e:
        logger.error(f"Error solving question '{question}': {e}", exc_info=True)
        # Return error in SolutionResponse format
        return SolutionResponse(
            original_problem=question, 
            steps=[], 
            error=f"Failed to solve the math problem: {str(e)}"
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

@app.post("/generate-solution", response_model=SolutionResponse)
async def generate_solution(request: ProblemRequest):
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
             return SolutionResponse(original_problem=request.problem_text, steps=[], error=solver_result["error"])

        # Adapt the solver result (Dict[str, Any]) to the SolutionResponse model
        formatted_steps: List[Step] = []
        if solver_result.get("steps"):
            for i, step_text in enumerate(solver_result["steps"]):
                formatted_steps.append(Step(step_number=i + 1, explanation=step_text))
        
        final_answer_str: Optional[str] = None
        if solver_result.get("solution"):
             # Join list of solutions into a single string if needed
             if isinstance(solver_result["solution"], list):
                 final_answer_str = ", ".join(map(str, solver_result["solution"]))
             else:
                  final_answer_str = str(solver_result["solution"])

        # Note: solver_result["explanation"] is ignored as SolutionResponse doesn't have a field for it

        return SolutionResponse(
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
        return SolutionResponse(
            original_problem=request.problem_text, 
            steps=[], 
            error=f"An unexpected error occurred: {str(e)}"
        )

@app.post("/explain-step", response_model=ExplanationResponse)
async def explain_step(request: ExplanationRequest):
    """
    Receives problem context and a step number, asks Gemini for an explanation.
    """
    if not request.problem_text or not request.all_steps:
         raise HTTPException(status_code=400, detail="Missing problem context or steps.")

    step_to_explain_data = next((step for step in request.all_steps if step.step_number == request.step_number_to_explain), None)

    if step_to_explain_data is None:
        raise HTTPException(status_code=404, detail=f"Step number {request.step_number_to_explain} not found.")

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

        if gemini_response.get("error"):
             return ExplanationResponse(explanation="", error=gemini_response["error"])

        return ExplanationResponse(**gemini_response)

    except Exception as e:
        print(f"Error explaining step: {e}")
        raise HTTPException(status_code=500, detail="Failed to get explanation due to an internal error.")

# ---> ADD Drawing Recognition Endpoint <---
@app.post("/recognize-drawing", response_model=RecognitionResponse)
async def recognize_drawing(request: DrawingRequest):
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
            return RecognitionResponse(error=recognition_result["error"])
        else:
            recognized_text = recognition_result.get("recognized_text")
            logger.info(f"Recognition simulation successful. Text: {recognized_text}")
            return RecognitionResponse(recognized_text=recognized_text)

    except Exception as e:
        logger.error(f"Error recognizing drawing: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to recognize drawing due to an internal error.")
# ---> END ADDITION <---

# ---> ADD Practice Problem Endpoint <---
@app.post("/generate-practice-problem", response_model=PracticeResponse)
async def generate_practice_problem(request: PracticeRequest):
    """
    Receives a topic (and optionally a previous problem), asks Gemini 
    to generate a practice problem and solution.
    """
    if not request.topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")

    try:
        # Call the practice generation function, passing the optional previous problem
        practice_result = await call_gemini_for_practice(
            request.topic, 
            request.previous_problem # Pass previous_problem if provided
        )

        if practice_result.get("error"):
            logger.warning(f"Practice generation failed: {practice_result['error']}")
            return PracticeResponse(error=practice_result["error"])
        else:
            return PracticeResponse(
                problem=practice_result.get("problem"),
                solution_explanation=practice_result.get("solution_explanation")
            )

    except Exception as e:
        logger.error(f"Error generating practice problem for topic {request.topic}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate practice problem: {str(e)}")
# ---> END ADDITION <---

# ---> ADD Graph Generation Endpoint <---
@app.post("/generate-graph", response_model=GraphResponse)
async def generate_graph_endpoint(request: GraphRequest):
    logger.info(f"Received graph generation request for equation: {request.equation}")
    try:
        # Call the synchronous function in a thread pool
        image_data_url = await run_in_threadpool(graphing.generate_graph, request.equation)
        if image_data_url:
            return GraphResponse(image_data_url=image_data_url)
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
@app.post("/diagnose-solution", response_model=DiagnoseSolutionResponse)
async def diagnose_solution_endpoint(request: DiagnoseSolutionRequest):
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
        return DiagnoseSolutionResponse(feedback=result["feedback"])
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