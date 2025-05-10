// src/components/TutorComponent.tsx
import React, { useState, useRef, useEffect } from 'react';
// import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { Button } from "@/components/ui/button"; // Assuming shadcn/ui setup
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast"; // Assuming shadcn/ui setup
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select
import { useAuth } from '@/context/AuthContext'; // Import useAuth
import CodingProblemDisplay from './cs/CodingProblemDisplay'; // Import the new component
import McqQuestionDisplay from './cs/McqQuestionDisplay'; // Import the new MCQ component
import TheoryQuestionDisplay from './cs/TheoryQuestionDisplay'; // Import the new Theory component

// --- Configuration ---
// Standardize to use VITE_API_URL and default to the correct backend port 8000
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// --- Types --- (Match backend Pydantic models)
interface Step {
  step_number: number;
  explanation: string;
}

interface Solution {
  original_problem?: string; // Changed from problem to match backend
  steps: Step[];
  final_answer?: string | null;
  error?: string; // Added to handle potential error field in response
  updated_xp?: number; // For XP system - Add here as well
}

interface StepExplanation {
  [stepNumber: number]: {
    explanation: string;
    isLoading: boolean;
    error?: string | null;
    queryType?: 'why' | 'how'; // Store query type to show correct loading state
  };
}

interface SolveResult {
  solution: string[] | string | null;
  steps: string[] | null; // This was string[], let's check backend
  explanation: string | null;
  error?: string;
  updated_xp?: number; // For XP system
}

// Type for UserLevel
type UserLevel = "Bronze" | "Silver" | "Gold" | "Platinum"; // Added Platinum

// --- CS Question Types ---
export interface MCQOption {
  id: string;
  text: string;
}

export interface BaseCSQuestion {
  id: string;
  chapter: string;
  question_text: string;
}

export interface MCQQuestionType extends BaseCSQuestion {
  question_type: "mcq";
  options: MCQOption[];
}

export interface CodingProblemType extends BaseCSQuestion {
  question_type: "coding";
  initial_code_stub?: string;
  // Expected: problem description, language (implicitly JS/Python for now, or specified)
}

export interface TheoryQuestionType extends BaseCSQuestion {
  question_type: "theory";
}

export type CSQuestion = MCQQuestionType | CodingProblemType | TheoryQuestionType;

export interface CSSubmissionFeedback {
  correct: boolean;
  explanation: string;
  detailed_solution?: string;
  simulated_output?: string;
  ai_feedback?: string;
}

// --- Learning Aid Types (mirroring backend schemas) ---
export interface Flashcard {
    question: string;
    answer: string;
}

export interface FlashcardsData {
    chapter: string;
    aid_type: "flashcards";
    flashcards: Flashcard[];
}

export interface SummaryData {
    chapter: string;
    aid_type: "summary";
    summary_text: string;
}

export interface KeyPointsData {
    chapter: string;
    aid_type: "key_points";
    key_points: string[];
}

export type LearningAidData = FlashcardsData | SummaryData | KeyPointsData;

// --- End CS Question Types ---

// Helper function to calculate level based on XP
const calculateLevel = (xp: number): UserLevel => {
  if (xp < 100) return "Bronze";
  if (xp < 500) return "Silver";
  if (xp < 1500) return "Gold";
  return "Platinum";
};

// Simple loading spinner component (if not already global)
const LoadingSpinner = () => (
    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] text-blue-500 motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
      <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
        Loading...
      </span>
    </div>
  );

// --- Practice Topics ---
interface Chapter {
  name: string;
}

interface Subject {
  name: string;
  chapters: Chapter[];
}

const mainSubjects: Subject[] = [
  {
    name: "Mathematics",
    chapters: [
      { name: "Basic Algebra" },
      { name: "Linear Equations" },
      { name: "Quadratic Equations" },
      { name: "Derivatives (Calculus)" },
      { name: "Integrals (Calculus)" },
      { name: "Limits (Calculus)" },
      { name: "Trigonometry Basics" },
      { name: "Logarithms" },
      { name: "Exponents" },
      { name: "Matrix Operations" },
    ],
  },
  {
    name: "Computer Science",
    chapters: [
      { name: "Data Structures (Stacks, Queues, Trees, Graphs)" },
      { name: "Algorithms (Sorting, Searching, Recursion)" },
      { name: "Operating Systems (Processes, Memory, Deadlocks)" },
      { name: "DBMS (Normalization, SQL Queries, Transactions)" },
      { name: "Computer Networks (OSI Model, IP, Routing)" },
      { name: "Programming Concepts (OOP, Loops, Functions)" },
    ],
  },
];

