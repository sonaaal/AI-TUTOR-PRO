"""Math Solving and Explanation Utilities"""
import logging
from typing import Dict, List, Any
from fastapi import HTTPException
# Remove sympy if no longer used
# import sympy
# from sympy.parsing.sympy_parser import parse_expr, standard_transformations, implicit_multiplication_application
from . import config # Relative import
import re # Import regex module

logger = logging.getLogger(__name__)

# --- Optional: Google Generative AI (Gemini) ---
genai = None
try:
    import google.generativeai as genai_import
    if config.GOOGLE_API_KEY:
        genai_import.configure(api_key=config.GOOGLE_API_KEY)
        genai = genai_import # Assign only if key exists
        logger.info("Google Generative AI configured successfully (for Solver).")
    else:
        logger.warning("Google API Key not found. Gemini Solver disabled.")
except ImportError:
    logger.warning("google-generativeai package not installed. Gemini Solver disabled.")
except Exception as e:
    logger.error(f"Error configuring Google Generative AI for Solver: {e}")

# --- Helper to Parse Gemini Response (Improved Basic) ---
def _parse_gemini_solver_response(text: str) -> Dict[str, Any]:
    """Attempts to parse the Gemini response into solution, steps, and explanation."""
    solution = []
    steps = []
    explanation = text # Default: treat everything as explanation initially

    # Try to find common markers - this is heuristic and may need refinement
    solution_match = re.search(r"(?:final answer|solution|result):\s*(.*)", text, re.IGNORECASE | re.DOTALL)
    steps_match = re.search(r"(?:steps|step-by-step|working):\s*(.*)", text, re.IGNORECASE | re.DOTALL)
    explanation_match = re.search(r"(?:explanation|summary):\s*(.*)", text, re.IGNORECASE | re.DOTALL)

    # Extract explanation first if clearly marked
    if explanation_match:
        explanation = explanation_match.group(1).strip()
        # Remove explanation part from the main text to avoid duplication
        text = text[:explanation_match.start()] + text[explanation_match.end():]

    # Extract steps if clearly marked
    if steps_match:
        steps_text = steps_match.group(1).strip()
        # Simple split by newline, remove empty lines and list markers
        steps = [re.sub(r'^\s*\d+[.)]?\s*|^\s*[-*+]\s*', '', line).strip() 
                 for line in steps_text.split('\n') if line.strip()]
        # Remove steps part from the main text
        text = text[:steps_match.start()] + text[steps_match.end():]
        # If explanation wasn't explicitly marked, use the remaining text before steps
        if not explanation_match:
             explanation_part_before = text[:steps_match.start()].strip()
             if explanation_part_before:
                 explanation = explanation_part_before
             else: # If nothing before steps, use a generic explanation or the raw text if needed
                  explanation = "See steps above." # Or maybe keep original full text?

    # Extract solution if clearly marked
    if solution_match:
        solution_text = solution_match.group(1).strip()
        # Split potential multiple solutions, handle simple cases
        solution = [s.strip() for s in solution_text.split('\n') if s.strip()]
        # Remove solution part from main text
        text = text[:solution_match.start()] + text[solution_match.end():]
        # Refine explanation if needed
        if not explanation_match and not steps_match:
             explanation = text.strip() # Use whatever remains

    # Fallback logic if markers are missing
    if not explanation_match and not steps_match and not solution_match:
         explanation = text # Everything is explanation
    elif not solution and steps: # If steps found but no explicit solution
        # Crude check: Is the last step likely an answer (e.g., x = 5)?
        last_step_match = re.search(r'([a-zA-Z]\s*=[^=]+)$|=([^=]+)$', steps[-1])
        if last_step_match:
            potential_solution = last_step_match.group(1) or last_step_match.group(2)
            if potential_solution:
                 solution = [potential_solution.strip()]
                 # Optionally remove from steps if needed
                 # steps = steps[:-1]
    
    # If still no explanation, but we have steps/solution, provide generic one
    if not explanation and (steps or solution):
        explanation = "Solution details provided."

    # Ensure solution is a list
    if not isinstance(solution, list):
        solution = [str(solution)]
    if len(solution) == 1 and not solution[0]: # Handle empty string case
         solution = None

    return {
        "solution": solution if solution else None,
        "steps": steps if steps else None,
        "explanation": explanation.strip() if explanation else None,
        "error": None # Assuming parsing success doesn't mean functional error
    }

