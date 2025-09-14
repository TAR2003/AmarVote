import React, { useState, useRef, useCallback } from 'react';
import { FiUpload, FiX, FiImage, FiCheck, FiAlertCircle } from 'react-icons/fi';

const ImageUpload = ({
  onImageUpload,
  currentImage = null,
  uploadType = 'profile', // 'profile', 'candidate', 'party', 'election'
  className = '',
  disabled = false,
  maxSize = null, // No size limit
  acceptedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg', 'image/bmp', 'image/tiff', 'image/svg+xml']
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentImage);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);

  const validateFile = (file) => {
    if (!file) {
      return 'No file selected';
    }

    // Only check file type - accept all image formats
    if (!file.type.startsWith('image/')) {
      return 'Please select an image file';
    }

    // No size restrictions
    return null;
  };

  const handleFile = useCallback(async (file) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setUploading(true);
    setProgress(0);

    try {
      // Create preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 100);

      // Call the upload function
      await onImageUpload(file);
      
      clearInterval(progressInterval);
      setProgress(100);
      
      // Keep progress at 100% for a moment before hiding
      setTimeout(() => {
        setProgress(0);
        setUploading(false);
      }, 500);

    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
      setUploading(false);
      setProgress(0);
      // Reset preview on error
      setPreview(currentImage);
    }
  }, [onImageUpload, currentImage]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled || uploading) return;

    const files = e.dataTransfer.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  }, [disabled, uploading, handleFile]);

  const handleFileChange = (e) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const openFileDialog = () => {
    if (!disabled && !uploading) {
      fileInputRef.current?.click();
    }
  };

  const removeImage = () => {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getUploadText = () => {
    switch (uploadType) {
      case 'profile':
        return 'Upload Profile Picture';
      case 'candidate':
        return 'Upload Candidate Photo';
      case 'party':
        return 'Upload Party Logo';
      case 'election':
        return 'Upload Election Image';
      default:
        return 'Upload Image';
    }
  };

  const getPlaceholderIcon = () => {
    switch (uploadType) {
      case 'profile':
        return '👤';
      case 'candidate':
        return '🎯';
      case 'party':
        return '🏛️';
      case 'election':
        return '🗳️';
      default:
        return '📷';
    }
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedFormats.join(',')}
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || uploading}
      />

      <div
        className={`
          relative border-2 border-dashed rounded-xl p-6 transition-all duration-200
          ${dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : preview 
              ? 'border-gray-200 bg-gray-50' 
              : 'border-gray-300 hover:border-gray-400'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          ${uploading ? 'pointer-events-none' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={openFileDialog}
      >
        {preview ? (
          <div className="relative">
            <img
              src={preview}
              alt="Preview"
              className="w-full h-48 object-cover rounded-lg"
            />
            
            {/* Upload overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                  <div className="text-sm font-medium">Uploading...</div>
                  <div className="text-xs opacity-75">{progress}%</div>
                </div>
              </div>
            )}

            {/* Success overlay */}
            {!uploading && progress === 100 && (
              <div className="absolute inset-0 bg-green-500 bg-opacity-80 rounded-lg flex items-center justify-center transition-opacity">
                <div className="text-white text-center">
                  <FiCheck className="w-8 h-8 mx-auto mb-2" />
                  <div className="text-sm font-medium">Uploaded!</div>
                </div>
              </div>
            )}

            {/* Remove button */}
            {!uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage();
                }}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <FiX className="w-4 h-4" />
              </button>
            )}

            {/* Change image overlay on hover */}
            {!uploading && (
              <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 rounded-lg transition-all duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
                <div className="text-white text-center">
                  <FiUpload className="w-6 h-6 mx-auto mb-1" />
                  <div className="text-sm font-medium">Change Image</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-4xl mb-3">{getPlaceholderIcon()}</div>
            <div className="text-lg font-medium text-gray-700 mb-2">
              {getUploadText()}
            </div>
            <div className="text-sm text-gray-500 mb-4">
              Drag and drop an image here, or click to browse
            </div>
            <div className="flex items-center justify-center space-x-4 text-xs text-gray-400">
              <span>Formats: {acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}</span>
              <span>•</span>
              <span>Max size: {(maxSize / 1024 / 1024).toFixed(1)}MB</span>
            </div>
            
            {dragActive && (
              <div className="mt-4">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-600 text-sm font-medium">
                  <FiUpload className="w-4 h-4 mr-1" />
                  Drop to upload
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress bar */}
        {uploading && (
          <div className="absolute bottom-0 left-0 right-0 bg-gray-200 rounded-b-xl overflow-hidden">
            <div
              className="bg-blue-500 h-1 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 flex items-center space-x-2 text-red-600 text-sm">
          <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload tips */}
      {!preview && !error && (
        <div className="mt-3 text-xs text-gray-500">
          <div className="flex items-center space-x-2">
            <FiImage className="w-3 h-3" />
            <span>Best quality: Square images, at least 400x400 pixels</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;