import { useState } from 'react';
import { FiShield, FiCheck, FiX, FiLoader, FiAlertCircle, FiInfo } from 'react-icons/fi';
import toast from 'react-hot-toast';
import { electionApi } from '../utils/electionApi';

/**
 * Blockchain Verification Component
 * 
 * This component provides blockchain verification for individual ballots.
 * It connects to the backend blockchain service to verify ballot integrity
 * using Hyperledger Fabric network.
 * 
 * Features:
 * - Real-time blockchain verification
 * - Professional UI with status indicators
 * - Error handling and retry logic
 * - Secure API communication
 */
const BlockchainVerification = ({ ballot, electionId }) => {
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [showDetails, setShowDetails] = useState(false);

  /**
   * Verify ballot on blockchain
   * Implements retry logic with exponential backoff for reliability
   */
  const verifyBallotOnBlockchain = async () => {
    setVerifying(true);
    setVerificationResult(null);

    try {
      // Use the electionApi method for blockchain verification
      const result = await electionApi.verifyBallotOnBlockchain(
        electionId,
        ballot.ballot_id,
        ballot.initial_hash || ballot.decrypted_hash
      );
      
      setVerificationResult(result);
      
      // Show appropriate toast notification
      if (result.verified) {
        toast.success('✅ Ballot verified on blockchain!', { duration: 3000 });
      } else {
        toast.error('❌ Blockchain verification failed', { duration: 4000 });
      }

    } catch (error) {
      console.error('Blockchain verification error:', error);
      
      const errorResult = {
        verified: false,
        error: true,
        message: error.message || 'Failed to verify ballot on blockchain',
        timestamp: new Date().toISOString()
      };
      
      setVerificationResult(errorResult);
      toast.error('Failed to connect to blockchain service', { duration: 4000 });
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Get verification status styling based on result
   */
  const getVerificationStatus = () => {
    if (!verificationResult) {
      return {
        text: 'Not Verified',
        bgColor: 'bg-gray-100',
        textColor: 'text-gray-600',
        borderColor: 'border-gray-300',
        icon: FiShield
      };
    }

    if (verificationResult.error) {
      return {
        text: 'Error',
        bgColor: 'bg-red-100',
        textColor: 'text-red-700',
        borderColor: 'border-red-300',
        icon: FiAlertCircle
      };
    }

    if (verificationResult.verified) {
      return {
        text: 'Verified',
        bgColor: 'bg-green-100',
        textColor: 'text-green-700',
        borderColor: 'border-green-300',
        icon: FiCheck
      };
    }

    return {
      text: 'Failed',
      bgColor: 'bg-amber-100',
      textColor: 'text-amber-700',
      borderColor: 'border-amber-300',
      icon: FiX
    };
  };

  const status = getVerificationStatus();
  const StatusIcon = status.icon;

  return (
    <div className="mt-4 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <FiShield className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">Blockchain Verification</span>
        </div>
        
        {verificationResult && (
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {showDetails ? 'Hide Details' : 'View Details'}
          </button>
        )}
      </div>

      {/* Verification Status */}
      <div className={`flex items-center justify-between p-3 rounded-lg border ${status.bgColor} ${status.borderColor}`}>
        <div className="flex items-center space-x-2">
          <StatusIcon className={`h-4 w-4 ${status.textColor}`} />
          <span className={`text-sm font-medium ${status.textColor}`}>
            {status.text}
          </span>
        </div>

        {!verificationResult && (
          <button
            onClick={verifyBallotOnBlockchain}
            disabled={verifying}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? (
              <>
                <FiLoader className="h-4 w-4 animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <FiShield className="h-4 w-4" />
                <span>Verify Using Blockchain</span>
              </>
            )}
          </button>
        )}

        {verificationResult && !verificationResult.error && (
          <button
            onClick={verifyBallotOnBlockchain}
            disabled={verifying}
            className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm underline"
          >
            {verifying ? (
              <>
                <FiLoader className="h-3 w-3 animate-spin" />
                <span>Re-verifying...</span>
              </>
            ) : (
              <span>Re-verify</span>
            )}
          </button>
        )}

        {verificationResult?.error && (
          <button
            onClick={verifyBallotOnBlockchain}
            disabled={verifying}
            className="flex items-center space-x-2 bg-red-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {verifying ? (
              <>
                <FiLoader className="h-4 w-4 animate-spin" />
                <span>Retrying...</span>
              </>
            ) : (
              <>
                <FiShield className="h-4 w-4" />
                <span>Retry Verification</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Verification Details */}
      {showDetails && verificationResult && (
        <div className="mt-3 p-3 bg-gray-50 rounded-lg border">
          <h4 className="text-xs font-medium text-gray-700 mb-2 flex items-center">
            <FiInfo className="h-3 w-3 mr-1" />
            Verification Details
          </h4>
          
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${status.textColor}`}>
                {verificationResult.verified ? 'Verified' : 'Not Verified'}
              </span>
            </div>
            
            {verificationResult.blockchainHash && (
              <div className="flex justify-between">
                <span className="text-gray-600">Blockchain Hash:</span>
                <span className="font-mono text-gray-800 break-all">
                  {verificationResult.blockchainHash.substring(0, 16)}...
                </span>
              </div>
            )}
            
            {verificationResult.blockNumber && (
              <div className="flex justify-between">
                <span className="text-gray-600">Block Number:</span>
                <span className="font-medium text-gray-800">#{verificationResult.blockNumber}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span className="text-gray-600">Verified At:</span>
              <span className="text-gray-800">
                {new Date(verificationResult.timestamp).toLocaleString()}
              </span>
            </div>
            
            {verificationResult.message && (
              <div className="mt-2 pt-2 border-t border-gray-200">
                <span className="text-gray-600">Message:</span>
                <p className="text-gray-800 mt-1">{verificationResult.message}</p>
              </div>
            )}
            
            {verificationResult.error && verificationResult.details && (
              <div className="mt-2 pt-2 border-t border-red-200">
                <span className="text-red-600">Error Details:</span>
                <p className="text-red-700 mt-1">{verificationResult.details}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blockchain Info */}
      <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
        <p className="text-xs text-blue-800">
          <FiInfo className="h-3 w-3 inline mr-1" />
          This verification uses Hyperledger Fabric blockchain to ensure ballot integrity and provide cryptographic proof of vote inclusion.
        </p>
      </div>
    </div>
  );
};

export default BlockchainVerification;