# --- Core Solving Logic (Using Gemini) ---
async def solve_math_problem(question_text: str) -> Dict[str, Any]:
    """Solves a math problem using the Gemini API."""
    logger.info(f"Attempting to solve using Gemini: {question_text[:60]}...")

    if not genai:
        logger.error("Gemini API client not configured or key is missing.")
        raise HTTPException(status_code=501, # 501 Not Implemented
                            detail="Math solving via AI model is not configured on the server.")

    # --- Call Gemini API ---
    try:
        # Use a model suitable for reasoning/math - Pro might be better than Flash
        # model = genai.GenerativeModel('gemini-1.5-flash-latest') 
        model = genai.GenerativeModel('gemini-1.5-flash-latest') # Try Pro for potentially better math reasoning

        # Construct the prompt - More specific for math
        prompt = f"""You are a helpful math assistant.
Solve the following mathematical problem:
```
{question_text}
```
Provide the final answer or solution clearly.
If applicable, provide a step-by-step derivation or calculation process.
Also provide a brief explanation of the method used or the reasoning.

Structure your response clearly, for example:

Explanation:
[Brief explanation of the approach]

Steps:
1. [First step]
2. [Second step]
...

Solution:
[Final answer or simplified expression]

If the problem is ambiguous or cannot be solved, please state why.
"""

        logger.info(f"Sending request to Gemini model: {model.model_name}")
        # Use await for async call
        response = await model.generate_content_async(prompt)

        # --- Parse Gemini Response ---
        if response and hasattr(response, 'text'):
            raw_response_text = response.text
            logger.info(f"Received response from Gemini. Length: {len(raw_response_text)}")
            logger.debug(f"Gemini Raw Response:\n{raw_response_text}")

            # Attempt to parse the structured response
            parsed_result = _parse_gemini_solver_response(raw_response_text)
            logger.info("Parsed Gemini response.")
            return parsed_result

        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            logger.error(f"Gemini request blocked for solving '{question_text[:60]}'. Reason: {block_reason}")
            raise HTTPException(status_code=400, detail=f"Content generation blocked by API. Reason: {block_reason}")
        else:
            logger.error(f"Gemini response format unexpected or empty for solving '{question_text[:60]}'. Response: {response}")
            raise HTTPException(status_code=500, detail="Solver AI returned an unexpected or empty response.")

    except Exception as e:
        logger.error(f"Gemini solving failed for '{question_text[:60]}': {e}", exc_info=True)
        # Distinguish API errors
        err_str = str(e).lower()
        if "api key" in err_str or "permission denied" in err_str or "authentication" in err_str:
             raise HTTPException(status_code=401, detail=f"Solver API Error: Invalid API Key or Authentication Failed.")
        elif isinstance(e, HTTPException):
             raise e # Re-raise specific HTTP errors
        else:
            raise HTTPException(status_code=500, detail=f"Failed to solve using AI model: {str(e)}") 

# --- Practice Problem Generation (Using Gemini) ---
async def generate_practice_problem(topic_or_original_problem: str) -> Dict[str, Any]:
    """Generates a practice math problem related to the input using the Gemini API."""
    logger.info(f"Attempting to generate practice problem for: {topic_or_original_problem[:60]}...")

    if not genai:
        logger.error("Gemini API client not configured or key is missing for practice generation.")
        raise HTTPException(status_code=501,
                            detail="Practice problem generation via AI model is not configured.")

    # --- Call Gemini API ---
    try:
        model = genai.GenerativeModel('gemini-1.5-flash-latest') # Or flash if preferred

        # Construct the prompt - Ask for a similar problem
        prompt = f"""You are a helpful math tutor assistant.
Generate a practice math problem that is similar in concept and difficulty to the following topic or problem:
```
{topic_or_original_problem}
```
Present ONLY the practice problem statement itself, without any introduction, explanation, steps, or solution.
Just provide the problem text.
Example format: "Solve the equation 2x + 5 = 11." OR "Find the derivative of f(x) = sin(x^2)."
"""

        logger.info(f"Sending practice generation request to Gemini model: {model.model_name}")
        response = await model.generate_content_async(prompt)

        # --- Parse Gemini Response ---
        if response and hasattr(response, 'text'):
            practice_problem_text = response.text.strip()
            logger.info(f"Received practice problem from Gemini. Length: {len(practice_problem_text)}")
            logger.debug(f"Gemini Raw Practice Problem Response:\n{practice_problem_text}")

            # Return just the problem text
            # We might want a more structured response later, but for now, just the text.
            return {"practice_problem": practice_problem_text}

        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            logger.error(f"Gemini request blocked for practice generation. Reason: {block_reason}")
            raise HTTPException(status_code=400, detail=f"Content generation blocked by API. Reason: {block_reason}")
        else:
            logger.error(f"Gemini response format unexpected or empty for practice generation. Response: {response}")
            raise HTTPException(status_code=500, detail="AI returned an unexpected or empty response for practice problem.")

    except Exception as e:
        logger.error(f"Gemini practice generation failed for '{topic_or_original_problem[:60]}': {e}", exc_info=True)
        err_str = str(e).lower()
        if "api key" in err_str or "permission denied" in err_str or "authentication" in err_str:
             raise HTTPException(status_code=401, detail="AI API Error: Invalid API Key or Authentication Failed.")
        elif isinstance(e, HTTPException):
             raise e
        else:
            raise HTTPException(status_code=500, detail=f"Failed to generate practice problem using AI: {str(e)}") 

