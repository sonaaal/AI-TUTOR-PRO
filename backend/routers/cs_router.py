# backend/routers/cs_router.py
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Union, Optional # Added Optional
import random
import re # For parsing AI responses
import logging # Added logging
import asyncio # Added asyncio

# Explicitly configure logger for this module
logger = logging.getLogger(__name__)
if not logger.hasHandlers(): # Check if handlers are already configured (e.g., by root)
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO) # Ensure level is INFO for this logger

# Import the schemas (adjust path if structure differs)
# Assuming schemas.py is in the parent directory (backend/)
from .. import schemas 

# --- AI Client Setup ---
# Attempt to import and configure Gemini (similar to main.py)
# Ideally, move this configuration to a central place (e.g., config.py or ai_utils.py)
# and import the configured 'genai' object.
genai = None
try:
    import google.generativeai as genai_import
    # Assuming config is accessible, e.g., by importing from .. import config
    from .. import config as backend_config
    if backend_config.GOOGLE_API_KEY:
        genai_import.configure(api_key=backend_config.GOOGLE_API_KEY)
        genai = genai_import
        logger.info("Google Generative AI configured successfully for cs_router.")
    else:
        logger.warning("Google API Key not found in config/env. CS AI features might be disabled.")
except ImportError:
    logger.warning("google-generativeai package not installed. CS AI features disabled.")
except Exception as e:
    logger.error(f"Error configuring Google Generative AI in cs_router: {e}")

# --- Router Setup ---
router = APIRouter(
    prefix="/cs",      # All routes in this file start with /cs
    tags=["Computer Science"], # For API documentation
)

# --- Helper: Parse MCQ from AI Text ---
def _parse_mcq_response(text: str, chapter: str, default_id: str) -> schemas.MCQQuestionResponseSchema:
    """Attempts to parse Gemini response into MCQ format."""
    try:
        question_match = re.search(r"Question:\s*(.*?)\s*(?:Option A:|Option 1:|$)", text, re.DOTALL | re.IGNORECASE)
        question = question_match.group(1).strip() if question_match else "Could not parse question."

        options = []
        # Refined regex: Looks for "Option [letter/digit]:" then captures text until the next "Option" or "Correct Answer"
        option_matches = re.findall(r"(?:Option\s+([A-D]|[1-4])[:.)]|([A-D]|[1-4])[:.)])\s*(.*?)(?=\s*(?:Option\s+[A-D1-4][:.)]|Correct Answer:|$))", text, re.DOTALL | re.IGNORECASE)

        option_map = {'A': 'opt1', 'B': 'opt2', 'C': 'opt3', 'D': 'opt4',
                      '1': 'opt1', '2': 'opt2', '3': 'opt3', '4': 'opt4'}

        for key_group1, key_group2, option_text in option_matches:
            key = key_group1 if key_group1 else key_group2 # Use whichever group matched the letter/number
            option_id = option_map.get(key.upper())
            if option_id:
                options.append(schemas.MCQOptionSchema(id=option_id, text=option_text.strip()))

        # Find the correct answer indicator if provided
        # Correct_Answer: B
        correct_key_match = re.search(r"Correct Answer:?\s*([A-D]|[1-4])", text, re.IGNORECASE)
        correct_id = None
        if correct_key_match:
             correct_id = option_map.get(correct_key_match.group(1).upper())
             # We don't return the correct ID in the question schema, it's used for evaluation

        if not options or len(options) < 2:
            logger.warning(f"Could not parse options well for chapter {chapter}. Raw text: {text}")
            # Fallback: create dummy options? Or raise error?
            options = [schemas.MCQOptionSchema(id="opt1", text="Parse Error Option 1"), schemas.MCQOptionSchema(id="opt2", text="Parse Error Option 2")]

        return schemas.MCQQuestionResponseSchema(
            id=default_id,
            chapter=chapter,
            question_type="mcq",
            question_text=question,
            options=options
        )
    except Exception as e:
        logger.error(f"Error parsing MCQ response: {e}\nRaw Text: {text}", exc_info=True)
        # Return a fallback error structure
        return schemas.MCQQuestionResponseSchema(
             id=default_id, chapter=chapter, question_type="mcq",
             question_text="Error parsing question from AI.",
             options=[schemas.MCQOptionSchema(id="err", text="Error")]
        )

