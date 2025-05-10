import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';

// Import icons
import { UserPlus, User, Mail, Lock, ArrowRight, CheckCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const LoadingSpinner = () => (
  <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent align-[-0.125em] text-white motion-reduce:animate-[spin_1.5s_linear_infinite]" role="status">
    <span className="!absolute !-m-px !h-px !w-px !overflow-hidden !whitespace-nowrap !border-0 !p-0 ![clip:rect(0,0,0,0)]">
      Loading...
    </span>
  </div>
);

const Register = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear specific error when user starts typing in a field
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required.';
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format.';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters.';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Confirm password is required.';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    setErrors({}); // Clear previous submission errors

    try {
      const response = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Assuming backend returns error in { detail: \"message\" } or { error: \"message\" }
        const errorMessage = data.detail || data.error || `Registration failed (status ${response.status})`;
        throw new Error(errorMessage);
      }

      toast({
        title: 'Registration Successful!',
        description: data.message || 'You can now log in.',
        variant: 'default',
      });
      navigate('/login'); // Redirect to login page

    } catch (error: any) {
      const displayError = error.message || 'An unexpected error occurred. Please try again.';
      setErrors({ form: displayError }); // Show a general form error
      toast({
        title: 'Registration Failed',
        description: displayError,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            Math Wiz
          </h1>
          <p className="text-gray-600 mt-2">Create an account to start learning</p>
        </div>
        
        <Card className="border-0 shadow-lg rounded-xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
          <CardHeader className="space-y-1 pt-6">
            <div className="flex justify-center mb-2">
              <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <UserPlus className="h-6 w-6 text-indigo-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center">Create an Account</CardTitle>
            <CardDescription className="text-center">
              Enter your details below to get started
            </CardDescription>
          </CardHeader>
          
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label 
                  htmlFor="name" 
                  className="text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  <User className="h-4 w-4 text-gray-500" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  className={`pl-3 pr-3 py-2 h-11 rounded-lg border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 w-full ${errors.name ? 'border-red-300 focus:border-red-300 focus:ring-red-200' : ''}`}
                  aria-invalid={errors.name ? "true" : "false"}
                  aria-describedby={errors.name ? "name-error" : undefined}
                />
                {errors.name && (
                  <p id="name-error" className="text-xs text-red-600 flex items-center gap-1 mt-1">
                    <span className="h-3 w-3 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <span className="block h-1.5 w-1.5 rounded-full bg-red-600"></span>
                    </span>
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label 
                  htmlFor="email" 
                  className="text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  <Mail className="h-4 w-4 text-gray-500" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  className={`pl-3 pr-3 py-2 h-11 rounded-lg border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 w-full ${errors.email ? 'border-red-300 focus:border-red-300 focus:ring-red-200' : ''}`}
                  aria-invalid={errors.email ? "true" : "false"}
                  aria-describedby={errors.email ? "email-error" : undefined}
                />
                {errors.email && (
                  <p id="email-error" className="text-xs text-red-600 flex items-center gap-1 mt-1">
                    <span className="h-3 w-3 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <span className="block h-1.5 w-1.5 rounded-full bg-red-600"></span>
                    </span>
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label 
                  htmlFor="password" 
                  className="text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  <Lock className="h-4 w-4 text-gray-500" />
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`pl-3 pr-3 py-2 h-11 rounded-lg border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 w-full ${errors.password ? 'border-red-300 focus:border-red-300 focus:ring-red-200' : ''}`}
                  aria-invalid={errors.password ? "true" : "false"}
                  aria-describedby={errors.password ? "password-error" : undefined}
                />
                {errors.password && (
                  <p id="password-error" className="text-xs text-red-600 flex items-center gap-1 mt-1">
                    <span className="h-3 w-3 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <span className="block h-1.5 w-1.5 rounded-full bg-red-600"></span>
                    </span>
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label 
                  htmlFor="confirmPassword" 
                  className="text-sm font-medium text-gray-700 flex items-center gap-2"
                >
                  <CheckCircle className="h-4 w-4 text-gray-500" />
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`pl-3 pr-3 py-2 h-11 rounded-lg border-gray-200 focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 w-full ${errors.confirmPassword ? 'border-red-300 focus:border-red-300 focus:ring-red-200' : ''}`}
                  aria-invalid={errors.confirmPassword ? "true" : "false"}
                  aria-describedby={errors.confirmPassword ? "confirm-password-error" : undefined}
                />
                {errors.confirmPassword && (
                  <p id="confirm-password-error" className="text-xs text-red-600 flex items-center gap-1 mt-1">
                    <span className="h-3 w-3 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                      <span className="block h-1.5 w-1.5 rounded-full bg-red-600"></span>
                    </span>
                    {errors.confirmPassword}
                  </p>
                )}
              </div>
              
              {errors.form && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 animate-in fade-in duration-300">
                  <p className="text-sm font-medium text-red-600 text-center">{errors.form}</p>
                </div>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 h-11 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg font-medium flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all duration-200 mt-2"
              >
                {isLoading ? <LoadingSpinner /> : (
                  <>
                    Create Account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
          
          <CardFooter className="border-t border-gray-100 p-6 bg-gray-50 flex flex-col items-center">
            <p className="text-sm text-gray-600">
              Already have an account?
            </p>
            <Link 
              to="/login" 
              className="mt-2 inline-flex items-center justify-center bg-white border border-indigo-200 text-indigo-600 px-4 py-2 rounded-lg font-medium text-sm hover:bg-indigo-50 transition-colors duration-200"
            >
              Log in instead
            </Link>
          </CardFooter>
        </Card>
        
        <div className="text-center mt-6">
          <p className="text-xs text-gray-500">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register; 