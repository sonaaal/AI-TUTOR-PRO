import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { ScrollArea } from "@/components/ui/scroll-area"; // For scrollable chat

// Imports for KaTeX
import 'katex/dist/katex.min.css'; // KaTeX CSS
import { InlineMath, BlockMath } from 'react-katex';

// Import icons
import { 
  MessageSquareText, 
  Upload, 
  Mic, 
  Send,
  X
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

interface ChatMessage {
  id: string; // Unique ID for each message
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  imagePreviewUrl?: string;
}

const LoadingSpinner = () => (
  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] text-indigo-500 motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
      Loading...
    </span>
  </div>
);

// Helper function to render text with KaTeX components
const renderMessageText = (text: string) => {
  // Split by block math delimiters ($$ ... $$)
  const parts = text.split(/(\$\$.*?\$\$)/g);
  return parts.map((part, index) => {
    if (part.startsWith('$$') && part.endsWith('$$')) {
      // It's block math
      return <BlockMath key={index} math={part.slice(2, -2)} />;
    } else {
      // It's either plain text or might contain inline math
      // Split this part by inline math delimiters ($ ... $)
      const inlineParts = part.split(/(\$[^$]*?\$)/g);
      return inlineParts.map((inlinePart, inlineIndex) => {
        if (inlinePart.startsWith('$') && inlinePart.endsWith('$')) {
          // It's inline math
          return <InlineMath key={`${index}-${inlineIndex}`} math={inlinePart.slice(1, -1)} />;
        } else {
          // It's plain text
          return <span key={`${index}-${inlineIndex}`}>{inlinePart}</span>;
        }
      });
    }
  });
};

