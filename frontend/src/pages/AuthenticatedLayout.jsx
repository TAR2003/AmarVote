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
import BrandMark, { BrandWordmark } from "../components/BrandMark";
import { electionApi } from "../utils/electionApi";
import { ElectionsProvider, useElections } from "../context/ElectionsContext";
import { timezoneUtils } from "../utils/timezoneUtils";
import { HTTP_ERROR_KIND } from "../utils/httpErrors";
import { buildAuthUrl, pathFromLocation, rememberReturnPath } from "../utils/authRedirect";

const AuthenticatedLayout = ({ userEmail, setUserEmail, sessionError, onRetrySession }) => (
  <ElectionsProvider userEmail={userEmail}>
    <AuthenticatedLayoutContent
      userEmail={userEmail}
      setUserEmail={setUserEmail}
      sessionError={sessionError}
      onRetrySession={onRetrySession}
    />
  </ElectionsProvider>
);

const AuthenticatedLayoutContent = ({ userEmail, setUserEmail, sessionError, onRetrySession }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { elections: allElections, loading: isLoadingElections } = useElections();
  const [guardianAttentionItems, setGuardianAttentionItems] = useState([]);
  const [showGuardianAttention, setShowGuardianAttention] = useState(false);
  const [loadingGuardianAttention, setLoadingGuardianAttention] = useState(false);
  const [canCreateElections, setCanCreateElections] = useState(false);
  const [canManageAuthorizedUsers, setCanManageAuthorizedUsers] = useState(false);
  const searchRef = useRef(null);
  const suggestionsRef = useRef(null);
  const notificationRef = useRef(null);
  const menuToggleButtonRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Helper function to check if a route is active
  const isActiveRoute = (path) => {
    return location.pathname === path;
  };

  const isWidePage = location.pathname === "/api-logs" || location.pathname === "/authenticated-users";
  const isElectionPage = location.pathname.includes("/election-page");

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setShowGuardianAttention(false);
    requestAnimationFrame(() => {
      menuToggleButtonRef.current?.focus();
    });
  };

  // Load create-election permissions when user is known
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
        setCanManageAuthorizedUsers(!!data.canManageAuthorizedUsers);
      } catch {
        setCanCreateElections(false);
        setCanManageAuthorizedUsers(false);
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
      // Close floating panels when clicking outside their containers.
      const clickedInsideDesktop = searchRef.current && searchRef.current.contains(event.target);
      const clickedInsideSuggestions = suggestionsRef.current && suggestionsRef.current.contains(event.target);
      const clickedInsideNotifications = notificationRef.current && notificationRef.current.contains(event.target);

      if (!clickedInsideDesktop && !clickedInsideSuggestions && !clickedInsideNotifications) {
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
      return { text: 'Key Ceremony', color: 'text-brand-dark' };
    }

    const now = new Date();
    const startTime = new Date(election.startingTime);
    const endTime = new Date(election.endingTime);

    if (now < startTime) return { text: 'Upcoming', color: 'text-brand' };
    if (now > endTime) return { text: 'Ended', color: 'text-dusk' };
    return { text: 'Active', color: 'text-sage' };
  };

  useEffect(() => {
    setMobileMenuOpen(false);
    setShowGuardianAttention(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleEscapeClose = (event) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };

    document.addEventListener("keydown", handleEscapeClose);
    return () => {
      document.removeEventListener("keydown", handleEscapeClose);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let idleId = null;
    let timeoutId = null;

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
        if (cancelled) return;

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
        guardianElections.forEach((election) => {
          if (!election.endingTime) return;
          if (election.status === 'key_ceremony_pending') return;
          if (['decrypted', 'completed'].includes(String(election.status || '').toLowerCase())) return;
          if (new Date(election.endingTime) >= now) return;
          if (election.guardianDecrypted === false) {
            attentionItems.push({
              electionId: election.electionId,
              electionTitle: election.electionTitle,
              type: 'decryption',
              detail: 'Election ended. Your decryption share is required.',
            });
          }
        });

        if (!cancelled) {
          setGuardianAttentionItems(attentionItems);
        }
      } finally {
        if (!cancelled) {
          setLoadingGuardianAttention(false);
        }
      }
    };

    const scheduleLoad = () => {
      if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
        idleId = window.requestIdleCallback(() => loadGuardianAttentionItems());
        return;
      }
      timeoutId = setTimeout(loadGuardianAttentionItems, 250);
    };

    scheduleLoad();

    return () => {
      cancelled = true;
      if (idleId != null && typeof window !== 'undefined' && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId != null) {
        clearTimeout(timeoutId);
      }
    };
  }, [userEmail, allElections, location.pathname]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Not scheduled';
    return timezoneUtils.formatDateOnly(dateString);
  };

  const mobileNavItems = [
    { key: 'dashboard', label: 'Home', path: '/dashboard', icon: FiHome },
    { key: 'all-elections', label: 'Elections', path: '/all-elections', icon: FiBarChart2 },
    ...(canCreateElections ? [{ key: 'create-election', label: 'Create', path: '/create-election', icon: FiPlus }] : []),
    ...(canManageAuthorizedUsers ? [{ key: 'authenticated-users', label: 'Users', path: '/authenticated-users', icon: FiUsers }] : []),
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

      // Redirect to login
      navigate("/login");
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
    const isSessionExpired = !sessionError || sessionError?.kind === HTTP_ERROR_KIND.SESSION_EXPIRED;
    const title = sessionError?.title || "Sign in required";
    const message = sessionError?.message || "Please sign in to continue to this page.";
    const showRetry = sessionError && !isSessionExpired && typeof onRetrySession === "function";
    const returnPath = pathFromLocation(location);
    if (returnPath) rememberReturnPath(returnPath);
    const loginHref = returnPath ? buildAuthUrl(returnPath, "login") : "/login";
    const registerHref = returnPath ? buildAuthUrl(returnPath, "register") : "/register";

    return (
      <div className="flex min-h-screen items-center justify-center bg-frost-mesh px-4">
        <div className="glass-panel w-full max-w-md p-8 text-center animate-fade-up">
          <div className="mb-5 flex justify-center">
            <BrandMark size="lg" />
          </div>
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            isSessionExpired ? "bg-glacier" : "bg-ceremonial-soft"
          }`}>
            <FiLogOut className={`text-xl ${isSessionExpired ? "text-brand" : "text-ink"}`} />
          </div>
          <h2 className="font-display text-2xl font-bold text-deep">
            {title}
          </h2>
          <p className="mt-2 text-dusk">{message}</p>
          {returnPath?.includes("/election-page/") && (
            <p className="mt-3 rounded-xl bg-glacier/70 px-3 py-2 text-sm text-brand-dark">
              After you sign in or register, we’ll bring you back to this election.
            </p>
          )}
          <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
            {showRetry && (
              <button
                type="button"
                onClick={() => onRetrySession()}
                className="btn-ghost"
              >
                Try again
              </button>
            )}
            {isSessionExpired && (
              <>
                <Link to={loginHref} className="btn-brand">
                  Sign in
                </Link>
                <Link to={registerHref} className="btn-ghost">
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen">
      {/* Top Navigation Bar — Deep Space encrypted header */}
      <header className="nav-deep sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between h-12 sm:h-14 md:h-16 items-center gap-2 sm:gap-3">
            <div className="flex-shrink-0">
              <button
                ref={menuToggleButtonRef}
                onClick={() => {
                  if (mobileMenuOpen) {
                    closeMobileMenu();
                    return;
                  }

                  setMobileMenuOpen(true);
                }}
                className="inline-flex items-center justify-center p-2 rounded-xl text-dusk-soft hover:text-paper hover:bg-paper/10 focus:outline-none focus:ring-2 focus:ring-brand transition-all duration-200"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <FiX className="h-5 w-5 sm:h-6 sm:w-6" />
                ) : (
                  <FiMenu className="h-5 w-5 sm:h-6 sm:w-6" />
                )}
              </button>
            </div>

            <Link to="/dashboard" className="group flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
              <BrandMark
                size="sm"
                className="transition duration-300 group-hover:scale-105 group-hover:shadow-brand sm:h-8 sm:w-8"
              />
              <BrandWordmark light className="hidden text-sm xs:inline sm:text-base" />
            </Link>

            {/* Search Bar */}
            <div className="flex-1 min-w-0 items-center justify-center">
              <div className="w-full max-w-3xl relative mx-auto" ref={searchRef}>
                <form onSubmit={handleSearchSubmit} className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none">
                    <FiSearch className="h-4 w-4 sm:h-5 sm:w-5 text-dusk" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search elections..."
                    value={searchQuery}
                    onChange={handleSearchInputChange}
                    className="block w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2.5 border border-white/15 rounded-xl sm:rounded-2xl leading-5 bg-paper/10 text-paper placeholder:text-dusk-soft focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand/60 focus:bg-paper/15 text-xs sm:text-sm transition-all duration-300"
                  />
                </form>

                {/* Search Suggestions Dropdown */}
                {showSuggestions && searchSuggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    className="absolute z-50 w-full mt-2 bg-paper/95 backdrop-blur-lg border border-ink/10/50 rounded-2xl shadow-2xl max-h-80 overflow-y-auto"
                  >
                    {searchSuggestions.map((election) => {
                      const status = getElectionStatus(election);
                      return (
                        <div
                          key={election.electionId}
                          onClick={() => handleElectionSelect(election.electionId)}
                          className="p-4 hover:bg-frost cursor-pointer border-b border-ink/10 last:border-b-0 transition-colors duration-150"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-ink truncate">
                                {election.electionTitle}
                              </h4>
                              <p className="text-xs text-dusk mt-1 overflow-hidden" style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical'
                              }}>
                                {election.electionDescription}
                              </p>
                              <div className="flex items-center mt-2 space-x-3 text-xs text-dusk">
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
                                ? 'bg-sage-soft text-sage'
                                : 'bg-ceremonial-soft text-ink'
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
                  <div className="absolute z-50 w-full mt-2 bg-paper/95 backdrop-blur-lg border border-ink/10/50 rounded-2xl shadow-2xl">
                    <div className="p-4 text-center text-dusk text-sm">
                      No elections found matching "{searchQuery}"
                    </div>
                  </div>
                )}

                {/* Loading Message */}
                {isLoadingElections && searchQuery.trim() && (
                  <div className="absolute z-50 w-full mt-2 bg-paper/95 backdrop-blur-lg border border-ink/10/50 rounded-2xl shadow-2xl">
                    <div className="p-4 text-center text-dusk text-sm">
                      <FiSearch className="h-4 w-4 animate-spin mx-auto mb-1" />
                      Searching elections...
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Profile Button */}
            <div className="ml-1 sm:ml-2 mr-0.5 sm:mr-0 flex items-center">
              <button
                type="button"
                onClick={() => navigate('/profile')}
                className="flex flex-col items-center p-1 sm:p-1.5 rounded-xl sm:rounded-2xl hover:bg-paper/10 transition-all"
                title="Open profile"
              >
                <div className="w-7 h-7 sm:w-9 sm:h-9 bg-paper/10 border border-white/15 rounded-xl sm:rounded-2xl flex items-center justify-center">
                  <FiUser className="text-brand-light h-3.5 w-3.5 sm:h-4.5 sm:w-4.5" />
                </div>
                <span className="hidden md:block text-xs font-medium text-dusk-soft mt-1 max-w-[100px] truncate">
                  {userEmail || 'User'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar Menu */}
      {mobileMenuOpen && (
      <div
        className="fixed inset-0 z-50 transition-all duration-300 pointer-events-auto"
      >
        <div
          className="absolute inset-0 bg-deep/45 backdrop-blur-[2px] transition-opacity duration-300 opacity-100"
          onClick={closeMobileMenu}
        />
        <aside
          className="absolute left-0 top-0 h-full w-[88vw] max-w-sm sm:max-w-md bg-deep text-paper shadow-2xl transition-transform duration-300 ease-out translate-x-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-full flex flex-col">
            <div className="px-4 sm:px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <Link to="/dashboard" onClick={closeMobileMenu} className="flex items-center gap-3 group">
                <BrandMark className="transition duration-300 group-hover:scale-105" />
                <div>
                  <p className="font-display text-sm font-semibold text-paper">AmarVote</p>
                  <p className="text-xs text-dusk">Secure navigation</p>
                </div>
              </Link>
              <button
                type="button"
                onClick={closeMobileMenu}
                className="p-2 rounded-xl text-dusk hover:text-paper hover:bg-paper/10"
                aria-label="Close menu"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5">
            <Link
              to="/dashboard"
              onClick={closeMobileMenu}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm sm:text-base font-medium ${isActiveRoute('/dashboard')
                  ? 'text-paper bg-brand/15'
                  : 'text-dusk-soft hover:text-paper hover:bg-paper/5 transition-all duration-300'
                }`}
            >
              <FiHome className="h-5 w-5" />
              <span>Dashboard</span>
            </Link>

            <Link
              to="/all-elections"
              onClick={closeMobileMenu}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm sm:text-base font-medium ${isActiveRoute('/all-elections')
                  ? 'text-paper bg-brand/15'
                  : 'text-dusk-soft hover:text-paper hover:bg-paper/5 transition-all duration-300'
                }`}
            >
              <FiBarChart2 className="h-5 w-5" />
              <span>All Elections</span>
            </Link>

            {canCreateElections ? (
              <Link
                to="/create-election"
                onClick={closeMobileMenu}
                className={`mt-2 mb-2 flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm sm:text-base font-medium shadow-md ${isActiveRoute('/create-election')
                    ? 'text-paper bg-brand-glow shadow-brand'
                    : 'text-paper bg-brand-dark hover:bg-brand'
                  }`}
              >
                <FiPlus className="h-5 w-5" />
                <span>Create Election</span>
              </Link>
            ) : null}

            {canManageAuthorizedUsers ? (
              <>
                <button
                  onClick={() => {
                    closeMobileMenu();
                    handleApiLogsAccess();
                  }}
                  className={`flex items-center space-x-3 w-full px-4 py-3 rounded-2xl text-sm sm:text-base font-medium ${isActiveRoute('/api-logs')
                      ? 'text-paper bg-brand/15'
                      : 'text-dusk-soft hover:text-paper hover:bg-paper/5 transition-all duration-300'
                    }`}
                >
                  <FiBarChart2 className="h-5 w-5" />
                  <span>API Logs</span>
                </button>

                <Link
                  to="/authenticated-users"
                  onClick={closeMobileMenu}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm sm:text-base font-medium ${isActiveRoute('/authenticated-users')
                      ? 'text-paper bg-brand/15'
                      : 'text-dusk-soft hover:text-paper hover:bg-paper/5 transition-all duration-300'
                    }`}
                >
                  <FiUsers className="h-5 w-5" />
                  <span>Authenticated Users</span>
                </Link>
              </>
            ) : null}

            <Link
              to="/profile"
              onClick={closeMobileMenu}
              className={`flex items-center space-x-3 px-4 py-3 rounded-2xl text-sm sm:text-base font-medium ${isActiveRoute('/profile')
                  ? 'text-paper bg-brand/15'
                  : 'text-dusk-soft hover:text-paper hover:bg-paper/5 transition-all duration-300'
                }`}
            >
              <FiUser className="h-5 w-5" />
              <span>Profile</span>
            </Link>

            <div className="pt-2" ref={notificationRef}>
              <button
                type="button"
                onClick={() => setShowGuardianAttention((prev) => !prev)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl text-sm sm:text-base font-medium text-dusk-soft hover:text-paper hover:bg-paper/5 transition-all duration-300"
              >
                <span className="flex items-center space-x-3">
                  <FiBell className="h-5 w-5" />
                  <span>Guardian Notifications</span>
                </span>
                {guardianAttentionItems.length > 0 ? (
                  <span className="bg-ember text-paper text-[10px] font-bold rounded-full px-2 py-0.5 min-w-[22px] text-center">
                    {guardianAttentionItems.length}
                  </span>
                ) : null}
              </button>

              {showGuardianAttention && (
                <div className="mt-2 mx-1 bg-frost border border-ink/10 rounded-2xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-ink/10">
                    <h4 className="text-sm font-semibold text-ink">Guardian Notifications</h4>
                    <p className="text-xs text-dusk mt-1">
                      Guardian in {allElections.filter((e) => e.userRoles?.includes('guardian')).length} election(s) · {guardianAttentionItems.length} need attention
                    </p>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {loadingGuardianAttention ? (
                      <div className="p-4 text-sm text-dusk">Loading...</div>
                    ) : guardianAttentionItems.length === 0 ? (
                      <div className="p-4 text-sm text-dusk">No pending guardian actions.</div>
                    ) : (
                      guardianAttentionItems.map((item, index) => (
                        <button
                          key={`${item.type}-${item.electionId}-${index}`}
                          onClick={() => {
                            setShowGuardianAttention(false);
                            closeMobileMenu();
                            navigate(`/election-page/${item.electionId}/guardian`);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-paper border-b border-ink/10 last:border-b-0"
                        >
                          <div className="text-sm font-medium text-ink truncate">{item.electionTitle}</div>
                          <div className="text-xs text-dusk mt-1">{item.detail}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            </div>

            <div className="p-3 border-t border-white/10 bg-deep-soft">
              <div className="px-3 pb-3">
                <p className="text-xs text-dusk">Signed in as</p>
                <p className="text-sm font-medium text-dusk-soft truncate">{userEmail || 'User'}</p>
              </div>
              <button
                onClick={() => {
                  handleLogout();
                  closeMobileMenu();
                }}
                className="flex items-center space-x-3 w-full px-4 py-3 rounded-2xl text-sm sm:text-base font-medium text-ember-soft hover:text-ember-soft hover:bg-ember/10 transition-all duration-300"
              >
                <FiLogOut className="h-5 w-5" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>
      </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto focus:outline-none">
        <div className={`${isWidePage ? "max-w-[min(1920px,99vw)]" : "max-w-7xl"} mx-auto ${isWidePage ? "px-2 sm:px-4 lg:px-5" : "px-3 sm:px-6 lg:px-8"} py-4 sm:py-8 mobile-bottom-pad`}>
          <Outlet />
        </div>
      </main>

      {!isElectionPage && (
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-deep/95 backdrop-blur-lg shadow-nav safe-pb">
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
                    ? 'bg-brand/20 text-paper'
                    : 'text-dusk hover:bg-paper/5 hover:text-paper'
                }`}
              >
                <Icon className="h-4 w-4 mb-1" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
      )}
    </div>
  );
};

export default AuthenticatedLayout;
