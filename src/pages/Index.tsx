
import React, { useState, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Simple loading spinner component
const LoadingSpinner = () => (
  <div className="flex justify-center items-center py-4">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
  </div>
);

const Index = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [loading, setLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle file selection and preview
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }
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
    const file = e.dataTransfer.files?.[0] ?? null;
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a file smaller than 5MB.",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  // Mock OCR extraction on button click to simulate
  const extractQuestion = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please upload an image file first.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      // For demo, pretend we extracted text from image
      setOcrText(
        "Solve for x: 2x + 5 = 17\n\nPlease enter your solution here."
      );
      setLoading(false);
      toast({
        title: "Question extracted",
        description: "You can edit the question or proceed to solve it.",
      });
    }, 2000);
  };

  // Mock solve question handler (just toast for now)
  const solveQuestion = () => {
    if (!ocrText.trim()) {
      toast({
        title: "No question text",
        description: "Please extract and/or enter a question before solving.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Solving question",
      description: "Step-by-step solution will appear here soon!",
    });
    // TODO: implement real solving flow
  };

  // Reset all states to try again
  const tryAnother = () => {
    setSelectedFile(null);
    setImagePreviewUrl(null);
    setOcrText("");
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-soft-blue-50 p-6 md:p-12 gap-8">
      {/* Left Section */}
      <div className="md:w-1/2 flex flex-col items-center bg-white rounded-lg shadow-md p-6">
        <div
          className="w-full border-2 border-dashed border-blue-300 rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Drag and drop image or click to select file"
        >
          <p className="text-blue-600 mb-2 font-semibold">
            Drag and drop an image here
          </p>
          <p className="text-gray-500 mb-4">(or click to choose file)</p>
          <Button variant="outline" size="sm" type="button" onClick={() => fileInputRef.current?.click()}>
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
          <img
            src={imagePreviewUrl}
            alt="Uploaded preview"
            className="mt-4 max-h-52 object-contain rounded"
          />
        )}
        <Button
          className="mt-6 w-full"
          onClick={extractQuestion}
          disabled={loading || !selectedFile}
        >
          {loading ? "Extracting..." : "Extract Question"}
        </Button>
      </div>

      {/* Right Section */}
      <div className="md:w-1/2 flex flex-col bg-white rounded-lg shadow-md p-6">
        <label htmlFor="ocrOutput" className="text-lg font-semibold mb-2">
          Extracted Question Text
        </label>
        <textarea
          id="ocrOutput"
          className="resize-none p-3 border border-gray-300 rounded-md min-h-[160px] text-gray-700"
          value={ocrText}
          onChange={(e) => setOcrText(e.target.value)}
          placeholder="Extracted OCR text will appear here..."
          disabled={loading}
        />
        <Button
          className="mt-4"
          onClick={solveQuestion}
          disabled={loading || !ocrText.trim()}
        >
          Solve Question
        </Button>
        {loading && <LoadingSpinner />}
        {ocrText && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-6 self-start text-blue-500"
            onClick={tryAnother}
          >
            Try Another
          </Button>
        )}
      </div>
    </div>
  );
};

export default Index;