# --- AI Interaction Functions --- (Replacing Mocks)

async def generate_question_from_ai(chapter: str, question_type_filter: Optional[str] = None) -> schemas.CSQuestionResponse:
    """Calls Gemini to generate a CS practice question."""
    if not genai:
        raise HTTPException(status_code=500, detail="AI Service not configured.")

    q_type = question_type_filter if question_type_filter else random.choice(["mcq", "coding", "theory"])
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    prompt = f"Generate a single practice question suitable for a student learning about '{chapter}' in Computer Science. The question type should be '{q_type}'.\n\n"
    req_id = f"{q_type}_{random.randint(1000, 9999)}" # Generate ID here

    if q_type == "mcq":
        prompt += """
        Provide the following:
        1. The question text.
        2. 3-4 multiple-choice options, clearly labeled (e.g., A, B, C, D or 1, 2, 3, 4).
        3. Indicate the correct answer clearly (e.g., "Correct Answer: B").
        Format:
        Question: [Question text]
        Option A: [Option A text]
        Option B: [Option B text]
        Option C: [Option C text]
        Correct Answer: [Correct Letter/Number]
        """
    elif q_type == "coding":
        prompt += """
        Provide the following:
        1. A clear description of the coding problem (assume Python unless specified otherwise).
        2. An optional simple starting code stub (e.g., function definition with 'pass').
        Format:
        Problem: [Problem description]
        Code Stub: (Optional)
        [Code stub here]
        """
    else: # Theory
        prompt += """
        Provide a clear theory or conceptual question.
        Format:
        Question: [Question text]
        """

    logger.info(f"Generating {q_type} question for {chapter}. Prompt: {prompt[:150]}...")
    try:
        response = await model.generate_content_async(prompt)
        
        if response and hasattr(response, 'text'):
            raw_text = response.text
            logger.info(f"Gemini response received for {q_type} question. Length: {len(raw_text)}")
            
            if q_type == "mcq":
                # Attempt to parse the MCQ structure
                return _parse_mcq_response(raw_text, chapter, req_id)
            elif q_type == "coding":
                problem_match = re.search(r"Problem:\s*(.*?)\s*(?:Code Stub:|$)", raw_text, re.DOTALL | re.IGNORECASE)
                stub_match = re.search(r"Code Stub:\s*(.*)", raw_text, re.DOTALL | re.IGNORECASE)
                problem_text = problem_match.group(1).strip() if problem_match else "Error: Could not parse problem description."
                code_stub = stub_match.group(1).strip() if stub_match else None
                return schemas.CodingProblemResponseSchema(
                    id=req_id, chapter=chapter, question_type="coding",
                    question_text=problem_text, initial_code_stub=code_stub
                )
            else: # Theory
                question_match = re.search(r"Question:\s*(.*)", raw_text, re.DOTALL | re.IGNORECASE)
                question_text = question_match.group(1).strip() if question_match else "Error: Could not parse theory question."
                return schemas.TheoryQuestionResponseSchema(
                    id=req_id, chapter=chapter, question_type="theory",
                    question_text=question_text
                )
                
        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
             raise HTTPException(status_code=500, detail=f"AI content generation blocked. Reason: {response.prompt_feedback.block_reason}")
        else:
             raise HTTPException(status_code=500, detail="AI model returned an unexpected or empty response.")

    except Exception as e:
        logger.error(f"Gemini question generation failed for chapter '{chapter}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Generation Error: {str(e)}")


