
import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#d3e4fd] flex flex-col justify-center items-center px-6 py-24 md:py-32">
      <div className="max-w-4xl w-full bg-white rounded-xl shadow-lg px-8 py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-semibold text-primary mb-4">
          Welcome to AI Tutor Pro
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-xl mx-auto">
          Upload handwritten or printed math questions, get instant OCR extraction, live editing, and step-by-step solutions.
          Learn smarter with AI-powered tutoring right at your fingertips.
        </p>
        <Button
          className="px-8 py-3 text-lg"
          onClick={() => navigate("/")}
          variant="default"
        >
          Get Started
        </Button>
      </div>
      <footer className="mt-16 text-muted-foreground text-sm">
        © {new Date().getFullYear()} AI Tutor Pro - Educational use only. Credits: OpenAI, SymPy.
      </footer>
    </div>
  );
};

export default Home;

