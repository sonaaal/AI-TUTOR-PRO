import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
// import DailyPuzzleCard from '@/components/DailyPuzzleCard';
import McqQuestionDisplay from '@/components/cs/McqQuestionDisplay';

// Import icons
import { 
  BookOpen, 
  UserCircle, 
  TrendingUp, 
  Star, 
  Calendar, 
  CheckCircle,
  Activity,
  Award,
  BarChart3
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

interface UserData {
  name: string;
  email: string;
  // Additional fields we might want to display
  joined_date?: string;
  problems_solved?: number;
  accuracy_rate?: number;
  streak_days?: number;
  total_xp?: number;
  level?: string;
}

// --- Daily Challenge Types ---
export interface MCQOption {
  id: string;
  text: string;
}

export interface BaseCSQuestion {
  id: string;
  chapter: string;
  question_text: string;
}

export interface MCQQuestionType extends BaseCSQuestion {
  question_type: "mcq";
  options: MCQOption[];
}

export interface DailyChallengeSubmissionFeedback {
  correct: boolean;
  explanation: string;
  detailed_solution?: string;
  ai_feedback?: string;
  correct_option_id?: string | null;
  correct_option_text?: string | null;
}
// --- End Daily Challenge Types ---

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { getAuthHeader, user, token, isLoading: authLoading } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // State for Daily Challenge
  const [dailyChallengeQuestion, setDailyChallengeQuestion] = useState<MCQQuestionType | null>(null);
  const [dailyChallengeFeedback, setDailyChallengeFeedback] = useState<DailyChallengeSubmissionFeedback | null>(null);
  const [isDailyChallengeLoading, setIsDailyChallengeLoading] = useState<boolean>(false);
  const [dailyChallengeError, setDailyChallengeError] = useState<string | null>(null);
  const [isDailyChallengeSubmitting, setIsDailyChallengeSubmitting] = useState<boolean>(false);
  
  // Mock data for statistics - replace with actual API calls in production
  const [stats, setStats] = useState({
    problemsSolved: 24,
    accuracyRate: 87,
    streakDays: 5,
    totalXp: 2450,
    level: "Silver",
    recentTopics: [
      { name: "Algebra", progress: 75 },
      { name: "Calculus", progress: 45 },
      { name: "Geometry", progress: 60 }
    ]
  });

  useEffect(() => {
    const fetchUserData = async () => {
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/users/me`, {
          headers: {
            ...getAuthHeader(),
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: UserData = await response.json();
        setUserData(data);
        
        // We would also fetch user statistics here from another endpoint
        // fetchUserStats();
      } catch (err: any) {
        console.error("Failed to fetch user data:", err);
        const errorMessage = err.message || "Could not fetch user details.";
        setError(errorMessage);
        toast({
          title: "Error Fetching Data",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && token) {
      fetchUserData();
      fetchDailyChallenge(); // Fetch daily challenge on load
    } else if (!authLoading && !token) {
      setError("User not authenticated. Please log in.");
      setIsLoading(false);
    }

  }, [authLoading, token, getAuthHeader, user]);

  // --- Daily Challenge Functions ---
  const fetchDailyChallenge = async () => {
    setIsDailyChallengeLoading(true);
    setDailyChallengeError(null);
    setDailyChallengeQuestion(null); // Clear previous question
    setDailyChallengeFeedback(null); // Clear previous feedback
    
    const payload = {
      chapter_name: "General CS Concepts", // Using a more descriptive chapter name
      requested_question_type: "mcq"
    };

    try {
      const response = await fetch(`${API_BASE_URL}/cs/questions`, { // Changed to POST
        method: 'POST', // Specify POST method
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload) // Send parameters in the body
      });
      if (!response.ok) {
        const errorData = await response.json();
        // Try to get a more specific error message
        let detail = "Unknown error occurred.";
        if (errorData && errorData.detail) {
          if (typeof errorData.detail === 'string') {
            detail = errorData.detail;
          } else if (Array.isArray(errorData.detail) && errorData.detail.length > 0 && errorData.detail[0].msg) {
            // Handle FastAPI validation errors (which come as an array of objects)
            detail = errorData.detail.map((err: any) => err.msg).join(', ');
          } else {
            try {
              detail = JSON.stringify(errorData.detail);
            } catch (e) { /* ignore */ }
          }
        }
        throw new Error(detail || `HTTP error! status: ${response.status}`);
      }
      // The /cs/questions endpoint is expected to return a single question object, not an array
      const data: MCQQuestionType = await response.json(); 
      if (data && data.id) { // Check if data is a valid question object
        setDailyChallengeQuestion(data);
      } else {
        throw new Error("No valid daily challenge question received or unexpected response format.");
      }
    } catch (err: any) {
      console.error("Failed to fetch daily challenge:", err);
      const errorMessage = err.message || "Could not fetch daily challenge.";
      setDailyChallengeError(errorMessage);
      toast({
        title: "Error Fetching Daily Challenge",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDailyChallengeLoading(false);
    }
  };

  const handleDailyChallengeSubmit = async (submission: { question_id: string; selected_option_id: string }) => {
    if (!dailyChallengeQuestion) return;
    setDailyChallengeFeedback(null); // Clear previous feedback
    setDailyChallengeError(null);
    setIsDailyChallengeSubmitting(true);

    const payload = {
      question_id: submission.question_id,
      answer: submission.selected_option_id,
      question_text: dailyChallengeQuestion.question_text,
      options: dailyChallengeQuestion.options,
      question_type: "mcq"
    };

    try {
      const response = await fetch(`${API_BASE_URL}/cs/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }
      const feedbackData: DailyChallengeSubmissionFeedback = await response.json();
      setDailyChallengeFeedback(feedbackData);
    } catch (err: any) {
      console.error("Failed to submit daily challenge:", err);
      const errorMessage = err.message || "Could not process your submission.";
      setDailyChallengeError(errorMessage); // Set error for display within the card
      toast({
        title: "Submission Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsDailyChallengeSubmitting(false);
    }
  };
  // --- End Daily Challenge Functions ---

  if (isLoading && authLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
      {/* Page Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Welcome back, {userData?.name?.split(' ')[0] || 'User'}!
            </h1>
            <p className="text-gray-600 mt-1">Track your progress, solve daily puzzles, and improve your skills.</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
              onClick={() => navigate('/tutor')}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Practice Problems
            </Button>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700"
              onClick={() => navigate('/solve')}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Solve New Problem
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - User Profile */}
        <div className="lg:col-span-1 space-y-6">
          {/* User Profile Card */}
          <Card className="overflow-hidden border-0 shadow-md">
            <div className="h-24 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
            <div className="px-6 pb-6 -mt-12">
              <div className="flex justify-center">
                <div className="rounded-full border-4 border-white bg-white p-1 shadow-lg">
                  <UserCircle className="h-20 w-20 text-indigo-600" />
                </div>
            </div>
              <div className="mt-3 text-center">
                <h2 className="text-xl font-bold text-gray-800">
                  {userData?.name || 'Your Name'}
                </h2>
                <p className="text-sm text-gray-500">{userData?.email || 'email@example.com'}</p>
              </div>

              {error && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                  <p className="font-medium">Error:</p>
                  <p>{error}</p>
                </div>
              )}

              <div className="mt-5 pt-5 border-t border-gray-100">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-sm font-medium text-gray-700">Level</p>
                  <p className="text-sm font-bold text-indigo-600">{stats.level}</p>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5 mb-4">
                  <div 
                    className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2.5 rounded-full" 
                    style={{ width: `${Math.min((stats.totalXp % 500) / 5, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{stats.totalXp} XP</span>
                  <span>Next Level: {stats.totalXp + (500 - stats.totalXp % 500)} XP</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Quick Stats Card */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Your Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-purple-50 rounded-lg p-3 border border-purple-100">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-4 h-4 text-purple-600" />
                    <p className="text-xs font-medium text-purple-800">Problems Solved</p>
                  </div>
                  <p className="text-2xl font-bold text-purple-700">{stats.problemsSolved}</p>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 text-indigo-600" />
                    <p className="text-xs font-medium text-indigo-800">Accuracy</p>
                  </div>
                  <p className="text-2xl font-bold text-indigo-700">{stats.accuracyRate}%</p>
                </div>
                <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-medium text-blue-800">Current Streak</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{stats.streakDays} days</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="w-4 h-4 text-amber-600" />
                    <p className="text-xs font-medium text-amber-800">Total XP</p>
                  </div>
                  <p className="text-2xl font-bold text-amber-700">{stats.totalXp}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Activity & Progress */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Topics Card */}
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg">Recent Topics</CardTitle>
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:bg-indigo-50">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats.recentTopics.map((topic, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium text-gray-700">{topic.name}</p>
                      <p className="text-sm text-gray-600">{topic.progress}%</p>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-purple-500 to-indigo-500 h-2 rounded-full"
                        style={{ width: `${topic.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Activity & Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Activity className="w-5 h-5 text-indigo-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Solved 3 Algebra problems</p>
                      <p className="text-xs text-gray-500">Today, 11:32 AM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Award className="w-5 h-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Earned "Quick Solver" badge</p>
                      <p className="text-xs text-gray-500">Yesterday, 4:17 PM</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-800">Improved Calculus accuracy by 7%</p>
                      <p className="text-xs text-gray-500">2 days ago</p>
                    </div>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-indigo-600 hover:bg-indigo-50">
                  View All Activity
                </Button>
        </CardContent>
      </Card>

            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Recommended for You</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="p-3 border border-indigo-100 rounded-lg hover:bg-indigo-50 transition cursor-pointer">
                    <p className="text-sm font-medium text-gray-800">Quadratic Equations Practice</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Based on your recent activities
                    </p>
                  </div>
                  <div className="p-3 border border-purple-100 rounded-lg hover:bg-purple-50 transition cursor-pointer">
                    <p className="text-sm font-medium text-gray-800">Trigonometry Challenge</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Recommended to improve your skills
                    </p>
                  </div>
                  <div className="p-3 border border-blue-100 rounded-lg hover:bg-blue-50 transition cursor-pointer">
                    <p className="text-sm font-medium text-gray-800">Calculus Tutorial</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Help strengthen your understanding
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Challenge Card - Updated */}
          <Card className="border-0 shadow-md">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" />
                  <CardTitle className="text-lg">Daily Challenge</CardTitle>
                </div>
                <Button variant="outline" size="sm" onClick={fetchDailyChallenge} disabled={isDailyChallengeLoading}>
                  New Challenge
                </Button>
              </div>
              <CardDescription>A new brain-teaser every day! Sharpen your skills.</CardDescription>
            </CardHeader>
            <CardContent>
              {isDailyChallengeLoading && (
                <div className="flex justify-center items-center py-6">
                  <div className="h-8 w-8 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
                  <p className="ml-2 text-gray-600">Fetching new challenge...</p>
                </div>
              )}
              {!isDailyChallengeLoading && dailyChallengeError && !dailyChallengeQuestion && (
                <div className="text-center py-6 text-red-600">
                  <p>{dailyChallengeError}</p>
                  <Button variant="link" onClick={fetchDailyChallenge} className="mt-2">Try Again</Button>
                </div>
              )}
              {!isDailyChallengeLoading && !dailyChallengeError && dailyChallengeQuestion && (
                <McqQuestionDisplay
                  problem={dailyChallengeQuestion}
                  onSubmit={(selectedOptionId) => handleDailyChallengeSubmit({
                    question_id: dailyChallengeQuestion.id,
                    selected_option_id: selectedOptionId
                  })}
                  feedback={dailyChallengeFeedback}
                  isSubmitting={isDailyChallengeSubmitting}
                />
              )}
              {!isDailyChallengeLoading && !dailyChallengeQuestion && !dailyChallengeError && (
                 <div className="text-center py-6">
                    <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">
                      Click "New Challenge" to get started!
                    </p>
                  </div>
              )}
              {/* Display error specific to submission if it occurred and no new feedback */}
              {!isDailyChallengeLoading && dailyChallengeError && dailyChallengeQuestion && !dailyChallengeFeedback && (
                 <div className="mt-4 text-center py-2 text-red-600">
                  <p>Error submitting: {dailyChallengeError}</p>
          </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage; 