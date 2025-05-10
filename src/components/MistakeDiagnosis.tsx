import React, { useState, useEffect } from 'react';
import { Button } from './ui/button'; // Assuming shadcn/ui is used
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { diagnoseSolutionApi, DiagnoseSolutionPayload } from '../lib/api';

// Define props interface
interface MistakeDiagnosisProps {
  initialProblemText?: string;
}

export function MistakeDiagnosis({ initialProblemText }: MistakeDiagnosisProps): JSX.Element {
  const [problemText, setProblemText] = useState<string>('');
  const [userSteps, setUserSteps] = useState<string>('');
  const [feedback, setFeedback] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [userHasEditedProblem, setUserHasEditedProblem] = useState<boolean>(false);

  useEffect(() => {
    if (initialProblemText && !userHasEditedProblem) {
      setProblemText(initialProblemText);
    }
    // Do not reset userHasEditedProblem here, it should only be set to true on user input
    // and reset if the component needs to re-sync with a new initialProblemText from a new problem entirely.
    // For now, this handles pre-filling if the user hasn't touched it.
  }, [initialProblemText, userHasEditedProblem]);

  const handleProblemTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setProblemText(e.target.value);
    setUserHasEditedProblem(true); // Mark that user has edited the problem input
  };

  const handleSubmit = async () => {
    if (!problemText.trim() || !userSteps.trim()) {
      setError('Please enter both the problem and your steps.');
      setFeedback('');
      return;
    }
    setIsLoading(true);
    setError('');
    setFeedback('');

    const payload: DiagnoseSolutionPayload = {
      problem_text: problemText,
      user_steps: userSteps,
    };

    try {
      const response = await diagnoseSolutionApi(payload);
      if (response.error) {
        setError(response.error);
        setFeedback('');
      } else {
        setFeedback(response.feedback);
        setError('');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'An unexpected error occurred.';
      setError(errorMessage);
      setFeedback('');
    }
    setIsLoading(false);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>AI-Based Mistake Diagnosis</CardTitle>
        <CardDescription>
          Enter your math problem and the steps you took to solve it. Our AI will analyze your solution and provide feedback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="problem-text">Problem Statement</Label>
          <Textarea
            id="problem-text"
            placeholder="e.g., Solve for x: 2x + 5 = 11"
            value={problemText}
            onChange={handleProblemTextChange}
            rows={3}
            disabled={isLoading}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-steps">Your Solution Steps</Label>
          <Textarea
            id="user-steps"
            placeholder="Enter each step on a new line, e.g.,
1. 2x = 11 - 5
2. 2x = 6
3. x = 3"
            value={userSteps}
            onChange={(e) => setUserSteps(e.target.value)}
            rows={6}
            disabled={isLoading}
          />
        </div>
      </CardContent>
      <CardFooter className="flex flex-col items-start space-y-4">
        <Button onClick={handleSubmit} disabled={isLoading} className="w-full sm:w-auto">
          {isLoading ? 'Diagnosing...' : 'Diagnose My Solution'}
        </Button>
        {error && (
          <div className="w-full p-3 text-red-700 bg-red-100 border border-red-300 rounded-md">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}
        {feedback && (
          <div className="w-full p-3 text-blue-700 bg-blue-100 border border-blue-300 rounded-md">
            <p className="font-semibold">Feedback:</p>
            {/* Using a pre-wrap to maintain formatting from Markdown-like responses */}
            <div style={{ whiteSpace: 'pre-wrap' }} dangerouslySetInnerHTML={{ __html: feedback.replace(/\\n/g, '<br />') }} />
          </div>
        )}
      </CardFooter>
    </Card>
  );
} 