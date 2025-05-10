import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { MCQQuestionType, CSSubmissionFeedback } from '../TutorComponent'; // Adjust path as needed

interface McqQuestionDisplayProps {
  problem: MCQQuestionType;
  feedback: CSSubmissionFeedback | null;
  onSubmit: (selectedOptionId: string) => void;
  isSubmitting: boolean;
}

const McqQuestionDisplay: React.FC<McqQuestionDisplayProps> = ({ problem, feedback, onSubmit, isSubmitting }) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | undefined>(undefined);

  // Reset selection when problem changes
  useEffect(() => {
    setSelectedOptionId(undefined);
  }, [problem]);

  const handleSubmit = () => {
    if (selectedOptionId) {
      onSubmit(selectedOptionId);
    }
  };

  return (
    <Card className="bg-purple-50 border-purple-200">
      <CardHeader>
        <CardTitle className="text-purple-800">Multiple Choice Question: {problem.chapter}</CardTitle>
        <CardDescription className="whitespace-pre-wrap text-sm text-purple-700">{problem.question_text}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <RadioGroup value={selectedOptionId} onValueChange={setSelectedOptionId}>
          {problem.options.map((option) => (
            <div key={option.id} className="flex items-center space-x-2 p-2 rounded hover:bg-purple-100 cursor-pointer">
              <RadioGroupItem value={option.id} id={`option-${problem.id}-${option.id}`} />
              <Label htmlFor={`option-${problem.id}-${option.id}`} className="cursor-pointer flex-1">
                {option.text}
              </Label>
            </div>
          ))}
        </RadioGroup>
        
        <Button onClick={handleSubmit} disabled={isSubmitting || !selectedOptionId} className="bg-purple-600 hover:bg-purple-700">
          {isSubmitting ? 'Submitting...' : 'Submit Answer'}
        </Button>

        {feedback && (
          <div className="mt-4 space-y-3">
            <Alert variant={feedback.correct ? "default" : "destructive"} className={feedback.correct ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}>
              <AlertTitle>{feedback.correct ? 'Correct!' : 'Needs Improvement'}</AlertTitle>
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
                    <summary className="cursor-pointer font-medium text-purple-600 hover:text-purple-800">
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

export default McqQuestionDisplay; 