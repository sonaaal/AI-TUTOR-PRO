import React, { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { toast } from '@/components/ui/use-toast';

// No custom props are needed for this component currently.
// interface ProtectedRouteProps {}

const ProtectedRoute: React.FC = () => {
  const { isLoggedIn, isLoading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    console.log('ProtectedRoute rendered');
    console.log('isLoggedIn:', isLoggedIn);
    console.log('isLoading:', isLoading);
    console.log('Current location:', location);
  }, [isLoggedIn, isLoading, location]);

  if (isLoading) {
    // Show loading spinner while auth state is being determined
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-b from-gray-50 to-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          <p className="text-xl font-medium text-gray-800">Authenticating...</p>
          <p className="text-gray-500">Please wait while we verify your login</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    console.log('User not logged in, redirecting to login');
    // Show toast notification on redirect
    toast({
      title: "Authentication Required",
      description: "Please log in to access this page.",
      variant: "default",
    });
    
    // Redirect them to the /login page, but save the current location they were
    // trying to go to in state so we can send them there after login.
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log('User authenticated, rendering protected content');
  return <Outlet />; // Render the child route component (e.g., TutorComponent)
};

export default ProtectedRoute; 