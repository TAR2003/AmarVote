import React from "react";
import { Link } from "react-router-dom";
import Layout from "./Layout";

const HowItWorks = () => {
  return (
    <Layout>
      {/* Main Content */}
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-4">
            How AmarVote Works
          </h1>
          <p className="max-w-2xl mx-auto text-xl text-gray-600">
            A step-by-step guide to our secure voting process powered by
            ElectionGuard's cryptographic technology
          </p>
        </div>

        {/* Process Steps */}
        <div className="max-w-3xl mx-auto">
          {/* Step 1 */}
          <div className="mb-16">
            <div className="flex items-start">
              <div className="flex-shrink-0 bg-blue-100 rounded-full p-3 mr-4">
                <span className="text-2xl text-blue-700">1</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Voter Authentication
                </h2>
                <p className="text-gray-600 mb-4">
                  Before you can vote, we verify your identity to ensure only
                  eligible voters participate. This is done through secure
                  government-issued ID verification or pre-registered
                  credentials.
                </p>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <div className="flex">
                    <span className="text-blue-500 mr-2">🔐</span>
                    <p className="text-sm text-gray-700">
                      <strong>Security Note:</strong> Your identity is never
                      connected to your ballot choices. Authentication only
                      confirms your eligibility to vote.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 */}
          <div className="mb-16">
            <div className="flex items-start">
              <div className="flex-shrink-0 bg-blue-100 rounded-full p-3 mr-4">
                <span className="text-2xl text-blue-700">2</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Ballot Preparation
                </h2>
                <p className="text-gray-600 mb-4">
                  You'll receive a digital ballot with all the candidates and
                  measures for your specific voting district. The ballot is
                  generated uniquely for you with encrypted tracking
                  information.
                </p>
                <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
                  <div className="flex items-center mb-2">
                    <span className="text-gray-500 mr-2">📝</span>
                    <h4 className="font-medium text-gray-800">
                      Sample Ballot Preview
                    </h4>
                  </div>
                  <div className="space-y-3">
                    <div className="p-3 border border-gray-200 rounded">
                      <h5 className="font-medium mb-2">President</h5>
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <input type="radio" className="mr-2" disabled />
                          <span>Candidate A (Democratic Party)</span>
                        </div>
                        <div className="flex items-center">
                          <input type="radio" className="mr-2" disabled />
                          <span>Candidate B (Republican Party)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="mb-16">
            <div className="flex items-start">
              <div className="flex-shrink-0 bg-blue-100 rounded-full p-3 mr-4">
                <span className="text-2xl text-blue-700">3</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Vote Encryption
                </h2>
                <p className="text-gray-600 mb-4">
                  When you submit your ballot, ElectionGuard immediately
                  encrypts your choices using advanced cryptographic techniques.
                  This happens before your ballot leaves your device.
                </p>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <div className="flex flex-col md:flex-row items-center">
                    <div className="md:w-1/2 mb-4 md:mb-0">
                      <h4 className="font-medium text-gray-800 mb-2">
                        Before Encryption
                      </h4>
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <div className="font-mono text-sm">
                          <p>President: Candidate A</p>
                          <p>Proposition 1: Yes</p>
                        </div>
                      </div>
                    </div>
                    <div className="md:w-1/2">
                      <h4 className="font-medium text-gray-800 mb-2">
                        After Encryption
                      </h4>
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <div className="font-mono text-sm text-blue-600">
                          <p>a3f2e97b2c9f4a1d...</p>
                          <p>8e4c2a7f5b9d3e1f...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 text-sm text-gray-600">
                    <span className="text-blue-500 mr-1">ℹ️</span> Your actual
                    encrypted data is much longer and more complex than shown
                    here
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="mb-16">
            <div className="flex items-start">
              <div className="flex-shrink-0 bg-blue-100 rounded-full p-3 mr-4">
                <span className="text-2xl text-blue-700">4</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Homomorphic Tallying
                </h2>
                <p className="text-gray-600 mb-4">
                  All encrypted ballots are combined and counted without ever
                  being decrypted. This revolutionary approach preserves voter
                  privacy while ensuring accurate results.
                </p>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                  <div className="flex items-center mb-2">
                    <span className="text-purple-600 mr-2">🧮</span>
                    <h4 className="font-medium text-purple-800">
                      How It Works
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="bg-white p-2 rounded border border-purple-100">
                      <div className="font-mono mb-1">a3f2 + 7b2c</div>
                      <div className="text-xs text-gray-500">
                        Encrypted Vote 1 + Vote 2
                      </div>
                    </div>
                    <div className="bg-white p-2 rounded border border-purple-100">
                      <div className="text-xl">=</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-purple-100">
                      <div className="font-mono mb-1">1e4e</div>
                      <div className="text-xs text-gray-500">
                        Encrypted Total
                      </div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-purple-700">
                    The system can calculate totals while all votes remain
                    encrypted throughout the entire process.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="mb-16">
            <div className="flex items-start">
              <div className="flex-shrink-0 bg-blue-100 rounded-full p-3 mr-4">
                <span className="text-2xl text-blue-700">5</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Verification & Results
                </h2>
                <p className="text-gray-600 mb-4">
                  After the election closes, the results are decrypted and
                  published. You can verify your vote was counted correctly
                  using your unique tracking code.
                </p>
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="flex">
                    <span className="text-green-600 mr-2">✅</span>
                    <div>
                      <h4 className="font-medium text-green-800 mb-1">
                        Verification Process
                      </h4>
                      <ul className="list-disc list-inside text-sm text-green-700 space-y-1">
                        <li>Receive a unique tracking code when you vote</li>
                        <li>After election closes, check the public ledger</li>
                        <li>
                          Confirm your encrypted ballot is included in the tally
                        </li>
                        <li>
                          Verify the cryptographic proofs of correct tallying
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="bg-blue-700 rounded-xl p-8 text-center">
            <h2 className="text-2xl font-bold text-white mb-4">
              Ready to experience secure voting?
            </h2>
            <p className="text-blue-100 mb-6">
              Join thousands of voters who trust AmarVote for verifiable,
              private elections.
            </p>
            <Link to="/otp-login">
              <button className="px-8 py-3 bg-white text-blue-700 rounded-lg font-medium hover:bg-blue-50 transition">
                Sign Up Now
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                How is my privacy protected?
              </h3>
              <p className="text-gray-600">
                Your identity is never connected to your ballot choices. The
                encryption process ensures that while we can verify you voted
                (preventing double voting), no one can determine how you voted.
                Even the election administrators cannot see your individual
                choices.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                What if I make a mistake on my ballot?
              </h3>
              <p className="text-gray-600">
                Before final submission, you'll have a chance to review your
                selections. Once submitted, ballots cannot be changed to prevent
                coercion. This is a standard security practice in all voting
                systems.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                How do I know my vote was counted?
              </h3>
              <p className="text-gray-600">
                You'll receive a unique tracking code after voting. After the
                election, you can use this code to verify your encrypted ballot
                was included in the final tally without revealing your choices.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                What prevents hacking or tampering?
              </h3>
              <p className="text-gray-600">
                Multiple safeguards: end-to-end encryption, paper audit trails,
                cryptographic proofs, and distributed verification. Even if one
                system were compromised, the others would detect
                inconsistencies.
              </p>
            </div>

            <div className="pb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Can I vote from my mobile device?
              </h3>
              <p className="text-gray-600">
                Yes! AmarVote is fully responsive and works on smartphones,
                tablets, and computers. However, for the highest security
                elections, we may require additional identity verification
                steps.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default HowItWorks;
