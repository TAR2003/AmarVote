import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FiCalendar,
  FiCheckCircle,
  FiBarChart2,
  FiClock,
  FiAward,
} from "react-icons/fi";
import { fetchAllElections } from "../utils/api";

const Dashboard = ({ userEmail }) => {
  const navigate = useNavigate();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadElections = async () => {
      try {
        setLoading(true);
        const electionData = await fetchAllElections();
        setElections(electionData);
      } catch (err) {
        setError(err.message);
        console.error("Error loading elections:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userEmail) {
      loadElections();
    }
  }, [userEmail]);

  // Handle navigation to election page
  const handleElectionClick = (electionId) => {
    navigate(`/election-page/${electionId}`);
  };

  // Calculate stats from real data
  const calculateStats = () => {
    const now = new Date();
    const upcomingElections = elections.filter(
      (e) => new Date(e.startingTime) > now
    );
    const ongoingElections = elections.filter(
      (e) => new Date(e.startingTime) <= now && new Date(e.endingTime) > now
    );
    const completedElections = elections.filter(
      (e) => new Date(e.endingTime) <= now
    );

    return [
      {
        name: "Upcoming Elections",
        value: upcomingElections.length.toString(),
        icon: FiCalendar,
        change: "+2",
        changeType: "positive",
      },
      {
        name: "Available Elections",
        value: ongoingElections.length.toString(),
        icon: FiCheckCircle,
        change: "+1",
        changeType: "positive",
      },
      {
        name: "Total Elections",
        value: elections.length.toString(),
        icon: FiBarChart2,
        change: `+${elections.length}`,
        changeType: "positive",
      },
      {
        name: "Completed",
        value: completedElections.length.toString(),
        icon: FiClock,
        change: "0",
        changeType: "neutral",
      },
    ];
  };

  const stats = calculateStats();

  // Categorize elections by status
  const categorizeElections = () => {
    const now = new Date();
    const upcoming = elections.filter(
      (e) => new Date(e.startingTime) > now
    );
    const ongoing = elections.filter(
      (e) => new Date(e.startingTime) <= now && new Date(e.endingTime) > now
    );
    const completed = elections.filter(
      (e) => new Date(e.endingTime) <= now
    );

    return { upcoming, ongoing, completed };
  };

  const { upcoming, ongoing, completed } = categorizeElections();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-8 sm:p-10">
            <div className="animate-pulse">
              <div className="h-8 bg-blue-500 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-blue-400 rounded w-2/3"></div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white shadow rounded-xl p-5">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-300 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-300 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiClock className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading elections
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl shadow-lg overflow-hidden">
        <div className="px-6 py-8 sm:p-10">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                Welcome back, {userEmail.split("@")[0]}!
              </h1>
              <p className="mt-2 text-blue-100 max-w-lg">
                You have {ongoing.length} active elections to participate in. Make your voice
                heard!
              </p>
            </div>
            <div className="hidden sm:block">
              <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <FiAward className="text-white text-2xl" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white overflow-hidden shadow rounded-xl hover:shadow-md transition-shadow duration-200"
          >
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    {stat.name}
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-2xl font-semibold text-gray-900">
                      {stat.value}
                    </div>
                    <div
                      className={`ml-2 flex items-baseline text-sm font-semibold ${
                        stat.changeType === "positive"
                          ? "text-green-600"
                          : stat.changeType === "negative"
                          ? "text-red-600"
                          : "text-gray-500"
                      }`}
                    >
                      {stat.change}
                    </div>
                  </dd>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Elections Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Available Elections */}
        <div className="bg-white shadow rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Available Elections
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Elections you can currently participate in
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {ongoing.length > 0 ? (
              ongoing.map((election) => (
                <div
                  key={election.electionId}
                  className="p-4 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  onClick={() => handleElectionClick(election.electionId)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-base font-medium text-gray-900">
                          {election.electionTitle}
                        </h3>
                        {/* Public/Private Indicator */}
                        <span
                          className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            election.isPublic 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {election.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-500 mt-1">
                        {election.electionDescription}
                      </p>

                      {/* User Roles */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              role === 'admin' ? 'bg-red-100 text-red-800' :
                              role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                              'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </span>
                        ))}
                        {/* Show eligible voter status for public elections */}
                        {election.isPublic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Eligible Voter (Public)
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-400">
                        Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-1">
                        Ends: {new Date(election.endingTime).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <div className="flex-shrink-0 ml-4">
                      <button 
                        className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleElectionClick(election.electionId);
                        }}
                      >
                        {(election.userRoles?.includes('voter') || election.isPublic) ? 'Vote Now' : 'View Election'}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-500">
                  No available elections at this time
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white shadow rounded-xl overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Recent Activity
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Your recent voting participation
            </p>
          </div>
          <div className="divide-y divide-gray-200">
            {completed.length > 0 ? (
              completed.map((election) => (
                <div
                  key={election.electionId}
                  className="p-4 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  onClick={() => handleElectionClick(election.electionId)}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-green-100">
                      <FiCheckCircle className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="ml-4 flex-1">
                      <div className="flex items-center">
                        <h3 className="text-base font-medium text-gray-900">
                          {election.electionTitle}
                        </h3>
                        {/* Public/Private Indicator */}
                        <span
                          className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            election.isPublic 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {election.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-500 mt-1">
                        {election.electionDescription}
                      </p>

                      {/* User Roles */}
                      <div className="mt-2 flex flex-wrap gap-1">
                        {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              role === 'admin' ? 'bg-red-100 text-red-800' :
                              role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                              'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </span>
                        ))}
                        {/* Show eligible voter status for public elections */}
                        {election.isPublic && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Eligible Voter (Public)
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-400">
                        Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
                      </div>
                      
                      <p className="text-xs text-gray-400 mt-1">
                        Ended on {new Date(election.endingTime).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center">
                <p className="text-gray-500">No recent activity to display</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upcoming Elections */}
      <div className="bg-white shadow rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Upcoming Elections
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Mark your calendar for these important dates
          </p>
        </div>
        <div className="divide-y divide-gray-200">
          {upcoming.length > 0 ? (
            upcoming.map((election) => (
              <div
                key={election.electionId}
                className="p-4 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                onClick={() => handleElectionClick(election.electionId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <h3 className="text-base font-medium text-gray-900">
                        {election.electionTitle}
                      </h3>
                      {/* Public/Private Indicator */}
                      <span
                        className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          election.isPublic 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {election.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                    
                    <p className="text-sm text-gray-500 mt-1">
                      {election.electionDescription}
                    </p>

                    {/* User Roles */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
                        <span
                          key={role}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            role === 'admin' ? 'bg-red-100 text-red-800' :
                            role === 'guardian' ? 'bg-purple-100 text-purple-800' :
                            'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </span>
                      ))}
                      {/* Show eligible voter status for public elections */}
                      {election.isPublic && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Eligible Voter (Public)
                        </span>
                      )}
                    </div>
                    
                    <div className="mt-2 text-xs text-gray-400">
                      Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
                    </div>
                    
                    <p className="text-xs text-gray-400 mt-1">
                      Starts on {new Date(election.startingTime).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <button 
                      className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Set reminder functionality can be added here
                      }}
                    >
                      Set Reminder
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-500">No upcoming elections scheduled</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