async def evaluate_submission_with_ai(
    question_id: str,
    question_type: str,
    question_text: str, # Now received from frontend
    answer: str, # For MCQ, this is the selected option_id
    options: Optional[List[schemas.MCQOptionSchema]] = None # Added for MCQ context
) -> schemas.CSSubmissionFeedbackResponse:
    """Evaluates a CS submission using Gemini."""
    if not genai:
        raise HTTPException(status_code=500, detail="AI Service not configured.")
        
    # --- MCQ Handling (Using AI) ---
    if question_type == "mcq":
        if not options:
            logger.warning(f"MCQ submission for Q_ID {question_id} missing options list.")
            raise HTTPException(status_code=400, detail="MCQ submission requires the list of options.")

        user_selected_option_text = "Not found"
        for opt in options:
            if opt.id == answer:
                user_selected_option_text = opt.text
                break
        
        model = genai.GenerativeModel('gemini-1.5-flash-latest')
        options_str = "\n".join([f"- Option ID: {opt.id}, Text: {opt.text}" for opt in options])
        prompt = f"""You are an AI computer science tutor evaluating a student's answer to a multiple-choice question.
Question: {question_text}

Available Options:
{options_str}

Student selected Option ID: {answer} (Text: "{user_selected_option_text}")

Please perform the following:
1.  Identify the ID of the *correct* option from the "Available Options" list.
2.  Provide the text of the correct option.
3.  Determine if the student's selected option (ID: {answer}) is correct.
4.  Provide a concise explanation for why the correct option is indeed correct.
5.  If the student's answer was incorrect, briefly explain the flaw in their choice or why the chosen option is wrong.

Format your response STRICTLY as follows, ensuring each field is on a new line:
Correctness: [Yes/No based on student's answer]
CorrectOptionID: [ID of the correct option]
CorrectOptionText: [Text of the correct option]
Explanation: [Your explanation of why the correct option is correct, and feedback on student's choice if incorrect]
AI_Feedback: [Any brief, general feedback or encouragement for the student, or a more detailed look if the explanation is simple]
DetailedSolution: [Restate the correct option and a clear, comprehensive reason why it is the best answer among the choices. This can be similar to or expand on the Explanation.]
"""
        logger.info(f"Evaluating MCQ ID {question_id} with AI. User selected: {answer}. Prompt (condensed): {prompt[:200]}...")
        
        try:
            response = await model.generate_content_async(prompt)
            original_raw_text = str(response.text) 
            logger.info(f"Original raw_text length: {len(original_raw_text)}")
            logger.info(f"Original raw_text type: {type(original_raw_text)}")
            logger.info(f"Original Raw Text For Regex Processing:\n>>>\n{original_raw_text}\n<<<" )

            # --- Start Character Inspection & Sanitization ---
            # Log ordinal values of characters around where 'CorrectOptionText:' is expected
            try:
                start_index = original_raw_text.lower().find('correctoptiontext:') - 15
                if start_index < 0: start_index = 0
                end_index = start_index + 60 # Log about 60 chars
                if end_index > len(original_raw_text): end_index = len(original_raw_text)
                
                debug_snippet = original_raw_text[start_index:end_index]
                char_ords = [(char, ord(char)) for char in debug_snippet]
                logger.info(f"Char ordinals for snippet '...{debug_snippet}...': {char_ords}")
            except Exception as e_inspect:
                logger.error(f"Error during char inspection: {e_inspect}")

            # Attempt to sanitize by keeping only printable ASCII and common whitespace
            sanitized_raw_text = "".join(char for char in original_raw_text if 32 <= ord(char) <= 126 or char in '\n\r\t')
            logger.info(f"Sanitized raw_text length: {len(sanitized_raw_text)}")
            if len(sanitized_raw_text) != len(original_raw_text):
                logger.warning("Length mismatch after sanitization! Some chars were removed.")
                logger.info(f"Sanitized Raw Text For Regex Processing:\n>>>\n{sanitized_raw_text}\n<<<" )
            
            raw_text_to_use = sanitized_raw_text # Use sanitized text for regex
            # --- End Character Inspection & Sanitization ---

            is_correct_val = False
            correct_option_id_val = None
            correct_option_text_val = "Could not determine from AI." 
            explanation_val = "AI could not provide a clear explanation." 
            ai_feedback_val = None 
            detailed_solution_val = None 

            correctness_match = re.search(r"Correctness:\s*(Yes|No)", raw_text_to_use, re.IGNORECASE)
            if correctness_match:
                is_correct_val = correctness_match.group(1).lower() == 'yes'

            correct_id_match = re.search(r"CorrectOptionID:\s*(\S+)", raw_text_to_use, re.IGNORECASE)
            if correct_id_match:
                correct_option_id_val = correct_id_match.group(1).strip()
            
            logger.info("Attempting to parse CorrectOptionText...") 
            correct_text_match = re.search(r"CorrectOptionText:(.*)", raw_text_to_use, re.IGNORECASE | re.DOTALL) 
            if correct_text_match:
                parsed_cot = correct_text_match.group(1).strip() 
                logger.info(f"DIAGNOSTIC PARSED CorrectOptionText (group 1, stripped): ###{parsed_cot}###") 
                actual_cot_value = parsed_cot.split('\n')[0].strip()
                if actual_cot_value:
                    correct_option_text_val = actual_cot_value
                    logger.info(f"Assigned CorrectOptionText: ###{correct_option_text_val}###")
                else:
                    logger.warning("Diagnostic Parsed CorrectOptionText (first line) was EMPTY after strip.")
            else:
                logger.warning("Diagnostic Regex for CorrectOptionText found NO MATCH.") 
            
            logger.info("Attempting to parse Explanation...") 
            explanation_match = re.search(r"Explanation:\s*(.*?)(?=\s*AI_Feedback:|\s*DetailedSolution:|$)", raw_text_to_use, re.DOTALL | re.IGNORECASE) 
            if explanation_match:
                parsed_expl = explanation_match.group(1).strip()
                logger.info(f"PARSED Explanation (stripped): ###{parsed_expl}###") 
                if parsed_expl: 
                    explanation_val = parsed_expl
                else:
                    logger.warning("Parsed Explanation was EMPTY after strip.") 
            else:
                logger.warning("Regex for Explanation found NO MATCH.") 

            logger.info("Attempting to parse AI_Feedback...") 
            ai_feedback_match = re.search(r"AI_Feedback:\s*(.*?)(?=\s*DetailedSolution:|$)", raw_text_to_use, re.DOTALL | re.IGNORECASE) 
            if ai_feedback_match:
                parsed_ai_feedback = ai_feedback_match.group(1).strip()
                logger.info(f"PARSED AI_Feedback (stripped): ###{parsed_ai_feedback}###") 
                if parsed_ai_feedback: 
                    ai_feedback_val = parsed_ai_feedback
                else:
                    logger.warning("Parsed AI_Feedback was EMPTY after strip.") 
            else:
                logger.warning("Regex for AI_Feedback found NO MATCH.") 

            logger.info("Attempting to parse DetailedSolution...") 
            detailed_solution_match = re.search(r"DetailedSolution:\s*(.*)", raw_text_to_use, re.DOTALL | re.IGNORECASE) 
            if detailed_solution_match:
                parsed_ds = detailed_solution_match.group(1).strip()
                logger.info(f"PARSED DetailedSolution (stripped): ###{parsed_ds}###") 
                if parsed_ds: 
                    detailed_solution_val = parsed_ds
                else:
                    logger.warning("Parsed DetailedSolution was EMPTY after strip.") 
            else:
                logger.warning("Regex for DetailedSolution found NO MATCH.") 

            return schemas.CSSubmissionFeedbackResponse(
                correct=is_correct_val,
                explanation=explanation_val,
                detailed_solution=detailed_solution_val,
                ai_feedback=ai_feedback_val,
                correct_option_id=correct_option_id_val,
                correct_option_text=correct_option_text_val
            )

        except Exception as e:
            logger.error(f"Gemini MCQ evaluation failed for Q_ID {question_id}: {e}", exc_info=True)
            return schemas.CSSubmissionFeedbackResponse(
                correct=False,
                explanation=f"Error during AI evaluation: {str(e)}. Please try again.",
                detailed_solution="Could not determine the solution due to an evaluation error.",
                ai_feedback="An issue occurred while trying to get AI feedback.",
                correct_option_id=None,
                correct_option_text=None
            )

    # --- AI Evaluation for Coding & Theory ---
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    prompt = f"You are an AI programming and computer science tutor evaluating a student's answer.\n\n"
    prompt += f"Question Type: {question_type}\n"
    prompt += f"Original Question: {question_text}\n"
    prompt += f"Student's Answer: {answer}\n\n"

    if question_type == "coding":
        prompt += """
        Please evaluate the student's Python code. Assess the following:
        1. Correctness: Does the code likely solve the problem based on the description? (Answer Yes/No/Partially)
        2. Explanation: Briefly explain if the code is correct, or why it's incorrect or incomplete.
        3. AI Feedback: Provide specific, constructive feedback on the code's logic, style, potential bugs, or areas for improvement.
        4. Detailed Solution: Provide a correct and idiomatic Python solution to the original problem.
        5. Simulated Output: Describe the expected output for a simple test case (e.g., "Calling add(2, 3) should return 5"). Do NOT attempt to execute the code.
        
        Format your response clearly, label each section (Correctness, Explanation, AI Feedback, Detailed Solution, Simulated Output).
        """
    elif question_type == "theory":
        prompt += """
        Please evaluate the student's explanation. Assess the following:
        1. Correctness: Is the explanation conceptually accurate and complete? (Answer Yes/No/Partially)
        2. Explanation: Briefly explain why the student's answer is correct or where it falls short.
        3. AI Feedback: Provide specific feedback on clarity, accuracy, depth, and examples used. Suggest improvements.
        4. Detailed Solution: Provide a clear, concise, and accurate model answer to the original question.
        
        Format your response clearly, label each section (Correctness, Explanation, AI Feedback, Detailed Solution).
        """
    else: # Should not happen based on request schema
        raise HTTPException(status_code=400, detail=f"Unsupported question type for evaluation: {question_type}")

    logger.info(f"Evaluating {question_type} submission for Q_ID {question_id}. Prompt: {prompt[:150]}...")
    try:
        response = await model.generate_content_async(prompt)

        if response and hasattr(response, 'text'):
            raw_text = response.text
            logger.info(f"Gemini response received for submission eval. Length: {len(raw_text)}")
            
            # --- Parse the structured feedback ---
            # This parsing needs to be robust. Using regex is one way.
            correctness_str = re.search(r"Correctness:\s*(Yes|No|Partially)", raw_text, re.IGNORECASE)
            explanation = re.search(r"Explanation:\s*(.*?)\s*(?:AI Feedback:|$)", raw_text, re.DOTALL | re.IGNORECASE)
            ai_feedback = re.search(r"AI Feedback:\s*(.*?)\s*(?:Detailed Solution:|$)", raw_text, re.DOTALL | re.IGNORECASE)
            detailed_solution = re.search(r"Detailed Solution:\s*(.*?)\s*(?:Simulated Output:|$)", raw_text, re.DOTALL | re.IGNORECASE)
            simulated_output = re.search(r"Simulated Output:\s*(.*)", raw_text, re.DOTALL | re.IGNORECASE) if question_type == "coding" else None

            is_correct = correctness_str.group(1).lower() == 'yes' if correctness_str else False # Default to False if not parsed
            
            # Create feedback response
            return schemas.CSSubmissionFeedbackResponse(
                correct=is_correct,
                explanation=explanation.group(1).strip() if explanation else "Could not parse explanation.",
                ai_feedback=ai_feedback.group(1).strip() if ai_feedback else None,
                detailed_solution=detailed_solution.group(1).strip() if detailed_solution else None,
                simulated_output=simulated_output.group(1).strip() if simulated_output else None
            )
            
        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
             raise HTTPException(status_code=500, detail=f"AI content evaluation blocked. Reason: {response.prompt_feedback.block_reason}")
        else:
             raise HTTPException(status_code=500, detail="AI model returned an unexpected or empty response for evaluation.")

    except Exception as e:
        logger.error(f"Gemini submission evaluation failed for Q_ID '{question_id}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Evaluation Error: {str(e)}")


