import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# API Keys
MATHPIX_APP_ID = os.getenv("MATHPIX_APP_ID")
MATHPIX_APP_KEY = os.getenv("MATHPIX_APP_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
WOLFRAM_APP_ID = os.getenv("WOLFRAM_APP_ID")

# Google AI API Key
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# Tesseract Configuration
TESSERACT_CMD = os.getenv("TESSERACT_CMD")

# Feature Flags (Convert string 'true' to boolean True)
USE_GPT_EXPLANATIONS = os.getenv("USE_GPT_EXPLANATIONS", "false").lower() == "true"
PREFER_WOLFRAM_ALPHA = os.getenv("PREFER_WOLFRAM_ALPHA", "false").lower() == "true"

# Folder where uploaded files will be temporarily stored
# Creates a folder named 'uploads' inside the 'backend' directory
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')

# Allowed file extensions for uploads
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'pdf'}

# Add other configurations here as needed, e.g.:
# MATHPIX_APP_ID = os.getenv("MATHPIX_APP_ID")
# MATHPIX_APP_KEY = os.getenv("MATHPIX_APP_KEY")
# GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") 