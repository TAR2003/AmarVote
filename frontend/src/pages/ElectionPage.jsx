import React, { useState } from 'react';
import { useParams } from 'react-router-dom';

const subMenus = [
  { name: 'Voting Booth', key: 'voting' },
  { name: 'Guardian Key Submission', key: 'guardian' },
  { name: 'Election Results', key: 'results' },
  { name: 'Election Result Verification', key: 'verification' },
];

const candidates = [
  'Candidate 1',
  'Candidate 2',
  'Candidate 3',
];

export default function ElectionPage() {
  const { id } = useParams(); // Assuming you are using react-router-dom for routing
  const [activeTab, setActiveTab] = useState('voting');
  const [selectedCandidate, setSelectedCandidate] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleVoteSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
    // TODO: handle vote submission logic
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <h2 className="text-xl font-semibold mb-4">Election ID: {id}</h2>
      {/* Layout Header */}
      <header className="bg-blue-700 text-white p-4 shadow">
        <h1 className="text-2xl font-bold">Election Page</h1>
      </header>
      <div className="flex flex-col md:flex-row max-w-4xl mx-auto mt-8 bg-white rounded shadow-lg overflow-hidden">
        {/* Sidebar Menu */}
        <aside className="md:w-1/4 border-b md:border-b-0 md:border-r bg-gray-100">
          <nav className="flex md:flex-col">
            {subMenus.map((menu) => (
              <button
                key={menu.key}
                className={`w-full px-4 py-3 text-left hover:bg-blue-100 focus:outline-none transition ${activeTab === menu.key ? 'bg-blue-200 font-semibold' : ''}`}
                onClick={() => setActiveTab(menu.key)}
              >
                {menu.name}
              </button>
            ))}
          </nav>
        </aside>
        {/* Main Content */}
        <main className="flex-1 p-6">
          {activeTab === 'voting' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Voting Booth</h2>
              {submitted ? (
                <div className="p-4 bg-green-100 rounded">Thank you for voting!</div>
              ) : (
                <form onSubmit={handleVoteSubmit} className="space-y-4">
                  <label className="block text-gray-700 font-medium mb-2">Select a candidate:</label>
                  <select
                    className="w-full border rounded px-3 py-2"
                    value={selectedCandidate}
                    onChange={(e) => setSelectedCandidate(e.target.value)}
                    required
                  >
                    <option value="" disabled>Select...</option>
                    {candidates.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
                  >
                    Submit Vote
                  </button>
                </form>
              )}
            </div>
          )}
          {activeTab === 'guardian' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Guardian Key Submission</h2>
              <p>Guardian key submission form goes here.</p>
            </div>
          )}
          {activeTab === 'results' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Election Results</h2>
              <p>Election results will be displayed here.</p>
            </div>
          )}
          {activeTab === 'verification' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">Election Result Verification</h2>
              <p>Verification details will be shown here.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