# --- API Endpoints --- (Now use the AI functions)

@router.post("/questions", response_model=schemas.CSQuestionResponse, summary="Get a Computer Science practice question")
async def get_cs_question(request: schemas.CSQuestionRequest):
    """Generates a Computer Science practice question, optionally of a specific type."""
    logger.info(f"Received request for CS question: chapter='{request.chapter_name}', type='{request.requested_question_type}'")
    try:
        # Pass the requested_question_type to the generation function
        question = await generate_question_from_ai(request.chapter_name, request.requested_question_type)
        return question
    except HTTPException as e:
        raise e


@router.post("/submit", response_model=schemas.CSSubmissionFeedbackResponse, summary="Submit an answer for a Computer Science question")
async def submit_cs_answer(submission: schemas.CSSubmissionRequest):
    """Evaluates the submitted answer using AI (for coding/theory)."""
    return await evaluate_submission_with_ai(
        question_id=submission.question_id,
        question_type=submission.question_type,
        question_text=submission.question_text, # Pass question text
        answer=submission.answer, # Pass selected option_id
        options=submission.options # Pass options list
    )

# --- AI Helper Functions for Learning Aids (Stubs) ---

def _parse_flashcards_from_text(text: str, chapter: str) -> List[schemas.FlashcardSchema]:
    """Parses AI response text to extract flashcards (Q/A pairs)."""
    flashcards = []   
    # Regex to find blocks starting with Q: or Question: and A: or Answer:
    # It captures the text after Q: and A: until the next Q: or end of string.
    # Using re.DOTALL so '.' matches newlines, and re.IGNORECASE for Q/A prefixes.
    pattern = re.compile(r"(?:Q:|Question:)\s*(.*?)\s*(?:A:|Answer:)\s*(.*?)(?=\s*(?:Q:|Question:)|$)", re.DOTALL | re.IGNORECASE)
    
    matches = pattern.findall(text)
    
    for q_text, a_text in matches:
        question = q_text.strip()
        answer = a_text.strip()
        if question and answer: # Ensure both are non-empty
            flashcards.append(schemas.FlashcardSchema(question=question, answer=answer))
            
    if not flashcards:
        logger.warning(f"Could not parse any flashcards for chapter '{chapter}' from raw text. Text: {text[:300]}...")
        # Optionally, return a single flashcard indicating parse error, or let it be an empty list
        # flashcards.append(schemas.FlashcardSchema(question="Parsing Error", answer="Could not extract flashcards from AI response."))
        
    return flashcards

