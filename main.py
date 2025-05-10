from typing import List, Dict, Any, Optional
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse # Added for custom response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import base64
import os # Import os module
from backend.ocr import extract_text_from_image
from backend.solver import solve_math_problem, generate_practice_problem
from backend.graphing import generate_graph

# --- Configuration ---
# ... (existing config) ...

# --- Pydantic Models --- 
class ProblemRequest(BaseModel):
    problem: str

class Step(BaseModel):
    step_number: int
    explanation: str

class SolutionResponse(BaseModel):
    original_problem: Optional[str] = None
    steps: List[Step] = []
    final_answer: Optional[str] = None
    explanation: Optional[str] = None
    error: Optional[str] = None

class PracticeRequest(BaseModel):
    topic: Optional[str] = None
    original_problem: Optional[str] = None # Provide one or the other

class PracticeResponse(BaseModel):
    practice_problem: Optional[str] = None
    error: Optional[str] = None

# Model for receiving graph equation
class GraphRequest(BaseModel):
    equation: str

# Model for sending back graph data URL
class GraphResponse(BaseModel):
    graph_data_url: Optional[str] = None
    error: Optional[str] = None


# --- FastAPI App Initialization ---
app = FastAPI()

# Custom Exception Handler for RequestValidationError
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # Log the exact error details to the console
    print(f"!!! Detailed Pydantic Validation Error: {exc.errors()}")
    # You can still use the default handler to return the 422 response to the client
    # or construct a custom JSONResponse if you prefer
    # return await request_validation_exception_handler(request, exc)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()} # Send errors back to client for inspection
    )

# --- CORS Configuration ---
origins = [
    "http://localhost:8003", # Your frontend origin
    "http://127.0.0.1:8003", # Also allow localhost IP
    # Add any other origins if necessary (e.g., deployed frontend URL)
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True, # Allow cookies if needed
    allow_methods=["*"],    # Allow all methods (GET, POST, etc.)
    allow_headers=["*"],    # Allow all headers
)

# --- Placeholder Gemini API Interaction Functions ---
# ... (existing placeholder functions) ...

# --- Placeholder Recognition API Function ---


# --- API Endpoints ---

@app.post("/upload-image", response_model=SolutionResponse)
async def upload_image(file: UploadFile = File(...)):
    """Receives an image, performs OCR, solves the problem, returns solution."""
    # Save the uploaded file temporarily
    uploads_dir = "backend/uploads"
    file_path = os.path.join(uploads_dir, file.filename) # Use os.path.join
    try:
        # Ensure the uploads directory exists
        os.makedirs(uploads_dir, exist_ok=True)

        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)

        # Perform OCR using the backend/ocr.py function
        extracted_text = await extract_text_from_image(file_path)

        if not extracted_text:
            raise HTTPException(status_code=400, detail="OCR failed or no text found in image.")

        # Solve the extracted text using the backend/solver.py function
        solution_data = await solve_math_problem(extracted_text)

        # Map solver result to SolutionResponse format
        # Assuming solve_math_problem returns a dict like:
        # {"solution": ["ans"], "steps": ["step1", "step2"], "explanation": "expl", "error": None}
        if solution_data.get("error"):
             raise HTTPException(status_code=500, detail=solution_data["error"])

        # Convert steps from simple strings to Step objects if needed
        # (Adjust based on actual solve_math_problem output structure)
        response_steps = []
        if solution_data.get("steps"):
            for i, step_text in enumerate(solution_data["steps"]):
                 response_steps.append(Step(step_number=i + 1, explanation=step_text))

        return SolutionResponse(
            original_problem=extracted_text,
            steps=response_steps,
            final_answer=solution_data.get("solution", ["N/A"])[0] if solution_data.get("solution") else "N/A",
            explanation=solution_data.get("explanation")
        )

    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise e
    except Exception as e:
        # Handle other errors (file handling, OCR, solver)
        print(f"Error in /upload-image: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {e}")
    finally:
        # Clean up the uploaded file (optional)
        # We still need os for this part if uncommented later
        if os.path.exists(file_path):
            # os.remove(file_path) # Keep commented for now
            pass
        pass # Keep file for now for debugging

@app.post("/solve-text", response_model=SolutionResponse)
async def solve_text(request: ProblemRequest):
    """Receives text problem, solves it, returns solution."""
    try:
        solution_data = await solve_math_problem(request.problem)

        if solution_data.get("error"):
             raise HTTPException(status_code=500, detail=solution_data["error"])

        response_steps = []
        if solution_data.get("steps"):
            for i, step_text in enumerate(solution_data["steps"]):
                 response_steps.append(Step(step_number=i + 1, explanation=step_text))

        return SolutionResponse(
            original_problem=request.problem,
            steps=response_steps,
            final_answer=solution_data.get("solution", ["N/A"])[0] if solution_data.get("solution") else "N/A",
            explanation=solution_data.get("explanation")
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error in /solve-text: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {e}")

@app.post("/generate-practice", response_model=PracticeResponse)
async def generate_practice(request: PracticeRequest):
    """Generates a practice problem based on the request."""
    try:
        # Determine input for generation (topic or original problem)
        input_text = request.topic or request.original_problem
        if not input_text:
            raise HTTPException(status_code=400, detail="Please provide either a topic or the original problem.")

        practice_data = await generate_practice_problem(input_text)

        if practice_data.get("error"):
            raise HTTPException(status_code=500, detail=practice_data["error"])

        # Expecting practice_data = {"practice_problem": "text..."}
        return PracticeResponse(
            practice_problem=practice_data.get("practice_problem", "Could not generate problem.")
        )
    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"Error in /generate-practice: {e}")
        raise HTTPException(status_code=500, detail=f"An internal error occurred: {e}")

@app.post("/generate-graph", response_model=GraphResponse)
async def generate_graph_endpoint(request: GraphRequest):
    """Receives an equation string, generates graph, returns data URL."""
    if not request.equation:
        raise HTTPException(status_code=400, detail="No equation provided.")
    try:
        graph_data_url = await generate_graph(request.equation)
        return GraphResponse(graph_data_url=graph_data_url)
    except ValueError as ve:
        # Catch parsing/evaluation errors from generate_graph
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"Error in /generate-graph: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate graph: {e}")



# --- Run instruction --- 
# ... (existing uvicorn run command) ... 