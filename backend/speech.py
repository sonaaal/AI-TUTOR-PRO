"""Text-to-Speech (TTS) Utilities"""
import logging
import io
from gtts import gTTS
from fastapi import HTTPException

logger = logging.getLogger(__name__)

async def text_to_speech(text: str) -> io.BytesIO:
    """Converts text to speech using gTTS and returns an in-memory MP3 audio stream."""
    logger.info(f"Generating TTS for text: '{text[:50]}...'")
    try:
        tts = gTTS(text=text, lang='en', slow=False) # slow=False for normal speed
        
        # Save the audio to an in-memory file
        audio_fp = io.BytesIO()
        tts.write_to_fp(audio_fp)
        audio_fp.seek(0) # Rewind the file pointer to the beginning

        logger.info(f"Successfully generated TTS audio stream.")
        return audio_fp

    except Exception as e:
        logger.error(f"gTTS failed to generate speech for '{text[:50]}...': {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Text-to-Speech generation failed: {str(e)}")

# Placeholder for speech synthesis functions
async def text_to_speech_placeholder(text: str) -> io.BytesIO:
    print(f"[Placeholder] text_to_speech called for: {text[:30]}...")
    # In a real implementation, this would call a TTS API (e.g., Google TTS)
    # and return an audio stream (like MP3 data) in a BytesIO object.
    # For now, return empty bytes.
    return io.BytesIO(b"") 