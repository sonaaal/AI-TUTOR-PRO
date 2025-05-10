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
    <div className="w-full">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="problem-text" className="text-gray-700 font-medium">Problem Statement</Label>
            <Textarea
              id="problem-text"
              placeholder="e.g., Solve for x: 2x + 5 = 11"
              value={problemText}
              onChange={handleProblemTextChange}
              rows={3}
              disabled={isLoading}
              className="resize-none border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="user-steps" className="text-gray-700 font-medium">Your Solution Steps</Label>
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
              className="resize-none border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
            />
          </div>
        </div>
        
        <Button 
          onClick={handleSubmit} 
          disabled={isLoading} 
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] text-white motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
                <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">Loading...</span>
              </div>
              Diagnosing...
            </span>
          ) : 'Diagnose My Solution'}
        </Button>
        
        {error && (
          <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-700">
            <p className="font-medium mb-1">Error:</p>
            <p>{error}</p>
          </div>
        )}
        
        {feedback && (
          <div className="p-4 rounded-lg bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100">
            <p className="font-semibold text-indigo-800 mb-3">Feedback:</p>
            <div className="prose prose-sm max-w-none text-gray-800 bg-white p-4 rounded-md border border-gray-100">
              {feedback.split('\n').map((line, index) => (
                <p key={index} className="mb-2">{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 