# Math Wiz Assistant

## Overview

Math Wiz Assistant is a comprehensive web application designed to help users solve math problems, understand concepts, and practice their skills. It leverages AI to provide step-by-step solutions, diagnose mistakes in user attempts, generate practice questions, and offer an interactive tutoring experience. Users can input problems via text, upload images for OCR extraction, or even use voice input.

## Features

*   **User Authentication**: Secure registration and login for personalized experience.
*   **Problem Input Methods**:
    *   **Text Input**: Directly type or paste math problems.
    *   **Image Upload (OCR)**: Upload images of handwritten or printed math problems to extract the text.
    *   **Voice Input**: Dictate math problems (browser permitting).
    *   **Camera Input**: Capture math problems using the device camera (browser permitting).
*   **AI-Powered Math Problem Solving**:
    *   **Step-by-Step Solutions**: Get detailed, sequential explanations for solving math problems.
    *   **Final Answers**: Clear presentation of the solution for math problems.
    *   **Interactive Explanations**: Ask "why" or "how" for specific math steps to get further clarification.
*   **Mistake Diagnosis (Mathematics)**: Input a math problem and your attempted solution to receive AI-driven feedback on errors.
*   **Practice Problem Generation (Mathematics)**:
    *   Generate math practice questions based on a selected topic or a previously solved problem.
*   **Computer Science Learning Module**:
    *   **Structured Content**: Select CS subjects (e.g., Computer Science) and specific chapters (e.g., Data Structures, Algorithms, Operating Systems, DBMS, Computer Networks, Programming Concepts).
    *   **Diverse Question Types**: Generate various types of practice questions per chapter:
        *   **Multiple Choice Questions (MCQs)**: Test conceptual understanding.
        *   **Coding Problems**: Solve practical programming challenges with an in-browser code editor (supports syntax highlighting).
        *   **Theory Questions**: Answer open-ended conceptual questions.
    *   **AI-Powered Feedback & Solutions for CS**: 
        *   Receive detailed evaluations for submitted MCQ, coding, and theory answers.
        *   Get explanations for why an answer is correct or incorrect.
        *   View AI-generated model solutions for all question types.
        *   For coding problems, feedback includes simulated output for sample test cases and suggestions on logic, style, and potential bugs.
        *   **AI-Generated Learning Aids**: For each CS chapter, access supplementary materials:
            *   **Flashcards**: Review key terms and concepts with Q&A flashcards.
            *   **Chapter Summaries**: Get concise overviews of core chapter content.
            *   **Key Point Lists**: Quickly revise the most important takeaways from a chapter.
*   **Graphing Calculator**: Input equations to generate and view visual graphs.
*   **AI Tutor Chat**: Interactive chat interface for asking math-related questions and getting help.
*   **User Dashboard**: View profile information and (potentially) progress.
*   **Bookmarking**: Save interesting problems and their solutions for later review.
*   **User Experience (XP) System**: Gain experience points for solving problems and level up.
*   **Responsive Design**: UI adapts to different screen sizes with components from shadcn/ui and Tailwind CSS.
*   **Dark Mode**: Theme support for user preference.

## Technologies Used

*   **Backend**:
    *   Python
    *   FastAPI (web framework)
    *   SQLAlchemy (ORM for database interaction)
    *   Alembic (database migrations)
    *   Uvicorn (ASGI server)
    *   Google Gemini (for AI-powered solving, explanations, CS content generation, etc.)
    *   Pydantic (data validation)
*   **Frontend**:
    *   React
    *   TypeScript
    *   Vite (build tool)
    *   Tailwind CSS (utility-first CSS framework)
    *   shadcn/ui (component library)
    *   React Router (routing)
    *   TanStack Query (React Query for data fetching and state management)
    *   Katex (for rendering mathematical notation)
    *   react-simple-code-editor (for CS coding problem input)
    *   React Sketch Canvas (for drawing input)
    *   Various Radix UI primitives (underlying many shadcn/ui components)
*   **Database**:
    *   SQLite (as per `alembic.ini` and `math_wiz_app.db`)
*   **Version Control**:
    *   Git

## Project Structure

```
math-wiz-assistant/
├── alembic/              # Alembic migration scripts
├── backend/              # FastAPI backend application
│   ├── __pycache__/      # Python cache (typically in .gitignore)
│   ├── routers/          # API routers (e.g., auth_router.py, cs_router.py, etc.)
│   ├── uploads/          # Temporary storage for uploaded files (from .gitignore)
│   ├── ocr.py            # Optical Character Recognition logic
│   ├── solver.py         # Math problem solving logic
│   └── graphing.py       # Graph generation logic
├── node_modules/         # Node.js dependencies (typically in .gitignore)
├── public/               # Static assets for the frontend (e.g., index.html, favicons)
├── src/                  # Primary frontend React/TypeScript application source
│   ├── assets/           # Static assets like images, fonts used by the frontend app
│   ├── components/       # Reusable UI components
│   │   ├── cs/           # Components specific to Computer Science features
│   │   └── ui/           # shadcn/ui components
│   ├── context/          # React context (e.g., AuthContext)
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions and API helpers
│   ├── pages/            # Page components for different routes (if using page-based routing)
│   ├── App.tsx           # Main App component with routing setup
│   ├── main.tsx          # Entry point for the React application
│   └── index.css         # Global styles and Tailwind directives
├── .git/                 # Git version control files
├── .gitignore            # Specifies intentionally untracked files
├── alembic.ini           # Alembic configuration
├── main.py               # Main FastAPI application entry point (at the root)
├── math_wiz_app.db       # SQLite database file
├── package.json          # Frontend project metadata and dependencies
├── package-lock.json     # Exact versions of frontend dependencies
├── README.md             # This file
├── tailwind.config.ts    # Tailwind CSS configuration
├── tsconfig.json         # TypeScript root configuration
├── tsconfig.app.json     # TypeScript configuration for the app
├── tsconfig.node.json    # TypeScript configuration for Node.js scripts (e.g., Vite config)
└── vite.config.ts        # Vite configuration
```