async def diagnose_user_solution(problem_text: str, user_steps_str: str) -> Dict[str, Any]:
    """
    Diagnoses mistakes in a user's provided solution steps by comparing them
    with a model-generated correct solution.
    """
    logger.info(f"Starting mistake diagnosis for problem: {problem_text[:60]}...")

    if not genai:
        logger.error("Gemini API client not configured for mistake diagnosis.")
        raise HTTPException(status_code=501,
                            detail="Mistake diagnosis via AI model is not configured on the server.")

    try:
        # 1. Get the correct solution and steps from the existing solver
        logger.info("Fetching correct solution for comparison...")
        correct_solution_data = await solve_math_problem(problem_text)
        
        correct_steps = correct_solution_data.get("steps")
        correct_solution = correct_solution_data.get("solution")

        if not correct_steps:
            logger.warning("Could not retrieve correct steps for comparison.")
            # Potentially return a message indicating correct steps couldn't be generated
            # For now, we'll proceed and let Gemini handle it, but it might be less effective.
            correct_steps_str = "Could not automatically determine the correct steps for this problem."
        else:
            correct_steps_str = "\n".join([f"{i+1}. {step}" for i, step in enumerate(correct_steps)])
        
        correct_solution_str = ", ".join(correct_solution) if correct_solution else "Not available"

        # 2. Formulate a prompt for Gemini to compare and give feedback
        # model = genai.GenerativeModel('gemini-1.5-flash-latest') # Can use flash for this if speed is preferred
        model = genai.GenerativeModel('gemini-1.5-flash-latest')

        prompt = f"""You are an expert math tutor.
A student is trying to solve the following math problem:
Problem:
{problem_text}

The student has provided the following steps for their solution:
Student's Steps:
{user_steps_str}

For your reference, a correct step-by-step solution is:
Correct Steps:
{correct_steps_str}
Correct Final Solution: {correct_solution_str}

Your task is to:
1.  Analyze the student's steps carefully.
2.  Compare the student's steps with the correct steps.
3.  Identify any mistakes, misunderstandings, or missing steps in the student's solution.
4.  Provide clear, constructive feedback to the student. Explain where they went wrong and guide them towards the correct thinking process.
5.  If the student's solution is correct, acknowledge it.
6.  Be encouraging and supportive.

Format your feedback clearly. You can use markdown.
For example:
"Overall, you're on the right track with [positive aspect].
However, in step [X], it seems there was a [type of error, e.g., calculation error, conceptual misunderstanding].
The correct approach for that step would be [explanation].
Keep an eye on [specific detail] next time.
Remember to [general tip or reminder]."

If the student's solution is entirely correct, you can say something like:
"Great job! Your steps are clear and lead to the correct solution."

Provide only the feedback to the student.
"""

        logger.info("Sending request to Gemini for mistake diagnosis...")
        response = await model.generate_content_async(prompt)

        if response and hasattr(response, 'text'):
            feedback_text = response.text.strip()
            logger.info(f"Received diagnosis feedback from Gemini. Length: {len(feedback_text)}")
            logger.debug(f"Gemini Diagnosis Feedback:\n{feedback_text}")
            return {"feedback": feedback_text, "error": None}
        
        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            logger.error(f"Gemini request blocked for diagnosis. Reason: {block_reason}")
            raise HTTPException(status_code=400, detail=f"Content generation blocked by API. Reason: {block_reason}")
        else:
            logger.error("Gemini response format unexpected or empty for diagnosis.")
            raise HTTPException(status_code=500, detail="AI returned an unexpected or empty response for diagnosis.")

    except HTTPException as http_exc: # Re-raise HTTPExceptions directly
        raise http_exc
    except Exception as e:
        logger.error(f"Mistake diagnosis failed for '{problem_text[:60]}': {e}", exc_info=True)
        err_str = str(e).lower()
        if "api key" in err_str or "permission denied" in err_str or "authentication" in err_str:
             raise HTTPException(status_code=401, detail="AI API Error: Invalid API Key or Authentication Failed.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to diagnose mistake using AI model: {str(e)}") 

