import React from "react";
import { Button } from "@/components/ui/button";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/components/ui/use-toast";

const Home = () => {
  const navigate = useNavigate();
  const { isLoggedIn, user, logout, isLoading } = useAuth();

  const handleNavigateToProtected = (route: string) => {
    console.log(`Attempting to navigate to protected route: ${route}`);
    
    if (isLoggedIn) {
      console.log('User is logged in, navigating directly');
      // Check if route is /tutor specifically
      if (route === "/tutor") {
        console.log('Navigating to tutor route');
        try {
          navigate("/tutor");
          console.log('Navigation to tutor attempted');
        } catch (error) {
          console.error('Error navigating to tutor:', error);
          toast({
            title: "Navigation Error",
            description: `Error accessing the tutor page: ${error}`,
            variant: "destructive",
          });
        }
      } else {
        // For other routes
        navigate(route);
      }
    } else {
      console.log('User not logged in, redirecting to login');
      toast({
        title: "Login Required",
        description: `Please log in to access ${route === "/tutor" ? "the AI Tutor" : "this feature"}.`,
        variant: "default",
      });
      navigate('/login', { state: { from: route } });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-gradient-to-b from-indigo-100 to-blue-50">
        <div className="h-12 w-12 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-100 to-blue-50">
      {/* Top Authentication Bar */}
      <div className="absolute top-4 right-6 z-10 flex gap-3">
        {isLoggedIn ? (
          <>
            {user && <span className="text-gray-700 self-center mr-2 font-medium">Hi, {user.name}!</span>}
            <Button onClick={logout} variant="outline" className="shadow-sm hover:shadow-md transition-all">Logout</Button>
          </>
        ) : (
          <>
            <Button onClick={() => navigate('/login')} variant="outline" className="shadow-sm hover:shadow-md transition-all">Login</Button>
            <Button onClick={() => navigate('/register')} variant="default" className="bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all">Sign Up</Button>
          </>
        )}
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-32 -right-24 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-24 left-32 w-72 h-72 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        
        <div className="container mx-auto px-6 pt-28 pb-16">
          <div className="flex flex-col lg:flex-row items-center">
            {/* Left Side Content */}
            <div className="lg:w-1/2 text-center lg:text-left mb-12 lg:mb-0">
              <h1 className="text-5xl md:text-6xl font-bold text-gray-900 leading-tight">
                Transform Your <span className="text-indigo-600">Math Learning</span> Experience
        </h1>
              <p className="mt-6 text-xl text-gray-600 max-w-xl">
                AI-powered mathematics assistant with instant OCR extraction, step-by-step solutions, and personalized tutoring to help you excel.
        </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
          <Button
                  className="px-8 py-6 text-lg font-medium shadow-lg hover:shadow-xl bg-indigo-600 hover:bg-indigo-700 transition-all"
            onClick={() => handleNavigateToProtected("/ocr")}
          >
                  Try Solver Now
          </Button>
          <Button
                  className="px-8 py-6 text-lg font-medium shadow-md hover:shadow-lg bg-white text-indigo-600 hover:bg-gray-50 border border-indigo-200 transition-all"
            onClick={() => handleNavigateToProtected("/tutor")}
            variant="outline"
          >
            AI Tutor
          </Button>
        </div>
      </div>
            
            {/* Right Side Image */}
            <div className="lg:w-1/2 relative">
              <div className="relative z-10 bg-white p-5 rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300">
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-3 rounded-xl mb-4">
                  <div className="flex items-center mb-2">
                    <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="ml-3 text-xs font-mono">AI Tutor Pro</div>
                  </div>
                  <div className="font-mono text-sm">
                    <span className="text-indigo-200">{">"}</span> Analyzing your problem...
                  </div>
                </div>
                <div className="mb-4 p-4 bg-gray-100 rounded-lg font-mono text-sm overflow-hidden">
                  <div className="mb-2">
                    <span className="text-green-600">// Math Problem:</span>
                  </div>
                  <div className="text-gray-800">
                    Solve for x: 3x² + 4x - 7 = 0
                  </div>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center mb-3">
                    <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M16.5 7.5h-9v9h9v-9z" />
                        <path fillRule="evenodd" d="M8.25 2.25A.75.75 0 019 3v.75h2.25V3a.75.75 0 011.5 0v.75H15V3a.75.75 0 011.5 0v.75h.75a3 3 0 013 3v.75H21A.75.75 0 0121 9h-.75v2.25H21a.75.75 0 010 1.5h-.75V15H21a.75.75 0 010 1.5h-.75v.75a3 3 0 01-3 3h-.75V21a.75.75 0 01-1.5 0v-.75h-2.25V21a.75.75 0 01-1.5 0v-.75H9V21a.75.75 0 01-1.5 0v-.75h-.75a3 3 0 01-3-3v-.75H3A.75.75 0 013 15h.75v-2.25H3a.75.75 0 010-1.5h.75V9H3a.75.75 0 010-1.5h.75v-.75a3 3 0 013-3h.75V3a.75.75 0 01.75-.75zM6 6.75A.75.75 0 016.75 6h10.5a.75.75 0 01.75.75v10.5a.75.75 0 01-.75.75H6.75a.75.75 0 01-.75-.75V6.75z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="font-medium text-indigo-800">AI Tutor</div>
                  </div>
                  <div className="space-y-2 text-gray-700">
                    <p>Using the quadratic formula: x = (-b ± √(b² - 4ac)) / 2a</p>
                    <p>Where a=3, b=4, c=-7</p>
                    <p>x = (-4 ± √(16 + 84)) / 6</p>
                    <p>x = (-4 ± √100) / 6</p>
                    <p>x = (-4 ± 10) / 6</p>
                    <p className="font-bold text-indigo-700">Therefore, x = 1 or x = -7/3</p>
                  </div>
                </div>
              </div>
              
              {/* Decorative elements */}
              <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-yellow-400 rounded-full opacity-50"></div>
              <div className="absolute -top-6 -left-6 w-32 h-32 bg-indigo-500 rounded-full opacity-50"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Features Section */}
      <div className="bg-white py-24">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-16">Why Choose AI Tutor Pro</h2>
          
          <div className="grid md:grid-cols-3 gap-10">
            {/* Feature 1 */}
            <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-8 rounded-xl shadow-md hover:shadow-lg transition-all">
              <div className="w-14 h-14 bg-indigo-600 text-white rounded-lg flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Smart Problem Analysis</h3>
              <p className="text-gray-600">Our AI engine breaks down complex problems into manageable steps, identifying patterns and solution paths instantly.</p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-xl shadow-md hover:shadow-lg transition-all">
              <div className="w-14 h-14 bg-purple-600 text-white rounded-lg flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Personalized Learning</h3>
              <p className="text-gray-600">Adaptive feedback and customized explanations that match your learning style and knowledge level.</p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-8 rounded-xl shadow-md hover:shadow-lg transition-all">
              <div className="w-14 h-14 bg-blue-600 text-white rounded-lg flex items-center justify-center mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-3">Instant OCR Extraction</h3>
              <p className="text-gray-600">Snap a photo of handwritten math problems and get them extracted and solved immediately with our advanced OCR technology.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Call to Action */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-700 py-16">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to Transform Your Math Experience?</h2>
          <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">Join thousands of students who have improved their understanding and grades with AI Tutor Pro.</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              className="px-8 py-6 text-lg font-medium bg-white text-indigo-700 hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl"
              onClick={() => navigate("/register")}
            >
              Get Started Free
            </Button>
            <Button
              className="px-8 py-6 text-lg font-medium bg-transparent hover:bg-indigo-700 text-white border border-white transition-all shadow-md hover:shadow-lg"
              onClick={() => handleNavigateToProtected("/tutor")}
              variant="outline"
            >
              Explore Features
            </Button>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-8 md:mb-0">
              <div className="flex items-center text-2xl font-bold">
                <span className="text-indigo-400">AI</span><span>Tutor</span><span className="text-indigo-400">Pro</span>
              </div>
              <p className="mt-2 text-gray-400">Empowering students with AI-assisted learning</p>
            </div>
            <div className="text-center md:text-right">
              <p className="text-gray-400">© {new Date().getFullYear()} AI Tutor Pro</p>
              <p className="text-gray-500 text-sm mt-1">Educational use only</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

