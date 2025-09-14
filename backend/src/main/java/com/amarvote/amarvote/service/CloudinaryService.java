package com.amarvote.amarvote.service;

import java.io.IOException;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;

@Service
public class CloudinaryService {

    @Autowired
    private Cloudinary cloudinary;

    public enum ImageType {
        PROFILE("amarvote/profiles"),
        CANDIDATE("amarvote/candidates"),
        PARTY("amarvote/parties");

        private final String folder;

        ImageType(String folder) {
            this.folder = folder;
        }

        public String getFolder() {
            return folder;
        }
    }

    /**
     * Upload image to Cloudinary
     * @param file The image file to upload
     * @param imageType Type of image (PROFILE, CANDIDATE, PARTY)
     * @return URL of the uploaded image
     * @throws IOException if upload fails
     */
    public String uploadImage(MultipartFile file, ImageType imageType) throws IOException {
        // Validate file
        validateImageFile(file);

        System.out.println("Starting Cloudinary upload for file: " + file.getOriginalFilename() + 
                         ", Type: " + imageType + ", Size: " + file.getSize() + " bytes");

        Map<String, Object> uploadParams = ObjectUtils.asMap(
                "folder", imageType.getFolder(),
                "resource_type", "image",
                "quality", "auto:good"
        );

        System.out.println("Upload parameters: " + uploadParams);

        try {
            Map<String, Object> uploadResult = cloudinary.uploader().upload(file.getBytes(), uploadParams);
            String secureUrl = (String) uploadResult.get("secure_url");
            
            System.out.println("Upload successful. Secure URL: " + secureUrl);
            
            return secureUrl;
        } catch (Exception e) {
            System.err.println("Cloudinary upload failed: " + e.getMessage());
            e.printStackTrace();
            throw new IOException("Failed to upload to Cloudinary: " + e.getMessage(), e);
        }
    }

    /**
     * Delete image from Cloudinary
     * @param imageUrl The URL of the image to delete
     * @return true if deletion was successful
     */
    public boolean deleteImage(String imageUrl) {
        try {
            // Extract public_id from URL
            String publicId = extractPublicId(imageUrl);
            if (publicId == null) {
                return false;
            }

            Map<String, Object> result = cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
            return "ok".equals(result.get("result"));
        } catch (Exception e) {
            System.err.println("Error deleting image: " + e.getMessage());
            return false;
        }
    }

    /**
     * Validate image file
     * @param file The file to validate
     * @throws IllegalArgumentException if file is invalid
     */
    private void validateImageFile(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File cannot be null or empty");
        }

        // Basic file type check - allow all image types
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("File must be an image");
        }
        
        // No size restrictions - allow any size
        // No format restrictions - allow all image formats
    }

    /**
     * Extract public_id from Cloudinary URL
     * @param imageUrl The Cloudinary URL
     * @return The public_id or null if extraction fails
     */
    private String extractPublicId(String imageUrl) {
        try {
            if (imageUrl == null || !imageUrl.contains("cloudinary.com")) {
                return null;
            }

            // URL format: https://res.cloudinary.com/{cloud_name}/image/upload/{transformations}/{public_id}.{format}
            String[] parts = imageUrl.split("/");
            if (parts.length < 2) {
                return null;
            }

            // Find the public_id (it comes after "upload" and optional transformations)
            int uploadIndex = -1;
            for (int i = 0; i < parts.length; i++) {
                if ("upload".equals(parts[i])) {
                    uploadIndex = i;
                    break;
                }
            }

            if (uploadIndex == -1 || uploadIndex >= parts.length - 1) {
                return null;
            }

            // The public_id is the last part without extension
            String lastPart = parts[parts.length - 1];
            int dotIndex = lastPart.lastIndexOf('.');
            String fileName = dotIndex > 0 ? lastPart.substring(0, dotIndex) : lastPart;

            // Reconstruct the full public_id with folder
            StringBuilder publicId = new StringBuilder();
            for (int i = uploadIndex + 1; i < parts.length - 1; i++) {
                if (publicId.length() > 0) {
                    publicId.append("/");
                }
                publicId.append(parts[i]);
            }
            if (publicId.length() > 0) {
                publicId.append("/");
            }
            publicId.append(fileName);

            return publicId.toString();
        } catch (Exception e) {
            System.err.println("Error extracting public_id from URL: " + e.getMessage());
            return null;
        }
    }
}