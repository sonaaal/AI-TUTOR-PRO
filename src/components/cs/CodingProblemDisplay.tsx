// src/components/cs/CodingProblemDisplay.tsx
import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CodingProblemType, CSSubmissionFeedback } from '../TutorComponent'; // Adjust path as needed

interface CodingProblemDisplayProps {
  problem: CodingProblemType;
  feedback: CSSubmissionFeedback | null;
  onSubmit: (code: string) => void;
  isSubmitting: boolean; // To disable button during submission
}

const CodingProblemDisplay: React.FC<CodingProblemDisplayProps> = ({ problem, feedback, onSubmit, isSubmitting }) => {
  const [userCode, setUserCode] = useState<string>(problem.initial_code_stub || "");

  // Update userCode if the problem changes (e.g., user requests a new problem)
  useEffect(() => {
    setUserCode(problem.initial_code_stub || "");
  }, [problem]);

  const handleSubmit = () => {
    onSubmit(userCode);
  };

  return (
    <Card className="bg-sky-50 border-sky-200">
      <CardHeader>
        <CardTitle className="text-sky-800">Coding Problem: {problem.chapter}</CardTitle>
        <CardDescription className="whitespace-pre-wrap text-sm text-sky-700">{problem.question_text}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor={`code-input-${problem.id}`} className="block text-sm font-medium text-gray-700 mb-1">
            Your Code:
          </label>
          <Textarea
            id={`code-input-${problem.id}`}
            placeholder="Enter your code here..."
            rows={12}
            className="font-mono text-sm bg-white border-gray-300 focus:ring-sky-500 focus:border-sky-500 w-full"
            value={userCode}
            onChange={(e) => setUserCode(e.target.value)}
          />
        </div>
        <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-sky-600 hover:bg-sky-700">
          {isSubmitting ? 'Submitting...' : 'Submit Code'}
        </Button>

        {feedback && (
          <div className="mt-4 space-y-3">
            <Alert variant={feedback.correct ? "default" : "destructive"} className={feedback.correct ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}>
              <AlertTitle>{feedback.correct ? 'Correct!' : 'Needs Improvement'}</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">
                {feedback.explanation}
              </AlertDescription>
            </Alert>

            {feedback.simulated_output && (
              <Card className="bg-gray-50">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-medium">Simulated Output:</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <pre className="bg-gray-100 p-2 rounded text-xs font-mono whitespace-pre-wrap">{feedback.simulated_output}</pre>
                </CardContent>
              </Card>
            )}

            {feedback.ai_feedback && (
              <Card className="bg-blue-50 border-blue-200">
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-sm font-medium text-blue-700">AI Feedback:</CardTitle>
                </CardHeader>
                <CardContent className="pb-3">
                  <p className="whitespace-pre-wrap text-sm">{feedback.ai_feedback}</p>
                </CardContent>
              </Card>
            )}
            
            {feedback.detailed_solution && (
                 <details className="mt-2 text-sm">
                    <summary className="cursor-pointer font-medium text-sky-600 hover:text-sky-800">
                        View Detailed Solution
                    </summary>
                    <div className="mt-2 p-3 border rounded-md bg-white whitespace-pre-wrap">
                        {feedback.detailed_solution}
                    </div>
                 </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CodingProblemDisplay; 