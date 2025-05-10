import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

// Import icons
import { 
  Bookmark, 
  BookOpen,
  Trash2,
  Calendar,
  History,
  AlertCircle,
  Search,
  ArrowRight,
  Clock
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

interface BookmarkMetadata {
  steps?: Array<{ step_number: number; explanation: string }>;
  final_answer?: string | null;
  // Add other potential metadata fields if necessary
}

interface Bookmark {
  id: number;
  question_text: string;
  question_source: string;
  metadata_json: BookmarkMetadata | null; // Parsed metadata
  created_at: string; // Or Date object if you parse it
  // user_id is not typically sent to frontend for user's own bookmarks
}

const BookmarksPage: React.FC = () => {
  const navigate = useNavigate();
  const { getAuthHeader, user } = useAuth();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBookmark, setExpandedBookmark] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filter, setFilter] = useState<string>("all");

  // Format the created_at date to a user-friendly string
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  useEffect(() => {
    const fetchBookmarks = async () => {
      if (!user) { // Don't fetch if user is not logged in
        setIsLoading(false);
        setError("Please log in to see your bookmarks.");
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`${API_BASE_URL}/api/bookmarks/`, {
          method: 'GET',
          headers: {
            ...getAuthHeader(),
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch bookmarks.' }));
          throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        const data: Bookmark[] = await response.json();
        // Parse metadata_json if it's a string
        const parsedData = data.map(bm => ({
            ...bm,
            metadata_json: bm.metadata_json ? (typeof bm.metadata_json === 'string' ? JSON.parse(bm.metadata_json) : bm.metadata_json) : null
        }));
        setBookmarks(parsedData);

      } catch (err: any) {
        console.error("Error fetching bookmarks:", err);
        setError(err.message || 'Could not load bookmarks.');
        toast({
          title: "Error Loading Bookmarks",
          description: err.message || 'Could not load bookmarks.',
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookmarks();
  }, [getAuthHeader, user]); // Re-fetch if auth status changes

  const handleToggleExpand = (bookmarkId: number) => {
    setExpandedBookmark(expandedBookmark === bookmarkId ? null : bookmarkId);
  };

  const handleUnbookmark = async (bookmarkId: number) => {
    try {
        const response = await fetch(`${API_BASE_URL}/api/bookmarks/${bookmarkId}`, {
            method: 'DELETE',
            headers: {
                ...getAuthHeader(),
            },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Failed to delete bookmark.' }));
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }
        
        // Remove the bookmark from the local state
        setBookmarks(prevBookmarks => prevBookmarks.filter(bm => bm.id !== bookmarkId));
        toast({
            title: "Bookmark Removed",
            description: "The bookmark has been successfully deleted.",
        });

    } catch (err: any) {
        console.error("Error deleting bookmark:", err);
        setError(err.message || 'Could not delete bookmark.'); // Optionally set a page-level error
        toast({
            title: "Error Deleting Bookmark",
            description: err.message || 'Could not delete bookmark.',
            variant: "destructive",
        });
    }
  };

  // Filter and search bookmarks
  const filteredBookmarks = bookmarks.filter(bookmark => {
    // Apply search query filter
    const matchesSearch = searchQuery === "" || 
      bookmark.question_text.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Apply source filter
    const matchesFilter = filter === "all" || 
      bookmark.question_source === filter;
    
    return matchesSearch && matchesFilter;
  });

  // Get unique bookmark sources for filter options
  const bookmarkSources = [...new Set(bookmarks.map(b => b.question_source))];

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gradient-to-b from-gray-50 to-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
          <p className="text-gray-600">Loading your bookmarks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Unable to Load Bookmarks</h1>
            <p className="text-red-500 mb-4">{error}</p>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate('/')}>
              Return Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
      return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
              <Bookmark className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-gray-800 mb-2">My Bookmarks</h1>
              <p className="text-gray-600 mb-6">Please log in to view your saved bookmarks.</p>
              <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate('/login')}>
                Log In
              </Button>
            </div>
          </div>
        </div>
      );
  }
  
  if (bookmarks.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <Bookmark className="h-12 w-12 text-indigo-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-800 mb-2">My Bookmarks</h1>
            <p className="text-gray-600 mb-6">You haven't bookmarked any questions yet.</p>
            <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={() => navigate('/tutor')}>
              <BookOpen className="w-4 h-4 mr-2" />
              Go to Tutor
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white p-4 md:p-8">
      {/* Page Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              My Bookmarks
            </h1>
            <p className="text-gray-600 mt-1">
              {filteredBookmarks.length} saved {filteredBookmarks.length === 1 ? 'question' : 'questions'}
            </p>
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
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="max-w-6xl mx-auto mb-6">
        <div className="bg-white rounded-xl shadow-md p-4 border border-gray-100">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search bookmarks..."
                className="w-full pl-9 py-2 pr-4 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex-shrink-0">
              <select
                className="w-full md:w-40 py-2 px-3 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="all">All sources</option>
                {bookmarkSources.map((source) => (
                  <option key={source} value={source}>{source}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Bookmarks List */}
      <div className="max-w-6xl mx-auto">
        <div className="space-y-4">
          {filteredBookmarks.length === 0 ? (
            <div className="text-center p-8 bg-white rounded-xl shadow-md border border-gray-100">
              <p className="text-gray-600">No matching bookmarks found. Try adjusting your search or filter.</p>
            </div>
          ) : (
            filteredBookmarks.map((bookmark) => (
              <Card key={bookmark.id} className="border-0 shadow-md overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg text-gray-800 pr-8">
                      {bookmark.question_text.length > 100 
                        ? `${bookmark.question_text.substring(0, 100)}...` 
                        : bookmark.question_text}
                    </CardTitle>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleUnbookmark(bookmark.id)}
                      className="text-red-500 hover:text-red-600 hover:bg-red-50 -mt-1 -mr-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                    <span className="flex items-center text-xs text-gray-500">
                      <History className="h-3 w-3 mr-1" />
                      Source: <span className="font-medium ml-1 text-indigo-600">{bookmark.question_source}</span>
                    </span>
                    <span className="hidden sm:block text-gray-300">•</span>
                    <span className="flex items-center text-xs text-gray-500">
                      <Clock className="h-3 w-3 mr-1" />
                      Saved: {formatDate(bookmark.created_at)}
                    </span>
                  </div>
                </CardHeader>
                
                {bookmark.metadata_json && (
                  <>
                    <CardContent className={`pb-0 transition-all duration-300 ${expandedBookmark === bookmark.id ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
                      {bookmark.metadata_json.steps && bookmark.metadata_json.steps.length > 0 && (
                        <div className="mb-4">
                          <p className="font-medium text-sm text-gray-700 mb-2">Solution Steps:</p>
                          <div className="space-y-3">
                            {bookmark.metadata_json.steps.map((step) => (
                              <div key={step.step_number} className="p-2 border-l-2 border-indigo-300 pl-3 bg-gray-50 rounded-r-md">
                                <p className="text-sm"><span className="font-medium text-indigo-700">Step {step.step_number}:</span> {step.explanation}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {bookmark.metadata_json.final_answer && (
                        <div className="mb-4">
                          <p className="font-medium text-sm text-gray-700 mb-2">Final Answer:</p>
                          <div className="p-3 bg-green-50 rounded-md text-sm font-mono text-green-800 whitespace-pre-wrap border border-green-100">
                            {bookmark.metadata_json.final_answer}
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className={`pt-0 pb-3 ${!bookmark.metadata_json.steps && !bookmark.metadata_json.final_answer ? 'hidden' : ''}`}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleExpand(bookmark.id)}
                        className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 mt-2"
                      >
                        {expandedBookmark === bookmark.id ? 'Hide Details' : 'Show Details'}
                        <ArrowRight className={`h-4 w-4 ml-1 transition-transform ${expandedBookmark === bookmark.id ? 'rotate-90' : ''}`} />
                      </Button>
                    </CardFooter>
                  </>
                )}
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BookmarksPage; 