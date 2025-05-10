import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import TutorComponent from './components/TutorComponent';
import Register from './pages/Register';
import Login from './pages/Login';
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Layout from "./components/Layout";
import DashboardPage from "./pages/Dashboard";
import BookmarksPage from './pages/BookmarksPage'; // Adjust path as needed
import ChatPage from './pages/ChatPage'; // ADDED IMPORT FOR CHATPAGE
import { Link } from 'react-router-dom';
import { useState, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import UserListComponent from './components/admin/UserListComponent'; // New import

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
        <Routes>
            {/* Routes with the main Layout (Navbar, etc.) */}
            <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
              {/* Protected Routes within Layout */}
              <Route element={<ProtectedRoute />}>
          <Route path="/ocr" element={<Index />} />
          <Route path="/tutor" element={<TutorComponent />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/bookmarks" element={<BookmarksPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/admin/users" element={<UserListComponent />} /> {/* New Route */}
                {/* Add other protected routes that use the Layout here */}
              </Route>
              {/* Add other public routes that use the Layout here (e.g., /about) */}
            </Route>
            
            {/* Routes without the main Layout (e.g., login, register) */}
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />

            {/* Catch-all Not Found Route (can be inside or outside Layout as preferred) */}
            {/* If inside Layout, it will have Navbar. If outside, it won't. */}
            {/* For now, let's keep it simple and outside the main Layout */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </TooltipProvider>
      </AuthProvider>
      </BrowserRouter>
  </QueryClientProvider>
);

export default App;
