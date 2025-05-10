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