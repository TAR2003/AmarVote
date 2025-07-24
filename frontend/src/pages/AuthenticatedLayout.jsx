import React, { useState, useEffect, useRef } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiUsers,
  FiUser,
  FiSettings,
  FiLogOut,
  FiSearch,
  FiBell,
  FiBarChart2,
  FiCalendar,
  FiClock,
} from "react-icons/fi";
import { fetchAllElections } from "../utils/api";

const AuthenticatedLayout = ({ userEmail, setUserEmail }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allElections, setAllElections] = useState([]);
  const [isLoadingElections, setIsLoadingElections] = useState(false);
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Load elections when component mounts
  useEffect(() => {
    const loadElections = async () => {
      if (!userEmail) return;

      setIsLoadingElections(true);
      try {
        const elections = await fetchAllElections();
        setAllElections(elections);
      } catch (error) {
        console.error("Failed to load elections for search:", error);
      } finally {
        setIsLoadingElections(false);
      }
    };

    loadElections();
  }, [userEmail]);

  // Clear search on refresh/navigation and page load
  useEffect(() => {
    setSearchQuery("");
    setShowSuggestions(false);
    setSearchSuggestions([]);
  }, [location?.pathname]); // React to route changes

  // Handle clicks outside search to close suggestions
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Filter elections based on search query
  const filterElections = (query) => {
    if (!query.trim()) return [];

    const searchTerm = query.toLowerCase();
    return allElections
      .filter(election =>
        election.electionTitle?.toLowerCase().includes(searchTerm)
      )
      .slice(0, 5); // Limit to 5 suggestions
  };

  const handleSearchInputChange = (e) => {
    const value = e.target.value;
    setSearchQuery(value);

    if (value.trim().length > 0) {
      const suggestions = filterElections(value);
      setSearchSuggestions(suggestions);
      setShowSuggestions(true);
    } else {
      setSearchSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleElectionSelect = (electionId) => {
    setSearchQuery("");
    setShowSuggestions(false);
    navigate(`/election-page/${electionId}`);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchSuggestions.length > 0) {
      // Navigate to the first suggestion
      handleElectionSelect(searchSuggestions[0].electionId);
    }
  };

  const getElectionStatus = (election) => {
    const now = new Date();
    const startTime = new Date(election.startingTime);
    const endTime = new Date(election.endingTime);

    if (now < startTime) return { text: 'Upcoming', color: 'text-blue-600' };
    if (now > endTime) return { text: 'Ended', color: 'text-gray-600' };
    return { text: 'Active', color: 'text-green-600' };
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };



  const handleLogout = async () => {
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Logout failed");

      // Clear user data
      setUserEmail(null);
      localStorage.removeItem("email");
      localStorage.setItem("logout", Date.now());

      // Redirect to login
      navigate("/login");
    } catch (err) {
      console.error("Logout error:", err);
      alert("Failed to logout. Please try again.");
    }
  };

  if (!userEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md w-full mx-4">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiLogOut className="text-blue-600 text-2xl" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Session Expired
          </h2>
          <p className="text-gray-600 mb-6">Please sign in again to continue</p>
          <Link
            to="/login"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-all duration-200"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-600 hover:bg-gray-100 focus:outline-none"
              >
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  {mobileMenuOpen ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  )}
                </svg>
              </button>
            </div>

            {/* Logo */}
            <div className="flex items-center">
              <Link to="/dashboard" className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <FiHome className="text-white" />
                </div>
                <span className="ml-2 text-xl font-bold text-gray-900 hidden sm:block">
                  AmarVote
                </span>
              </Link>
            </div>

            {/* Search Bar */}
            <div className="flex-1 flex items-center justify-center px-2 lg:ml-6 lg:justify-end">
              <div className="max-w-lg w-full lg:max-w-xs relative" ref={searchRef}>
                <form onSubmit={handleSearchSubmit} className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search elections......"
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-full leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                  />
                </form>

                {/* Search Suggestions Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
                  >
                    {searchSuggestions.map((election) => {
                      const status = getElectionStatus(election);
                      return (
                        <div
                          key={election.electionId}
                          onClick={() => handleElectionSelect(election.electionId)}
                          className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {election.electionTitle}
                              </h4>
                              <p className="text-xs text-gray-500 mt-1 overflow-hidden" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                              }}>
                                {election.electionDescription}
                              </p>
                              <div className="flex items-center mt-2 space-x-3 text-xs text-gray-400">
                                <div className="flex items-center">
                                  <FiCalendar className="h-3 w-3 mr-1" />
                                  <span>{formatDate(election.startingTime)}</span>
                                </div>
                                <div className="flex items-center">
                                  <FiClock className="h-3 w-3 mr-1" />
                                  <span>{formatDate(election.endingTime)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end ml-3">
                              <span className={`text-xs font-medium ${status.color}`}>
                                {status.text}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full mt-1 ${election.isPublic
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-orange-100 text-orange-700'
                                }`}>
                                {election.isPublic ? 'Public' : 'Private'}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* No Results Message */}
                {showSuggestions && searchQuery.trim() && searchSuggestions.length === 0 && !isLoadingElections && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <div className="p-3 text-center text-gray-500 text-sm">
                      No elections found matching "{searchQuery}"
                    </div>
                  </div>
                )}

                {/* Loading Message */}
                {isLoadingElections && searchQuery.trim() && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                    <div className="p-3 text-center text-gray-500 text-sm">
                      <FiSearch className="h-4 w-4 animate-spin mx-auto mb-1" />
                      Searching elections...
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User menu */}
            <div className="ml-4 flex items-center md:ml-6">
              <button className="p-1 rounded-full text-gray-500 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <FiBell className="h-6 w-6" />
              </button>

              <div className="ml-3 relative">
                <div className="flex items-center space-x-2">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-medium text-gray-700 hidden sm:block">
                      {userEmail}
                    </span>
                    <span className="text-xs text-gray-500 hidden sm:block">
                      Admin
                    </span>
                  </div>
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <FiUser className="text-blue-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white shadow-lg">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {/* Mobile Search Bar */}
            <div className="relative mb-4" ref={searchRef}>
              <form onSubmit={handleSearchSubmit} className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiSearch className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search elections..."
                  value={searchQuery}
                  onChange={handleSearchInputChange}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                />
              </form>

              {/* Mobile Search Suggestions Dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {searchSuggestions.map((election) => {
                    const status = getElectionStatus(election);
                    return (
                      <div
                        key={election.electionId}
                        onClick={() => {
                          handleElectionSelect(election.electionId);
                          setMobileMenuOpen(false);
                        }}
                        className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-medium text-gray-900 truncate">
                              {election.electionTitle}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1 overflow-hidden" style={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical'
                            }}>
                              {election.electionDescription}
                            </p>
                            <div className="flex items-center mt-2 space-x-3 text-xs text-gray-400">
                              <div className="flex items-center">
                                <FiCalendar className="h-3 w-3 mr-1" />
                                <span>{formatDate(election.startingTime)}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end ml-3">
                            <span className={`text-xs font-medium ${status.color}`}>
                              {status.text}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Mobile No Results Message */}
              {showSuggestions && searchQuery.trim() && searchSuggestions.length === 0 && !isLoadingElections && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                  <div className="p-3 text-center text-gray-500 text-sm">
                    No elections found matching "{searchQuery}"
                  </div>
                </div>
              )}
            </div>

            <Link
              to="/dashboard"
              className="block px-3 py-2 rounded-md text-base font-medium text-blue-700 bg-blue-50"
            >
              Dashboard
            </Link>
            <Link
              to="/create-election"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            >
              Create Elections
            </Link>
            <Link
              to="/all-elections"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            >
              All Elections
            </Link>
            <Link
              to="/profile"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            >
              Profile
            </Link>
            <Link
              to="/election-page"
              className="block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            >
              Election Page
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-50"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="hidden md:flex md:flex-shrink-0">
          <div className="flex flex-col w-64 border-r border-gray-200 bg-white">
            <div className="h-0 flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
              <nav className="flex-1 px-2 space-y-1">
                <Link
                  to="/dashboard"
                  className="group flex items-center px-3 py-3 text-sm font-medium rounded-lg text-blue-700 bg-blue-50"
                >
                  <FiHome className="mr-3 h-5 w-5 text-blue-500" />
                  Dashboard
                </Link>
                <Link
                  to="/create-election"
                  className="group flex items-center px-3 py-3 text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200"
                >
                  <FiUsers className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                  Create Elections
                </Link>
                <Link
                  to="/all-elections"
                  className="group flex items-center px-3 py-3 text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200"
                >
                  <FiBarChart2 className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                  All Elections
                </Link>
                <Link
                  to="/profile"
                  className="group flex items-center px-3 py-3 text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200"
                >
                  <FiUser className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                  Profile
                </Link>
                <Link
                  to="/settings"
                  className="group flex items-center px-3 py-3 text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200"
                >
                  <FiSettings className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" />
                  Settings
                </Link>
                <Link
                  to="/election-page"
                  className="group flex items-center px-3 py-3 text-sm font-medium rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors duration-200"
                >
                  <FiBarChart2 className="mr-3 h-5 w-5 text-gray-400 group-hover:text-blue-500" />
                  Election Page
                </Link>
              </nav>
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 transition-colors duration-200"
              >
                <FiLogOut className="mr-2 h-4 w-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 relative overflow-y-auto focus:outline-none bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AuthenticatedLayout;
