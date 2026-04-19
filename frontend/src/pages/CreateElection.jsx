import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { electionApi } from "../utils/electionApi";
import { uploadCandidateImage } from "../utils/api";
import ImageUpload from "../components/ImageUpload";

const CreateElection = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [emailSuggestions, setEmailSuggestions] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [canCreateElections, setCanCreateElections] = useState(false);
    const [checkingPermission, setCheckingPermission] = useState(true);
    const suggestionsRef = useRef(null);

    const [form, setForm] = useState({
        electionTitle: "",
        electionDescription: "",
        electionPrivacy: "public",
        electionEligibility: "listed",
        voterEmails: [],
        guardianNumber: "",
        quorumNumber: "",
        guardianEmails: [],
        candidateNames: [""],
        candidatePictures: [""],
        maxChoices: 1
    });

    // Track image URLs for preview
    const [candidateImages, setCandidateImages] = useState([]);

    useEffect(() => {
        let isMounted = true;

        const checkCreatePermission = async () => {
            try {
                const res = await fetch("/api/authorized-users/me", {
                    method: "GET",
                    credentials: "include",
                });

                if (!res.ok) {
                    throw new Error("Unable to verify create-election access.");
                }

                const data = await res.json();
                if (!isMounted) {
                    return;
                }

                if (!data.canCreateElections) {
                    setError("You are not allowed to create elections.");
                    setTimeout(() => {
                        navigate("/dashboard", { replace: true });
                    }, 800);
                    return;
                }

                setCanCreateElections(true);
            } catch (permissionError) {
                if (!isMounted) {
                    return;
                }
                setError(permissionError.message || "Unable to verify create-election access.");
                setTimeout(() => {
                    navigate("/dashboard", { replace: true });
                }, 800);
            } finally {
                if (isMounted) {
                    setCheckingPermission(false);
                }
            }
        };

        checkCreatePermission();

        return () => {
            isMounted = false;
        };
    }, [navigate]);

    // Handle candidate image changes.
    const handleImageChange = async (index, file) => {
        if (!canCreateElections) {
            setError("You are not allowed to upload election assets.");
            return;
        }

        try {
            const candidateName = form.candidateNames[index] || `candidate_${index}`;
            const response = await uploadCandidateImage(file, candidateName);
            const imageUrl = response.imageUrl;

            setCandidateImages(prev => {
                const updated = [...prev];
                updated[index] = imageUrl;
                return updated;
            });
            
            setForm(prev => {
                const updatedPictures = [...prev.candidatePictures];
                updatedPictures[index] = imageUrl;
                return { ...prev, candidatePictures: updatedPictures };
            });
        } catch (error) {
            console.error('Error uploading image:', error);
            setError(error.message || "Failed to upload candidate image.");
        }
    };

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
        return function () {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;

        // If guardian number changes, auto-adjust quorum to default (more than half)
        if (name === 'guardianNumber') {
            const guardianCount = parseInt(value) || 0;
            
            // Calculate default quorum as more than half
            const defaultQuorum = guardianCount > 0 ? Math.floor(guardianCount / 2) + 1 : 0;

            setForm((prev) => ({
                ...prev,
                [name]: value,
                // Set quorum to default value
                quorumNumber: guardianCount === 0 ? "" : defaultQuorum.toString()
            }));
        } else if (name === 'quorumNumber') {
            // Validate quorum number
            const quorumCount = parseInt(value) || 0;
            const guardianCount = parseInt(form.guardianNumber) || 0;

            // Only allow valid quorum values
            if (value === "" || (quorumCount > 0 && quorumCount <= guardianCount)) {
                setForm((prev) => ({ ...prev, [name]: value }));
            }
            // If invalid, don't update the form
        } else {
            setForm((prev) => ({ ...prev, [name]: value }));
        }
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

    // Handle CSV/TXT upload for guardian emails
    const handleGuardianFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validate file type
        const validTypes = ['text/plain', 'text/csv', 'application/vnd.ms-excel'];
        const isValidType = validTypes.includes(file.type) || file.name.endsWith('.txt') || file.name.endsWith('.csv');
        
        if (!isValidType) {
            setError('Please upload a .txt or .csv file');
            setTimeout(() => setError(""), 3000);
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target.result;
                // Split by line, trim, filter empty, and flatten if comma-separated
                let emails = text
                    .split(/\r?\n/)
                    .map(line => line.split(',').map(email => email.trim()))
                    .flat()
                    .filter(email => email.length > 0 && email.includes('@'));

                // Validate all emails
                const validEmails = emails.filter(email => isValidEmail(email));
                const invalidCount = emails.length - validEmails.length;

                // Deduplicate emails
                const uniqueEmails = [...new Set(validEmails)];
                
                if (uniqueEmails.length === 0) {
                    setError('No valid email addresses found in the file');
                    setTimeout(() => setError(""), 3000);
                    return;
                }

                if (uniqueEmails.length > 20) {
                    setError('Maximum 20 guardians allowed. File contains ' + uniqueEmails.length + ' emails.');
                    setTimeout(() => setError(""), 3000);
                    return;
                }

                // Calculate minimum quorum (more than half)
                const minQuorum = Math.floor(uniqueEmails.length / 2) + 1;

                setForm((prev) => ({ 
                    ...prev, 
                    guardianEmails: uniqueEmails,
                    guardianNumber: uniqueEmails.length.toString(),
                    quorumNumber: minQuorum.toString()
                }));

                // Show success message
                let message = `Successfully uploaded ${uniqueEmails.length} guardian email(s)`;
                if (invalidCount > 0) {
                    message += ` (${invalidCount} invalid email(s) skipped)`;
                }
                message += `. Quorum set to ${minQuorum}.`;
                setSuccess(message);

                // Clear success message after 5 seconds
                setTimeout(() => {
                    setSuccess("");
                }, 5000);
            } catch (error) {
                setError('Error reading file: ' + error.message);
                setTimeout(() => setError(""), 3000);
            }
        };
        
        reader.onerror = () => {
            setError('Failed to read file');
            setTimeout(() => setError(""), 3000);
        };
        
        reader.readAsText(file);
        
        // Clear the file input so the same file can be selected again
        e.target.value = null;
    };

    // Email validation and suggestion based on common providers
    const commonEmailProviders = [
        '@gmail.com',
        '@yahoo.com',
        '@outlook.com',
        '@hotmail.com',
        '@icloud.com',
        '@protonmail.com',
        '@aol.com',
        '@mail.com',
        '@zoho.com',
        '@yandex.com'
    ];

    // Validate email format
    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Generate email suggestions based on input
    const generateEmailSuggestions = (query) => {
        if (!query || query.length < 2) {
            return [];
        }

        const suggestions = [];
        const lowerQuery = query.toLowerCase();

        // If query contains @, suggest completing the domain
        if (lowerQuery.includes('@')) {
            const [localPart, domainPart] = lowerQuery.split('@');
            
            // If domain is partially typed, suggest matching providers
            if (domainPart !== undefined) {
                commonEmailProviders.forEach(provider => {
                    if (provider.toLowerCase().startsWith('@' + domainPart)) {
                        suggestions.push({
                            email: localPart + provider,
                            isComplete: true
                        });
                    }
                });
            }
        } else {
            // If @ not typed yet, suggest adding common providers
            commonEmailProviders.forEach(provider => {
                suggestions.push({
                    email: lowerQuery + provider,
                    isComplete: true
                });
            });
        }

        return suggestions.slice(0, 5); // Limit to 5 suggestions
    };

    // Create a debounced search function
    const debouncedSearch = useRef(
        debounce(async (query) => {
            if (!query || query.length < 2) {
                setEmailSuggestions([]);
                return;
            }

            try {
                // Generate email suggestions based on common providers
                const suggestions = generateEmailSuggestions(query);
                
                // Filter out already selected emails
                const filteredSuggestions = suggestions.filter(
                    suggestion => !form.guardianEmails.includes(suggestion.email)
                );

                setEmailSuggestions(filteredSuggestions);
            } catch (error) {
                console.error("Error generating email suggestions:", error);
                setEmailSuggestions([]);
            }
        }, 300)
    ).current;

    const searchEmails = (query) => {
        setSearchQuery(query);
        debouncedSearch(query);
    };

    const addGuardianEmail = (email) => {
        // Validate email format
        if (!isValidEmail(email)) {
            setError("Please enter a valid email address");
            setTimeout(() => setError(""), 3000);
            return;
        }

        // Check if email is already added
        if (!form.guardianEmails.includes(email)) {
            const newGuardianEmails = [...form.guardianEmails, email];
            const newGuardianCount = newGuardianEmails.length;
            
            // Check maximum guardians limit
            if (newGuardianCount > 20) {
                setError("Maximum 20 guardians allowed");
                setTimeout(() => setError(""), 3000);
                return;
            }
            
            // Calculate default quorum (more than half)
            const defaultQuorum = Math.floor(newGuardianCount / 2) + 1;
            
            setForm(prev => ({
                ...prev,
                guardianEmails: newGuardianEmails,
                guardianNumber: newGuardianCount.toString(),
                quorumNumber: defaultQuorum.toString()
            }));
        }
        setSearchQuery("");
        setEmailSuggestions([]);
    };

    const removeGuardianEmail = (email) => {
        const newGuardianEmails = form.guardianEmails.filter(e => e !== email);
        const newGuardianCount = newGuardianEmails.length;
        
        // Calculate default quorum (more than half)
        const defaultQuorum = newGuardianCount > 0 ? Math.floor(newGuardianCount / 2) + 1 : 0;
        
        setForm(prev => ({
            ...prev,
            guardianEmails: newGuardianEmails,
            guardianNumber: newGuardianCount > 0 ? newGuardianCount.toString() : "",
            quorumNumber: newGuardianCount > 0 ? defaultQuorum.toString() : ""
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
            candidatePictures: [...prev.candidatePictures, ""]
        }));
        setCandidateImages(prev => [...prev, ""]);
    };

    const removeCandidate = (index) => {
        // Prevent removing if it would result in less than 2 candidates
        if (form.candidateNames.length <= 2) {
            setError("At least 2 candidates are required. Cannot remove more candidates.");
            return;
        }

        setForm(prev => ({
            ...prev,
            candidateNames: prev.candidateNames.filter((_, i) => i !== index),
            candidatePictures: prev.candidatePictures.filter((_, i) => i !== index)
        }));
        setCandidateImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleCandidateChange = (index, field, value) => {
        setForm(prev => {
            const updated = { ...prev };
            updated[field][index] = value;
            return updated;
        });
    };

    // Helper function to check for duplicates in candidate names
    const getCandidateNameValidation = (index, name) => {
        if (!name || name.trim() === '') return { isValid: true, message: '' };

        const trimmedName = name.trim().toLowerCase();
        const duplicateIndex = form.candidateNames.findIndex((candidateName, i) =>
            i !== index && candidateName.trim().toLowerCase() === trimmedName
        );

        if (duplicateIndex !== -1) {
            return {
                isValid: false,
                message: `Duplicate candidate name with Candidate ${duplicateIndex + 1}`
            };
        }

        return { isValid: true, message: '' };
    };

    // Check if there are any duplicate candidate names
    const hasDuplicateNames = () => {
        const candidateNamesLower = form.candidateNames
            .filter(name => name.trim() !== '')
            .map(name => name.trim().toLowerCase());

        const hasDuplicateCandidates = candidateNamesLower.length !== new Set(candidateNamesLower).size;

        return hasDuplicateCandidates;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!canCreateElections) {
            setError("You are not allowed to create elections.");
            return;
        }

        // Validate form
        if (form.candidateNames.some(name => !name || !name.trim())) {
            setError("All candidate names are required");
            return;
        }

        // Check minimum candidate count
        const validCandidateNames = form.candidateNames.filter(name => name.trim() !== '');
        if (validCandidateNames.length < 2) {
            setError("At least 2 candidates are required for an election");
            return;
        }

        // Check for duplicate names
        if (hasDuplicateNames()) {
            setError("Candidate names must be unique. Please remove any duplicate names.");
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

        // Enhanced guardian and quorum validation
        const guardianCount = parseInt(form.guardianNumber) || 0;
        const quorumCount = parseInt(form.quorumNumber) || 0;

        if (guardianCount <= 0) {
            setError("Number of guardians must be at least 1");
            return;
        }

        if (quorumCount <= 0) {
            setError("Quorum number must be at least 1");
            return;
        }

        if (quorumCount > guardianCount) {
            setError(`Quorum number (${quorumCount}) cannot be greater than the number of guardians (${guardianCount})`);
            return;
        }

        const maxChoicesVal = parseInt(form.maxChoices) || 1;
        if (maxChoicesVal < 1) {
            setError("Max choices must be at least 1");
            return;
        }
        if (maxChoicesVal > validCandidateNames.length) {
            setError(`Max choices (${maxChoicesVal}) cannot exceed the number of candidates (${validCandidateNames.length})`);
            return;
        }

        if (form.guardianEmails.length === 0 || form.guardianEmails.length < guardianCount) {
            setError(`At least ${guardianCount} guardian emails are required`);
            return;
        }

        setError("");
        setIsSubmitting(true);

        try {
            const electionData = {
                ...form,
                partyNames: validCandidateNames.map((_, index) => `${index + 1}`),
                partyPictures: []
            };

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
            {emailSuggestions.map((suggestion, index) => (
                <div
                    key={index}
                    className="px-4 py-2 hover:bg-blue-50 cursor-pointer flex items-center justify-between transition-colors"
                    onClick={() => addGuardianEmail(suggestion.email)}
                >
                    <div className="flex items-center flex-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white mr-3 font-semibold">
                            @
                        </div>
                        <div className="flex-1">
                            <div className="font-medium text-gray-800">{suggestion.email}</div>
                            <div className="text-xs text-gray-500">
                                {isValidEmail(suggestion.email) ? "Valid email format" : "Complete the email"}
                            </div>
                        </div>
                    </div>
                    <div className="text-blue-500 text-sm">
                        Click to add
                    </div>
                </div>
            ))}
            {emailSuggestions.length === 0 && searchQuery.length > 0 && (
                <div className="px-4 py-3 text-gray-500 text-center">
                    <div className="mb-1">💡 Type your email address</div>
                    <div className="text-xs">Suggestions will appear as you type</div>
                </div>
            )}
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto p-3 sm:p-6">
            <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-gray-800">Create New Election</h1>

            {checkingPermission && (
                <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-3 rounded mb-4">
                    Verifying your election creation permission...
                </div>
            )}

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
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
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

                    <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                        Election start and end time are set later, after key ceremony completion.
                    </div>
                </div>

                {/* Election Privacy Settings */}
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Privacy Settings</h2>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">Election Privacy</label>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
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
                                <label className="inline-flex items-center justify-center w-full sm:w-auto px-4 py-2 bg-blue-500 text-white rounded-md cursor-pointer hover:bg-blue-600">
                                    <span>Upload CSV</span>
                                    <input
                                        type="file"
                                        accept=".csv,.txt"
                                        onChange={handleVoterCSVUpload}
                                        className="hidden"
                                    />
                                </label>
                                <span className="text-gray-500 text-sm block sm:inline sm:ml-2 mt-2 sm:mt-0">Upload a CSV/TXT file with one email per line or comma-separated</span>
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
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Guardian Settings</h2>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">
                            Number of Guardians <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            name="guardianNumber"
                            value={form.guardianNumber}
                            onChange={handleChange}
                            min="1"
                            max="20"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Enter number of guardians (1-20)"
                        />
                        <p className="text-sm text-gray-600 mt-1">
                            Choose any number of guardians between 1 and 20. More guardians provide better security through distributed key management.
                        </p>
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">
                            Quorum Threshold <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="number"
                            name="quorumNumber"
                            value={form.quorumNumber}
                            onChange={handleChange}
                            min="1"
                            max={form.guardianNumber}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={form.guardianNumber ? `Enter quorum (1-${form.guardianNumber})` : 'Set guardian count first'}
                        />
                        <p className="text-sm text-gray-600 mt-1">
                            Minimum number of guardians needed to decrypt the election results (must be ≤ {form.guardianNumber || 0}).
                            Default is set to more than half ({form.guardianNumber ? Math.floor(parseInt(form.guardianNumber) / 2) + 1 : 0}). 
                            This enables fault tolerance - if some guardians are unavailable, the election can still be decrypted.
                        </p>
                        {/* Validation message */}
                        {(() => {
                            const guardianCount = parseInt(form.guardianNumber) || 0;
                            const quorumCount = parseInt(form.quorumNumber) || 0;

                            if (quorumCount > guardianCount && guardianCount > 0) {
                                return (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                                        ⚠️ Quorum cannot be greater than the number of guardians ({guardianCount})
                                    </div>
                                );
                            }

                            if (quorumCount <= 0 && guardianCount > 0) {
                                return (
                                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                                        ⚠️ Quorum must be at least 1
                                    </div>
                                );
                            }

                            if (quorumCount > 0 && guardianCount > 0 && quorumCount <= guardianCount) {
                                const isDefault = quorumCount === Math.floor(guardianCount / 2) + 1;
                                return (
                                    <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                                        ✓ Valid quorum: {quorumCount} out of {guardianCount} guardians required
                                        {isDefault && ' (default recommended value)'}
                                    </div>
                                );
                            }

                            return null;
                        })()}
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium mb-2">
                            Guardian Emails <span className="text-red-500">*</span>
                        </label>

                        {/* File Upload for Guardian Emails */}
                        <div className="mb-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Upload Guardian Emails (CSV/TXT)</p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Upload a file with one email per line or comma-separated. This will automatically set the guardian count and quorum.
                                    </p>
                                </div>
                                <label className="cursor-pointer inline-flex items-center justify-center w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
                                    Choose File
                                    <input
                                        type="file"
                                        accept=".txt,.csv"
                                        onChange={handleGuardianFileUpload}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            <div className="text-xs text-gray-500 mt-2">
                                Supported formats: .txt, .csv (max 20 guardians)
                            </div>
                        </div>

                        {/* Manual Email Input */}
                        <div className="mb-2">
                            <p className="text-sm font-medium text-gray-700 mb-2">Or add emails manually:</p>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => searchEmails(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && searchQuery.trim()) {
                                            e.preventDefault();
                                            // If there are suggestions, add the first one
                                            if (emailSuggestions.length > 0) {
                                                addGuardianEmail(emailSuggestions[0].email);
                                            } else if (isValidEmail(searchQuery.trim())) {
                                                // Otherwise, if the typed email is valid, add it
                                                addGuardianEmail(searchQuery.trim());
                                            }
                                        }
                                    }}
                                    placeholder="Type email address (e.g., user@gmail.com)..."
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />

                                {emailSuggestions.length > 0 && renderEmailSuggestions()}
                            </div>
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

                        <div className="mt-2 text-sm text-gray-600">
                            <div>{form.guardianEmails.length} of {form.guardianNumber || 0} guardians added</div>
                            <div className="text-xs mt-1">💡 Tip: Upload a file for bulk import or press Enter to add email manually</div>
                        </div>
                    </div>
                </div>

                {/* Candidate Information */}
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-700">Candidates</h2>
                            <p className="text-sm text-gray-500 mt-1">
                                Add each candidate with a clear name and optional photo for better ballot recognition.
                            </p>
                        </div>
                        <div className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                            {form.candidateNames.length} candidate{form.candidateNames.length !== 1 ? 's' : ''}
                        </div>
                    </div>

                    {form.candidateNames.map((name, index) => {
                        const candidateValidation = getCandidateNameValidation(index, name);

                        return (
                            <div
                                key={index}
                                className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-4 shadow-sm"
                            >
                                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                                    <h3 className="font-semibold text-slate-800">Candidate {index + 1}</h3>

                                    {index > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => removeCandidate(index)}
                                            disabled={form.candidateNames.length <= 2}
                                            className={`text-sm ${form.candidateNames.length <= 2
                                                    ? 'text-gray-400 cursor-not-allowed'
                                                    : 'text-red-500 hover:text-red-700'
                                                }`}
                                            title={form.candidateNames.length <= 2 ? 'At least 2 candidates are required' : 'Remove candidate'}
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    <div className="lg:col-span-7">
                                        <label className="block text-slate-700 text-sm font-medium mb-1">
                                            Candidate Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            placeholder={`Enter name for candidate ${index + 1}`}
                                            onChange={(e) => handleCandidateChange(index, 'candidateNames', e.target.value)}
                                            className={`w-full px-3 py-2.5 border rounded-lg shadow-sm focus:outline-none focus:ring-2 transition-colors ${!candidateValidation.isValid
                                                    ? 'border-red-500 bg-red-50 text-red-900 focus:ring-red-500'
                                                    : 'border-slate-300 bg-white focus:ring-blue-500'
                                                }`}
                                            required
                                        />
                                        {!candidateValidation.isValid && (
                                            <p className="mt-1 text-sm text-red-600 flex items-center">
                                                <span className="mr-1">⚠️</span>
                                                {candidateValidation.message}
                                            </p>
                                        )}
                                        <p className="mt-2 text-xs text-slate-500">
                                            Use full names to avoid ambiguity for voters.
                                        </p>
                                    </div>

                                    <div className="lg:col-span-5">
                                        <label className="block text-slate-700 text-sm font-medium mb-1">
                                            Candidate Picture
                                        </label>
                                        <ImageUpload
                                            currentImage={candidateImages[index]}
                                            onImageUpload={(file) => handleImageChange(index, file)}
                                            uploadType="candidate"
                                            size="compact"
                                            placeholder="Upload candidate picture"
                                        />
                                    </div>
                                </div>
                            </div>
                        )
                    })}

                    <div className="mb-4 p-4 border border-gray-200 rounded-md bg-gray-50">
                        <label className="block text-gray-700 font-medium mb-2">
                            Max Choices <span className="text-red-500">*</span>
                        </label>
                        <p className="text-sm text-gray-500 mb-2">
                            How many candidates can each voter select? (1 = single choice, more = multiple choice)
                        </p>
                        <input
                            type="number"
                            name="maxChoices"
                            value={form.maxChoices}
                            onChange={handleChange}
                            min={1}
                            max={form.candidateNames.filter(n => n.trim() !== '').length || 1}
                            className="w-full sm:w-32 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            required
                        />
                        {form.maxChoices > 1 && (
                            <p className="text-sm text-blue-600 mt-2">
                                ℹ️ Voters will be able to select up to {form.maxChoices} candidates.
                            </p>
                        )}
                    </div>

                    {/* Validation Summary */}
                    {(form.candidateNames.filter(name => name.trim() !== '').length < 2 || hasDuplicateNames()) && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                            <div className="flex items-center">
                                <span className="text-yellow-600 mr-2">⚠️</span>
                                <div className="text-yellow-800">
                                    {form.candidateNames.filter(name => name.trim() !== '').length < 2 && (
                                        <p className="text-sm">• At least 2 candidates are required to create an election</p>
                                    )}
                                    {hasDuplicateNames() && (
                                        <p className="text-sm">• Remove duplicate candidate names before proceeding</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={addCandidate}
                        className="mt-2 w-full sm:w-auto px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    >
                        + Add Another Candidate
                    </button>
                </div>

                <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-between">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="w-full sm:w-auto px-6 py-3 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                    >
                        Cancel
                    </button>

                    <button
                        type="submit"
                        disabled={isSubmitting || form.candidateNames.filter(name => name.trim() !== '').length < 2 || hasDuplicateNames()}
                        className={`w-full sm:w-auto px-6 py-3 text-white rounded-md ${isSubmitting || form.candidateNames.filter(name => name.trim() !== '').length < 2 || hasDuplicateNames()
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-blue-500 hover:bg-blue-600'
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