## Setup and Installation

### Prerequisites

*   Node.js and npm (or bun)
*   Python 3.8+ and pip
*   Git

### Backend Setup

1.  **Clone the repository:**
    ```bash
    git clone <YOUR_GIT_URL>
    cd math-wiz-assistant
    ```
2.  **Navigate to the backend directory (if applicable, though `main.py` is at root):**
    *(Adjust if backend code is primarily in `backend/` and needs its own venv there)*
3.  **Create and activate a virtual environment:**
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows: venv\\Scripts\\activate
    ```
4.  **Install Python dependencies:**
    ```bash
    pip install -r backend/requirements.txt
    ```
    *Note: Check the comments within `backend/requirements.txt` for any system-level dependencies that might need separate installation (e.g., Tesseract OCR, Poppler).*
5.  **Set up environment variables (Backend):**
    *   Create a `.env` file in the project root directory. This file is crucial for storing sensitive information like API keys.
    *   You **must** add your `GOOGLE_API_KEY` (obtained from Google AI Studio/Cloud Console) to this file for all AI-powered features (math solving, CS content generation, learning aids, etc.) to work.
    Example `.env` file content:
    ```
    GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY_HERE"
    # DATABASE_URL="sqlite:///./math_wiz_app.db" # This is usually handled by alembic.ini or backend config
    ```
6.  **Initialize and run database migrations:**
    ```bash
    alembic upgrade head
    ```

### Frontend Setup

1.  **Navigate to the project root (if not already there):**
    ```bash
    cd /path/to/math-wiz-assistant
    ```
2.  **Install Node.js dependencies:**
    ```bash
    npm install
    # or if using bun:
    # bun install
    ```
3.  **Environment Variables (Frontend):**
    *   The frontend uses Vite and requires a `.env` file in the project root for variables like `VITE_API_URL` to connect to the backend.
    Example `.env` file in the project root (can be the same `.env` file used for backend): 
    ```
    VITE_API_URL=http://127.0.0.1:8000
    ```

## Running the Application

### Backend

1.  **Ensure your virtual environment is activated.**
2.  **Start the FastAPI server from the project root (where `main.py` is):**
    ```bash
    uvicorn main:app --reload --port 8000
    ```
    The backend API will typically be available at `http://127.0.0.1:8000`.

### Frontend

1.  **Open a new terminal in the project root.**
2.  **Start the Vite development server:**
    ```bash
    npm run dev
    # or if using bun:
    # bun dev
    ```
    The frontend will typically be available at `http://localhost:8003` (as per `vite.config.ts`).

## API Endpoints (Summary)

*   `POST /api/register`: User registration.
*   `POST /api/login`: User login (returns JWT token).
*   `GET /api/users/me`: Get current authenticated user's details.
*   `POST /upload-image`: Upload an image for OCR and problem solving.
*   `POST /solve-text`: Solve a math problem provided as text.
*   `POST /explain-step`: Get detailed explanation for a specific step of a math solution.
~*   `POST /generate-practice-problem`: Generate a math practice problem.
*   `POST /cs/questions`: Generate a Computer Science practice question (MCQ, coding, or theory).
*   `POST /cs/submit`: Submit an answer for a CS question and receive AI-powered feedback and solution.
*   `POST /cs/learning-aids`: Fetch AI-generated learning materials (flashcards, summary, key points) for a CS chapter.
*   `POST /generate-graph`: Generate a graph for an equation.
*   `POST /api/chat`: (Currently a placeholder, actual endpoint for AI Tutor chat may vary or needs implementation).
*   `GET /api/bookmarks`: Get user's bookmarks.
*   `POST /api/bookmarks`: Create a bookmark.
*   `DELETE /api/bookmarks/{bookmark_id}`: Delete a bookmark.
*   `POST /diagnose-solution`: Diagnose a user's math solution attempt.
*   `GET /api/daily-puzzle`: Fetch the daily puzzle.
*   `POST /api/submit-puzzle`: Submit an answer for the daily puzzle.
*   `GET /user/data`: Get current user's XP and other relevant data.

*(This is based on observed API calls in frontend components and backend route definitions. Always refer to the backend code for the definitive list of active endpoints and their exact paths/schemas.)*

## Usage

1.  Navigate to the application in your browser (default: `http://localhost:8003`).
2.  Register for a new account or log in if you have one.
3.  Explore the different features:
    *   Use the "Solve & Diagnose" section to upload images or type math problems, and get step-by-step solutions or feedback on your attempts.
    *   Navigate to "Practice Problems" to select either Mathematics or Computer Science topics.
        *   For **Mathematics**, choose a topic to generate practice problems and view their solutions.
        *   For **Computer Science**, select a chapter to generate MCQs, Coding Problems (with an interactive editor), or Theory Questions. Submit your answers to receive AI-powered feedback and model solutions. Additionally, access AI-generated **Learning Aids** like Flashcards, Summaries, and Key Points for CS chapters.
    *   Interact with the "AI Tutor" for chat-based assistance (primarily for math).
    *   Use the "Graphing" tool for visualizing equations.
    *   Check your "Dashboard" (if available) and manage your "Bookmarks".
    *   Track your progress with the XP and Level system.
