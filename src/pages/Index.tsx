import React, { useState, useRef, useEffect } from "react";
import { toast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import ReactMarkdown from 'react-markdown';
import { MistakeDiagnosis } from "@/components/MistakeDiagnosis";
import { useAuth } from '@/context/AuthContext';

// --- Configuration ---
// Standardize to use VITE_API_URL and default to the correct backend port 8000
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Simple loading spinner component
const LoadingSpinner = () => (
  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] text-indigo-500 motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
      Loading...
    </span>
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
  const { getAuthHeader } = useAuth();
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
          ...getAuthHeader(),
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
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
      {/* Page Header */}
      <div className="max-w-4xl mx-auto text-center mb-12">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent mb-2">
          Solve & Diagnose Math Problems
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          Upload a problem image, extract text, and get step-by-step solutions. Understand where you might have made mistakes in your own solutions.
        </p>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
        {/* --- Left Section: Upload & Extract --- */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Upload Question</h2>
          <div
            className="w-full border-2 border-dashed border-indigo-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-400 transition-colors bg-indigo-50"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Drag and drop image or click to select file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
            <p className="text-indigo-600 mb-1 font-medium">
              Drag & drop your problem image
            </p>
            <p className="text-gray-500 text-sm mb-3">JPG, PNG, or PDF (Max 10MB)</p>
            <Button variant="outline" size="sm" type="button" 
              onClick={(e) => {e.stopPropagation(); fileInputRef.current?.click();}}
              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              disabled={loadingOcr || loadingSolve}>
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
            <div className="mt-4 overflow-hidden rounded-lg border border-indigo-100 bg-white p-2">
              <div className="flex justify-center items-center max-h-60 overflow-hidden">
                {selectedFile?.type === 'application/pdf' ? (
                  <div className="text-center text-gray-600 p-4 w-full">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto mb-2 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                    <p className="font-medium text-gray-700">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500 mt-1">(PDF preview not available)</p>
                  </div>
                ) : (
                  <img
                    src={imagePreviewUrl}
                    alt="Uploaded preview"
                    className="max-h-52 w-auto object-contain rounded"
                  />
                )}
              </div>
            </div>
          )}
          <Button
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700"
            onClick={extractQuestion}
            disabled={loadingOcr || loadingSolve || !selectedFile}
          >
            {loadingOcr ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner/> Extracting Text...
              </span>
            ) : "Extract Text from Image"}
          </Button>
        </div>

        {/* --- Right Section: Edit, Solve & Results --- */}
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Review & Solve</h2>
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">
              Question Text:
            </p>
            <Textarea
              className="resize-y min-h-[120px] border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
              value={ocrText}
              onChange={(e) => {setOcrText(e.target.value); setSolveResult(null);}}
              placeholder="Extracted text will appear here. You can also type your question directly."
              disabled={loadingOcr || loadingSolve}
            />
          </div>
          <Button
            className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700"
            onClick={solveQuestion}
            disabled={loadingOcr || loadingSolve || !ocrText.trim()}
          >
            {loadingSolve ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner/> Solving Problem...
              </span>
            ) : "Solve Question"}
          </Button>

          {apiError && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <p className="font-medium">Error:</p>
              <p>{apiError}</p>
            </div>
          )}

          {loadingSolve && (
            <div className="my-6 flex flex-col items-center justify-center p-6">
              <div className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mb-4"></div>
              <p className="text-gray-600">Solving your math problem...</p>
            </div>
          )}

          {solveResult && !loadingSolve && !apiError && (
            <div className="mt-6 p-5 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-indigo-100">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800">Solution</h3>
                {solveResult.original_problem && (
                  <p className="mt-1 text-sm text-gray-600">Original Problem: {solveResult.original_problem}</p>
                )}
              </div>
              
              {solveResult.explanation && (
                <div className="mb-4 p-4 bg-white rounded-lg border border-gray-100">
                  <p className="font-medium text-gray-800 mb-1">Explanation:</p>
                  <div className="prose prose-sm max-w-none text-gray-700">
                    <ReactMarkdown>{solveResult.explanation}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Display Steps if they exist */}
              {solveResult.steps && solveResult.steps.length > 0 && (
                <div className="mb-4 p-4 bg-white rounded-lg border border-gray-100">
                  <p className="font-medium text-gray-800 mb-2">Steps:</p>
                  <div className="space-y-3">
                    {solveResult.steps.map((step) => (
                      <div key={step.step_number} className="p-2 border-l-2 border-indigo-300 pl-3">
                        <p><span className="font-medium text-indigo-700">Step {step.step_number}:</span> {step.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Display Final Answer */}
              {solveResult.final_answer && (
                <div className="p-4 bg-white rounded-lg border border-green-200">
                  <p className="font-semibold text-gray-800 mb-1">Final Answer:</p>
                  <p className="p-3 bg-green-50 rounded-md font-mono text-green-800 break-words border border-green-100">
                    {solveResult.final_answer}
                  </p>
                </div>
              )}

              {/* Fallback if no solution details */}
              {!solveResult.final_answer && (!solveResult.steps || solveResult.steps.length === 0) && (!solveResult.explanation || solveResult.explanation.length < 10) && (
                <p className="text-center text-gray-600 p-4 bg-white rounded-lg border border-gray-100">
                  No specific solution, steps, or detailed explanation were generated.
                </p>
              )}
            </div>
          )}

          {(selectedFile || ocrText) && !loadingOcr && !loadingSolve && (
            <Button
              variant="outline"
              className="mt-4 w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={tryAnother}
            >
              Reset / Try Another Problem
            </Button>
          )}
        </div>
      </div>

      {/* --- Section: Mistake Diagnosis --- */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Diagnose Your Solution Steps</h2>
          <MistakeDiagnosis initialProblemText={ocrText} />
        </div>
      </div>
    </div>
  );
};

export default Index;