const ChatPage: React.FC = () => {
  const { getAuthHeader, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentMessage, setCurrentMessage] = useState<string>("");
  const [isLoadingResponse, setIsLoadingResponse] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null); // For auto-scrolling
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewForMessage, setImagePreviewForMessage] = useState<string | null>(null);

  // State for Voice Input
  const [isVoiceRecording, setIsVoiceRecording] = useState<boolean>(false);
  const [voiceRecognitionError, setVoiceRecognitionError] = useState<string | null>(null);
  const [isSpeechApiSupported, setIsSpeechApiSupported] = useState<boolean>(false);
  const recognitionRef = useRef<any | null>(null); // For SpeechRecognition instance

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]); // Scroll to bottom when messages change

  // useEffect for SpeechRecognition API check and cleanup
  useEffect(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      setIsSpeechApiSupported(true);
    } else {
      setIsSpeechApiSupported(false);
      console.warn("Web Speech Recognition API not supported in this browser for ChatPage.");
    }

    // Cleanup function to stop recognition if component unmounts while recording
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // console.warn("Error stopping recognition on unmount (ChatPage):", e);
        }
        recognitionRef.current = null; 
      }
    };
  }, []);

  // Function to handle voice recording toggle
  const handleToggleVoiceRecording = () => {
    if (!isSpeechApiSupported) {
      toast({ title: "Voice Input Not Supported", description: "Your browser does not support speech recognition.", variant: "destructive" });
      return;
    }

    if (isVoiceRecording) {
      // Stop recording
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error("Error stopping voice recognition (ChatPage):", e);
          setIsVoiceRecording(false); // Force state update if stop fails
        }
      }
    } else {
      // Start recording
      const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognitionAPI();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      setVoiceRecognitionError(null);
      // Optionally clear currentMessage or append to it
      // setCurrentMessage(""); // Or: setCurrentMessage(prev => prev + (prev ? " " : ""));

      recognitionRef.current.onstart = () => {
        setIsVoiceRecording(true);
        // Disable other inputs if needed (e.g., image upload, text input)
      };

      recognitionRef.current.onresult = (event: any /* SpeechRecognitionEvent */) => {
        const transcript = event.results[0][0].transcript;
        setCurrentMessage(prev => prev + (prev ? " " : "") + transcript); // Append transcript
        toast({ title: "Voice Input Captured", description: "Text added to your message." });
      };

      recognitionRef.current.onerror = (event: any /* SpeechRecognitionErrorEvent */) => {
        let errorMsg = `Speech recognition error: ${event.error}`;
        if (event.error === 'no-speech') errorMsg = "No speech detected. Please try again.";
        else if (event.error === 'audio-capture') errorMsg = "Microphone error. Ensure it's connected/enabled.";
        else if (event.error === 'not-allowed') errorMsg = "Microphone permission denied. Please allow access.";
        else if (event.error === 'network') errorMsg = "Network error during speech recognition.";
        
        setVoiceRecognitionError(errorMsg);
        toast({ title: "Voice Recognition Error", description: errorMsg, variant: "destructive" });
        setIsVoiceRecording(false); // Ensure recording stops on error
        recognitionRef.current = null;
      };

      recognitionRef.current.onend = () => {
        setIsVoiceRecording(false);
        recognitionRef.current = null; // Clean up ref
        // Re-enable other inputs if they were disabled
      };

      try {
        recognitionRef.current.start();
      } catch (e) {
        console.error("Error starting voice recognition (ChatPage):", e);
        setVoiceRecognitionError("Could not start voice recognition.");
        setIsVoiceRecording(false);
        recognitionRef.current = null;
      }
    }
  };

  const handleSendMessage = async (e?: React.FormEvent<HTMLFormElement>) => {
    if (e) e.preventDefault();
    const trimmedMessage = currentMessage.trim();

    // If there's no text message AND no image selected, do nothing
    if (!trimmedMessage && !selectedImageFile) {
      toast({ title: "Cannot Send", description: "Please type a message or select an image.", variant: "default" });
      return;
    }

    setIsLoadingResponse(true);
    let messageToSendToChatApi = trimmedMessage;
    const userImagePreviewUrlForThisMessage = imagePreviewForMessage; // Capture preview URL for this specific message

    // Optimistic UI update for user's message (text and/or image)
    const newUserMessage: ChatMessage = {
      id: Date.now().toString() + '-user-' + Math.random().toString(36).substr(2, 9), // More unique ID
      sender: 'user',
      text: trimmedMessage, // Text part
      timestamp: new Date(),
      imagePreviewUrl: userImagePreviewUrlForThisMessage, // Image part for display
    };
    setMessages(prevMessages => [...prevMessages, newUserMessage]);
    
    // Store file to use after clearing state, because state updates are async
    const fileToSend = selectedImageFile; 

    // Clear input states immediately for better UX
    setCurrentMessage("");
    setSelectedImageFile(null); 
    setImagePreviewForMessage(null);
    if (imageInputRef.current) imageInputRef.current.value = '';


    try {
      // Step 1: If an image was selected, upload it for OCR
      if (fileToSend && userImagePreviewUrlForThisMessage) { // Check if an image was part of this message intent
        const formData = new FormData();
        formData.append("file", fileToSend);

        console.log("Attempting to upload image for OCR...");
        const ocrResponse = await fetch(`${API_BASE_URL}/upload-image`, {
          method: 'POST',
          headers: {
            // For FormData, Content-Type is set automatically by the browser.
            // Do NOT set 'Content-Type': 'application/json'.
            ...getAuthHeader(), 
          },
          body: formData,
        });

        if (!ocrResponse.ok) {
          const errorData = await ocrResponse.json().catch(() => ({ detail: 'Failed to process image.' }));
          throw new Error(errorData.detail || `Image processing error: ${ocrResponse.status}`);
        }
        const ocrData = await ocrResponse.json();
        if (ocrData.error || ocrData.extracted_text === undefined) { // Check for undefined explicitly
          throw new Error(ocrData.error || "Could not extract text from image.");
        }
        
        // Prepend OCRed text to the typed message or use as message if none typed
        messageToSendToChatApi = trimmedMessage 
          ? `${ocrData.extracted_text}\n\n${trimmedMessage}` 
          : ocrData.extracted_text;
        toast({ title: "Image Processed", description: "Text extracted from image." });
        console.log("OCR successful, combined message:", messageToSendToChatApi);
      }

      // Step 2: Send the (potentially combined or text-only) message to the chat API
      const finalQuestionForApi = messageToSendToChatApi.trim() || (userImagePreviewUrlForThisMessage ? "[Image Content]" : "");

      if (!finalQuestionForApi && !userImagePreviewUrlForThisMessage) { 
          console.log("Nothing to send to chat API.");
          setIsLoadingResponse(false); 
          return; 
      }
      
      console.log("Sending to /api/chat:", finalQuestionForApi);
      const historyToSend = messages
        .slice(-6) // Send last 6 messages (user + AI) as history, adjust as needed
        .map(msg => ({ sender: msg.sender, text: msg.text })); // Map to ChatMessageSchema format

      const chatApiResponse = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ 
          question: finalQuestionForApi, 
          history: historyToSend 
        }),
      });

      if (!chatApiResponse.ok) {
        const errorData = await chatApiResponse.json().catch(() => ({ detail: 'Failed to get response from chat API.' }));
        throw new Error(errorData.detail || `HTTP error! status: ${chatApiResponse.status}`);
      }

      const aiResponseData = await chatApiResponse.json();
      
      const newAiMessage: ChatMessage = {
        id: Date.now().toString() + '-ai-' + Math.random().toString(36).substr(2, 9), // More unique ID
        sender: 'ai',
        text: aiResponseData.answer || "Sorry, I couldn't process that.",
        timestamp: new Date(),
      };
      setMessages(prevMessages => [...prevMessages, newAiMessage]);

    } catch (err: any) {
      console.error("Error in handleSendMessage:", err);
      const errorAiMessage: ChatMessage = {
        id: Date.now().toString() + '-error-' + Math.random().toString(36).substr(2, 9),
        sender: 'ai',
        text: `Error: ${err.message || 'Could not get a response.'}`,
        timestamp: new Date(),
      };
      setMessages(prevMessages => [...prevMessages, errorAiMessage]);
      toast({
        title: "Chat Operation Failed",
        description: err.message || 'Could not complete the operation.',
        variant: "destructive",
      });
    } finally {
      setIsLoadingResponse(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <MessageSquareText className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Chat Mode</h1>
            <p className="text-gray-600 mb-6">Please log in to use the chat feature.</p>
            <Button className="bg-indigo-600 hover:bg-indigo-700">
              Log In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
      {/* Page Header */}
      <div className="max-w-6xl mx-auto mb-6">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
          Math Wiz Chat Assistant
        </h1>
        <p className="text-gray-600 mt-1">Ask any math questions, upload images of problems, and get step-by-step help.</p>
      </div>

      {/* Chat Interface */}
      <div className="max-w-6xl mx-auto">
        <Card className="border-0 shadow-lg rounded-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 px-6">
            <CardTitle className="flex items-center gap-2">
              <MessageSquareText className="h-5 w-5" />
              <span>Mathematics Chat Assistant</span>
            </CardTitle>
          </CardHeader>
          
          <CardContent className="p-0 flex flex-col h-[calc(100vh-260px)]">
            {/* Messages Area */}
            <ScrollArea className="flex-grow p-6 space-y-5">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-10">
                  <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
                    <MessageSquareText className="h-8 w-8 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">Start Your Math Conversation</h3>
                  <p className="text-gray-500 max-w-sm">
                    Ask any math question or upload an image of a math problem to get step-by-step assistance.
                  </p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-3 duration-300`}
                  >
                    <div 
                      className={`max-w-[75%] p-4 rounded-2xl shadow-sm ${
                        msg.sender === 'user' 
                          ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white' 
                          : 'bg-white border border-gray-100 text-gray-800'
                      }`}
                    >
                      {msg.imagePreviewUrl && (
                        <div className="mb-3">
                          <img 
                            src={msg.imagePreviewUrl} 
                            alt="Uploaded" 
                            className="rounded-lg max-h-60 w-auto" 
                          />
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap">
                        {renderMessageText(msg.text)}
                      </div>
                      <p className={`text-xs mt-2 ${msg.sender === 'user' ? 'text-indigo-100' : 'text-gray-400'} text-right`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} /> {/* Element to scroll to */}
              {isLoadingResponse && (
                <div className="flex justify-start animate-in fade-in slide-in-from-bottom-3">
                  <div className="max-w-[70%] p-4 rounded-2xl shadow-sm bg-white border border-gray-100 flex items-center space-x-3">
                    <LoadingSpinner /> 
                    <span className="text-sm text-gray-700">Solving your problem...</span>
                  </div>
                </div>
              )}
            </ScrollArea>
            
            {/* Input Area */}
            <div className="border-t border-gray-100 p-5 bg-white">
              <form onSubmit={handleSendMessage} className="flex flex-col gap-3">
                {/* Image Preview Area */}
                {imagePreviewForMessage && (
                  <div className="relative w-fit mx-2">
                    <img 
                      src={imagePreviewForMessage} 
                      alt="Preview" 
                      className="max-h-32 w-auto rounded-lg border border-gray-200 shadow-sm" 
                    />
                    <Button 
                      variant="secondary"
                      size="icon"
                      className="absolute -top-2 -right-2 rounded-full h-6 w-6 bg-white text-red-500 hover:bg-red-50 hover:text-red-600 border border-gray-200 shadow-sm p-1"
                      onClick={() => {
                        setSelectedImageFile(null);
                        setImagePreviewForMessage(null);
                        if(imageInputRef.current) imageInputRef.current.value = '';
                      }}
                      title="Remove image"
                      type="button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {/* Input Field and Buttons */}
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="outline"
                    size="icon"
                    onClick={() => imageInputRef.current?.click()} 
                    disabled={isLoadingResponse || isVoiceRecording}
                    className="h-10 w-10 rounded-full bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50"
                    title="Attach image"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                  
                  <Button 
                    type="button" 
                    variant={isVoiceRecording ? "destructive" : "outline"}
                    size="icon"
                    onClick={handleToggleVoiceRecording}
                    disabled={!isSpeechApiSupported || isLoadingResponse}
                    className={`h-10 w-10 rounded-full ${isVoiceRecording ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50'}`}
                    title={isVoiceRecording ? "Stop recording" : "Start voice input"}
                  >
                    <Mic className={`h-4 w-4 ${isVoiceRecording ? 'animate-pulse' : ''}`} />
                  </Button>
                  
                  <div className="relative flex-grow">
                    <Input
                      type="text"
                      placeholder="Ask any math question..."
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      className="flex-grow h-10 pl-4 pr-12 rounded-full border-indigo-200 focus:border-indigo-300 focus:ring focus:ring-indigo-100 focus:ring-opacity-50"
                      disabled={isLoadingResponse}
                    />
                    <Button 
                      type="submit" 
                      disabled={isLoadingResponse || (!currentMessage.trim() && !selectedImageFile)}
                      className="absolute right-1 top-1 h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white flex items-center justify-center"
                    >
                      {isLoadingResponse ? <LoadingSpinner /> : <Send className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
                
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  ref={imageInputRef} 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedImageFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setImagePreviewForMessage(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                      if(e.target) e.target.value = '';
                    } else {
                      setSelectedImageFile(null);
                      setImagePreviewForMessage(null);
                    }
                  }}
                />
                
                {/* Error display */}
                {voiceRecognitionError && (
                  <p className="text-xs text-red-500 mt-1 ml-2">{voiceRecognitionError}</p>
                )}
                {!isSpeechApiSupported && (
                  <p className="text-xs text-amber-500 mt-1 ml-2">Voice input not supported by your browser.</p>
                )}
              </form>
            </div>
          </CardContent>
        </Card>
        
        {/* Tips or Features Section */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Upload className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">Upload Images</h3>
                <p className="text-xs text-gray-500">Take a picture of your math problem for instant help.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <MessageSquareText className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">Step-by-Step Solutions</h3>
                <p className="text-xs text-gray-500">Get detailed explanations to understand concepts better.</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-md hover:shadow-lg transition-shadow duration-200">
            <CardContent className="p-4 flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Mic className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-medium text-gray-800 mb-1">Voice Input</h3>
                <p className="text-xs text-gray-500">Speak your questions for hands-free learning experience.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ChatPage; 