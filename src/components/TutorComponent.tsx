// src/components/TutorComponent.tsx
import React, { useState, useRef } from 'react';
// import { ReactSketchCanvas, ReactSketchCanvasRef } from "react-sketch-canvas";
import { Button } from "@/components/ui/button"; // Assuming shadcn/ui setup
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast"; // Assuming shadcn/ui setup
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Import Select

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
}

// Simple loading spinner component (if not already global)
const LoadingSpinner = () => (
    <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] text-blue-500 motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
      <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
        Loading...
      </span>
    </div>
  );

// --- Practice Topics --- Define the list of topics
const practiceTopics = [
  "Basic Algebra",
  "Linear Equations",
  "Quadratic Equations",
  "Derivatives (Calculus)",
  "Integrals (Calculus)",
  "Limits (Calculus)",
  "Trigonometry Basics",
  "Logarithms",
  "Exponents",
  "Matrix Operations",
];

// --- Component ---
const TutorComponent: React.FC = () => {
  const [problemInput, setProblemInput] = useState<string>("");
  const [solution, setSolution] = useState<Solution | null>(null);
  const [stepExplanations, setStepExplanations] = useState<StepExplanation>({});
  const [isLoadingSolution, setIsLoadingSolution] = useState<boolean>(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);

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
  const [selectedTopic, setSelectedTopic] = useState<string>("");
  const [practiceProblem, setPracticeProblem] = useState<string | null>(null);
  const [practiceSolutionExplanation, setPracticeSolutionExplanation] = useState<string | null>(null);
  const [isLoadingPractice, setIsLoadingPractice] = useState<boolean>(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);

  // --- State for Graphing ---
  const [graphEquation, setGraphEquation] = useState<string>(""); // Input for equation
  const [graphImageDataUrl, setGraphImageDataUrl] = useState<string | null>(null); // Stores the base64 image URL
  const [isLoadingGraph, setIsLoadingGraph] = useState<boolean>(false);
  const [graphError, setGraphError] = useState<string | null>(null);

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
         headers: { "Content-Type": "application/json" },
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

    resetUploadState(); // Clear previous upload state
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

  // --- Practice Problem Handler ---
  const handleGetPracticeProblem = async () => {
    if (!selectedTopic) {
      toast({ title: "No Topic Selected", description: "Please choose a topic first.", variant: "destructive" });
      return;
    }
    setIsLoadingPractice(true);
    // Don't clear the existing problem when fetching a *new* one
    // setPracticeProblem(null); 
    // setPracticeSolutionExplanation(null);
    setPracticeError(null);

    // Construct payload, including the previous problem if it exists
    const payload: { topic: string; previous_problem?: string } = {
        topic: selectedTopic,
    };
    if (practiceProblem) { // Only add if a previous problem exists
        payload.previous_problem = practiceProblem;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/generate-practice-problem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || data.detail || `HTTP error! status: ${response.status}`);
      }

      setPracticeProblem(data.problem || "No problem generated.");
      setPracticeSolutionExplanation(data.solution_explanation || "No solution provided.");
      toast({ title: "Practice Problem Generated", description: `Topic: ${selectedTopic}` });

    } catch (error: any) {
      console.error("Get Practice Problem Error:", error);
      const msg = error.message || "Failed to connect to the backend.";
      setPracticeError(msg);
      toast({ title: "Error Generating Practice Problem", description: msg, variant: "destructive" });
    } finally {
      setIsLoadingPractice(false);
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

  return (
    <div className="p-4 md:p-8 space-y-6">
        {/* --- Section Title (Optional) --- */}
        {/* <h1 className="text-2xl font-bold text-center mb-6">Math Wiz Assistant</h1> */}
        
        {/* Group Inputs Together (Optional Layout Refinement) */}
        <h2 className="text-lg font-semibold border-b pb-1">Input Methods</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* --- Input Card (Upload) --- */}
          <Card className="col-span-1">
             <CardHeader>
               <CardTitle>Upload Question (Image/PDF)</CardTitle>
               <CardDescription>Upload or drag & drop a JPG, PNG, or PDF file.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
               <div
                 className="w-full border-2 border-dashed border-blue-300 rounded-lg p-6 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500 transition-colors bg-blue-50"
                 onDrop={onDrop}
                 onDragOver={onDragOver}
                 onClick={() => fileInputRef.current?.click()}
               >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                 <p className="text-blue-600 mb-1 font-medium">Drag & drop or click</p>
                 <p className="text-gray-500 text-sm mb-3">JPG, PNG, PDF (Max 10MB)</p>
                 <Button variant="outline" size="sm" type="button" onClick={(e) => {e.stopPropagation(); fileInputRef.current?.click();}} disabled={loadingOcr || isRecording || isCameraActive || isCapturing}>
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
                 <div className="mt-4 border rounded-md p-2 flex flex-col items-center text-sm">
                    <p className="font-medium mb-2">Selected: {selectedFile.name}</p>
                    {imagePreviewUrl && selectedFile.type !== 'application/pdf' ? (
                        <img src={imagePreviewUrl} alt="Preview" className="max-h-40 w-auto object-contain rounded" />
                    ) : selectedFile.type === 'application/pdf' ? (
                        <p className="text-gray-600">(PDF - Preview not available)</p>
                    ) : null}
                    <Button
                      className="mt-3 w-full max-w-xs"
                      size="sm"
                      onClick={extractQuestion}
                      disabled={loadingOcr || isLoadingSolution || isRecording || isCameraActive || isCapturing}
                    >
                      {loadingOcr ? <span className="flex items-center justify-center gap-2"><LoadingSpinner/> Extracting...</span> : "Extract Text from File"}
                    </Button>
                 </div>
                )}
                {ocrApiError && <p className="text-red-600 mt-2">OCR Error: {ocrApiError}</p>}
             </CardContent>
           </Card>

            {/* --- Input Card (Camera) --- */}
            <Card className="col-span-1">
             <CardHeader>
               <CardTitle>Live Camera Scan</CardTitle>
               <CardDescription>Position the question in front of your camera.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                {/* Video element for camera feed */} 
                <div className={`w-full aspect-video bg-gray-200 rounded overflow-hidden ${isCameraActive ? '' : 'hidden'}`}> 
                  <video ref={videoRef} className="w-full h-full object-cover" playsInline muted></video>
                </div>
                {/* Hidden canvas for capturing frames */} 
                <canvas ref={captureCanvasRef} className="hidden"></canvas>

                <div className="flex space-x-2">
                   {isCameraActive ? (
                     <>
                        <Button 
                            onClick={captureFrameAndRecognize} 
                            disabled={isCapturing || loadingOcr} 
                            className="flex-1"
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
                     <Button onClick={startCamera} className="w-full" disabled={loadingOcr || isLoadingSolution || isRecording || isCapturing}>
                       Start Camera
                     </Button>
                   )}
                </div>
                {cameraError && <p className="text-red-600 text-sm mt-2">{cameraError}</p>}
                {/* Display OCR errors specifically during capture process maybe? */} 
                {isCapturing && ocrApiError && <p className="text-red-600 mt-2">OCR Error: {ocrApiError}</p>}
             </CardContent>
           </Card>

          {/* --- Input Card (Voice) --- */}
          <Card className="col-span-1">
             <CardHeader>
               <CardTitle>Speak Your Question</CardTitle>
               <CardDescription>Click the button and speak your math problem clearly.</CardDescription>
             </CardHeader>
             <CardContent className="space-y-4">
                 <Button 
                    onClick={handleToggleRecording} 
                    disabled={!speechApiSupported || loadingOcr || isLoadingSolution || isCameraActive || isCapturing}
                    variant={isRecording ? "destructive" : "default"}
                    className="w-full"
                 >
                   {isRecording ? (
                     <span className="flex items-center justify-center gap-2">
                       <LoadingSpinner/> Stop Recording...
                     </span>
                    ) : (
                     "Start Recording"
                    )}
                 </Button>
                 {recognitionError && <p className="text-red-600 text-sm mt-2">{recognitionError}</p>}
                 {!speechApiSupported && <p className="text-orange-600 text-sm mt-2">Speech recognition not available in this browser.</p>}
             </CardContent>
           </Card>
        </div>

      {/* --- Input Card (Text Review/Manual) --- */}
      <Card>
        <CardHeader>
          <CardTitle>Review / Enter Problem Manually</CardTitle>
          <CardDescription>Review extracted/spoken text below, edit if needed, or type your problem directly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            placeholder="Problem text will appear here after extraction/recognition/speech, or you can type directly."
            value={problemInput}
            onChange={(e) => setProblemInput(e.target.value)}
            rows={4}
            disabled={isLoadingSolution || loadingOcr || isRecording || isCameraActive || isCapturing}
          />
          <Button onClick={handleGenerateSolution} disabled={isLoadingSolution || loadingOcr || isRecording || isCameraActive || isCapturing || !problemInput.trim()} >
            {isLoadingSolution ? <span className="flex items-center justify-center gap-2"><LoadingSpinner/> Solving...</span> : "Solve Problem Text"}
          </Button>
          {solutionError && <p className="text-red-600">Solver Error: {solutionError}</p>}
        </CardContent>
      </Card>
      
      {/* --- Graphing Section --- */}
      <h2 className="text-lg font-semibold border-b pb-1">Graph Generator</h2>
      <Card>
         <CardHeader>
           <CardTitle>Plot Equation</CardTitle>
           <CardDescription>Enter an equation (e.g., y = x**2, sin(x), 2*x+1) to generate its graph.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                 <Input 
                    type="text"
                    placeholder="Enter equation here (e.g., x**2 + 2*x - 1)"
                    value={graphEquation}
                    onChange={(e) => setGraphEquation(e.target.value)}
                    disabled={isLoadingGraph}
                    className="flex-grow"
                 />
                 <Button onClick={handleGenerateGraph} disabled={isLoadingGraph || !graphEquation.trim()} className="w-full sm:w-auto">
                     {isLoadingGraph ? <span className="flex items-center justify-center gap-2"><LoadingSpinner/> Plotting...</span> : "Generate Graph"}
                 </Button>
              </div>
              {graphError && <p className="text-red-600 text-sm mt-2">Error: {graphError}</p>}

              {/* Display Generated Graph */} 
              {isLoadingGraph && <div className="text-center p-4"><LoadingSpinner/> Generating graph...</div>}
              {graphImageDataUrl && !isLoadingGraph && (
                 <div className="mt-4 pt-4 border-t flex justify-center">
                    <img src={graphImageDataUrl} alt={`Graph of ${graphEquation}`} className="max-w-full h-auto border rounded shadow-md" />
                 </div>
              )}
           </CardContent>
         </Card>

      {/* --- Practice Problems Section --- */}
      <h2 className="text-lg font-semibold border-b pb-1">Practice Problems</h2>
      <Card>
         <CardHeader>
           <CardTitle>Topic Practice</CardTitle>
           <CardDescription>Select a topic to get a practice problem and its solution.</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
             <div className="flex flex-col sm:flex-row items-center gap-4">
                <Select value={selectedTopic} onValueChange={setSelectedTopic}>
                    <SelectTrigger className="w-full sm:w-[250px]">
                        <SelectValue placeholder="Select a topic..." />
                    </SelectTrigger>
                    <SelectContent>
                        {practiceTopics.map((topic) => (
                        <SelectItem key={topic} value={topic}>
                            {topic}
                        </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={handleGetPracticeProblem} disabled={isLoadingPractice || !selectedTopic} className="w-full sm:w-auto">
                    {isLoadingPractice ? <span className="flex items-center justify-center gap-2"><LoadingSpinner/> Loading...</span> : "Get Practice Problem"}
                </Button>
             </div>
             {practiceError && <p className="text-red-600 text-sm mt-2">Error: {practiceError}</p>}

             {/* Display Practice Problem and Solution */} 
             {practiceProblem && !isLoadingPractice && (
                <div className="mt-4 space-y-4 pt-4 border-t">
                    <div className="p-4 border rounded bg-gray-50">
                        <h3 className="font-semibold mb-2">Practice Problem:</h3>
                        <p className="whitespace-pre-wrap">{practiceProblem}</p>
                        <Button 
                           variant="link" 
                           size="sm" 
                           className="p-0 h-auto mt-2 text-sm text-blue-600 hover:text-blue-800"
                           onClick={handleGetPracticeProblem} 
                           disabled={isLoadingPractice || !selectedTopic} 
                        >
                           {isLoadingPractice ? <LoadingSpinner/> : "Practice another similar problem"}
                        </Button>
                    </div>
                    {practiceSolutionExplanation && (
                        <div className="p-4 border rounded bg-green-50 border-green-200">
                            <h3 className="font-semibold mb-2 text-green-800">Solution & Explanation:</h3>
                            {/* Consider using ReactMarkdown here if backend provides markdown */}
                            <p className="whitespace-pre-wrap text-sm text-green-900">{practiceSolutionExplanation}</p>
                        </div>
                    )}
                </div>
             )}
         </CardContent>
       </Card>

      {/* --- Solution Section (for main problem) --- */}
      <h2 className="text-lg font-semibold border-b pb-1">Problem Solver Results</h2>
      {isLoadingSolution && <div className="text-center p-4"><LoadingSpinner/> Loading solution...</div>}
      {solution && !isLoadingSolution && (
         <Card>
           <CardHeader>
             <CardTitle>Solution Steps</CardTitle>
             <CardDescription>Problem: {solution.original_problem || problemInput}</CardDescription>
           </CardHeader>
           <CardContent className="space-y-4">
             {/* --- Wrap the steps mapping in a single container --- */}
             {solution.steps && solution.steps.length > 0 ? (
                 <div className="p-3 border rounded bg-slate-50 space-y-3"> {/* Outer container with styles */}
                     {solution.steps.map((step) => (
                       <div key={step.step_number}> {/* Inner div - remove border/padding */} 
                         <p className="font-medium mb-1">Step {step.step_number}:</p>
                         <p className="whitespace-pre-wrap text-sm">{step.explanation}</p> {/* Smaller text? */} 
                         {/* Explanation display logic can remain if needed */}
                         {stepExplanations[step.step_number] && (stepExplanations[step.step_number].isLoading || stepExplanations[step.step_number].explanation || stepExplanations[step.step_number].error) && (
                            <div className="mt-3 p-3 border rounded bg-blue-50 border-blue-200 text-sm">
                              {stepExplanations[step.step_number].isLoading ? (
                                <p><LoadingSpinner/> Loading explanation...</p>
                              ) : stepExplanations[step.step_number].error ? (
                                <p className="text-red-600">Error: {stepExplanations[step.step_number].error}</p>
                              ) : (
                                <p className="whitespace-pre-wrap">{stepExplanations[step.step_number].explanation}</p>
                              )}
                            </div>
                         )}
                       </div>
                     ))}
                 </div>
             ) : (
                 !solution.final_answer && <p className="text-gray-600 italic">No steps were provided for this solution.</p>
             )}

             {/* --- Display the final answer (after steps) --- */}
             {solution.final_answer && (
               <div className="mt-4 pt-4 border-t"> 
                 <p className="font-semibold">Final Answer:</p>
                 <p className="font-mono p-2 bg-gray-100 rounded inline-block mt-1 whitespace-pre-wrap">{solution.final_answer}</p>
               </div>
             )}

             {!solution.steps?.length && !solution.final_answer && (
                 <p className="text-gray-600 italic">No solution details were provided.</p>
             )}
           </CardContent>
         </Card>
       )}
    </div>
  );
};

export default TutorComponent; 