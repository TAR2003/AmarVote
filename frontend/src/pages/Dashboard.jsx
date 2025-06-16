import React from "react";
import {
  FiCalendar,
  FiCheckCircle,
  FiBarChart2,
  FiClock,
  FiAward,
} from "react-icons/fi";

const Dashboard = ({ userEmail }) => {
  // Mock data - replace with real data from your API
  const stats = [
    {
      name: "Upcoming Elections",
      value: "12",
      icon: FiCalendar,
      change: "+2",
      changeType: "positive",
    },
    {
      name: "Completed Votes",
      value: "34",
      icon: FiCheckCircle,
      change: "+8",
      changeType: "positive",
    },
    {
      name: "Participation Rate",
      value: "78%",
      icon: FiBarChart2,
      change: "+5%",
      changeType: "positive",
    },
    {
      name: "Pending Decisions",
      value: "5",
      icon: FiClock,
      change: "-3",
      changeType: "negative",
    },
  ];

  const recentElections = [
    {
      id: 1,
      title: "Student Council Election",
      date: "2023-05-15",
      status: "completed",
      voted: true,
    },
    {
      id: 2,
      title: "Annual Budget Approval",
      date: "2023-06-20",
      status: "ongoing",
      voted: false,
    },
    {
      id: 3,
      title: "New Policy Referendum",
      date: "2023-04-05",
      status: "upcoming",
      voted: false,
    },
  ];

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
                You have 3 active elections to participate in. Make your voice
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
                          : "text-red-600"
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
            {recentElections.filter((e) => e.status === "ongoing").length >
            0 ? (
              recentElections
                .filter((e) => e.status === "ongoing")
                .map((election) => (
                  <div
                    key={election.id}
                    className="p-4 hover:bg-gray-50 transition-colors duration-150"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-medium text-gray-900">
                          {election.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {new Date(election.date).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <button className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-full shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        {election.voted ? "View Results" : "Vote Now"}
                      </button>
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
            {recentElections.filter((e) => e.status === "completed").length >
            0 ? (
              recentElections
                .filter((e) => e.status === "completed")
                .map((election) => (
                  <div
                    key={election.id}
                    className="p-4 hover:bg-gray-50 transition-colors duration-150"
                  >
                    <div className="flex items-start">
                      <div
                        className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${
                          election.voted ? "bg-green-100" : "bg-gray-100"
                        }`}
                      >
                        {election.voted ? (
                          <FiCheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <FiClock className="h-5 w-5 text-gray-500" />
                        )}
                      </div>
                      <div className="ml-4">
                        <h3 className="text-base font-medium text-gray-900">
                          {election.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {election.voted
                            ? "You participated in this election"
                            : "You missed this election"}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          Ended on{" "}
                          {new Date(election.date).toLocaleDateString()}
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
          {recentElections.filter((e) => e.status === "upcoming").length > 0 ? (
            recentElections
              .filter((e) => e.status === "upcoming")
              .map((election) => (
                <div
                  key={election.id}
                  className="p-4 hover:bg-gray-50 transition-colors duration-150"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-medium text-gray-900">
                        {election.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Starts on{" "}
                        {new Date(election.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <button className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-full text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                      Set Reminder
                    </button>
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
