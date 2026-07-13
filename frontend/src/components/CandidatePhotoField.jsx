import React, { useRef, useState } from 'react';
import { FiImage, FiUpload, FiX } from 'react-icons/fi';
import ImageLightbox from './ImageLightbox';

/**
 * Candidate photo: separate Upload / View actions + lightbox preview.
 */
const CandidatePhotoField = ({
  imageUrl,
  candidateName,
  onUpload,
  onRemove,
  disabled = false,
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [error, setError] = useState(null);

  const handleFile = async (file) => {
    if (!file || disabled) return;
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await onUpload(file);
    } catch (err) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const initial = (candidateName || '?').trim().charAt(0).toUpperCase();

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!imageUrl}
          onClick={() => imageUrl && setLightboxOpen(true)}
          className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-glacier transition hover:border-brand/40 disabled:cursor-default"
          aria-label={imageUrl ? `View photo of ${candidateName || 'candidate'}` : 'No photo yet'}
          title={imageUrl ? 'View photo' : 'No photo uploaded'}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-lg font-semibold text-brand-dark">
              {initial}
            </span>
          )}
          {imageUrl && (
            <span className="absolute inset-0 flex items-center justify-center bg-deep/0 text-paper opacity-0 transition group-hover:bg-deep/35 group-hover:opacity-100">
              <FiImage className="h-4 w-4" />
            </span>
          )}
        </button>

        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
            className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
          >
            <FiUpload className="h-3.5 w-3.5" />
            {uploading ? 'Uploading…' : imageUrl ? 'Change' : 'Upload'}
          </button>
          {imageUrl && (
            <>
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                className="btn-ghost inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              >
                <FiImage className="h-3.5 w-3.5" />
                View
              </button>
              {onRemove && (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onRemove}
                  className="inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium text-ember hover:bg-ember-soft"
                >
                  <FiX className="h-3.5 w-3.5" />
                  Remove
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {error && <p className="mt-1 text-xs text-ember">{error}</p>}

      <ImageLightbox
        src={imageUrl}
        alt={candidateName ? `${candidateName} photo` : 'Candidate photo'}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
};

export default CandidatePhotoField;
