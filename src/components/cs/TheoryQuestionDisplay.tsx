import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TheoryQuestionType, CSSubmissionFeedback } from '../TutorComponent'; // Adjust path as needed

interface TheoryQuestionDisplayProps {
  problem: TheoryQuestionType;
  feedback: CSSubmissionFeedback | null;
  onSubmit: (answerText: string) => void;
  isSubmitting: boolean;
}

const TheoryQuestionDisplay: React.FC<TheoryQuestionDisplayProps> = ({ problem, feedback, onSubmit, isSubmitting }) => {
  const [userAnswer, setUserAnswer] = useState<string>("");

  // Reset answer when problem changes
  useEffect(() => {
    setUserAnswer("");
  }, [problem]);

  const handleSubmit = () => {
    onSubmit(userAnswer);
  };

  return (
    <Card className="bg-green-50 border-green-200">
      <CardHeader>
        <CardTitle className="text-green-800">Theory Question: {problem.chapter}</CardTitle>
        <CardDescription className="whitespace-pre-wrap text-sm text-green-700">{problem.question_text}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label htmlFor={`theory-answer-${problem.id}`} className="block text-sm font-medium text-gray-700 mb-1">
            Your Answer:
          </label>
          <Textarea
            id={`theory-answer-${problem.id}`}
            placeholder="Enter your answer here..."
            rows={8}
            className="bg-white border-gray-300 focus:ring-green-500 focus:border-green-500 w-full"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
          />
        </div>
        <Button onClick={handleSubmit} disabled={isSubmitting || !userAnswer.trim()} className="bg-green-600 hover:bg-green-700">
          {isSubmitting ? 'Submitting...' : 'Submit Answer'}
        </Button>

        {feedback && (
          <div className="mt-4 space-y-3">
            <Alert variant={feedback.correct ? "default" : "destructive"} className={feedback.correct ? "bg-emerald-50 border-emerald-300" : "bg-red-50 border-red-300"}>
              <AlertTitle>{feedback.correct ? 'Well Explained!' : 'Needs Elaboration'}</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">
                {feedback.explanation}
              </AlertDescription>
            </Alert>

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
                    <summary className="cursor-pointer font-medium text-green-600 hover:text-green-800">
                        View Model Answer / Explanation
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

export default TheoryQuestionDisplay; 