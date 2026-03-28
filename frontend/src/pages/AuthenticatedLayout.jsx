import React, { useState, useEffect, useRef } from "react";
import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  FiHome,
  FiUser,
  FiLogOut,
  FiSearch,
  FiBarChart2,
  FiCalendar,
  FiClock,
  FiMenu,
  FiX,
  FiPlus,
  FiBell,
  FiUsers,
} from "react-icons/fi";
import { fetchAllElections } from "../utils/api";
import { electionApi } from "../utils/electionApi";

const AuthenticatedLayout = ({ userEmail, setUserEmail }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allElections, setAllElections] = useState([]);
  const [isLoadingElections, setIsLoadingElections] = useState(false);
  const [guardianAttentionItems, setGuardianAttentionItems] = useState([]);
  const [showGuardianAttention, setShowGuardianAttention] = useState(false);
  const [loadingGuardianAttention, setLoadingGuardianAttention] = useState(false);
  const [canCreateElections, setCanCreateElections] = useState(false);
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const notificationRef = useRef(null);
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

  useEffect(() => {
    const loadCreatePermission = async () => {
      if (!userEmail) {
        setCanCreateElections(false);
        return;
      }

      try {
        const res = await fetch("/api/authorized-users/me", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          setCanCreateElections(false);
          return;
        }

        const data = await res.json();
        setCanCreateElections(!!data.canCreateElections);
      } catch {
        setCanCreateElections(false);
      }
    };

    loadCreatePermission();
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
      // If click is outside BOTH the desktop search area and the mobile search area,
      // then close suggestions. This prevents mobile suggestion clicks from being
      // dismissed by the global mousedown handler before the button's click runs.
      const clickedInsideDesktop = searchRef.current && searchRef.current.contains(event.target);
      const clickedInsideSuggestions = suggestionsRef.current && suggestionsRef.current.contains(event.target);
      const clickedInsideMobile = mobileSearchRef.current && mobileSearchRef.current.contains(event.target);
      const clickedInsideNotifications = notificationRef.current && notificationRef.current.contains(event.target);

      if (!clickedInsideDesktop && !clickedInsideSuggestions && !clickedInsideMobile && !clickedInsideNotifications) {
        setShowSuggestions(false);
        setShowGuardianAttention(false);
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
    if (!election?.startingTime || !election?.endingTime) {
      return { text: 'Key Ceremony', color: 'text-purple-600' };
    }

    const now = new Date();
    const startTime = new Date(election.startingTime);
    const endTime = new Date(election.endingTime);

    if (now < startTime) return { text: 'Upcoming', color: 'text-blue-600' };
    if (now > endTime) return { text: 'Ended', color: 'text-gray-600' };
    return { text: 'Active', color: 'text-green-600' };
  };

  useEffect(() => {
    const loadGuardianAttentionItems = async () => {
      if (!userEmail || allElections.length === 0) {
        setGuardianAttentionItems([]);
        return;
      }

      const guardianElections = allElections.filter((e) => e.userRoles?.includes('guardian'));
      if (guardianElections.length === 0) {
        setGuardianAttentionItems([]);
        return;
      }

      setLoadingGuardianAttention(true);
      try {
        const pendingCeremonyResp = await electionApi.getPendingKeyCeremonies().catch(() => ({ elections: [] }));
        const pendingCeremonies = pendingCeremonyResp?.elections || [];
        const pendingByElection = new Map(
          pendingCeremonies.map((item) => [Number(item.electionId), item])
        );

        const attentionItems = [];

        guardianElections.forEach((election) => {
          const pending = pendingByElection.get(Number(election.electionId));
          if (!pending) return;

          if (pending.currentRound === 'keypair_generation') {
            attentionItems.push({
              electionId: election.electionId,
              electionTitle: election.electionTitle,
              type: 'keypair',
              detail: `Round 1 key generation: ${pending.submittedGuardians}/${pending.numberOfGuardians} submitted`,
            });
          }

          if (pending.currentRound === 'backup_key_sharing') {
            attentionItems.push({
              electionId: election.electionId,
              electionTitle: election.electionTitle,
              type: 'backup',
              detail: `Round 2 backup sharing: ${pending.submittedBackupGuardians || 0}/${pending.numberOfGuardians} submitted`,
            });
          }
        });

        const now = new Date();
        const decryptionCandidates = guardianElections.filter((e) => {
          if (!e.endingTime) return false;
          if (e.status === 'key_ceremony_pending') return false;
          if (String(e.status || '').toLowerCase() === 'decrypted' || String(e.status || '').toLowerCase() === 'completed') return false;
          return new Date(e.endingTime) < now;
        });

        const details = await Promise.all(
          decryptionCandidates.map(async (e) => {
            try {
              return await electionApi.getElectionById(e.electionId);
            } catch {
              return null;
            }
          })
        );

        details.forEach((detail) => {
          if (!detail?.guardians) return;
          const currentGuardian = detail.guardians.find((g) => g.isCurrentUser);
          if (!currentGuardian) return;
          if (!currentGuardian.decryptedOrNot) {
            attentionItems.push({
              electionId: detail.electionId,
              electionTitle: detail.electionTitle,
              type: 'decryption',
              detail: 'Election ended. Your decryption share is required.',
            });
          }
        });

        setGuardianAttentionItems(attentionItems);
      } finally {
        setLoadingGuardianAttention(false);
      }
    };

    loadGuardianAttentionItems();
  }, [userEmail, allElections, location.pathname]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const mobileNavItems = [
    { key: 'dashboard', label: 'Home', path: '/dashboard', icon: FiHome },
    { key: 'all-elections', label: 'Elections', path: '/all-elections', icon: FiBarChart2 },
    ...(canCreateElections ? [{ key: 'create-election', label: 'Create', path: '/create-election', icon: FiPlus }] : []),
    { key: 'authenticated-users', label: 'Users', path: '/authenticated-users', icon: FiUsers },
  ];



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

      // Redirect to OTP login
      navigate("/otp-login");
    } catch (err) {
      console.error("Logout error:", err);
      alert("Failed to logout. Please try again.");
    }
  };

  const handleApiLogsAccess = async () => {
    try {
      const res = await fetch("/api/admin/access-check", {
        method: "GET",
        credentials: "include",
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.allowed) {
        navigate("/api-logs");
        return;
      }

      alert(data.message || "Not allowed to view API logs.");
    } catch (error) {
      alert("Failed to verify API logs access.");
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
            to="/otp-login"
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
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16 items-center">
            {/* Mobile/Tablet menu button - Show when nav buttons are hidden */}
            <div className="flex 2xl:hidden">
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
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 group-hover:scale-105">
                  <span className="text-white text-lg sm:text-xl font-bold">🗳️</span>
                </div>
                <span className="ml-2 sm:ml-3 text-sm sm:text-xl font-bold bg-gradient-to-r from-gray-900 to-blue-800 bg-clip-text text-transparent block">
                  AmarVote
                </span>
              </Link>
            </div>

            {/* Desktop Navigation Menu - shown only on very wide screens */}
            <div className="hidden 2xl:flex items-center space-x-2">
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

              {canCreateElections ? (
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
              ) : null}

              <button
                onClick={handleApiLogsAccess}
                className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 shadow-sm hover:shadow-md ${isActiveRoute('/api-logs')
                    ? 'text-blue-700 bg-blue-50/80'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
              >
                <FiBarChart2 className="h-4 w-4" />
                <span>API Logs</span>
              </button>

              <Link
                to="/authenticated-users"
                className={`flex items-center space-x-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-300 shadow-sm hover:shadow-md ${isActiveRoute('/authenticated-users')
                    ? 'text-blue-700 bg-blue-50/80'
                    : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100/80'
                  }`}
              >
                <FiUsers className="h-4 w-4" />
                <span>Authenticated Users</span>
              </Link>

            </div>

            {/* Search Bar - prioritize width on desktop/tablet */}
            <div className="hidden md:flex flex-1 items-center justify-center px-3 lg:px-6">
              <div className="w-full max-w-2xl relative" ref={searchRef}>
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
            <div className="ml-2 md:ml-4 mr-1 sm:mr-0 flex items-center space-x-2 md:space-x-3">
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowGuardianAttention((prev) => !prev)}
                  className="relative flex items-center justify-center p-2 rounded-2xl text-gray-700 hover:bg-gray-100/80 transition-all"
                  title="Guardian notifications"
                >
                  <FiBell className="h-5 w-5" />
                  {guardianAttentionItems.length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                      {guardianAttentionItems.length}
                    </span>
                  )}
                </button>

                {showGuardianAttention && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white border border-gray-200 rounded-2xl shadow-2xl z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <h4 className="text-sm font-semibold text-gray-800">Guardian Notifications</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        Guardian in {allElections.filter((e) => e.userRoles?.includes('guardian')).length} election(s) · {guardianAttentionItems.length} need attention
                      </p>
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {loadingGuardianAttention ? (
                        <div className="p-4 text-sm text-gray-500">Loading...</div>
                      ) : guardianAttentionItems.length === 0 ? (
                        <div className="p-4 text-sm text-gray-500">No pending guardian actions.</div>
                      ) : (
                        guardianAttentionItems.map((item, index) => (
                          <button
                            key={`${item.type}-${item.electionId}-${index}`}
                            onClick={() => {
                              setShowGuardianAttention(false);
                              navigate(`/election-page/${item.electionId}/guardian`);
                            }}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="text-sm font-medium text-gray-900 truncate">{item.electionTitle}</div>
                            <div className="text-xs text-gray-600 mt-1">{item.detail}</div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Email Display */}
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex flex-col items-center p-1.5 sm:p-2 rounded-2xl bg-gray-50/80 hover:bg-gray-100/90 transition-all"
                title="Open profile"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-2xl flex items-center justify-center shadow-sm">
                  <FiUser className="text-blue-600 h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <span className="hidden sm:block text-xs sm:text-sm font-medium text-gray-700 mt-1 max-w-[120px] truncate">
                  {userEmail || 'User'}
                </span>
              </button>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-2xl text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50/80 transition-all duration-300 shadow-sm hover:shadow-md"
              >
                <FiLogOut className="h-4 w-4" />
                <span className="hidden sm:block">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile/Tablet menu */}
      {mobileMenuOpen && (
        <div className="2xl:hidden fixed inset-0 z-50 bg-black bg-opacity-50" onClick={() => setMobileMenuOpen(false)}>
          <div className="bg-white/95 backdrop-blur-lg shadow-xl border-b border-white/20 max-h-screen overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 pt-3 pb-4 space-y-2">
            {/* Mobile Search Bar - Only visible on small screens */}
            <div className="relative mb-4 md:hidden" ref={mobileSearchRef}>

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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearchSubmit(e);
                    }
                  }}
                />
              </form>

              {/* Mobile Search Suggestions Dropdown */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-white/95 backdrop-blur-lg border border-gray-200/50 rounded-2xl shadow-2xl max-h-60 overflow-y-auto">
                  {searchSuggestions.map((election, idx) => {
                    const status = getElectionStatus(election);
                    return (
                      <button
                        type="button"
                        key={election.electionId}
                        onClick={() => {
                          handleElectionSelect(election.electionId);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full text-left p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150 focus:bg-blue-50 outline-none"
                        tabIndex={0}
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
                      </button>
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

            {canCreateElections ? (
              <Link
                to="/create-election"
                onClick={() => setMobileMenuOpen(false)}
                className={`mt-2 mb-2 flex items-center space-x-3 px-4 py-3 rounded-2xl text-base font-medium shadow-md ${isActiveRoute('/create-election')
                    ? 'text-white bg-gradient-to-r from-green-600 to-emerald-700'
                    : 'text-white bg-gradient-to-r from-green-500 to-emerald-600'
                  }`}
              >
                <FiPlus className="h-5 w-5" />
                <span>Create Election</span>
              </Link>
            ) : null}

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleApiLogsAccess();
              }}
              className={`flex items-center space-x-3 w-full px-4 py-3 rounded-2xl text-base font-medium ${isActiveRoute('/api-logs')
                  ? 'text-blue-700 bg-blue-50/80'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50/80 transition-all duration-300'
                }`}
            >
              <FiBarChart2 className="h-5 w-5" />
              <span>API Logs</span>
            </button>

            <Link
              to="/authenticated-users"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-base font-medium ${isActiveRoute('/authenticated-users')
                  ? 'text-blue-700 bg-blue-50/80'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50/80 transition-all duration-300'
                }`}
            >
              <FiUsers className="h-5 w-5" />
              <span>Authenticated Users</span>
            </Link>

            <div className="pt-3 mt-3 border-t border-gray-200">
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
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto focus:outline-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-24 md:pb-8">
          <Outlet />
        </div>
      </main>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-lg shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-4 gap-1 px-2 py-2">
          {mobileNavItems.slice(0, 4).map((item) => {
            const Icon = item.icon;
            const isActive = isActiveRoute(item.path);
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center rounded-xl py-2 text-[11px] font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="h-4 w-4 mb-1" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default AuthenticatedLayout;
