import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { electionApi } from "../utils/electionApi";
import { userApi } from "../utils/userApi";
import { timezoneUtils } from "../utils/timezoneUtils";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const CreateElection = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [emailSuggestions, setEmailSuggestions] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const suggestionsRef = useRef(null);
    
    // User database for email suggestions fetched from backend
    const [allUsers, setAllUsers] = useState([]);
    
    const [form, setForm] = useState({
        electionTitle: "",
        electionDescription: "",
        electionPrivacy: "public",
        electionEligibility: "listed",
        voterEmails: [],
        guardianNumber: "3",
        guardianEmails: [],
        candidateNames: [""],
        partyNames: [""],
        candidatePictures: [""],
        partyPictures: [""],
        startingTime: null,
        endingTime: null
    });

    useEffect(() => {
        // Close suggestion dropdown when clicking outside
        const handleClickOutside = (event) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(event.target)) {
                setEmailSuggestions([]);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);
    
    // Add debounce function for search optimization
    const debounce = (func, delay) => {
        let debounceTimer;
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    // Handle CSV upload for voter emails
    const handleVoterCSVUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target.result;
            // Split by line, trim, filter empty, and flatten if comma-separated
            let emails = text
                .split(/\r?\n/)
                .map(line => line.split(',').map(email => email.trim()))
                .flat()
                .filter(email => email.length > 0 && email.includes('@'));
                
            // Deduplicate emails
            emails = [...new Set(emails)];
            setForm((prev) => ({ ...prev, voterEmails: emails }));
            
            // Show success message
            setSuccess(`Successfully uploaded ${emails.length} voter emails`);
            
            // Clear success message after 3 seconds
            setTimeout(() => {
                setSuccess("");
            }, 3000);
        };
        reader.readAsText(file);
    };

    // Create a debounced search function
    const debouncedSearch = useRef(
        debounce(async (query) => {
            if (!query || query.length < 2) {
                setEmailSuggestions([]);
                return;
            }
            
            try {
                const users = await userApi.searchUsers(query);
                
                // Map the response to match our expected format and filter out already selected emails
                const mappedUsers = users.map(user => ({
                    email: user.email,
                    name: user.name,
                    userId: user.userId,
                    profilePic: user.profilePic
                })).filter(user => !form.guardianEmails.includes(user.email));
                
                setEmailSuggestions(mappedUsers);
            } catch (error) {
                console.error("Error searching for users:", error);
                setEmailSuggestions([]);
            }
        }, 300)
    ).current;

    const searchEmails = (query) => {
        setSearchQuery(query);
        debouncedSearch(query);
    };

    const addGuardianEmail = (email) => {
        if (!form.guardianEmails.includes(email)) {
            setForm(prev => ({
                ...prev,
                guardianEmails: [...prev.guardianEmails, email]
            }));
        }
        setSearchQuery("");
        setEmailSuggestions([]);
    };

    const removeGuardianEmail = (email) => {
        setForm(prev => ({
            ...prev,
            guardianEmails: prev.guardianEmails.filter(e => e !== email)
        }));
    };

    const removeVoterEmail = (email) => {
        setForm(prev => ({
            ...prev,
            voterEmails: prev.voterEmails.filter(e => e !== email)
        }));
    };

    // Candidates management
    const addCandidate = () => {
        setForm(prev => ({
            ...prev,
            candidateNames: [...prev.candidateNames, ""],
            partyNames: [...prev.partyNames, ""],
            candidatePictures: [...prev.candidatePictures, ""],
            partyPictures: [...prev.partyPictures, ""]
        }));
    };

    const removeCandidate = (index) => {
        setForm(prev => ({
            ...prev,
            candidateNames: prev.candidateNames.filter((_, i) => i !== index),
            partyNames: prev.partyNames.filter((_, i) => i !== index),
            candidatePictures: prev.candidatePictures.filter((_, i) => i !== index),
            partyPictures: prev.partyPictures.filter((_, i) => i !== index)
        }));
    };

    const handleCandidateChange = (index, field, value) => {
        setForm(prev => {
            const updated = { ...prev };
            updated[field][index] = value;
            return updated;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validate form
        if (form.candidateNames.some(name => !name) || form.partyNames.some(name => !name)) {
            setError("All candidate and party names are required");
            return;
        }

        if (!form.startingTime || !form.endingTime) {
            setError("Both starting and ending times are required");
            return;
        }

        if (form.electionPrivacy === "private" && form.voterEmails.length === 0) {
            setError("Voter list is required for private elections");
            return;
        }

        if (form.electionEligibility === "listed" && form.voterEmails.length === 0) {
            setError("Voter list is required for listed eligibility elections");
            return;
        }

        if (form.guardianEmails.length === 0 || form.guardianEmails.length < parseInt(form.guardianNumber)) {
            setError(`At least ${form.guardianNumber} guardian emails are required`);
            return;
        }

        setError("");
        setIsSubmitting(true);

        try {
            // Convert dates to UTC format for backend storage
            const electionData = {
                ...form,
                startingTime: timezoneUtils.convertToUTC(form.startingTime),
                endingTime: timezoneUtils.convertToUTC(form.endingTime)
            };

            console.log('Sending election data with UTC times:', {
                startingTime: electionData.startingTime,
                endingTime: electionData.endingTime,
                userTimezone: timezoneUtils.getUserTimezone()
            });

            const response = await electionApi.createElection(electionData);
            setSuccess("Election created successfully!");
            
            // Redirect to election details page after a short delay
            setTimeout(() => {
                navigate(`/election-page/${response.electionId}`);
            }, 2000);
        } catch (err) {
            console.error("Error creating election:", err);
            setError(err.message || "Failed to create election. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render Email Tags Component
    const renderEmailTag = (email, onRemove) => (
        <div 
            key={email} 
            className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md inline-flex items-center mr-2 mb-2"
        >
            <span className="mr-1">{email}</span>
            <button 
                type="button" 
                onClick={() => onRemove(email)}
                className="text-blue-500 hover:text-blue-700"
            >
                ×
            </button>
        </div>
    );

    // Render Email Suggestions Dropdown
    const renderEmailSuggestions = () => (
        <div 
            ref={suggestionsRef} 
            className="absolute z-10 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto"
        >
            {emailSuggestions.map((user) => (
                <div 
                    key={user.email} 
                    className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex items-center"
                    onClick={() => addGuardianEmail(user.email)}
                >
                    {user.profilePic ? (
                        <img 
                            src={user.profilePic} 
                            alt={user.name} 
                            className="w-8 h-8 rounded-full mr-2"
                        />
                    ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white mr-2">
                            {user.name.charAt(0)}
                        </div>
                    )}
                    <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                </div>
            ))}
            {emailSuggestions.length === 0 && searchQuery.length > 0 && (
                <div className="px-4 py-2 text-gray-500">No users found</div>
            )}
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-3xl font-bold mb-6 text-gray-800">Create New Election</h1>
            
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}
            
            {success && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                    {success}
                </div>
            )}
            
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Election Information */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Basic Information</h2>
                    
                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">
                            Election Title <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            name="electionTitle"
                            value={form.electionTitle}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                    </div>
                    
                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">
                            Election Description
                        </label>
                        <textarea
                            name="electionDescription"
                            value={form.electionDescription}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 h-24"
                        />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700 font-medium mb-2">
                                Start Time <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                selected={form.startingTime}
                                onChange={date => setForm(prev => ({ ...prev, startingTime: date }))}
                                showTimeSelect
                                timeFormat="HH:mm"
                                timeIntervals={15}
                                dateFormat="MMMM d, yyyy h:mm aa"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholderText="Select start date and time"
                                required
                            />
                        </div>
                        
                        <div>
                            <label className="block text-gray-700 font-medium mb-2">
                                End Time <span className="text-red-500">*</span>
                            </label>
                            <DatePicker
                                selected={form.endingTime}
                                onChange={date => setForm(prev => ({ ...prev, endingTime: date }))}
                                showTimeSelect
                                timeFormat="HH:mm"
                                timeIntervals={15}
                                dateFormat="MMMM d, yyyy h:mm aa"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholderText="Select end date and time"
                                minDate={form.startingTime}
                                required
                            />
                        </div>
                    </div>
                </div>
                
                {/* Election Privacy Settings */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Privacy Settings</h2>
                    
                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Election Privacy</label>
                        <div className="flex space-x-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="electionPrivacy"
                                    value="public"
                                    checked={form.electionPrivacy === "public"}
                                    onChange={handleChange}
                                    className="form-radio h-5 w-5 text-blue-600"
                                />
                                <span className="ml-2 text-gray-700">Public</span>
                            </label>
                            
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="electionPrivacy"
                                    value="private"
                                    checked={form.electionPrivacy === "private"}
                                    onChange={handleChange}
                                    className="form-radio h-5 w-5 text-blue-600"
                                />
                                <span className="ml-2 text-gray-700">Private</span>
                            </label>
                        </div>
                    </div>
                    
                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Voter Eligibility</label>
                        <div className="flex space-x-4">
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="electionEligibility"
                                    value="listed"
                                    checked={form.electionEligibility === "listed"}
                                    onChange={handleChange}
                                    className="form-radio h-5 w-5 text-blue-600"
                                />
                                <span className="ml-2 text-gray-700">Listed Voters Only</span>
                            </label>
                            
                            <label className="inline-flex items-center">
                                <input
                                    type="radio"
                                    name="electionEligibility"
                                    value="unlisted"
                                    checked={form.electionEligibility === "unlisted"}
                                    onChange={handleChange}
                                    className="form-radio h-5 w-5 text-blue-600"
                                />
                                <span className="ml-2 text-gray-700">Anyone Can Vote</span>
                            </label>
                        </div>
                    </div>
                    
                    {(form.electionPrivacy === "private" || form.electionEligibility === "listed") && (
                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-2">
                                Voter Emails 
                                {form.electionPrivacy === "private" && <span className="text-red-500">*</span>}
                            </label>
                            
                            <div className="mb-2">
                                <label className="inline-block px-4 py-2 bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600">
                                    <span>Upload CSV</span>
                                    <input
                                        type="file"
                                        accept=".csv,.txt"
                                        onChange={handleVoterCSVUpload}
                                        className="hidden"
                                    />
                                </label>
                                <span className="text-gray-500 text-sm ml-2">Upload a CSV/TXT file with one email per line or comma-separated</span>
                            </div>
                            
                            <div className="border border-gray-300 rounded-md p-3 min-h-[100px] max-h-[200px] overflow-auto">
                                <div className="flex flex-wrap">
                                    {form.voterEmails.length > 0 ? (
                                        form.voterEmails.map(email => renderEmailTag(email, removeVoterEmail))
                                    ) : (
                                        <span className="text-gray-500">No voter emails added yet</span>
                                    )}
                                </div>
                            </div>
                            
                            {form.voterEmails.length > 0 && (
                                <div className="mt-2 text-sm text-gray-500">
                                    {form.voterEmails.length} email{form.voterEmails.length !== 1 ? 's' : ''} added
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                {/* Guardian Settings */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Guardian Settings</h2>
                    
                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">
                            Number of Guardians <span className="text-red-500">*</span>
                        </label>
                        <select
                            name="guardianNumber"
                            value={form.guardianNumber}
                            onChange={handleChange}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="3">3 Guardians</option>
                            <option value="5">5 Guardians</option>
                            <option value="7">7 Guardians</option>
                            <option value="9">9 Guardians</option>
                        </select>
                    </div>
                    
                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">
                            Guardian Emails <span className="text-red-500">*</span>
                        </label>
                        
                        <div className="relative mb-2">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => searchEmails(e.target.value)}
                                placeholder="Type to search for users..."
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            
                            {emailSuggestions.length > 0 && renderEmailSuggestions()}
                        </div>
                        
                        <div className="border border-gray-300 rounded-md p-3 min-h-[100px]">
                            <div className="flex flex-wrap">
                                {form.guardianEmails.length > 0 ? (
                                    form.guardianEmails.map(email => renderEmailTag(email, removeGuardianEmail))
                                ) : (
                                    <span className="text-gray-500">No guardian emails added yet</span>
                                )}
                            </div>
                        </div>
                        
                        <div className="mt-2 text-sm text-gray-500">
                            {form.guardianEmails.length} of {form.guardianNumber} guardians added
                        </div>
                    </div>
                </div>
                
                {/* Candidate Information */}
                <div className="bg-white p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Candidates</h2>
                    
                    {form.candidateNames.map((name, index) => (
                        <div key={index} className="mb-6 p-4 border border-gray-200 rounded-md">
                            <div className="flex justify-between mb-2">
                                <h3 className="font-medium">Candidate {index + 1}</h3>
                                
                                {index > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => removeCandidate(index)}
                                        className="text-red-500 hover:text-red-700"
                                    >
                                        Remove
                                    </button>
                                )}
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        Candidate Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => handleCandidateChange(index, 'candidateNames', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        Party Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.partyNames[index]}
                                        onChange={(e) => handleCandidateChange(index, 'partyNames', e.target.value)}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    />
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        Candidate Picture URL
                                    </label>
                                    <input
                                        type="text"
                                        value={form.candidatePictures[index]}
                                        onChange={(e) => handleCandidateChange(index, 'candidatePictures', e.target.value)}
                                        placeholder="https://example.com/image.jpg"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium mb-1">
                                        Party Logo URL
                                    </label>
                                    <input
                                        type="text"
                                        value={form.partyPictures[index]}
                                        onChange={(e) => handleCandidateChange(index, 'partyPictures', e.target.value)}
                                        placeholder="https://example.com/logo.jpg"
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                    
                    <button
                        type="button"
                        onClick={addCandidate}
                        className="mt-2 px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    >
                        + Add Another Candidate
                    </button>
                </div>
                
                <div className="flex justify-between">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                    >
                        Cancel
                    </button>
                    
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 ${
                            isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Election'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default CreateElection;
