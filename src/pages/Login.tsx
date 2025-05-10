import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/context/AuthContext';

// Import icons
import { LogIn, Mail, Lock, ArrowRight } from 'lucide-react';

const LoadingSpinner = () => (
  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] text-white motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
      Loading...
    </span>
  </div>
);

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { login, isLoading: authIsLoading, isLoggedIn } = useAuth();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string>("/");

  // Extract the redirect target from location state
  useEffect(() => {
    console.log('Login component mounted');
    console.log('Location state:', location.state);
    
    // Get the intended destination from location state
    const fromPath = location.state?.from?.pathname;
    if (fromPath) {
      console.log('Redirect target found:', fromPath);
      setRedirectTarget(fromPath);
    } else {
      console.log('No redirect target, using default: /');
      setRedirectTarget("/");
    }
  }, [location]);

  // Redirect if user is already logged in
  useEffect(() => {
    if (isLoggedIn) {
      console.log('User already logged in, redirecting to:', redirectTarget);
      navigate(redirectTarget, { replace: true });
    }
  }, [isLoggedIn, redirectTarget, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    console.log('Login form submitted');

    if (!formData.email || !formData.password) {
      setError('Both email and password are required.');
      toast({
        title: 'Login Failed',
        description: 'Both email and password are required.',
        variant: 'destructive',
      });
      return;
    }

    try {
      console.log('Attempting login...');
      await login(formData);
      
      toast({
        title: 'Login Successful!',
        description: 'Welcome back!',
      });
      
      console.log('Login successful, redirecting to:', redirectTarget);
      navigate(redirectTarget, { replace: true });

    } catch (error: any) {
      console.error('Login error:', error);
      const displayError = error.message || 'An unexpected error occurred. Please try again.';
      setError(displayError);
      toast({
        title: 'Login Failed',
        description: displayError,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Math Wiz
          </h1>
          <p className="text-gray-600 mt-2">Your personalized math learning assistant</p>
        </div>
        
        <Card className="border-0 shadow-lg rounded-xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
          <CardHeader className="space-y-1 pt-6">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <LogIn className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">Welcome Back!</CardTitle>
            <CardDescription className="text-center">
              Enter your credentials to access your account
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label 
                  htmlFor="email" 
                  className="text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  <Mail className="h-4 w-4 text-gray-500" />
                  Email
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="name@example.com"
                    className="pl-3 pr-3 py-2 h-11 rounded-lg border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 w-full"
                    disabled={authIsLoading}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label 
                    htmlFor="password" 
                    className="text-sm font-medium text-gray-700 flex items-center gap-2"
                  >
                    <Lock className="h-4 w-4 text-gray-500" />
                    Password
                  </Label>
                  <Link 
                    to="/forgot-password" 
                    className="text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    className="pl-3 pr-3 py-2 h-11 rounded-lg border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 w-full"
                    disabled={authIsLoading}
                  />
                </div>
              </div>
              
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 animate-in fade-in duration-300">
                  <p className="text-sm font-medium text-red-600 text-center">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={authIsLoading}
                className="w-full py-3 h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
              >
                {authIsLoading ? <LoadingSpinner /> : (
                  <>
                    Log In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="border-t border-gray-100 p-6 bg-gray-50 flex flex-col items-center">
            <p className="text-sm text-gray-600">
              Don't have an account yet?
            </p>
            <Link 
              to="/register" 
              className="mt-2 inline-flex items-center justify-center bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-50 transition-colors duration-200"
            >
              Create an account
            </Link>
          </CardFooter>
        </Card>
        
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            By logging in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 