async def generate_flashcards_from_ai(chapter: str) -> schemas.FlashcardsResponse:
    if not genai:
        raise HTTPException(status_code=500, detail="AI Service not configured.")

    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    prompt = f"""
Generate 3-5 flashcards for the Computer Science chapter: '{chapter}'. 
Each flashcard should have a clear Question and a concise Answer.
Use the following format strictly for each flashcard:

Q: [Your Question Here]
A: [Your Answer Here]

Q: [Another Question Here]
A: [Another Answer Here]

(and so on...)
"""

    logger.info(f"Generating AI flashcards for chapter: {chapter}")
    try:
        response = await model.generate_content_async(prompt)

        if response and hasattr(response, 'text') and response.text:
            raw_text = response.text.strip()
            parsed_flashcards = _parse_flashcards_from_text(raw_text, chapter)
            
            if not parsed_flashcards:
                # If parsing failed, we might log and raise, or return empty/error flashcard
                logger.warning(f"Flashcard parsing returned empty for {chapter}. Raw AI text: {raw_text[:500]}")
                # Depending on desired behavior, could raise HTTPException or return with an error indicator
                # For now, let's return empty if parsing fails, client can handle this.

            logger.info(f"Gemini flashcards received and parsed for {chapter}. Count: {len(parsed_flashcards)}")
            return schemas.FlashcardsResponse(chapter=chapter, flashcards=parsed_flashcards)
        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            logger.error(f"AI flashcards generation blocked for {chapter}. Reason: {response.prompt_feedback.block_reason}")
            raise HTTPException(status_code=500, detail=f"AI content generation blocked. Reason: {response.prompt_feedback.block_reason}")
        else:
            logger.error(f"AI model returned an unexpected or empty response for flashcards: {chapter}")
            raise HTTPException(status_code=500, detail="AI model returned an empty or invalid response for flashcards.")

    except Exception as e:
        logger.error(f"Gemini flashcards generation failed for chapter '{chapter}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Flashcards Generation Error: {str(e)}")

