import React from "react";
import Layout from "./Layout";

function Features() {
  return (
    <Layout>
      <div className="min-h-screen bg-gray-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-lg p-8">
          <h1 className="text-4xl font-extrabold text-blue-700 mb-8 text-center">Features</h1>
          <div className="grid md:grid-cols-2 gap-8 mb-10">
            <div className="bg-blue-50 rounded-lg p-6 border border-blue-100 shadow-sm">
              <h2 className="text-xl font-bold text-blue-700 mb-2 flex items-center"><span className="mr-2">🔒</span> Secure & Verifiable Voting</h2>
              <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                <li>Implements <span className="font-semibold">ElectionGuard</span> cryptographic protocols for end-to-end verifiability</li>
                <li>Ballot encryption, guardian key ceremonies, and quorum-based decryption ensure privacy and integrity</li>
                <li>Audit trails and public verification for all election processes</li>
              </ul>
            </div>
            <div className="bg-green-50 rounded-lg p-6 border border-green-100 shadow-sm">
              <h2 className="text-xl font-bold text-green-700 mb-2 flex items-center"><span className="mr-2">🖥️</span> Modern Frontend (React)</h2>
              <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                <li>Responsive, accessible UI for voters, guardians, and admins</li>
                <li>Role-based dashboards and workflows</li>
                <li>Real-time updates and status indicators</li>
              </ul>
            </div>
            <div className="bg-purple-50 rounded-lg p-6 border border-purple-100 shadow-sm">
              <h2 className="text-xl font-bold text-purple-700 mb-2 flex items-center"><span className="mr-2">🛡️</span> Robust Backend (Spring Boot)</h2>
              <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                <li>Handles authentication, election management, and secure data storage</li>
                <li>Integrates with microservices for cryptographic operations and RAG support</li>
                <li>RESTful APIs for seamless frontend-backend communication</li>
              </ul>
            </div>
            <div className="bg-pink-50 rounded-lg p-6 border border-pink-100 shadow-sm">
              <h2 className="text-xl font-bold text-pink-700 mb-2 flex items-center"><span className="mr-2">⚙️</span> Python Microservices</h2>
              <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                <li><span className="font-semibold">ElectionGuard Microservice:</span> Cryptographic operations, ballot processing, and guardian management. Frontend only deals with simple data types for security.</li>
                <li><span className="font-semibold">RAG Service:</span> Retrieval-Augmented Generation for documentation and user support. Processes PDFs/Markdown, uses ChromaDB for semantic search, exposes REST APIs.</li>
              </ul>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mb-10">
            <div className="bg-yellow-50 rounded-lg p-6 border border-yellow-100 shadow-sm">
              <h2 className="text-xl font-bold text-yellow-700 mb-2 flex items-center"><span className="mr-2">📦</span> Containerized Deployment</h2>
              <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                <li>All components containerized with Docker, orchestrated via Docker Compose</li>
                <li>Easy to build, run, and scale the system with simple commands</li>
              </ul>
            </div>
            <div className="bg-indigo-50 rounded-lg p-6 border border-indigo-100 shadow-sm">
              <h2 className="text-xl font-bold text-indigo-700 mb-2 flex items-center"><span className="mr-2">🧩</span> Extensible & Maintainable</h2>
              <ul className="list-disc list-inside text-gray-700 text-sm space-y-1">
                <li>Clear separation of concerns between frontend, backend, and microservices</li>
                <li>Modular codebase for easy feature addition and maintenance</li>
                <li>Comprehensive logging, error handling, and testing recommendations</li>
              </ul>
            </div>
          </div>

          <div className="bg-blue-700 rounded-xl p-8 text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">Documentation & Support</h2>
            <ul className="list-disc list-inside text-blue-100 text-base space-y-2 mx-auto max-w-xl text-left">
              <li>Integrated RAG chatbot for instant answers from technical and user documentation</li>
              <li>Detailed guides for setup, usage, and troubleshooting</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default Features;