async def generate_daily_math_puzzle() -> Dict[str, Any]:
    """Generates a daily math puzzle using the Gemini API.

    Returns:
        A dictionary containing "question", "answer", and "difficulty",
        or raises HTTPException on error.
    """
    logger.info("Attempting to generate a daily math puzzle using Gemini...")

    if not genai:
        logger.error("Gemini API client not configured or key is missing for daily puzzle generation.")
        raise HTTPException(status_code=501,
                            detail="Daily puzzle generation via AI model is not configured.")

    try:
        model = genai.GenerativeModel('gemini-1.5-flash-latest')

        prompt = """You are a creative puzzle generator.
Generate a unique and engaging math puzzle suitable for a general audience.
The puzzle should be solvable with logic and basic math skills, not overly complex or involving very advanced topics unless specified.
Provide the following three pieces of information:
1.  "question": The puzzle question itself (string).
2.  "answer": The final numerical or short text answer (string or number).
3.  "difficulty": A difficulty rating for the puzzle (string: 'easy', 'medium', or 'hard').

Format the output STRICTLY as a single JSON object with keys "question", "answer", and "difficulty".
Example:
{
  "question": "If a hen and a half lay an egg and a half in a day and a half, how many eggs do six hens lay in six days?",
  "answer": "24",
  "difficulty": "medium"
}

Do not include any other text, explanations, or markdown formatting outside of this JSON object.
"""

        logger.info(f"Sending daily puzzle generation request to Gemini model: {model.model_name}")
        response = await model.generate_content_async(prompt)

        if response and hasattr(response, 'text'):
            raw_response_text = response.text.strip()
            logger.info(f"Received response from Gemini for daily puzzle. Length: {len(raw_response_text)}")
            logger.debug(f"Gemini Raw Daily Puzzle Response:\\n{raw_response_text}")

            try:
                # Attempt to parse the JSON response
                import json # Import json here as it's only used in this part
                payload_match = re.search(r'```json\\n({.*?})\\n```', raw_response_text, re.DOTALL)
                if payload_match:
                    json_text = payload_match.group(1)
                else:
                    # Fallback: assume the whole response is JSON if no markdown triple quotes
                    json_text = raw_response_text
                
                puzzle_data = json.loads(json_text)

                if not all(k in puzzle_data for k in ["question", "answer", "difficulty"]):
                    logger.error(f"Gemini response for daily puzzle missing required keys. Got: {puzzle_data.keys()}")
                    raise HTTPException(status_code=500, detail="AI returned malformed data for the daily puzzle (missing keys).")
                
                # Basic validation of types
                if not isinstance(puzzle_data["question"], str) or \
                   not isinstance(puzzle_data["answer"], (str, int, float)) or \
                   not isinstance(puzzle_data["difficulty"], str) or \
                   puzzle_data["difficulty"].lower() not in ['easy', 'medium', 'hard']:
                    logger.error(f"Gemini response for daily puzzle has invalid data types or difficulty. Data: {puzzle_data}")
                    raise HTTPException(status_code=500, detail="AI returned malformed data for the daily puzzle (invalid types/difficulty).")

                logger.info("Successfully parsed daily puzzle data from Gemini.")
                return {
                    "question": str(puzzle_data["question"]),
                    "answer": str(puzzle_data["answer"]), # Ensure answer is string
                    "difficulty": str(puzzle_data["difficulty"]).lower()
                }

            except json.JSONDecodeError as jde:
                logger.error(f"Failed to decode JSON from Gemini daily puzzle response: {jde}. Response was: {raw_response_text}")
                raise HTTPException(status_code=500, detail=f"AI returned invalid JSON for the daily puzzle. {str(jde)}")
            except Exception as e: # Catch other parsing errors
                logger.error(f"Error processing Gemini daily puzzle response: {e}. Response was: {raw_response_text}")
                raise HTTPException(status_code=500, detail=f"Error processing AI response for daily puzzle. {str(e)}")


        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            logger.error(f"Gemini request blocked for daily puzzle generation. Reason: {block_reason}")
            raise HTTPException(status_code=400, detail=f"Content generation for daily puzzle blocked by API. Reason: {block_reason}")
        else:
            logger.error(f"Gemini response format unexpected or empty for daily puzzle generation. Response: {response}")
            raise HTTPException(status_code=500, detail="AI returned an unexpected or empty response for daily puzzle generation.")

    except HTTPException as http_exc: # Re-raise HTTPExceptions directly
        raise http_exc
    except Exception as e:
        logger.error(f"Gemini daily puzzle generation failed: {e}", exc_info=True)
        err_str = str(e).lower()
        if "api key" in err_str or "permission denied" in err_str or "authentication" in err_str:
             raise HTTPException(status_code=401, detail="AI API Error for daily puzzle: Invalid API Key or Authentication Failed.")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to generate daily puzzle using AI model: {str(e)}") 