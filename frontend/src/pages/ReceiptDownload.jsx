import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiAlertCircle, FiLoader } from 'react-icons/fi';

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
          setMessage(
            'Your receipt download started. Keep the tracking code to confirm your ballot is in the tally later — without revealing your choice.',
          );
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
    <div className="flex min-h-screen items-center justify-center bg-deep-aurora p-6">
      <div className="observatory-panel w-full max-w-md p-8 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-aurora">
          Vote receipt
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-paper">AmarVote</h1>
        <div className="mt-6 flex justify-center" aria-hidden>
          {status === 'loading' && <FiLoader className="h-10 w-10 animate-spin text-aurora" />}
          {status === 'success' && <FiCheckCircle className="h-10 w-10 text-aurora" />}
          {status === 'error' && <FiAlertCircle className="h-10 w-10 text-ember" />}
        </div>
        <p
          className={`mt-4 text-sm leading-relaxed ${
            status === 'error'
              ? 'text-ember'
              : status === 'success'
                ? 'text-aurora'
                : 'text-paper-muted'
          }`}
          role="status"
        >
          {message}
        </p>
      </div>
    </div>
  );
}