async def generate_summary_from_ai(chapter: str) -> schemas.SummaryResponse:
    if not genai:
        raise HTTPException(status_code=500, detail="AI Service not configured.")
    
    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    prompt = f"Generate a concise educational summary (around 150-250 words) for the Computer Science chapter: '{chapter}'. The summary should cover the main concepts and be easy to understand for a student."
    
    logger.info(f"Generating AI summary for chapter: {chapter}")
    try:
        response = await model.generate_content_async(prompt)
        
        if response and hasattr(response, 'text') and response.text:
            summary_text = response.text.strip()
            logger.info(f"Gemini summary received for {chapter}. Length: {len(summary_text)}")
            return schemas.SummaryResponse(chapter=chapter, summary_text=summary_text)
        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            logger.error(f"AI summary generation blocked for {chapter}. Reason: {response.prompt_feedback.block_reason}")
            raise HTTPException(status_code=500, detail=f"AI content generation blocked. Reason: {response.prompt_feedback.block_reason}")
        else:
            logger.error(f"AI model returned an unexpected or empty response for summary: {chapter}")
            raise HTTPException(status_code=500, detail="AI model returned an empty or invalid response for summary.")

    except Exception as e:
        logger.error(f"Gemini summary generation failed for chapter '{chapter}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Summary Generation Error: {str(e)}")

