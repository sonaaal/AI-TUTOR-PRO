import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom'; // May need for programmatic navigation in login/logout

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Define the shape of the user object
interface User {
  name: string;
  email: string;
  // Add any other relevant user fields here, e.g., id, roles
}

// Define the shape of the AuthContext
interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean; // To handle loading state during auth operations
  token: string | null; // Added token state
  login: (loginData: Record<string, string>) => Promise<void>; // Takes email/password
  logout: () => void;
  getAuthHeader: () => Record<string, string>; // Utility to get auth header
  // checkAuthStatus: () => void; // Handled by useEffect in AuthProvider
}

// Create the context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Define props for the AuthProvider
interface AuthProviderProps {
  children: ReactNode;
}

// Create the AuthProvider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true); // Start true to check auth status
  const [token, setToken] = useState<string | null>(null); // Added token state
  const navigate = useNavigate(); // For navigation after login/logout

  // Check auth status on initial load
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    const storedIsLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

    if (storedIsLoggedIn && storedUser && storedToken) {
      try {
        setUser(JSON.parse(storedUser));
        setToken(storedToken);
        setIsLoggedIn(true);
      } catch (error) {
        console.error("Failed to parse user from localStorage during init", error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('isLoggedIn'); // Ensure this is also cleared
        setUser(null);
        setToken(null);
        setIsLoggedIn(false);
      }
    }
    setIsLoading(false); // Done checking
  }, []);

  const login = async (loginData: Record<string, string>) => {
    setIsLoading(true);
    // Convert loginData to FormData for OAuth2PasswordRequestForm
    const formData = new URLSearchParams();
    formData.append('username', loginData.email); // FastAPI's OAuth2 form expects 'username'
    formData.append('password', loginData.password);
    formData.append('grant_type', 'password'); // Typically required for password flow

    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, // Important for OAuth2 form data
        body: formData.toString(),
      });
      const data = await response.json(); // Expects TokenResponse: { access_token, token_type, user }

      if (!response.ok || !data.access_token || !data.user) {
        const errorMsg = data.detail || data.error || `Login failed (status ${response.status})`;
        throw new Error(errorMsg);
      }
      
      const userData: User = { name: data.user.name, email: data.user.email };
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('isLoggedIn', 'true'); // Keep for simplicity with ProtectedRoute for now
      setUser(userData);
      setToken(data.access_token);
      setIsLoggedIn(true);
    } catch (error) {
      console.error("Login API call failed:", error);
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('isLoggedIn');
      setUser(null);
      setToken(null);
      setIsLoggedIn(false);
      throw error; // Re-throw to be caught by the Login page for toast message
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('isLoggedIn');
    // also remove userName, userEmail if they were set separately before
    localStorage.removeItem('userName'); 
    localStorage.removeItem('userEmail');
    setUser(null);
    setToken(null);
    setIsLoggedIn(false);
    navigate('/login'); // Redirect to login page after logout
  };

  const getAuthHeader = (): Record<string, string> => {
    const currentToken = localStorage.getItem('token'); // Or use token from state
    console.log('[AuthContext] getAuthHeader - currentToken from localStorage:', currentToken);
    if (currentToken) {
      return { Authorization: `Bearer ${currentToken}` };
    }
    return {};
  };

  useEffect(() => {
    console.log('[AuthContext] AuthProvider value being set:', { user, isLoggedIn, isLoading, token });
  }, [user, isLoggedIn, isLoading, token]);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn, isLoading, token, login, logout, getAuthHeader }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 