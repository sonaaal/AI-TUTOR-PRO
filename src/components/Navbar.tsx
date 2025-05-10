import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
// Potentially import an icon for your app logo/title if you have one
// import { BrainCircuit } from 'lucide-react'; // Example icon

const Navbar: React.FC = () => {
  const { isLoggedIn, user, logout, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Add scroll effect for transparency
  useEffect(() => {
    const handleScroll = () => {
      const isScrolled = window.scrollY > 10;
      if (isScrolled !== scrolled) {
        setScrolled(isScrolled);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [scrolled]);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleMobileLinkClick = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false); // Close menu after navigation
  };

  const handleMobileLogout = () => {
    logout();
    setIsMobileMenuOpen(false); // Close menu after logout
  };

  // Determine active link
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <nav className={`${
      scrolled ? 'bg-white shadow-md' : 'bg-gradient-to-r from-indigo-600 to-purple-700'
    } sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'text-gray-800' : 'text-white'}`}>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* App Title/Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="flex items-center space-x-2 text-xl font-bold" onClick={() => setIsMobileMenuOpen(false)}>
              {/* <BrainCircuit className="h-7 w-7 text-sky-400" /> */}
              {scrolled ? (
                <>
                  <span className="text-indigo-600">AI</span>
                  <span className="text-gray-800">Tutor</span>
                  <span className="text-indigo-600">Pro</span>
                </>
              ) : (
                <>
                  <span className="text-indigo-300">AI</span>
                  <span className="text-white">Tutor</span>
                  <span className="text-indigo-300">Pro</span>
                </>
              )}
            </Link>
          </div>

          {/* Navigation Links - Centered */}
          <div className="hidden md:flex flex-grow justify-center items-center space-x-6">
            <Link 
              to="/tutor" 
              className={`px-3 py-2 text-sm font-medium transition-all ${
                scrolled 
                  ? `${isActive('/tutor') ? 'border-b-2 border-indigo-600 text-indigo-700' : 'hover:text-indigo-700'}`
                  : `${isActive('/tutor') ? 'border-b-2 border-indigo-300 text-indigo-200' : 'hover:text-indigo-200'}`
              }`}
            >
              AI Tutor
            </Link>
            <Link 
              to="/ocr" 
              className={`px-3 py-2 text-sm font-medium transition-all ${
                scrolled 
                  ? `${isActive('/ocr') ? 'border-b-2 border-indigo-600 text-indigo-700' : 'hover:text-indigo-700'}`
                  : `${isActive('/ocr') ? 'border-b-2 border-indigo-300 text-indigo-200' : 'hover:text-indigo-200'}`
              }`}
            >
              Solve & Diagnose
            </Link>
            {isLoggedIn && (
              <>
                <Link 
                  to="/dashboard" 
                  className={`px-3 py-2 text-sm font-medium transition-all ${
                    scrolled 
                      ? `${isActive('/dashboard') ? 'border-b-2 border-indigo-600 text-indigo-700' : 'hover:text-indigo-700'}`
                      : `${isActive('/dashboard') ? 'border-b-2 border-indigo-300 text-indigo-200' : 'hover:text-indigo-200'}`
                  }`}
                >
                  Dashboard
                </Link>
                <Link 
                  to="/bookmarks" 
                  className={`px-3 py-2 text-sm font-medium transition-all ${
                    scrolled 
                      ? `${isActive('/bookmarks') ? 'border-b-2 border-indigo-600 text-indigo-700' : 'hover:text-indigo-700'}`
                      : `${isActive('/bookmarks') ? 'border-b-2 border-indigo-300 text-indigo-200' : 'hover:text-indigo-200'}`
                  }`}
                >
                  My Bookmarks
                </Link>
                <Link 
                  to="/chat" 
                  className={`px-3 py-2 text-sm font-medium transition-all ${
                    scrolled 
                      ? `${isActive('/chat') ? 'border-b-2 border-indigo-600 text-indigo-700' : 'hover:text-indigo-700'}`
                      : `${isActive('/chat') ? 'border-b-2 border-indigo-300 text-indigo-200' : 'hover:text-indigo-200'}`
                  }`}
                >
                  Chat
                </Link>
              </>
            )}
          </div>

          {/* Auth Section - Right Aligned */}
          <div className="hidden md:flex items-center space-x-3">
            {isLoading ? (
              <div className="h-5 w-20 bg-indigo-700 rounded animate-pulse"></div>
            ) : isLoggedIn && user ? (
              <>
                <span className={`text-sm font-medium ${scrolled ? 'text-gray-600' : 'text-indigo-100'}`}>Hi, {user.name}!</span>
                <Button 
                  onClick={logout} 
                  variant="outline" 
                  size="sm" 
                  className={scrolled 
                    ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200 shadow-sm hover:shadow-md transition-all border-indigo-300"
                    : "bg-white text-indigo-700 hover:bg-gray-100 shadow-sm hover:shadow-md transition-all"
                  }
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button 
                  onClick={() => navigate('/login')} 
                  variant="ghost" 
                  size="sm" 
                  className={scrolled ? "text-indigo-700 hover:bg-indigo-100" : "text-white hover:bg-indigo-500"}
                >
                  Login
                </Button>
                <Button 
                  onClick={() => navigate('/register')} 
                  variant="default" 
                  size="sm" 
                  className={scrolled 
                    ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all"
                    : "bg-white text-indigo-700 hover:bg-gray-100 shadow-sm hover:shadow-md transition-all"
                  }
                >
                  Sign Up
                </Button>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="-mr-2 flex md:hidden">
            <Button 
              onClick={toggleMobileMenu} 
              variant="ghost" 
              size="icon" 
              className={scrolled ? "text-gray-800 hover:bg-indigo-100" : "text-white hover:bg-indigo-500"}
            >
              {isMobileMenuOpen ? (
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-6 w-6" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className={`md:hidden ${scrolled ? 'bg-gray-100 border-t border-gray-200' : 'bg-indigo-800 border-t border-indigo-700'}`}>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <button 
              onClick={() => handleMobileLinkClick('/tutor')} 
              className={`w-full text-left block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                scrolled 
                  ? `${isActive('/tutor') ? 'bg-indigo-100 text-indigo-800' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-800'}`
                  : `${isActive('/tutor') ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:bg-indigo-700 hover:text-white'}`
              }`}
            >
              AI Tutor
            </button>
            <button 
              onClick={() => handleMobileLinkClick('/ocr')} 
              className={`w-full text-left block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                scrolled 
                  ? `${isActive('/ocr') ? 'bg-indigo-100 text-indigo-800' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-800'}`
                  : `${isActive('/ocr') ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:bg-indigo-700 hover:text-white'}`
              }`}
            >
              Solve & Diagnose
            </button>
            {isLoggedIn && (
              <>
                <button 
                  onClick={() => handleMobileLinkClick('/dashboard')} 
                  className={`w-full text-left block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    scrolled 
                      ? `${isActive('/dashboard') ? 'bg-indigo-100 text-indigo-800' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-800'}`
                      : `${isActive('/dashboard') ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:bg-indigo-700 hover:text-white'}`
                  }`}
                >
                  Dashboard
                </button>
                <button 
                  onClick={() => handleMobileLinkClick('/bookmarks')} 
                  className={`w-full text-left block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    scrolled 
                      ? `${isActive('/bookmarks') ? 'bg-indigo-100 text-indigo-800' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-800'}`
                      : `${isActive('/bookmarks') ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:bg-indigo-700 hover:text-white'}`
                  }`}
                >
                  My Bookmarks
                </button>
                <button 
                  onClick={() => handleMobileLinkClick('/chat')} 
                  className={`w-full text-left block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                    scrolled 
                      ? `${isActive('/chat') ? 'bg-indigo-100 text-indigo-800' : 'text-gray-700 hover:bg-indigo-50 hover:text-indigo-800'}`
                      : `${isActive('/chat') ? 'bg-indigo-700 text-white' : 'text-indigo-200 hover:bg-indigo-700 hover:text-white'}`
                  }`}
                >
                  Chat
                </button>
              </>
            )}
          </div>
          <div className={`pt-4 pb-3 ${scrolled ? 'border-t border-gray-200' : 'border-t border-indigo-700'}`}>
            {isLoading ? (
                <div className="px-5 py-2">
                    <div className={`h-5 w-full rounded animate-pulse ${scrolled ? 'bg-indigo-200' : 'bg-indigo-700'}`}></div>
                </div>
            ) : isLoggedIn && user ? (
              <>
                <div className="flex items-center px-5 mb-3">
                  <div className="w-8 h-8 rounded-full bg-purple-200 text-indigo-800 flex items-center justify-center font-semibold mr-3">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className={`text-base font-medium leading-none ${scrolled ? 'text-gray-800' : 'text-white'}`}>{user.name}</div>
                    <div className={`text-sm font-medium leading-none mt-1 ${scrolled ? 'text-gray-500' : 'text-indigo-200'}`}>{user.email}</div>
                  </div>
                </div>
                <div className="px-2 space-y-1">
                  <Button 
                    onClick={handleMobileLogout} 
                    variant="outline" 
                    className={`w-full justify-start text-base font-medium ${
                      scrolled 
                        ? "border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                        : "border-indigo-300 text-white hover:bg-indigo-700"
                    }`}
                  >
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <div className="px-2 space-y-2 pb-3">
                <Button 
                  onClick={() => handleMobileLinkClick('/login')} 
                  variant="outline" 
                  className={`w-full justify-center text-base font-medium ${
                    scrolled 
                      ? "border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                      : "border-indigo-300 text-white hover:bg-indigo-700"
                  }`}
                >
                  Login
                </Button>
                <Button 
                  onClick={() => handleMobileLinkClick('/register')} 
                  variant="default" 
                  className={`w-full justify-center text-base font-medium ${
                    scrolled
                      ? "bg-indigo-600 text-white hover:bg-indigo-700"
                      : "bg-white text-indigo-700 hover:bg-gray-100"
                  }`}
                >
                  Sign Up
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar; 