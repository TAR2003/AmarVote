import React from "react";


import { Link } from "react-router-dom";

function About() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Bar */}
      <nav className="fixed w-full bg-white shadow-sm z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <Link to="/" className="flex-shrink-0 flex items-center">
                <span className="text-2xl">🗳️</span>
                <span className="ml-2 text-xl font-bold text-gray-900">AmarVote</span>
              </Link>
            </div>
            <div className="hidden md:block">
              <div className="ml-10 flex items-center space-x-4">
                <Link to="/features" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">Features</Link>
                <Link to="/how-it-works" className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium">How It Works</Link>
                <Link to="/about" className="text-blue-600 px-3 py-2 rounded-md text-sm font-medium">About</Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login">
                <button className="px-4 py-2 text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50 transition">Sign In</button>
              </Link>
              <Link to="/signup">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-sm">Sign Up</button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-4xl font-extrabold text-blue-700 mb-6 text-center">About AmarVote</h1>
          <p className="text-lg text-gray-700 mb-8 text-center">
            <span className="font-bold text-blue-700">AmarVote</span> is a secure, modern, and modular e-voting platform designed for transparency, verifiability, and ease of use. Leveraging advanced cryptography and a microservices architecture, AmarVote delivers a robust, scalable, and user-friendly voting experience for all stakeholders.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-10">
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-100 shadow-sm">
              <h2 className="text-xl font-bold text-blue-700 mb-2 flex items-center"><span className="mr-2">🖥️</span> Frontend</h2>
              <p className="text-gray-700 text-sm mb-2">Built with React, the frontend offers an intuitive, responsive interface for voters, guardians, and administrators. It handles all user interactions, ballot casting, and result viewing, communicating securely with backend services via REST APIs.</p>
            </div>
            <div className="bg-green-50 rounded-lg p-6 border border-green-100 shadow-sm">
              <h2 className="text-xl font-bold text-green-700 mb-2 flex items-center"><span className="mr-2">🛡️</span> Backend</h2>
              <p className="text-gray-700 text-sm mb-2">Developed with Java Spring Boot, the backend manages authentication, election logic, and secure data storage. It orchestrates the entire system, integrating with both the frontend and Python microservices for seamless operations.</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-6 border border-purple-100 shadow-sm">
              <h2 className="text-xl font-bold text-purple-700 mb-2 flex items-center"><span className="mr-2">⚙️</span> Microservices</h2>
              <p className="text-gray-700 text-sm mb-2">Python-based microservices handle cryptographic operations (ElectionGuard), Retrieval-Augmented Generation (RAG) for documentation, and other support tasks. All services are containerized and orchestrated for scalability and maintainability.</p>
            </div>
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Key Features</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>End-to-end verifiable elections using ElectionGuard cryptography</li>
              <li>Role-based access for voters, guardians, and admins</li>
              <li>Real-time result tallying and auditability</li>
              <li>Retrieval-Augmented Generation (RAG) chatbot for user support and documentation search</li>
              <li>Modular, extensible, and cloud-ready architecture</li>
            </ul>
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Project Structure</h2>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-blue-100 rounded-lg p-4 text-center">
                <span className="block text-2xl mb-2">📁</span>
                <span className="font-semibold text-blue-700">frontend/</span>
                <p className="text-sm text-gray-700">React code for the user interface</p>
              </div>
              <div className="bg-green-100 rounded-lg p-4 text-center">
                <span className="block text-2xl mb-2">📁</span>
                <span className="font-semibold text-green-700">backend/</span>
                <p className="text-sm text-gray-700">Java Spring Boot backend logic</p>
              </div>
              <div className="bg-purple-100 rounded-lg p-4 text-center">
                <span className="block text-2xl mb-2">📁</span>
                <span className="font-semibold text-purple-700">microservice/</span>
                <p className="text-sm text-gray-700">Python microservices for cryptography and RAG</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-6 border border-gray-100 text-center">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Open Source & Community</h2>
            <p className="text-gray-700 text-sm">AmarVote is open source and welcomes contributions from the community. For more details, see the project documentation and guidelines in the repository.</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800">
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Product</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link to="/features" className="text-base text-gray-300 hover:text-white">Features</Link>
                </li>
                <li>
                  <Link to="/security" className="text-base text-gray-300 hover:text-white">Security</Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Resources</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link to="/documentation" className="text-base text-gray-300 hover:text-white">Documentation</Link>
                </li>
                <li>
                  <Link to="/faq" className="text-base text-gray-300 hover:text-white">FAQ</Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Company</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link to="/about" className="text-base text-gray-300 hover:text-white">About</Link>
                </li>
                <li>
                  <Link to="/contact" className="text-base text-gray-300 hover:text-white">Contact</Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Legal</h3>
              <ul className="mt-4 space-y-4">
                <li>
                  <Link to="/privacy" className="text-base text-gray-300 hover:text-white">Privacy</Link>
                </li>
                <li>
                  <Link to="/terms" className="text-base text-gray-300 hover:text-white">Terms</Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-700 pt-8 md:flex md:items-center md:justify-between">
            <div className="flex space-x-6 md:order-2">
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">Facebook</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="text-gray-400 hover:text-gray-300">
                <span className="sr-only">Twitter</span>
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
            </div>
            <p className="mt-8 text-base text-gray-400 md:mt-0 md:order-1">&copy; 2025 AmarVote. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default About;
