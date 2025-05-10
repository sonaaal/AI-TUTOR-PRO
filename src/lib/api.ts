const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface DiagnoseSolutionPayload {
  problem_text: string;
  user_steps: string;
}

export interface DiagnoseSolutionResponse {
  feedback: string;
  error?: string;
}

export async function diagnoseSolutionApi(payload: DiagnoseSolutionPayload): Promise<DiagnoseSolutionResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/diagnose-solution`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "An unknown error occurred" }));
      throw new Error(errorData.detail || errorData.error || `HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error in diagnoseSolutionApi:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred during diagnosis.";
    return { feedback: "", error: errorMessage };
  }
}

// You can add other API call functions here in the future 

// --- Daily Puzzle API Functions ---

export interface DailyPuzzle {
  puzzle_id: string;
  question: string;
  difficulty?: string;
}

export async function getDailyPuzzleApi(token: string): Promise<DailyPuzzle> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/daily-puzzle`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "An unknown error occurred fetching puzzle" }));
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error in getDailyPuzzleApi:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred fetching the daily puzzle.";
    // For GET, we might not have a specific error structure in the body for failure to return a puzzle object
    // So, re-throw to be handled by the component
    throw new Error(errorMessage);
  }
}

export interface SubmitPuzzlePayload {
  puzzle_id: string;
  user_answer: string;
}

export interface SubmitPuzzleResponse {
  is_correct: boolean;
  message: string;
  correct_answer?: string;
  puzzle_id: string;
  error?: string; // Added for consistency if API returns an error field
}

export async function submitDailyPuzzleApi(payload: SubmitPuzzlePayload, token: string): Promise<SubmitPuzzleResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/submit-puzzle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "An unknown error occurred submitting answer" }));
      // The backend /api/submit-puzzle might not have an 'error' field in its Pydantic model for errors,
      // but it will have 'detail' from HTTPException.
      throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error in submitDailyPuzzleApi:", error);
    const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred submitting the answer.";
    // We need to return something that matches SubmitPuzzleResponse, even in error, or rethrow.
    // Rethrowing is often cleaner for the component to handle in its catch block.
    throw new Error(errorMessage);
  }
} 