import React, { useState, useEffect } from "react";
import { FiUser, FiMail, FiLock, FiEdit, FiSave, FiX, FiAlertCircle } from "react-icons/fi";
import { getUserProfile, updateUserProfile, updateUserPassword } from "../utils/api";

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [user, setUser] = useState({
    userName: "",
    userEmail: "",
    profilePic: "",
    isVerified: false
  });

  const [isEditing, setIsEditing] = useState(false);
  const [tempUser, setTempUser] = useState({ ...user });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordError, setPasswordError] = useState(null);

  // Fetch user profile on component mount
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        setLoading(true);
        const userData = await getUserProfile();
        setUser(userData);
        setTempUser(userData);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch user profile:", err);
        setError("Failed to load user profile. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, []);
  
  // Clear success/error messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleEdit = () => {
    setTempUser({ ...user });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setTempUser({ ...user });
    setPasswordData({
      currentPassword: "",
      newPassword: "",
      confirmPassword: ""
    });
    setPasswordError(null);
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Validate required fields
      if (!tempUser.userName || tempUser.userName.trim() === '') {
        setError("Name is required");
        setLoading(false);
        return;
      }
      
      // Create request object with only the fields that can be updated
      const updateData = {
        userName: tempUser.userName,
        profilePic: tempUser.profilePic || null
      };
      
      console.log("Sending profile update:", updateData);
      const updatedProfile = await updateUserProfile(updateData);
      setUser(updatedProfile);
      setSuccessMessage("Profile updated successfully");
      setIsEditing(false);
      
      // Handle password update if password fields are filled
      if (passwordData.currentPassword && passwordData.newPassword) {
        await handlePasswordUpdate();
      }
    } catch (err) {
      console.error("Failed to update profile:", err);
      setError(err.message || "Failed to update profile. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async () => {
    try {
      setPasswordError(null);
      
      // Validate password fields
      if (!passwordData.currentPassword) {
        setPasswordError("Current password is required");
        return;
      }
      
      if (passwordData.newPassword !== passwordData.confirmPassword) {
        setPasswordError("New password and confirmation do not match");
        return;
      }
      
      if (passwordData.newPassword.length < 8) {
        setPasswordError("Password must be at least 8 characters");
        return;
      }
      
      console.log("Updating password...");
      await updateUserPassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword
      });
      
      setSuccessMessage((prev) => prev ? `${prev} and password updated successfully` : "Password updated successfully");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
    } catch (err) {
      console.error("Failed to update password:", err);
      setPasswordError(err.message || "Failed to update password. Please check your current password.");
    }
  };

  const handleChange = (e) => {
    setTempUser({
      ...tempUser,
      [e.target.name]: e.target.value,
    });
  };
  
  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {loading && !isEditing && (
        <div className="flex justify-center items-center py-10">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <FiAlertCircle className="h-5 w-5 text-red-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">{successMessage}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setSuccessMessage(null)}
                  className="inline-flex rounded-md p-1.5 text-green-500 hover:bg-green-100 focus:outline-none"
                >
                  <FiX className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Profile Settings</h1>
            {!isEditing ? (
              <button
                onClick={handleEdit}
                className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition"
                disabled={loading}
              >
                <FiEdit /> Edit Profile
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 rounded-full hover:bg-opacity-30 transition"
                  disabled={loading}
                >
                  <FiX /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-white text-blue-600 rounded-full hover:bg-opacity-90 transition"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></span>
                  ) : (
                    <FiSave />
                  )}
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Profile Content */}
        {!loading || isEditing ? (
          <div className="p-6">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Avatar Section */}
              <div className="flex-shrink-0">
                <div className="relative group">
                  <img
                    className="w-32 h-32 rounded-full object-cover border-4 border-white shadow"
                    src={isEditing ? (tempUser.profilePic || "/default-avatar.png") : (user.profilePic || "/default-avatar.png")}
                    alt="Profile"
                    onError={(e) => {
                      // Set to local default avatar to avoid external requests
                      e.target.src = "/default-avatar.png";
                      // Prevent infinite loop if default image also fails
                      e.onerror = null;
                    }}
                  />
                  {isEditing && (
                    <div className="absolute bottom-0 right-0">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        id="profilePicUpload"
                        onChange={(e) => {
                          const file = e.target.files[0];
                          if (!file) return;
                          
                          // File size validation (max 1MB)
                          if (file.size > 1024 * 1024) {
                            setError("Image size must be less than 1MB");
                            return;
                          }
                          
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64String = reader.result;
                            console.log("Image loaded as base64");
                            setTempUser({
                              ...tempUser,
                              profilePic: base64String
                            });
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      <label htmlFor="profilePicUpload" className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition cursor-pointer">
                        <FiEdit />
                      </label>
                    </div>
                  )}
                </div>
                {isEditing && (
                  <div className="mt-2 text-center">
                    <button
                      type="button"
                      className="text-xs text-gray-500 hover:text-red-600"
                      onClick={() => setTempUser({...tempUser, profilePic: null})}
                    >
                      Remove photo
                    </button>
                  </div>
                )}
              </div>

              {/* Profile Details */}
              <div className="flex-1 space-y-6">
                {/* Name Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Full Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="userName"
                      value={tempUser.userName || ""}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  ) : (
                    <p className="text-lg font-medium">{user.userName}</p>
                  )}
                </div>

                {/* Email Field */}
                <div>
                  <label className="text-sm font-medium text-gray-500 mb-1 items-center gap-2 inline-flex">
                    <FiMail /> Email Address
                  </label>
                  <p className="text-lg">{user.userEmail}</p>
                </div>

                {/* Verification Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Account Status
                  </label>
                  <span 
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.isVerified 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-yellow-100 text-yellow-800'
                    }`}
                  >
                    {user.isVerified ? 'Verified' : 'Not Verified'}
                  </span>
                </div>

                {/* Password Change (Only shown when editing) */}
                {isEditing && (
                  <div className="pt-4 border-t">
                    <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                      <FiLock /> Change Password
                    </h3>
                    {passwordError && (
                      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
                        <p className="text-sm text-red-700">{passwordError}</p>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Current Password
                        </label>
                        <input
                          type="password"
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          New Password
                        </label>
                        <input
                          type="password"
                          name="newPassword"
                          value={passwordData.newPassword}
                          onChange={handlePasswordChange}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 mb-1">
                          Confirm New Password
                        </label>
                        <input
                          type="password"
                          name="confirmPassword"
                          value={passwordData.confirmPassword}
                          onChange={handlePasswordChange}
                          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Account Actions */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <h3 className="text-lg font-medium mb-2">Account Actions</h3>
          <div className="flex flex-wrap gap-3">
            <button 
              className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition"
              disabled={loading || isEditing}
            >
              Deactivate Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
