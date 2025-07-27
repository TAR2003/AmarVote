import React, { useState, useEffect, useRef } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiUsers,
  FiUser,
  FiLogOut,
  FiSearch,
  FiBarChart2,
  FiCalendar,
  FiClock,
  FiMenu,
  FiX,
  FiPlus,
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

  // Helper function to check if a route is active
  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {/* Top Navigation Bar */}
      <header className="bg-white/95 backdrop-blur-lg shadow-lg border-b border-white/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-xl text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
              >
                {mobileMenuOpen ? (
                  <FiX className="h-6 w-6" />
                ) : (
                  <FiMenu className="h-6 w-6" />
                )}
              </button>
            </div>

            {/* Logo */}
            <div className="flex items-center">
              <Link to="/dashboard" className="flex-shrink-0 flex items-center group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <span className="text-white text-xl font-bold">🗳️</span>
                </div>
                <span className="ml-3 text-xl font-bold bg-gradient-to-r from-gray-900 to-blue-800 bg-clip-text text-transparent hidden sm:block">
                  AmarVote
                </span>
              </Link>
            </div>

            {/* Desktop Navigation Menu */}
            <div className="hidden md:flex items-center space-x-2">
              <Link
                to="/dashboard"
                className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 shadow-sm hover:shadow-md ${isActiveRoute('/dashboard')
                    ? 'text-blue-700 bg-blue-50/80'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
              >
                <FiHome className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>

              <Link
                to="/all-elections"
                className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 shadow-sm hover:shadow-md ${isActiveRoute('/all-elections')
                    ? 'text-blue-700 bg-blue-50/80'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
              >
                <FiBarChart2 className="h-4 w-4" />
                <span>All Elections</span>
              </Link>

              <Link
                to="/create-election"
                className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 shadow-md hover:shadow-lg transform hover:scale-105 ${isActiveRoute('/create-election')
                    ? 'text-white bg-gradient-to-r from-green-600 to-emerald-700'
                    : 'text-white bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700'
                  }`}
              >
                <FiPlus className="h-4 w-4" />
                <span>Create Election</span>
              </Link>
            </div>

            {/* Search Bar */}
            <div className="flex-1 flex items-center justify-center px-4 lg:ml-6 lg:justify-end">
              <div className="max-w-lg w-full lg:max-w-xs relative" ref={searchRef}>
                <form onSubmit={handleSearchSubmit} className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiSearch className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search elections..."
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    className="block w-full pl-10 pr-4 py-2.5 border border-gray-200/80 rounded-2xl leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 sm:text-sm transition-all duration-300 shadow-sm hover:shadow-md"
                  />
                </form>

                {/* Search Suggestions Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-lg border border-gray-200/50 rounded-2xl shadow-2xl max-h-80 overflow-y-auto"
                  >
                    {searchSuggestions.map((election) => {
                      const status = getElectionStatus(election);
                      return (
                        <div
                          key={election.electionId}
                          onClick={() => handleElectionSelect(election.electionId)}
                          className="p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
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
                  <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-lg border border-gray-200/50 rounded-2xl shadow-2xl">
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No elections found matching "{searchQuery}"
                    </div>
                  </div>
                )}

                {/* Loading Message */}
                {isLoadingElections && searchQuery.trim() && (
                  <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-lg border border-gray-200/50 rounded-2xl shadow-2xl">
                    <div className="p-4 text-center text-gray-500 text-sm">
                      <FiSearch className="h-4 w-4 animate-spin mx-auto mb-1" />
                      Searching elections...
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* User menu */}
            <div className="ml-4 flex items-center space-x-3">
              {/* Profile Section */}
              <Link
                to="/profile"
                className="flex items-center space-x-3 p-2 rounded-2xl hover:bg-gray-100/80 transition-all duration-300 group"
              >
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    {userEmail?.split('@')[0] || 'User'}
                  </span>
                  <span className="text-xs text-gray-500">
                    View Profile
                  </span>
                </div>
                <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-all duration-300">
                  <FiUser className="text-blue-600 h-5 w-5" />
                </div>
              </Link>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50/80 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <FiLogOut className="h-4 w-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-white/95 backdrop-blur-lg shadow-xl border-b border-white/20">
          <div className="px-4 pt-2 pb-4 space-y-2">
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
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200/80 rounded-2xl leading-5 bg-white/80 backdrop-blur-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-400 sm:text-sm transition-all duration-300"
                />
              </form>

              {/* Mobile Search Suggestions Dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-lg border border-gray-200/50 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
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
                <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-lg border border-gray-200/50 rounded-2xl shadow-2xl">
                  <div className="p-3 text-center text-gray-500 text-sm">
                    No elections found matching "{searchQuery}"
                  </div>
                </div>
              )}
            </div>

            {/* Mobile Navigation Links */}
            <Link
              to="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-base font-medium shadow-sm ${isActiveRoute('/dashboard')
                  ? 'text-blue-700 bg-blue-50/80'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50/80 transition-all duration-300'
                }`}
            >
              <FiHome className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/all-elections"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-base font-medium ${isActiveRoute('/all-elections')
                  ? 'text-blue-700 bg-blue-50/80'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50/80 transition-all duration-300'
                }`}
            >
              <FiBarChart2 className="h-5 w-5" />
              <span>All Elections</span>
            </Link>

            <Link
              to="/create-election"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-base font-medium shadow-md ${isActiveRoute('/create-election')
                  ? 'text-white bg-gradient-to-r from-green-600 to-emerald-700'
                  : 'text-white bg-gradient-to-r from-green-500 to-emerald-600'
                }`}
            >
              <FiPlus className="h-5 w-5" />
              <span>Create Election</span>
            </Link>

            <Link
              to="/profile"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-base font-medium ${isActiveRoute('/profile')
                  ? 'text-blue-700 bg-blue-50/80'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50/80 transition-all duration-300'
                }`}
            >
              <FiUser className="h-5 w-5" />
              <span>Profile</span>
            </Link>

            <button
              onClick={() => {
                handleLogout();
                setMobileMenuOpen(false);
              }}
              className="flex items-center space-x-3 w-full px-4 py-3 rounded-2xl text-base font-medium text-red-600 hover:text-red-700 hover:bg-red-50/80 transition-all duration-300"
            >
              <FiLogOut className="h-5 w-5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto focus:outline-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default AuthenticatedLayout;