// --- Component ---
const TutorComponent: React.FC = () => {
  const { getAuthHeader, isLoggedIn, user } = useAuth(); // Get the getAuthHeader function from context
  const [problemInput, setProblemInput] = useState<string>("");
  const [solution, setSolution] = useState<Solution | null>(null);
  const [stepExplanations, setStepExplanations] = useState<StepExplanation>({});
  const [isLoadingSolution, setIsLoadingSolution] = useState<boolean>(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'loading' | 'online' | 'offline'>('loading');

  // State for image/PDF upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [loadingOcr, setLoadingOcr] = useState(false);
  const [ocrApiError, setOcrApiError] = useState<string | null>(null); // Dedicated error state for OCR

  // --- State for Voice Input ---
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  const [speechApiSupported, setSpeechApiSupported] = useState<boolean>(false);

  // --- State for Camera Input ---
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState<boolean>(false); // Loading for capture+OCR
  const streamRef = useRef<MediaStream | null>(null); // To keep track of the stream

  // --- State for Practice Problems ---
  const [selectedSubjectName, setSelectedSubjectName] = useState<string>("");
  const [availableChapters, setAvailableChapters] = useState<Chapter[]>([]);
  const [selectedChapterName, setSelectedChapterName] = useState<string>("");
  const [practiceProblem, setPracticeProblem] = useState<string | null>(null);
  const [practiceSolutionExplanation, setPracticeSolutionExplanation] = useState<string | null>(null);
  const [currentCSQuestion, setCurrentCSQuestion] = useState<CSQuestion | null>(null);
  const [csSubmissionFeedback, setCSSubmissionFeedback] = useState<CSSubmissionFeedback | null>(null);
  const [isLoadingPractice, setIsLoadingPractice] = useState<boolean>(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const [isSubmittingCS, setIsSubmittingCS] = useState<boolean>(false); // For CS submission loading state

  // --- State for Learning Aids (New) ---
  const [selectedAidType, setSelectedAidType] = useState<"flashcards" | "summary" | "key_points" | null>(null);
  const [currentLearningAid, setCurrentLearningAid] = useState<LearningAidData | null>(null);
  const [isLoadingLearningAid, setIsLoadingLearningAid] = useState<boolean>(false);
  const [learningAidError, setLearningAidError] = useState<string | null>(null);

  // --- State for Graphing ---
  const [graphEquation, setGraphEquation] = useState<string>(""); // Input for equation
  const [graphImageDataUrl, setGraphImageDataUrl] = useState<string | null>(null); // Stores the base64 image URL
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [graphError, setGraphError] = useState<string | null>(null);

  // --- State for User XP System ---
  const [currentUserXP, setCurrentUserXP] = useState<number>(0);
  const [currentUserLevel, setCurrentUserLevel] = useState<UserLevel>("Bronze");

  // --- State for Bookmarking ---
  const [isBookmarking, setIsBookmarking] = useState<boolean>(false);
  // Optional: To track what's been bookmarked in the UI for immediate feedback, 
  // though a full solution would involve checking backend status.
  const [locallyBookmarkedIds, setLocallyBookmarkedIds] = useState<Set<string>>(new Set());

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any | null>(null);
  // Refs for camera feature
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Check for SpeechRecognition API on component mount
  React.useEffect(() => {
    // Cast window to any to access potential vendor prefixes
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechApiSupported(true);
    } else {
      setSpeechApiSupported(false);
      console.warn("Web Speech Recognition API not supported in this browser.");
    }

    // Cleanup function to stop recognition if component unmounts while recording
    return () => {
      if (recognitionRef.current) {
          try {
              recognitionRef.current.stop();
          } catch (e) {
              console.warn("Error stopping recognition on unmount:", e);
          }
        recognitionRef.current = null; // Clear ref
      }
    };
  }, []);

  // Cleanup camera on unmount
  React.useEffect(() => {
    return () => {
      stopCamera(); // Ensure camera stops if component unmounts
    };
  }, []);

  // Effect to update available chapters when selectedSubjectName changes
  React.useEffect(() => {
    if (selectedSubjectName) {
      const subject = mainSubjects.find(s => s.name === selectedSubjectName);
      setAvailableChapters(subject ? subject.chapters : []);
      setSelectedChapterName(""); // Reset chapter selection
    } else {
      setAvailableChapters([]);
      setSelectedChapterName("");
    }
  }, [selectedSubjectName]);

  // Fetch initial User XP and Level
  React.useEffect(() => {
    const fetchUserXP = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/user/data`, { // Placeholder endpoint
          method: "GET",
          headers: { ...getAuthHeader() },
        });
        if (!response.ok) {
          throw new Error("Failed to fetch user data");
        }
        const data = await response.json();
        if (data.current_xp !== undefined) {
          setCurrentUserXP(data.current_xp);
          setCurrentUserLevel(calculateLevel(data.current_xp));
        }
      } catch (error) {
        console.error("Error fetching user XP:", error);
        // Optionally, show a toast, but it might be too intrusive on load
      }
    };
    fetchUserXP();
  }, [getAuthHeader]);

  // Reset helper (modified to optionally keep problemInput)
  const resetUploadState = () => {
      setSelectedFile(null);
      setImagePreviewUrl(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setLoadingOcr(false);
      setOcrApiError(null);
  };

  // --- API Call: Generate Initial Solution ---
  const handleGenerateSolution = async () => {
    if (!problemInput.trim()) {
      toast({ title: "Error", description: "Problem text is empty. Enter, upload, or draw a problem first.", variant: "destructive" });
      return;
    }
    setIsLoadingSolution(true);
    setSolution(null); // Clear previous solution
    setStepExplanations({}); // Clear old explanations
    setSolutionError(null);

    try {
      const response = await fetch(`${API_BASE_URL}/solve-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(), // Add Authorization header
        },
        body: JSON.stringify({ question_text: problemInput }),
      });

      const data: Solution = await response.json(); // Expecting SolutionResponse structure

      if (!response.ok) { 
         // If response is not OK, the body might be FastAPI's default error structure
         // or our custom one from the validation_exception_handler which has data.detail as the error list.
         const errorPayload = data as any; // Type assertion to access potential 'detail'
         const errorMsg = errorPayload.error || (errorPayload.detail ? JSON.stringify(errorPayload.detail) : null) || `HTTP error! status: ${response.status}`;
         throw new Error(errorMsg);
      }
      // If response.ok is true, but our application logic decided there's an error (e.g. Gemini error)
      if (data.error) {
        throw new Error(data.error);
      }

      setSolution(data);
      toast({
        title: "Solution Generated",
        description: "See the results below.",
      });

      // XP System: Award XP for solving a problem
      if (data.updated_xp !== undefined) {
        const xpGained = data.updated_xp - currentUserXP;
        setCurrentUserXP(data.updated_xp);
        setCurrentUserLevel(calculateLevel(data.updated_xp));
        if (xpGained > 0) {
            toast({ title: "XP Gained!", description: `+${xpGained} XP for solving the problem.` });
        }
      }

    } catch (error: any) {
       console.error("Solve Error:", error);
       const errorMsg = error.message || "Failed to connect to the solver service.";
       setSolutionError(`Solver Error: ${errorMsg}`);
       toast({
         title: "Solving Failed",
         description: errorMsg,
         variant: "destructive",
       });
       setSolution(null); // Clear results on error
    } finally {
      setIsLoadingSolution(false);
    }
  };

  // --- API Call: Get Explanation for a Step ---
  const handleExplainStep = async (stepNumber: number, queryType: 'why' | 'how') => {
    if (!solution) return; // Should not happen if button is visible

     // Set loading state for this specific step
    setStepExplanations(prev => ({
        ...prev,
        [stepNumber]: { ...prev[stepNumber], isLoading: true, error: null, queryType: queryType } // Store queryType
    }));

    try {
       const response = await fetch(`${API_BASE_URL}/explain-step`, {
         method: "POST",
         headers: { "Content-Type": "application/json", ...getAuthHeader() }, // Add Auth Header
         body: JSON.stringify({
           problem_text: solution.original_problem || problemInput,
           all_steps: solution.steps,
           step_number_to_explain: stepNumber,
           query_type: queryType,
         }),
       });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || data.detail || `HTTP error! status: ${response.status}`);
        }

        // Update explanation for this specific step
        setStepExplanations(prev => ({
            ...prev,
            [stepNumber]: { ...prev[stepNumber], explanation: data.explanation, isLoading: false, error: null }
        }));

        // XP System: Award XP for reviewing an explanation
        if (data.updated_xp !== undefined) {
            const xpGained = data.updated_xp - currentUserXP;
            setCurrentUserXP(data.updated_xp);
            setCurrentUserLevel(calculateLevel(data.updated_xp));
            if (xpGained > 0) {
                toast({ title: "XP Gained!", description: `+${xpGained} XP for reviewing an explanation.` });
            }
        }

    } catch (error: any) {
        console.error(`Explain Step ${stepNumber} Error:`, error);
        const msg = error.message || "Failed to get explanation.";
        // Update error state for this specific step
        setStepExplanations(prev => ({
            ...prev,
            [stepNumber]: { ...prev[stepNumber], isLoading: false, error: msg }
        }));
        toast({ title: `Error Explaining Step ${stepNumber}`, description: msg, variant: "destructive" });
    }
  };

  // --- File Upload / OCR Handlers ---
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
        resetUploadState();
        return;
    };
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
     if (!allowedTypes.includes(file.type)) {
       toast({ title: "Invalid file type", description: "Please upload JPG, PNG, or PDF.", variant: "destructive" });
       resetUploadState();
       return;
     }
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      toast({ title: "File too large", description: "Max 10MB.", variant: "destructive" });
      resetUploadState();
      return;
    }

    // resetUploadState(); // Clear previous upload state -- Problematic line commented out
    setSolution(null); // Clear previous solution results
    setStepExplanations({}); // Clear previous explanations
    setSolutionError(null); // Clear previous solution errors
    setOcrApiError(null); // Clear previous OCR errors
    setSelectedFile(file);

    if (file.type !== 'application/pdf') {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
    } else {
        setImagePreviewUrl(null); // No preview for PDF
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) return;
    // Re-use validation logic by simulating input change
    const inputElement = document.createElement('input');
    inputElement.files = e.dataTransfer.files;
    onFileChange({ target: inputElement } as React.ChangeEvent<HTMLInputElement>);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const extractQuestion = async () => {
    if (!selectedFile) {
      toast({ title: "No file selected", description: "Please select an image or PDF.", variant: "destructive" });
      return;
    }
    setLoadingOcr(true);
    setProblemInput(""); // Clear manual input text
    setSolution(null);
    setStepExplanations({});
    setSolutionError(null);
    setOcrApiError(null);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      // Assume backend endpoint for OCR is /upload-image
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
        const extracted = data.extracted_text || "";
        setProblemInput(extracted); // <-- SET THE MAIN PROBLEM INPUT
         toast({
           title: "Text Extracted",
           description: extracted ? "Review text in the input area below." : "No text found in image.",
         });
         // Reset file state after successful extraction
         resetUploadState();
      } else {
         throw new Error(data.error || "OCR failed. No text extracted.");
      }
    } catch (error: any) {
      console.error("OCR Error:", error);
      const errorMsg = error.message || "Failed to connect to the OCR service.";
      setOcrApiError(`${errorMsg}`); // Set OCR-specific error
      toast({ title: "OCR Failed", description: errorMsg, variant: "destructive" });
      setProblemInput(""); // Clear text on error
    } finally {
      setLoadingOcr(false);
    }
  };

  // --- Voice Recognition Handlers ---
  const handleToggleRecording = () => {
    if (!speechApiSupported) {
        toast({ title: "Error", description: "Speech recognition is not supported in your browser.", variant: "destructive" });
        return;
    }

    if (isRecording) {
      // Stop recording
      if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
          } catch (e) {
              console.error("Error stopping recognition:", e);
              // Force state update if stop fails unexpectedly
              setIsRecording(false);
          }
      }
      // Note: Actual state change to !isRecording happens in onend handler
    } else {
      // Start recording
      // Cast window to any to access potential vendor prefixes
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false; // Stop after first utterance
      recognitionRef.current.interimResults = false; // We only want the final result
      recognitionRef.current.lang = 'en-US'; // Set language

      setRecognitionError(null); // Clear previous errors
      setProblemInput(""); // Clear existing text input
      setSolution(null); // Clear previous solution
      setStepExplanations({});
      setSolutionError(null);
      resetUploadState(); // Clear file uploads

      recognitionRef.current.onstart = () => {
        console.log("Speech recognition started");
        setIsRecording(true);
      };

      recognitionRef.current.onresult = (event: any /* SpeechRecognitionEvent */) => {
        const transcript = event.results[0][0].transcript;
        console.log("Speech recognized:", transcript);
        setProblemInput(transcript); // Update the main text input
        toast({ title: "Speech Recognized", description: "Problem text updated." });
      };

      recognitionRef.current.onerror = (event: any /* SpeechRecognitionErrorEvent */) => {
        let errorMsg = `Speech recognition error: ${event.error}`; 
        if (event.error === 'no-speech') {
          errorMsg = "No speech detected. Please try again.";
        } else if (event.error === 'audio-capture') {
          errorMsg = "Microphone error. Please ensure it is connected and enabled.";
        } else if (event.error === 'not-allowed') {
          errorMsg = "Microphone permission denied. Please allow access.";
        } else if (event.error === 'network') {
          errorMsg = "Network error during speech recognition.";
        }
        console.error("Speech recognition error:", event.error, event.message);
        setRecognitionError(errorMsg);
        toast({ title: "Recognition Error", description: errorMsg, variant: "destructive" });
        setIsRecording(false); // Ensure recording stops on error
        recognitionRef.current = null;
      };

      recognitionRef.current.onend = () => {
        console.log("Speech recognition ended");
        setIsRecording(false);
        recognitionRef.current = null; // Clean up ref
      };

      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Error starting recognition:", e);
        setRecognitionError("Could not start voice recognition.");
        setIsRecording(false);
        recognitionRef.current = null;
      }
    }
  };

  // --- Camera Handlers ---
  const startCamera = async () => {
    if (isCameraActive) return; // Prevent starting if already active
    setCameraError(null);
    setIsCameraActive(true); // Set active early for UI feedback

    try {
      // Prefer back camera if available
      const constraints = {
        video: { facingMode: "environment" } // 'environment' = back camera
      };
      streamRef.current = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = streamRef.current;
        // Attempt to play - might need user interaction on some browsers
        try {
           await videoRef.current.play();
        } catch (playError) {
           console.warn("Video play failed, likely needs user interaction:", playError);
           // Let the video element show, user might need to click play
        }
      } else {
           throw new Error("Video element reference is not available.");
      }
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      let errMsg = "Could not access the camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errMsg = "Camera permission denied. Please allow access in browser settings.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errMsg = "No suitable camera found. Please ensure a camera is connected.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
         errMsg = "Camera might be in use by another application.";
      }
      setCameraError(errMsg);
      setIsCameraActive(false); // Reset state on error
      if (streamRef.current) {
         streamRef.current.getTracks().forEach(track => track.stop());
         streamRef.current = null;
      }
      toast({ title: "Camera Error", description: errMsg, variant: "destructive" });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraError(null);
    // console.log("Camera stopped");
  };

  const captureFrameAndRecognize = async () => {
      if (!videoRef.current || !captureCanvasRef.current || !isCameraActive) {
        console.warn("Capture called but video/canvas ref not ready or camera not active.")
        return;
      }

      setIsCapturing(true);
      setOcrApiError(null); // Clear previous OCR errors
      const video = videoRef.current;
      const canvas = captureCanvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
          setOcrApiError("Could not get canvas context for capture.");
          setIsCapturing(false);
          return;
      }

      // Set canvas dimensions to match video element dimensions
      canvas.width = video.videoWidth; // Use actual video dimensions
      canvas.height = video.videoHeight;

      // Draw the current video frame onto the canvas
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert canvas to Blob
      canvas.toBlob(async (blob) => {
          if (!blob) {
              setOcrApiError("Failed to create image blob from canvas.");
              setIsCapturing(false);
              return;
          }

          // Create FormData
          const formData = new FormData();
          // Append blob as a file (give it a filename)
          formData.append("file", blob, `capture-${Date.now()}.png`);

          // Stop camera stream now that we have the capture
          stopCamera();

          // Call the existing /upload-image endpoint
          try {
              setLoadingOcr(true); // Use the OCR loading state
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
                const extracted = data.extracted_text || "";
                setProblemInput(extracted); // <-- SET THE MAIN PROBLEM INPUT
                 toast({
                   title: "Text Extracted from Camera",
                   description: extracted ? "Review text in the input area below." : "No text found in captured image.",
                 });
              } else {
                 throw new Error(data.error || "OCR failed. No text extracted from capture.");
              }
            } catch (error: any) {
              console.error("Capture OCR Error:", error);
              const errorMsg = error.message || "Failed to connect to the OCR service for capture.";
              setOcrApiError(`${errorMsg}`); // Set OCR-specific error
              toast({ title: "Capture OCR Failed", description: errorMsg, variant: "destructive" });
              setProblemInput(""); // Clear text on error
            } finally {
              setIsCapturing(false);
              setLoadingOcr(false);
            }
      }, 'image/png'); // Specify PNG format for the blob
  };

  // --- Learning Aid Handler (New) ---
  const handleGetLearningAid = async (aidType: "flashcards" | "summary" | "key_points") => {
    if (!selectedChapterName || selectedSubjectName !== "Computer Science") {
      toast({
        title: "Cannot Fetch Aid",
        description: "Please select a Computer Science chapter first.",
        variant: "destructive",
      });
      return;
    }

    console.log(`Fetching learning aid: ${aidType} for chapter: ${selectedChapterName}`);
    setIsLoadingLearningAid(true);
    setSelectedAidType(aidType); // Keep track of which aid type is loading
    setCurrentLearningAid(null); // Clear previous aid
    setLearningAidError(null);   // Clear previous error

    try {
      const response = await fetch(`${API_BASE_URL}/cs/learning-aids`, { // Corrected endpoint
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(), // Assuming auth might be needed in the future
        },
        body: JSON.stringify({
          chapter_name: selectedChapterName,
          aid_type: aidType,
        }),
      });

      const data: LearningAidData = await response.json();

      if (!response.ok) {
        const errorPayload = data as any; // To access potential error details
        const errorMsg = errorPayload.detail || errorPayload.error || `HTTP error! status: ${response.status}`;
        throw new Error(errorMsg);
      }
      
      // Basic validation of the received aid structure
      if (!data || !data.aid_type || !data.chapter) {
          throw new Error ("Received malformed learning aid data from server.");
      }
      // Further validation based on aid_type
      if (data.aid_type === "flashcards" && !(data as FlashcardsData).flashcards) {
          throw new Error ("Malformed flashcards data.");
      }
      if (data.aid_type === "summary" && typeof (data as SummaryData).summary_text !== 'string') {
          throw new Error ("Malformed summary data.");
      }
      if (data.aid_type === "key_points" && !(data as KeyPointsData).key_points) {
          throw new Error ("Malformed key points data.");
      }

      setCurrentLearningAid(data);
      toast({
        title: "Learning Aid Loaded",
        description: `${aid_type_to_string(aidType)} for '${selectedChapterName}' loaded successfully.`,
      });

    } catch (error: any) {
      console.error("Get Learning Aid Error:", error);
      const msg = error.message || "Failed to connect to the learning aid service.";
      setLearningAidError(`Failed to load ${aidType}: ${msg}`);
      toast({
        title: `Error Loading ${aid_type_to_string(aidType)}`,
        description: msg,
        variant: "destructive",
      });
      setCurrentLearningAid(null); // Clear aid on error
    } finally {
      setIsLoadingLearningAid(false);
      // setSelectedAidType(null); // Optionally reset selected aid type after loading or error
    }
  };

  // Helper function to make aid type string more presentable for toasts
  const aid_type_to_string = (aidType: "flashcards" | "summary" | "key_points"): string => {
    switch (aidType) {
        case "flashcards": return "Flashcards";
        case "summary": return "Summary";
        case "key_points": return "Key Points";
        default: return "Learning Aid";
    }
  };

  // --- Practice Problem Handler ---
  const handleGetPracticeProblem = async () => {
    // Clear previous states
    setPracticeProblem(null);
    setPracticeSolutionExplanation(null);
    setCurrentCSQuestion(null);
    setCSSubmissionFeedback(null);
    setPracticeError(null);
    setIsSubmittingCS(false);

    if (selectedSubjectName === "Computer Science") {
      if (!selectedChapterName) {
        toast({ title: "No Chapter Selected", description: "Please choose a Computer Science chapter first.", variant: "destructive" });
      return;
    }
    setIsLoadingPractice(true);
      console.log(`Fetching CS questions for chapter: ${selectedChapterName}`);

      try {
        const response = await fetch(`${API_BASE_URL}/cs/questions`, {
          method: "POST", // Assuming POST, can be GET with query params
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeader(),
          },
          body: JSON.stringify({ chapter_name: selectedChapterName }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: "Failed to fetch CS question. Server error." }));
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const question: CSQuestion = await response.json();

        // Basic validation of the received question structure (optional but good practice)
        if (!question || !question.id || !question.question_type || !question.question_text) {
            throw new Error ("Received malformed question data from server.");
        }

        setCurrentCSQuestion(question);
        toast({ title: "CS Question Loaded", description: `Displaying a ${question.question_type} for ${selectedChapterName}` });

      } catch (error: any) {
        console.error("Get CS Question Error:", error);
        const msg = error.message || "Failed to connect to the CS question service.";
        setPracticeError(msg);
        toast({ title: "Error Loading CS Question", description: msg, variant: "destructive" });
        setCurrentCSQuestion(null); // Clear question on error
      } finally {
        setIsLoadingPractice(false);
      }

    } else if (selectedSubjectName === "Mathematics") {
      if (!selectedChapterName) {
        toast({ title: "No Chapter Selected", description: "Please choose a Mathematics topic first.", variant: "destructive" });
        return;
      }
      setIsLoadingPractice(true);
      const payload: { topic: string; previous_problem?: string } = {
          topic: selectedChapterName,
      };
    try {
      const response = await fetch(`${API_BASE_URL}/generate-practice-problem`, {
        method: "POST",
          headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || data.detail || `HTTP error! status: ${response.status}`);
      }
      setPracticeProblem(data.problem || "No problem generated.");
      setPracticeSolutionExplanation(data.solution_explanation || "No solution provided.");
        toast({ title: "Practice Problem Generated", description: `Topic: ${selectedChapterName}` });
      if (data.updated_xp !== undefined) {
        const xpGained = data.updated_xp - currentUserXP;
        setCurrentUserXP(data.updated_xp);
        setCurrentUserLevel(calculateLevel(data.updated_xp));
        if (xpGained > 0) {
            toast({ title: "XP Gained!", description: `+${xpGained} XP for this practice problem.` });
        }
      }
    } catch (error: any) {
        console.error("Get Practice Problem Error (Math):", error);
      const msg = error.message || "Failed to connect to the backend.";
      setPracticeError(msg);
        toast({ title: "Error Generating Math Problem", description: msg, variant: "destructive" });
    } finally {
      setIsLoadingPractice(false);
      }
    } else {
      if(!selectedSubjectName) {
        toast({ title: "No Subject Selected", description: "Please choose a subject first.", variant: "destructive" });
      } else {
        toast({ title: "Selection Error", description: "Selected subject not supported for practice problems yet.", variant: "destructive" });
      }
      return;
    }
  };

  // --- CS Problem Submission Handler ---
  const handleCSSubmit = async (submittedAnswer: string) => {
    if (!currentCSQuestion) return;

    // Include question_text in the log and the request body
    console.log(`Submitting CS ${currentCSQuestion.question_type} Answer: ID ${currentCSQuestion.id}, Q: ${currentCSQuestion.question_text.substring(0,50)}..., Answer: ${submittedAnswer}`);
    setIsSubmittingCS(true);
    setCSSubmissionFeedback(null);

    try {
      const payload: any = {
        question_id: currentCSQuestion.id,
        question_type: currentCSQuestion.question_type,
        question_text: currentCSQuestion.question_text,
        answer: submittedAnswer,
      };

      if (currentCSQuestion.question_type === "mcq" && "options" in currentCSQuestion) {
        payload.options = (currentCSQuestion as MCQQuestionType).options;
      }

      const response = await fetch(`${API_BASE_URL}/cs/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to process submission. Server error." }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const feedback: CSSubmissionFeedback = await response.json();

      console.log("Full feedback object received from backend:", feedback);

      if (!feedback || typeof feedback.correct === 'undefined' || !feedback.explanation) {
        throw new Error("Received malformed feedback data from server.");
      }

      setCSSubmissionFeedback(feedback);
      toast({ title: "Submission Processed", description: feedback.correct ? "Check the feedback below." : "There were some issues, check feedback." });

    } catch (error: any) {
      console.error("CS Submission Error:", error);
      const msg = error.message || "Failed to connect to the submission service.";
      setCSSubmissionFeedback({
        correct: false,
        explanation: `Error: ${msg}`,
        ai_feedback: "Could not process submission due to an error."
      });
      toast({ title: "Submission Error", description: msg, variant: "destructive" });
    } finally {
      setIsSubmittingCS(false);
    }
  };

  // --- Graphing Handler ---
  const handleGenerateGraph = async () => {
    if (!graphEquation.trim()) {
        toast({ title: "No Equation", description: "Please enter an equation to graph.", variant: "destructive" });
        return;
    }
    setIsLoadingGraph(true);
    setGraphImageDataUrl(null);
    setGraphError(null);

    try {
        const response = await fetch(`${API_BASE_URL}/generate-graph`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ equation: graphEquation }),
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            throw new Error(data.error || data.detail || `HTTP error! status: ${response.status}`);
        }

        if (data.image_data_url) {
            setGraphImageDataUrl(data.image_data_url);
            toast({ title: "Graph Generated" });
        } else {
             throw new Error("Backend did not return graph image data.");
        }

    } catch (error: any) {
        console.error("Generate Graph Error:", error);
        const msg = error.message || "Failed to generate graph.";
        setGraphError(msg);
        toast({ title: "Graphing Failed", description: msg, variant: "destructive" });
    } finally {
        setIsLoadingGraph(false);
    }
  };

  // --- Bookmark Handler for Main Solved Problem ---
  const handleBookmarkMainProblem = async () => {
    if (!solution && !problemInput) {
      toast({ title: "Cannot Bookmark", description: "No problem is currently solved or entered.", variant: "destructive" });
      return;
    }

    const problemToBookmark = solution?.original_problem || problemInput;
    if (!problemToBookmark.trim()) {
        toast({ title: "Cannot Bookmark", description: "Problem text is empty.", variant: "destructive" });
        return;
    }

    if (locallyBookmarkedIds.has(problemToBookmark) && !isBookmarking) {
        toast({ title: "Already Bookmarked", description: "This problem appears to be bookmarked.", variant: "default" });
        return; 
    }
    if (isBookmarking) return; 

    setIsBookmarking(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/bookmarks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeader(), 
        },
        body: JSON.stringify({
          question_text: problemToBookmark,
          question_source: "main_solved_problem",
          metadata_json: solution ? { steps: solution.steps.map(s => ({ step_number: s.step_number, explanation: s.explanation })), final_answer: solution.final_answer } : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: "Failed to bookmark problem. Please try again." }));
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      setLocallyBookmarkedIds(prev => new Set(prev).add(problemToBookmark)); 
      toast({
        title: "Bookmarked!",
        description: "Problem saved to your bookmarks.",
      });

    } catch (error: any) {
      toast({
        title: "Bookmark Failed",
        description: error.message || "Could not save bookmark.",
        variant: "destructive",
      });
    } finally {
      setIsBookmarking(false);
    }
  };

  // Component initialization debug log
  useEffect(() => {
    console.log('TutorComponent mounted');
    console.log('User logged in:', isLoggedIn);
    console.log('User data:', user);
    
    // Check backend connectivity
    const checkBackendStatus = async () => {
      try {
        console.log('Checking backend status...');
        const response = await fetch(`${API_BASE_URL}/health`, {
          method: 'GET',
          headers: { ...getAuthHeader() }
        });
        
        if (response.ok) {
          console.log('Backend is online');
          setBackendStatus('online');
          // toast({  // --- Toast Removed as per user request ---
          //   title: "Backend Connected",
          //   description: "Successfully connected to the AI Tutor backend.",
          // });
        } else {
          console.error('Backend returned error status:', response.status);
          setBackendStatus('offline');
          toast({
            title: "Backend Connection Issue",
            description: `Error connecting to AI Tutor backend: ${response.status}`,
            variant: "destructive"
          });
        }
      } catch (error) {
        console.error('Backend connection error:', error);
        setBackendStatus('offline');
        toast({
          title: "Backend Connection Failed",
          description: "Unable to connect to the AI Tutor backend server.",
          variant: "destructive"
        });
      }
    };
    
    checkBackendStatus();
    
    return () => {
      console.log('TutorComponent unmounted');
    };
  }, []);

  // Render with optional error fallback
  if (backendStatus === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8 flex justify-center items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          <p className="text-xl font-medium text-gray-800">Loading AI Tutor...</p>
          <p className="text-gray-500">Connecting to the backend server</p>
        </div>
      </div>
    );
  }
  
  if (backendStatus === 'offline') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-8 border border-red-200">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Connection Error</h2>
          <p className="text-gray-700 mb-6">
            We're having trouble connecting to the AI Tutor backend server. This could be due to:
          </p>
          <ul className="list-disc pl-6 mb-6 space-y-2 text-gray-600">
            <li>The backend server is not running</li>
            <li>Network connectivity issues</li>
            <li>API endpoint configuration problems</li>
          </ul>
          <p className="text-gray-700 mb-8">
            Please try again later or contact support if the issue persists.
          </p>
          <Button 
            onClick={() => window.location.reload()} 
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Retry Connection
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8 space-y-8">
      {/* Progress Section */}
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Your Learning Journey
              </h2>
              <p className="text-gray-600 mt-1">Track your progress and earn rewards</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Current Level</p>
                <p className="text-xl font-bold text-indigo-600">{currentUserLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">Total XP</p>
                <p className="text-xl font-bold text-purple-600">{currentUserXP}</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div 
                className="bg-gradient-to-r from-purple-500 to-indigo-500 h-3 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${Math.min((currentUserXP % 500) / 5, 100)}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Input Methods */}
        <div className="space-y-8">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Input Methods</h2>
            
            {/* Upload Card */}
            <Card className="mb-6 border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Upload Question</CardTitle>
                <CardDescription>Upload or drag & drop a JPG, PNG, or PDF file</CardDescription>
              </CardHeader>
              <CardContent>
                <div
                  className="w-full border-2 border-dashed border-indigo-200 rounded-xl p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-400 transition-colors bg-indigo-50"
                  onDrop={onDrop}
                  onDragOver={onDragOver}
                  onClick={() => !selectedFile && fileInputRef.current?.click()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-indigo-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <p className="text-indigo-600 mb-1 font-medium">Drag & drop or click</p>
                  <p className="text-gray-500 text-sm mb-3">JPG, PNG, PDF (Max 10MB)</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    type="button" 
                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }} 
                    disabled={loadingOcr || isRecording || isCameraActive || isCapturing || !!selectedFile}
                  >
                    Choose File
                  </Button>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={onFileChange}
                    disabled={loadingOcr || isRecording || isCameraActive || isCapturing}
                  />
                </div>

                {selectedFile && (
                  <div className="mt-4 p-4 border rounded-xl bg-gray-50 text-left">
                    <p className="font-medium text-gray-800">Selected: <span className="font-normal text-gray-600">{selectedFile.name}</span></p>
                    {imagePreviewUrl && (
                      <div className="mt-2 border rounded-lg overflow-hidden">
                        <img src={imagePreviewUrl} alt="Preview" className="max-w-full h-auto max-h-60 object-contain" />
                      </div>
                    )}
                    <div className="mt-3 flex gap-2">
                        <Button 
                          onClick={extractQuestion} 
                          disabled={loadingOcr}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                        >
                          {loadingOcr ? <span className="flex items-center justify-center gap-2"><LoadingSpinner/> Extracting...</span> : "Extract Text from Image"}
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            resetUploadState(); 
                            setProblemInput(''); // Also clear problem input if user explicitly clears selection
                          }} 
                          disabled={loadingOcr}
                        >
                          Clear Selection
                        </Button>
                    </div>
                  </div>
                )}
                {ocrApiError && <p className="text-red-600 text-sm mt-2 text-center">{ocrApiError}</p>}
              </CardContent>
            </Card>

            {/* Camera Card */}
            <Card className="mb-6 border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Live Camera Scan</CardTitle>
                <CardDescription>Position the question in front of your camera</CardDescription>
              </CardHeader>
              <CardContent>
                <div className={`w-full aspect-video bg-gray-100 rounded-xl overflow-hidden ${isCameraActive ? '' : 'hidden'}`}>
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted></video>
                </div>
                <canvas ref={captureCanvasRef} className="hidden"></canvas>
                <div className="flex space-x-2 mt-4">
                  {isCameraActive ? (
                    <>
                      <Button 
                        onClick={captureFrameAndRecognize} 
                        disabled={isCapturing || loadingOcr} 
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      >
                        {isCapturing ? <span className="flex items-center justify-center gap-2"><LoadingSpinner/> Capturing...</span> : "Capture Question"}
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={stopCamera} 
                        disabled={isCapturing}
                      >
                        Stop Camera
                      </Button>
                    </>
                  ) : (
                    <Button 
                      onClick={startCamera} 
                      className="w-full bg-indigo-600 hover:bg-indigo-700" 
                      disabled={loadingOcr || isLoadingSolution || isRecording || isCapturing}
                    >
                      Start Camera
                    </Button>
                  )}
                </div>
                {cameraError && <p className="text-red-600 text-sm mt-2">{cameraError}</p>}
              </CardContent>
            </Card>

            {/* Manual Input Card */}
            <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">Manual Input</CardTitle>
                <CardDescription>Review extracted text or type your problem directly</CardDescription>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Problem text will appear here after extraction/recognition/speech, or you can type directly."
                  value={problemInput}
                  onChange={(e) => setProblemInput(e.target.value)}
                  rows={4}
                  className="resize-none border-gray-200 focus:border-indigo-500 focus:ring-indigo-500"
                  disabled={isLoadingSolution || loadingOcr || isRecording || isCameraActive || isCapturing}
                />
                <Button 
                  onClick={handleGenerateSolution} 
                  disabled={isLoadingSolution || loadingOcr || isRecording || isCameraActive || isCapturing || !problemInput.trim()}
                  className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700"
                >
                  {isLoadingSolution ? <span className="flex items-center justify-center gap-2"><LoadingSpinner/> Solving...</span> : "Solve Problem"}
                </Button>
                {solutionError && <p className="text-red-600 mt-2">{solutionError}</p>}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Right Column - Results and Practice */}
        <div className="space-y-8">
          {/* Solution Section */}
          {solution && (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Solution</h2>
              <div className="space-y-4">
                {solution.steps && solution.steps.length > 0 ? (
                  <div className="space-y-4">
                    {solution.steps.map((step) => (
                      <div key={step.step_number} className="p-4 border rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
                        <p className="font-medium text-gray-800 mb-2">Step {step.step_number}:</p>
                        <p className="text-gray-700">{step.explanation}</p>
                        <div className="mt-3 flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExplainStep(step.step_number, 'why')}
                            disabled={stepExplanations[step.step_number]?.isLoading || isLoadingSolution}
                            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          >
                            {stepExplanations[step.step_number]?.isLoading && stepExplanations[step.step_number]?.queryType === 'why' ? 
                              <LoadingSpinner /> : "Why this step?"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleExplainStep(step.step_number, 'how')}
                            disabled={stepExplanations[step.step_number]?.isLoading || isLoadingSolution}
                            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                          >
                            {stepExplanations[step.step_number]?.isLoading && stepExplanations[step.step_number]?.queryType === 'how' ? 
                              <LoadingSpinner /> : "How to do this?"}
                          </Button>
                        </div>
                        {stepExplanations[step.step_number] && (
                          <div className="mt-3 p-3 border rounded-lg bg-indigo-50 border-indigo-100">
                            {stepExplanations[step.step_number].isLoading ? (
                              <p className="flex items-center gap-2"><LoadingSpinner/> Loading explanation...</p>
                            ) : stepExplanations[step.step_number].error ? (
                              <p className="text-red-600">{stepExplanations[step.step_number].error}</p>
                            ) : (
                              <p className="text-gray-700">{stepExplanations[step.step_number].explanation}</p>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  !solution.final_answer && <p className="text-gray-600 italic">No steps were provided for this solution.</p>
                )}

                {solution.final_answer && (
                  <div className="mt-6 p-4 border rounded-xl bg-green-50 border-green-100">
                    <p className="font-semibold text-green-800 mb-2">Final Answer:</p>
                    <p className="font-mono p-3 bg-white rounded-lg border border-green-200 text-green-900">
                      {solution.final_answer}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Practice Section */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Practice Problems</h2>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Select value={selectedSubjectName} onValueChange={setSelectedSubjectName}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a subject..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mainSubjects.map((subject) => (
                      <SelectItem key={subject.name} value={subject.name}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedSubjectName && availableChapters.length > 0 && (
                  <Select value={selectedChapterName} onValueChange={setSelectedChapterName}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a chapter..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableChapters.map((chapter) => (
                        <SelectItem key={chapter.name} value={chapter.name}>
                          {chapter.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <Button 
                onClick={handleGetPracticeProblem} 
                disabled={isLoadingPractice || !selectedChapterName}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
              >
                {isLoadingPractice ? <span className="flex items-center justify-center gap-2"><LoadingSpinner/> Loading...</span> : "Get Practice Problem"}
              </Button>

              {/* Practice Problem Display */}
              {selectedSubjectName === "Mathematics" && selectedChapterName && practiceProblem && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 border rounded-xl bg-gray-50">
                    <h3 className="font-semibold text-gray-800 mb-2">Practice Problem:</h3>
                    <p className="text-gray-700">{practiceProblem}</p>
                    <Button 
                      variant="link" 
                      size="sm" 
                      className="mt-2 text-indigo-600 hover:text-indigo-700"
                      onClick={handleGetPracticeProblem} 
                      disabled={isLoadingPractice}
                    >
                      {isLoadingPractice ? <LoadingSpinner/> : "Try another problem"}
                    </Button>
                  </div>
                  {practiceSolutionExplanation && (
                    <div className="p-4 border rounded-xl bg-green-50 border-green-100">
                      <h3 className="font-semibold text-green-800 mb-2">Solution & Explanation:</h3>
                      <p className="text-green-900">{practiceSolutionExplanation}</p>
                    </div>
                  )}
                </div>
              )}

              {/* CS Question Display */}
              {selectedSubjectName === "Computer Science" && currentCSQuestion && (
                <div className="mt-6">
                  {currentCSQuestion.question_type === "coding" && (
                    <CodingProblemDisplay 
                      problem={currentCSQuestion as CodingProblemType} 
                      feedback={csSubmissionFeedback} 
                      onSubmit={handleCSSubmit}
                      isSubmitting={isSubmittingCS}
                    />
                  )}
                  {currentCSQuestion.question_type === "mcq" && (
                    <McqQuestionDisplay
                      problem={currentCSQuestion as MCQQuestionType}
                      feedback={csSubmissionFeedback}
                      onSubmit={handleCSSubmit}
                      isSubmitting={isSubmittingCS}
                    />
                  )}
                  {currentCSQuestion.question_type === "theory" && (
                    <TheoryQuestionDisplay
                      problem={currentCSQuestion as TheoryQuestionType}
                      feedback={csSubmissionFeedback}
                      onSubmit={handleCSSubmit}
                      isSubmitting={isSubmittingCS}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Learning Aids Section */}
          {selectedSubjectName === "Computer Science" && selectedChapterName && (
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Learning Aids</h2>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleGetLearningAid("flashcards")} 
                  disabled={isLoadingLearningAid} 
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  {isLoadingLearningAid && selectedAidType === "flashcards" ? <LoadingSpinner/> : "Flashcards"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleGetLearningAid("summary")} 
                  disabled={isLoadingLearningAid}
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  {isLoadingLearningAid && selectedAidType === "summary" ? <LoadingSpinner/> : "Summary"}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleGetLearningAid("key_points")} 
                  disabled={isLoadingLearningAid}
                  className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                >
                  {isLoadingLearningAid && selectedAidType === "key_points" ? <LoadingSpinner/> : "Key Points"}
                </Button>
              </div>

              {currentLearningAid && !isLoadingLearningAid && (
                <div className="mt-6 p-4 border rounded-xl bg-gray-50">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 capitalize">
                    {currentLearningAid.aid_type.replace('_', ' ')} for {currentLearningAid.chapter}
                  </h3>
                  {currentLearningAid.aid_type === "flashcards" && (
                    <div className="space-y-3">
                      {(currentLearningAid as FlashcardsData).flashcards.map((flashcard, index) => (
                        <Card key={index} className="bg-white border-indigo-100">
                          <CardContent className="p-4">
                            <p className="font-semibold text-indigo-700">Q: {flashcard.question}</p>
                            <p className="mt-2 text-gray-600">A: {flashcard.answer}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                  {currentLearningAid.aid_type === "summary" && (
                    <div className="p-4 bg-white rounded-lg border border-indigo-100">
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {(currentLearningAid as SummaryData).summary_text}
                      </p>
                    </div>
                  )}
                  {currentLearningAid.aid_type === "key_points" && (
                    <div className="p-4 bg-white rounded-lg border border-indigo-100">
                      <ul className="list-disc list-inside space-y-2 text-gray-700">
                        {(currentLearningAid as KeyPointsData).key_points.map((point, index) => (
                          <li key={index}>{point}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {isLoadingLearningAid && (
                <div className="mt-6 text-center p-4">
                  <LoadingSpinner/> Loading learning aid...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorComponent; 