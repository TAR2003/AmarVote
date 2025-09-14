import React, { useState } from 'react';
import ImageUpload from './ImageUpload';
import { uploadElectionPicture, uploadCandidatePicture, uploadPartyPicture } from '../utils/api';

const ElectionImageUpload = ({
  uploadType, // 'election', 'candidate', 'party'
  currentImage = null,
  electionId = null, // Required for election images
  choiceId = null, // Required for candidate/party images (after election creation)
  onImageUploaded = null, // Callback with the new image URL
  className = '',
  disabled = false,
  placeholder = false // If true, show placeholder until election is created
}) => {
  const [tempImageUrl, setTempImageUrl] = useState(currentImage);

  const handleImageUpload = async (file) => {
    if (placeholder) {
      // Store the file temporarily for later upload after election creation
      const tempUrl = URL.createObjectURL(file);
      setTempImageUrl(tempUrl);
      if (onImageUploaded) {
        onImageUploaded(tempUrl, file); // Pass both URL and file
      }
      return Promise.resolve({ imageUrl: tempUrl });
    }

    // Upload to Cloudinary
    let response;
    switch (uploadType) {
      case 'election':
        if (!electionId) throw new Error('Election ID is required');
        response = await uploadElectionPicture(file, electionId);
        break;
      case 'candidate':
        if (!choiceId) throw new Error('Choice ID is required');
        response = await uploadCandidatePicture(file, choiceId);
        break;
      case 'party':
        if (!choiceId) throw new Error('Choice ID is required');
        response = await uploadPartyPicture(file, choiceId);
        break;
      default:
        throw new Error('Invalid upload type');
    }

    setTempImageUrl(response.imageUrl);
    if (onImageUploaded) {
      onImageUploaded(response.imageUrl);
    }

    return response;
  };

  const getUploadTypeDisplay = () => {
    switch (uploadType) {
      case 'election':
        return 'election';
      case 'candidate':
        return 'candidate';
      case 'party':
        return 'party';
      default:
        return 'image';
    }
  };

  return (
    <div className={className}>
      {placeholder ? (
        <div className="text-center">
          <ImageUpload
            onImageUpload={handleImageUpload}
            currentImage={tempImageUrl}
            uploadType={uploadType}
            disabled={disabled}
            maxSize={2 * 1024 * 1024} // 2MB for election images
          />
          <p className="mt-2 text-xs text-gray-500">
            Image will be uploaded after election is created
          </p>
        </div>
      ) : (
        <ImageUpload
          onImageUpload={handleImageUpload}
          currentImage={tempImageUrl || currentImage}
          uploadType={uploadType}
          disabled={disabled}
          maxSize={2 * 1024 * 1024} // 2MB for election images
        />
      )}
    </div>
  );
};

// Helper component for managing multiple candidate/party images during election creation
export const CandidatePartyImageManager = ({ 
  candidateImages, 
  partyImages, 
  onCandidateImageChange, 
  onPartyImageChange,
  candidateNames,
  partyNames,
  disabled = false
}) => {
  return (
    <div className="space-y-4">
      {candidateNames.map((name, index) => (
        <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              {name || `Candidate ${index + 1}`} Photo
            </label>
            <ElectionImageUpload
              uploadType="candidate"
              currentImage={candidateImages[index]}
              onImageUploaded={(imageUrl, file) => onCandidateImageChange(index, imageUrl, file)}
              placeholder={true}
              disabled={disabled}
              className="h-32"
            />
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-2">
              {partyNames[index] || `Party ${index + 1}`} Logo
            </label>
            <ElectionImageUpload
              uploadType="party"
              currentImage={partyImages[index]}
              onImageUploaded={(imageUrl, file) => onPartyImageChange(index, imageUrl, file)}
              placeholder={true}
              disabled={disabled}
              className="h-32"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default ElectionImageUpload;