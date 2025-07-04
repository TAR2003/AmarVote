import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { electionApi } from "../utils/electionApi";
import { FiCalendar, FiClock, FiUsers, FiInfo } from "react-icons/fi";

const AllElections = () => {
  const navigate = useNavigate();
  const [elections, setElections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all"); // all, upcoming, ongoing, completed, public, private, voter, admin, guardian

  useEffect(() => {
    const loadElections = async () => {
      try {
        setLoading(true);
        const electionData = await electionApi.getAllElections();
        setElections(electionData);
      } catch (err) {
        setError(err.message);
        console.error("Error loading elections:", err);
      } finally {
        setLoading(false);
      }
    };

    loadElections();
  }, []);

  // Handle navigation to election page
  const handleElectionClick = (electionId) => {
    navigate(`/election-page/${electionId}`);
  };

  // Filter elections based on status or user role
  const getFilteredElections = () => {
    const now = new Date();
    
    // First filter by user role if specified
    let filtered = elections;
    if (["voter", "admin", "guardian"].includes(filter)) {
      filtered = elections.filter((election) => {
        if (filter === "voter") {
          // User can vote if they are explicitly listed as voter OR if election is public
          return (election.userRoles && election.userRoles.includes(filter)) || election.isPublic;
        } else {
          // For admin and guardian, check explicit roles only
          return election.userRoles && election.userRoles.includes(filter);
        }
      });
    }
    
    // Filter by public/private if specified
    if (filter === "public") {
      filtered = elections.filter((election) => election.isPublic === true);
    } else if (filter === "private") {
      filtered = elections.filter((election) => election.isPublic === false);
    }
    
    // Then filter by time-based status
    switch (filter) {
      case "upcoming":
        return filtered.filter((e) => new Date(e.startingTime) > now);
      case "ongoing":
        return filtered.filter(
          (e) => new Date(e.startingTime) <= now && new Date(e.endingTime) > now
        );
      case "completed":
        return filtered.filter((e) => new Date(e.endingTime) <= now);
      default:
        return filtered;
    }
  };

  const filteredElections = getFilteredElections();

  const getElectionStatus = (election) => {
    const now = new Date();
    const startTime = new Date(election.startingTime);
    const endTime = new Date(election.endingTime);

    if (startTime > now) return "upcoming";
    if (startTime <= now && endTime > now) return "ongoing";
    return "completed";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "upcoming":
        return "bg-blue-100 text-blue-800";
      case "ongoing":
        return "bg-green-100 text-green-800";
      case "completed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-4"></div>
            <div className="h-4 bg-gray-300 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-300 rounded"></div>
              ))}
            </div>
          </div>
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
              <FiInfo className="h-5 w-5 text-red-400" />
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
      {/* Header */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900">All Elections</h1>
          <p className="mt-1 text-sm text-gray-500">
            View and participate in all elections you have access to
          </p>
        </div>
        
        {/* Filter tabs */}
        <div className="px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "All Elections", count: elections.length },
              { key: "upcoming", label: "Upcoming", count: elections.filter(e => new Date(e.startingTime) > new Date()).length },
              { key: "ongoing", label: "Ongoing", count: elections.filter(e => new Date(e.startingTime) <= new Date() && new Date(e.endingTime) > new Date()).length },
              { key: "completed", label: "Completed", count: elections.filter(e => new Date(e.endingTime) <= new Date()).length },
              { key: "public", label: "Public", count: elections.filter(e => e.isPublic === true).length },
              { key: "private", label: "Private", count: elections.filter(e => e.isPublic === false).length },
              { key: "voter", label: "As Voter", count: elections.filter(e => (e.userRoles?.includes('voter')) || e.isPublic).length },
              { key: "admin", label: "As Admin", count: elections.filter(e => e.userRoles?.includes('admin')).length },
              { key: "guardian", label: "As Guardian", count: elections.filter(e => e.userRoles?.includes('guardian')).length },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === tab.key
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tab.label}
                <span className="ml-2 bg-white bg-opacity-20 text-current py-0.5 px-2 rounded-full text-xs">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Elections List */}
      <div className="bg-white shadow rounded-lg">
        <div className="divide-y divide-gray-200">
          {filteredElections.length > 0 ? (
            filteredElections.map((election) => {
              const status = getElectionStatus(election);
              return (
                <div
                  key={election.electionId}
                  className="p-6 hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
                  onClick={() => handleElectionClick(election.electionId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <h3 className="text-lg font-medium text-gray-900">
                          {election.electionTitle}
                        </h3>
                        <span
                          className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            status
                          )}`}
                        >
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                        {/* Public/Private Indicator */}
                        <span
                          className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            election.isPublic 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-orange-100 text-orange-800'
                          }`}
                        >
                          {election.isPublic ? 'Public' : 'Private'}
                        </span>
                      </div>
                      
                      <p className="mt-1 text-sm text-gray-500">
                        {election.electionDescription}
                      </p>

                      {/* User Roles */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {election.userRoles && election.userRoles.length > 0 && election.userRoles.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Eligible Voter (Public)
                          </span>
                        )}
                      </div>
                      
                      <div className="mt-4 flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center">
                          <FiCalendar className="h-4 w-4 mr-1" />
                          <span>
                            {new Date(election.startingTime).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <FiClock className="h-4 w-4 mr-1" />
                          <span>
                            Ends: {new Date(election.endingTime).toLocaleDateString("en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <FiUsers className="h-4 w-4 mr-1" />
                          <span>{election.noOfCandidates} candidates</span>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-xs text-gray-400">
                        Admin: {election.adminName ? `${election.adminName} (${election.adminEmail})` : election.adminEmail}
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 ml-4">
                      {status === "ongoing" && (
                        <button 
                          className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                            election.hasVoted 
                              ? 'text-gray-700 bg-gray-200 cursor-not-allowed'
                              : ((election.userRoles?.includes('voter') || election.isPublic) 
                                  ? 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' 
                                  : 'text-gray-700 bg-gray-200 hover:bg-gray-300 focus:ring-gray-500')
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleElectionClick(election.electionId);
                          }}
                          disabled={election.hasVoted && ((election.userRoles?.includes('voter') || election.isPublic))}
                        >
                          {/* Show Vote Now only if user is eligible and hasn't voted yet */}
                          {((election.userRoles?.includes('voter') || election.isPublic) && !election.hasVoted) ? 'Vote Now' : 
                           election.hasVoted ? 'Already Voted' : 'View Election'}
                        </button>
                      )}
                      {status === "upcoming" && (
                        <button 
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Set reminder functionality can be added here
                          }}
                        >
                          Set Reminder
                        </button>
                      )}
                      {status === "completed" && (
                        <button 
                          className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleElectionClick(election.electionId);
                          }}
                        >
                          View Results
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <FiCalendar className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No elections found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {filter === "all"
                  ? "You don't have access to any elections at the moment."
                  : `No ${filter} elections found.`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AllElections;