async def generate_key_points_from_ai(chapter: str) -> schemas.KeyPointsResponse:
    if not genai:
        raise HTTPException(status_code=500, detail="AI Service not configured.")

    model = genai.GenerativeModel('gemini-1.5-flash-latest')
    prompt = f"Generate a list of 5-7 key points for the Computer Science chapter: '{chapter}'. Each key point should be a concise statement. Start each key point with a hyphen (-) or a number followed by a period (e.g., '1.')."

    logger.info(f"Generating AI key points for chapter: {chapter}")
    try:
        response = await model.generate_content_async(prompt)

        if response and hasattr(response, 'text') and response.text:
            raw_text = response.text.strip()
            # Simple parsing: split by newline and filter out empty lines or non-keypoint lines.
            # This assumes the AI follows the hyphen or number list format.
            key_points = [line.strip() for line in raw_text.split('\n') 
                          if line.strip() and (line.strip().startswith('-') or re.match(r"^\d+\.\s", line.strip()))]
            
            # Remove the leading markers (-, 1., etc.) for cleaner display
            cleaned_key_points = []
            for point in key_points:
                if point.startswith('-'):
                    cleaned_key_points.append(point[1:].strip())
                elif re.match(r"^\d+\.\s", point):
                    cleaned_key_points.append(re.sub(r"^\d+\.\s*", "", point).strip())
                else:
                    cleaned_key_points.append(point) # Should not happen if AI follows format
            
            if not cleaned_key_points:
                 logger.warning(f"Could not parse key points from AI response for {chapter}. Raw: {raw_text}")
                 # Fallback: return the raw text as a single key point or an error message
                 cleaned_key_points = ["Could not parse key points from AI response. Please try again."]

            logger.info(f"Gemini key points received for {chapter}. Count: {len(cleaned_key_points)}")
            return schemas.KeyPointsResponse(chapter=chapter, key_points=cleaned_key_points)
        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            logger.error(f"AI key points generation blocked for {chapter}. Reason: {response.prompt_feedback.block_reason}")
            raise HTTPException(status_code=500, detail=f"AI content generation blocked. Reason: {response.prompt_feedback.block_reason}")
        else:
            logger.error(f"AI model returned an unexpected or empty response for key points: {chapter}")
            raise HTTPException(status_code=500, detail="AI model returned an empty or invalid response for key points.")

    except Exception as e:
        logger.error(f"Gemini key points generation failed for chapter '{chapter}': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"AI Key Points Generation Error: {str(e)}")

# --- Learning Aids Endpoint ---
@router.post("/learning-aids", response_model=schemas.LearningAidResponse, summary="Get AI-generated learning aids for a CS chapter")
async def get_learning_aid(request: schemas.LearningAidRequest):
    """Fetches AI-generated learning aids (flashcards, summary, or key points) for a given CS chapter."""
    if request.aid_type == "flashcards":
        return await generate_flashcards_from_ai(request.chapter_name)
    elif request.aid_type == "summary":
        return await generate_summary_from_ai(request.chapter_name)
    elif request.aid_type == "key_points":
        return await generate_key_points_from_ai(request.chapter_name)
    else:
        # This case should ideally be prevented by Pydantic validation of Literal
        raise HTTPException(status_code=400, detail=f"Invalid learning aid type: {request.aid_type}") 