import React, { useState, useRef, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from 'react-markdown';
import { MistakeDiagnosis } from "@/components/MistakeDiagnosis";

// --- Configuration ---
// Standardize to use VITE_API_URL and default to the correct backend port 8000
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Simple loading spinner component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-4">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
  </div>
);

// --- Types ---
// Define Step interface to match backend and TutorComponent
interface Step {
  step_number: number;
  explanation: string;
}

interface SolveResult {
  original_problem?: string | null; // Added to match backend SolutionResponse
  solution: string[] | string | null;
  steps: Step[] | null; // <<<< Changed from string[] to Step[]
  explanation: string | null;
  error?: string;
  final_answer?: string | null; // Added to match backend SolutionResponse
}

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [loadingSolve, setLoadingSolve] = useState(false);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Reset state helper
  const resetState = (clearFile = true) => {
    if (clearFile) {
      setSelectedFile(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
      }
    }
    setOcrText("");
    setSolveResult(null);
    setLoadingOcr(false);
    setLoadingSolve(false);
    setApiError(null);
  };

  // Handle file selection and preview
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
        resetState(true); // Clear everything if no file is selected
        return;
    };
    // Limit file type (optional, backend also checks)
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
     if (!allowedTypes.includes(file.type)) {
       toast({
         title: "Invalid file type",
         description: "Please upload a JPG, PNG, or PDF file.",
         variant: "destructive",
       });
       resetState(true);
       return;
     }

    if (file.size > 10 * 1024 * 1024) { // Example: 10MB limit
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 10MB.",
        variant: "destructive",
      });
      resetState(true);
      return;
    }
    resetState(false); // Clear results, keep file
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle drag and drop file
  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent default drop behavior
    const file = e.dataTransfer.files?.[0] ?? null;
     if (!file) return;

    // Re-use validation logic
    const inputElement = document.createElement('input');
    inputElement.files = e.dataTransfer.files;
    onFileChange({ target: inputElement } as React.ChangeEvent<HTMLInputElement>);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); // Necessary to allow drop
    e.stopPropagation();
  };

  // --- API Call: Extract Question Text from Image ---
  const extractQuestion = async () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please upload an image or PDF file first.",
        variant: "destructive",
      });
      return;
    }
    setLoadingOcr(true);
    setOcrText(""); // Clear previous OCR text
    setSolveResult(null); // Clear previous results
    setApiError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${API_BASE_URL}/upload-image`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.detail || data.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      }

      if (data.status === "success" && data.extracted_text !== undefined) {
        setOcrText(data.extracted_text || ""); // Handle potential null/empty text
         toast({
           title: "Text Extracted",
           description: "Review the text below and edit if needed.",
         });
      } else {
         throw new Error(data.error || "OCR failed. No text extracted.");
      }
    } catch (error: any) {
      console.error("OCR Error:", error);
      const errorMsg = error.message || "Failed to connect to the OCR service.";
      setApiError(`OCR Error: ${errorMsg}`);
      toast({
        title: "OCR Failed",
        description: errorMsg,
        variant: "destructive",
      });
      setOcrText(""); // Clear text on error
    } finally {
      setLoadingOcr(false);
    }
  };

  // --- API Call: Solve Math Problem from Text ---
  const solveQuestion = async () => {
    const question = ocrText.trim();
    if (!question) {
      toast({
        title: "No question text",
        description: "Please extract or enter a question before solving.",
        variant: "destructive",
      });
      return;
    }
    setLoadingSolve(true);
    setSolveResult(null); 
    setApiError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/solve-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question_text: question }), 
      });

      const data: SolveResult = await response.json(); // Now expects SolveResult with Step[]

      if (!response.ok) {
         const errorPayload = data as any; 
         const errorMsg = errorPayload.error || (errorPayload.detail ? JSON.stringify(errorPayload.detail) : null) || `HTTP error! status: ${response.status}`;
         throw new Error(errorMsg);
      }
      if (data.error) {
        throw new Error(data.error);
      }

      setSolveResult(data);
       toast({
         title: "Solution Generated",
         description: "See the results below.",
       });

    } catch (error: any) {
       console.error("Solve Error:", error);
       const errorMsg = error.message || "Failed to connect to the solver service.";
       setApiError(`Solver Error: ${errorMsg}`);
       toast({
         title: "Solving Failed",
         description: errorMsg,
         variant: "destructive",
       });
       setSolveResult(null); // Clear results on error
    } finally {
      setLoadingSolve(false);
    }
  };

  // Reset all states to try again
  const tryAnother = () => {
    resetState(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 p-4 md:p-8">
      {/* Page Title for the OCR/Solve/Diagnose Page */}
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Solve & Diagnose Math Problems</h1>
      
      {/* Existing two-column layout for OCR and Solve parts */}
      <div className="flex flex-col lg:flex-row gap-6 mb-8">
        {/* --- Left Section: Upload & Extract --- */}
        <div className="lg:w-1/2 flex flex-col bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">1. Upload Question</h2>
          <div
            className="w-full border-2 border-dashed border-blue-300 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500 transition-colors bg-blue-50"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Drag and drop image or click to select file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-blue-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <p className="text-blue-600 mb-1 font-medium">
              Drag & drop JPG, PNG, or PDF
            </p>
            <p className="text-gray-500 text-sm mb-3">or click to browse</p>
            <Button variant="outline" size="sm" type="button" onClick={(e) => {e.stopPropagation(); fileInputRef.current?.click();}}>
              Choose File
            </Button>
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              ref={fileInputRef}
              className="hidden"
              onChange={onFileChange}
            />
          </div>
          {imagePreviewUrl && (
            <div className="mt-4 border rounded-md p-2 flex justify-center items-center max-h-60 overflow-hidden">
            {selectedFile?.type === 'application/pdf' ? (
              <p className="text-center text-gray-600 p-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                PDF Selected: <span className="font-medium">{selectedFile.name}</span>
                <br/><span className="text-sm">(Preview not available)</span>
              </p>
            ) : (
              <img
                src={imagePreviewUrl}
                alt="Uploaded preview"
                className="max-h-52 w-auto object-contain rounded"
              />
            )}
            </div>
          )}
          <Button
            className="w-full py-2.5"
            onClick={extractQuestion}
            disabled={loadingOcr || loadingSolve || !selectedFile}
          >
            {loadingOcr ? (
                <span className="flex items-center justify-center"><LoadingSpinner/> Extracting...</span>
            ) : "Extract Text"}
          </Button>
          {loadingOcr && <div className="text-sm text-center text-gray-500">Extracting text from image...</div>}
        </div>

        {/* --- Right Section: Edit, Solve & Results --- */}
        <div className="lg:w-1/2 flex flex-col bg-white rounded-lg shadow-md p-6 space-y-4">
          <h2 className="text-xl font-semibold text-gray-800 border-b pb-2">2. Review & Solve</h2>
          <div className="flex flex-col space-y-2">
              <label htmlFor="ocrOutput" className="text-sm font-medium text-gray-700">
                Extracted / Input Question Text:
              </label>
              <Textarea
                id="ocrOutput"
                className="resize-y p-3 border border-gray-300 rounded-md min-h-[150px] text-gray-800 bg-slate-50 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                value={ocrText}
                onChange={(e) => {setOcrText(e.target.value); setSolveResult(null); /* Clear results if text changes */}}
                placeholder="Extracted text will appear here. You can also type your question directly."
                disabled={loadingOcr || loadingSolve}
              />
          </div>
          <Button
            className="w-full py-2.5"
            onClick={solveQuestion}
            disabled={loadingOcr || loadingSolve || !ocrText.trim()}
          >
            {loadingSolve ? (
                <span className="flex items-center justify-center"><LoadingSpinner/> Solving...</span>
            ) : "Solve Question"}
          </Button>

          {apiError && (
              <div className="text-red-600 bg-red-100 border border-red-400 rounded p-3 text-sm">
                  <strong>Error:</strong> {apiError}
              </div>
          )}

          {loadingSolve && <div className="text-sm text-center text-gray-500">Solving the problem...</div>}

          {solveResult && !loadingSolve && !apiError && (
            <Card className="mt-4 border-green-200 bg-green-50">
              <CardHeader>
                <CardTitle className="text-green-800">Solution / Answer</CardTitle>
                {solveResult.original_problem && (
                  <CardDescription className="text-gray-700">Original Problem: {solveResult.original_problem}</CardDescription>
                )}
                {solveResult.explanation && (
                  <CardDescription className="text-green-700 pt-2">
                    <div className="prose prose-sm max-w-none">
                      <ReactMarkdown>
                        {solveResult.explanation}
                      </ReactMarkdown>
                    </div>
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Display Steps if they exist */}
                {solveResult.steps && solveResult.steps.length > 0 && (
                  <div className="pt-2">
                    <h4 className="font-semibold text-md mb-1 text-gray-800">Steps:</h4>
                    <div className="p-3 border rounded bg-slate-100 space-y-2">
                      {solveResult.steps.map((step) => (
                        <div key={step.step_number} className="text-sm">
                          <span className="font-medium">Step {step.step_number}:</span> {step.explanation}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Display Final Answer if it exists (renamed from solution) */}
                {solveResult.final_answer && (
                    <div>
                        <h4 className="font-semibold text-md mb-1 text-gray-800">Final Answer:</h4>
                        <div className="p-3 bg-white border rounded text-md font-mono text-green-900 break-words">
                          {solveResult.final_answer}
                        </div>
                    </div>
                )}

                {/* Fallback if no solution details */}
                {!solveResult.final_answer && (!solveResult.steps || solveResult.steps.length === 0) && (!solveResult.explanation || solveResult.explanation.length < 10) && (
                  <p className="text-center text-gray-600">No specific solution, steps, or detailed explanation were generated.</p>
                )}
              </CardContent>
            </Card>
          )}

          {(selectedFile || ocrText) && !loadingOcr && !loadingSolve && (
            <Button
              variant="outline"
              size="sm"
              className="mt-4 self-center text-blue-600 border-blue-300 hover:bg-blue-100"
              onClick={tryAnother}
            >
              Reset / Try Another
            </Button>
          )}
        </div>
      </div>

      {/* --- Section: Mistake Diagnosis --- */}
      <div className="w-full max-w-5xl mx-auto mt-8">
         <h2 className="text-2xl font-semibold text-gray-700 mb-4 text-center">Diagnose Your Solution Steps</h2>
        <MistakeDiagnosis initialProblemText={ocrText} />
      </div>
    </div>
  );
};

export default Index;

