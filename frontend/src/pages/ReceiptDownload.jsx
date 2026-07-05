import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

function parseFilename(contentDisposition) {
  if (!contentDisposition) {
    return 'vote_receipt.txt';
  }

  const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return utf8Match[1];
    }
  }

  const plainMatch = /filename="([^"]+)"/i.exec(contentDisposition);
  return plainMatch?.[1] || 'vote_receipt.txt';
}

export default function ReceiptDownload() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Preparing your receipt download...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('This receipt link is missing its security token.');
      return;
    }

    let cancelled = false;

    async function downloadReceipt() {
      try {
        const response = await fetch(
          `/api/receipt/download?token=${encodeURIComponent(token)}`,
          {
            method: 'GET',
            credentials: 'omit',
            redirect: 'manual',
            headers: { Accept: 'application/octet-stream' },
          },
        );

        if (response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400)) {
          throw new Error('Unexpected redirect while downloading receipt.');
        }

        if (!response.ok) {
          throw new Error(
            response.status === 403
              ? 'This receipt link is invalid or has expired.'
              : response.status === 404
                ? 'Receipt not found.'
                : 'Unable to download receipt right now.',
          );
        }

        const contentType = response.headers.get('Content-Type') || '';
        if (contentType.includes('text/html')) {
          throw new Error('Received an invalid receipt response. Please try the link again.');
        }

        const blob = await response.blob();
        const filename = parseFilename(response.headers.get('Content-Disposition'));

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = filename;
        anchor.rel = 'noopener';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(objectUrl);

        if (!cancelled) {
          setStatus('success');
          setMessage('Your receipt download started. You can close this tab.');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage(err.message || 'Unable to download receipt.');
        }
      }
    }

    downloadReceipt();

    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-xl shadow p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900 mb-3">AmarVote Receipt</h1>
        <p
          className={`text-sm ${
            status === 'error' ? 'text-red-600' : status === 'success' ? 'text-green-700' : 'text-slate-600'
          }`}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
