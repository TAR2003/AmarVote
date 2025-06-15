import React from "react";
import { Link } from "react-router-dom";

const Home = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Navigation Bar */}
      <nav className="fixed w-full bg-white shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <span className="text-2xl">🗳️</span>
                <span className="ml-2 text-xl font-bold text-gray-900">
                  AmarVote
                </span>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-center space-x-4">
                <Link
                  to="/features"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Features
                </Link>
                <Link
                  to="/how-it-works"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  How It Works
                </Link>
                <Link
                  to="/about"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium"
                >
                  About
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login">
                <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition">
                  Sign In
                </button>
              </Link>
              <Link to="/signup">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-sm">
                  Sign Up
                </button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            <span className="block">Secure, Verifiable</span>
            <span className="block text-blue-600">Voting for Everyone</span>
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-600 mb-10">
            AmarVote leverages cutting-edge cryptography to ensure your vote is
            private, secure, and verifiable. Powered by ElectionGuard's
            end-to-end encryption and homomorphic tallying.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/signup">
              <button className="px-8 py-3 bg-blue-600 text-white text-lg rounded-lg shadow hover:bg-blue-700 transition transform hover:-translate-y-1">
                Start Voting Now
              </button>
            </Link>
            <Link to="/how-it-works">
              <button className="px-8 py-3 border border-gray-300 text-gray-700 text-lg rounded-lg hover:bg-gray-50 transition">
                Learn How It Works
              </button>
            </Link>
          </div>
        </div>

        {/* Hero Illustration */}
        <div className="mt-16 flex justify-center">
          <div className="relative w-full max-w-3xl">
            <div className="absolute inset-0 bg-blue-100 rounded-2xl transform rotate-1"></div>
            <div className="relative bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
              <div className="flex flex-col md:flex-row items-center">
                <div className="md:w-1/2 mb-6 md:mb-0">
                  <h3 className="text-2xl font-bold text-gray-900 mb-4">
                    Your Vote is Encrypted
                  </h3>
                  <p className="text-gray-600 mb-4">
                    ElectionGuard encrypts your ballot the moment you submit it,
                    ensuring complete privacy.
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start">
                      <span className="text-xl mr-2">🔒</span>
                      <span>End-to-end encryption</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-xl mr-2">👁️‍🗨️</span>
                      <span>No one can see your individual choices</span>
                    </li>
                  </ul>
                </div>
                <div className="md:w-1/2 flex justify-center">
                  <div className="bg-blue-50 p-6 rounded-lg border border-blue-100">
                    <div className="flex justify-between items-center mb-4">
                      <div className="bg-blue-100 p-2 rounded-full">
                        <span className="text-xl">🔑</span>
                      </div>
                      <div className="text-sm font-medium text-blue-600">
                        Encrypted Ballot
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-white p-3 rounded shadow-sm flex justify-between">
                        <span className="text-gray-700">Candidate A</span>
                        <span className="font-mono text-blue-600">#a3f2e9</span>
                      </div>
                      <div className="bg-white p-3 rounded shadow-sm flex justify-between">
                        <span className="text-gray-700">Candidate B</span>
                        <span className="font-mono text-blue-600">#7b2c9f</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
              Uncompromising Election Security
            </h2>
            <p className="mt-4 max-w-2xl text-xl text-gray-600 mx-auto">
              Powered by ElectionGuard's revolutionary cryptographic techniques
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="pt-6">
              <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8 h-full">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-blue-500 rounded-md shadow-lg text-white text-xl">
                      🛡️
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                    End-to-End Verifiable
                  </h3>
                  <p className="mt-5 text-base text-gray-600">
                    Verify that your vote was counted correctly without
                    revealing your choices. ElectionGuard provides cryptographic
                    proofs of proper tallying.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="pt-6">
              <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8 h-full">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-green-500 rounded-md shadow-lg text-white text-xl">
                      📊
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                    Homomorphic Tallying
                  </h3>
                  <p className="mt-5 text-base text-gray-600">
                    Votes are counted without ever being decrypted, preserving
                    voter privacy while ensuring accurate results.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="pt-6">
              <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8 h-full">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-purple-500 rounded-md shadow-lg text-white text-xl">
                      💾
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                    Tamper-Proof Records
                  </h3>
                  <p className="mt-5 text-base text-gray-600">
                    All ballots are cryptographically sealed and recorded on
                    multiple independent systems to prevent manipulation.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="pt-6">
              <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8 h-full">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-red-500 rounded-md shadow-lg text-white text-xl">
                      🔔
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                    Real-Time Auditing
                  </h3>
                  <p className="mt-5 text-base text-gray-600">
                    Independent observers can monitor the election process in
                    real-time and verify results.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="pt-6">
              <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8 h-full">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-yellow-500 rounded-md shadow-lg text-white text-xl">
                      👤
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                    Voter Privacy
                  </h3>
                  <p className="mt-5 text-base text-gray-600">
                    Your identity is never connected to your ballot choices,
                    ensuring complete anonymity.
                  </p>
                </div>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="pt-6">
              <div className="flow-root bg-gray-50 rounded-lg px-6 pb-8 h-full">
                <div className="-mt-6">
                  <div>
                    <span className="inline-flex items-center justify-center p-3 bg-indigo-500 rounded-md shadow-lg text-white text-xl">
                      🔐
                    </span>
                  </div>
                  <h3 className="mt-8 text-lg font-medium text-gray-900 tracking-tight">
                    Multiple Encryption Layers
                  </h3>
                  <p className="mt-5 text-base text-gray-600">
                    Ballots are protected by multiple layers of encryption, with
                    keys held by separate trustees.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-blue-700">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:py-16 lg:px-8 lg:flex lg:items-center lg:justify-between">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            <span className="block">Ready to experience secure voting?</span>
            <span className="block text-blue-200">Sign up for free today.</span>
          </h2>
          <div className="mt-8 flex lg:mt-0 lg:flex-shrink-0">
            <div className="inline-flex rounded-md shadow">
              <Link to="/signup">
                <button className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-blue-700 bg-white hover:bg-blue-50 transition">
                  Get Started
                </button>
              </Link>
            </div>
            <div className="ml-3 inline-flex rounded-md shadow">
              <Link to="/how-it-works">
                <button className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition">
                  Learn More
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                Product
              </h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link
                    to="/features"
                    className="text-base text-gray-300 hover:text-white"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    to="/security"
                    className="text-base text-gray-300 hover:text-white"
                  >
                    Security
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                Resources
              </h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link
                    to="/documentation"
                    className="text-base text-gray-300 hover:text-white"
                  >
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link
                    to="/faq"
                    className="text-base text-gray-300 hover:text-white"
                  >
                    FAQ
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                Company
              </h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link
                    to="/about"
                    className="text-base text-gray-300 hover:text-white"
                  >
                    About
                  </Link>
                </li>
                <li>
                  <Link
                    to="/contact"
                    className="text-base text-gray-300 hover:text-white"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">
                Legal
              </h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link
                    to="/privacy"
                    className="text-base text-gray-300 hover:text-white"
                  >
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link
                    to="/terms"
                    className="text-base text-gray-300 hover:text-white"
                  >
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-700 pt-8 md:flex md:items-center md:justify-between">
            <div className="flex space-x-6 md:order-2">
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">Facebook</span>
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">Twitter</span>
                <svg
                  className="h-6 w-6"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
            </div>
            <p className="mt-8 text-base text-gray-400 md:mt-0 md:order-1">
              &copy; 2023 AmarVote. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;
