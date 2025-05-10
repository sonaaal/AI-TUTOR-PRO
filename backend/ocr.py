"""Optical Character Recognition (OCR) Utilities"""
import logging
from fastapi import HTTPException
from PIL import Image
# Remove pytesseract and related imports if sticking purely to Gemini
# import pytesseract 
# import cv2
# import numpy as np
# from pdf2image import convert_from_path
from . import config # Relative import
import io # For handling byte streams

logger = logging.getLogger(__name__)

# --- Optional: Google Generative AI (Gemini) --- 
# Attempt to import and configure Gemini
genai = None
try:
    import google.generativeai as genai_import
    if config.GOOGLE_API_KEY:
        genai_import.configure(api_key=config.GOOGLE_API_KEY)
        genai = genai_import # Assign to genai only if key exists
        logger.info("Google Generative AI configured successfully for OCR.")
    else:
        logger.warning("Google API Key not found in config/env. Gemini OCR disabled.")
except ImportError:
    logger.warning("google-generativeai package not installed. Gemini OCR disabled.")
except Exception as e:
    logger.error(f"Error configuring Google Generative AI for OCR: {e}")

# --- Gemini OCR Helper --- 
async def extract_text_with_gemini(image_path_or_bytes: str | bytes, mime_type: str) -> str:
    """Extracts text from image bytes using Gemini Pro Vision API."""
    if not genai:
        raise HTTPException(status_code=501, detail="Gemini API for OCR is not configured or available.")

    logger.info(f"Attempting OCR with Gemini for mime_type: {mime_type}")
    # Use a model compatible with vision
    model = genai.GenerativeModel('gemini-1.5-flash-latest') 

    # Prompt for Gemini
    prompt = "Extract all text content accurately from this image. Preserve the original formatting and line breaks where possible. Focus on mathematical notation if present."

    image_parts = [
        {
            "mime_type": mime_type,
            "data": image_path_or_bytes # Pass bytes directly
        }
    ]

    try:
        # Generate content
        response = await model.generate_content_async([prompt] + image_parts)

        # Extract text - handle potential response structures/errors
        if response and hasattr(response, 'text'):
             extracted_text = response.text.strip()
             logger.info(f"Gemini OCR successful. Text length: {len(extracted_text)}")
             return extracted_text
        elif response and hasattr(response, 'prompt_feedback') and response.prompt_feedback.block_reason:
            block_reason = response.prompt_feedback.block_reason
            logger.error(f"Gemini request blocked. Reason: {block_reason}")
            # Modify error based on reason if needed
            detail_msg = f"Content generation blocked by API. Reason: {block_reason}"
            if "safety" in str(block_reason).lower():
                 detail_msg = "The provided image could not be processed due to safety filters."
            raise HTTPException(status_code=400, detail=detail_msg)
        else:
            # Attempt to get more details if possible
            error_detail = "Unknown error or empty response."
            try:
                # Check common error structures if available
                if response and hasattr(response, 'candidates') and not response.candidates:
                     error_detail = "No candidates returned by API."
                # Add more specific checks if the API documentation suggests them
            except Exception:
                 pass # Ignore errors during error inspection
            logger.error(f"Gemini response format unexpected or empty. Details: {error_detail} Response: {response}")
            raise HTTPException(status_code=500, detail=f"Gemini API returned an unexpected response: {error_detail}")

    except Exception as e:
        logger.error(f"Error during Gemini OCR call: {e}", exc_info=True)
        # Distinguish API errors from other errors
        err_str = str(e).lower()
        if "api key" in err_str or "permission denied" in err_str or "authentication" in err_str:
             raise HTTPException(status_code=401, detail=f"Gemini API Error: Authentication or Permission Issue. Please check API Key.")
        elif isinstance(e, HTTPException): # Re-raise specific HTTP errors
            raise e
        else:
            # Generic internal error for other exceptions
            raise HTTPException(status_code=500, detail=f"Gemini OCR failed: An unexpected error occurred.")

# --- Main OCR Extraction Function --- 
async def extract_text_from_image(file_path: str) -> str:
    """Extracts text using Gemini. Reads file content into memory."""
    logger.info(f"Extracting text from: {file_path}")
    file_extension = file_path.rsplit('.', 1)[1].lower()
    mime_type = f'image/{file_extension}' if file_extension != 'jpg' else 'image/jpeg'
    
    # Handle PDF separately - for now, let's raise an error as Gemini doesn't directly take PDF bytes
    # A better implementation would convert PDF pages to images first
    if file_extension == 'pdf':
         logger.error("Direct PDF processing with Gemini OCR is not implemented in this version.")
         # TODO: Implement PDF to image conversion here if needed
         raise HTTPException(status_code=501, detail="PDF processing not implemented for this OCR method.")
    
    if file_extension not in ['png', 'jpg', 'jpeg', 'webp']: # Gemini Vision supports these
         logger.error(f"Unsupported file type for Gemini OCR: {file_extension}")
         raise HTTPException(status_code=400, detail=f"Unsupported file type for OCR: {file_extension}. Use PNG, JPG, JPEG, or WEBP.")

    try:
        # Read the image file bytes
        with open(file_path, "rb") as f:
            image_bytes = f.read()
        
        # Call the Gemini helper
        return await extract_text_with_gemini(image_bytes, mime_type)

    except FileNotFoundError:
        logger.error(f"Image file not found at path: {file_path}")
        raise HTTPException(status_code=404, detail="Image file not found for OCR processing.")
    except HTTPException as e:
         raise e # Re-raise HTTP exceptions from Gemini helper
    except Exception as e:
        logger.error(f"An unexpected error occurred reading file or calling OCR for {file_path}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during OCR processing: {str(e)}") 