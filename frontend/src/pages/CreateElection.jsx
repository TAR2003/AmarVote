import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { FiUpload, FiUser } from "react-icons/fi";
import { electionApi } from "../utils/electionApi";
import { uploadCandidateImage } from "../utils/api";
import { userApi } from "../utils/userApi";
import ImageUpload from "../components/ImageUpload";
import VoterListEditor from "../components/VoterListEditor";

const CreateElection = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [emailSuggestions, setEmailSuggestions] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [canCreateElections, setCanCreateElections] = useState(false);
    const [checkingPermission, setCheckingPermission] = useState(true);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const suggestionsRef = useRef(null);
    const candidateFileInputRef = useRef(null);

    const [form, setForm] = useState({
        electionTitle: "",
        electionDescription: "",
        electionPrivacy: "public",
        electionEligibility: "listed",
        voterEmails: [],
        guardianNumber: "",
        quorumNumber: "",
        guardianEmails: [],
        coAdminEmails: [],
        candidateNames: ["", ""],
        candidatePictures: ["", ""],
        totalCandidates: "2",
        maxChoices: "1",
        winnerNo: "1",
        sendBallotReceipt: false
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

    // Handle voter list updates
    const setVoterEmails = (voterEmails) => {
        setForm((prev) => ({ ...prev, voterEmails }));
    };

    const setCoAdminEmails = (coAdminEmails) => {
        setForm((prev) => ({ ...prev, coAdminEmails }));
    };

    const removeCoAdminEmail = (email) => {
        setForm((prev) => ({
            ...prev,
            coAdminEmails: prev.coAdminEmails.filter((e) => e !== email),
        }));
    };

    const removeAllCoAdminEmails = () => {
        setForm((prev) => ({ ...prev, coAdminEmails: [] }));
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

    const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    // Create a debounced search function for guardian email suggestions
    const debouncedSearch = useRef(
        debounce(async (query) => {
            if (!query || query.length < 2) {
                setEmailSuggestions([]);
                return;
            }

            try {
                const results = await userApi.searchUsers(query);
                const filtered = (results || [])
                    .filter((user) => !form.guardianEmails.includes(user.email))
                    .map((user) => ({
                        email: user.email,
                        source: user.source,
                    }));
                setEmailSuggestions(filtered);
            } catch (error) {
                console.error("Error searching users:", error);
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

    const removeAllVoterEmails = () => {
        setForm((prev) => ({ ...prev, voterEmails: [] }));
    };

    const parseTotalCandidates = (value) => {
        if (value === "" || value === null || value === undefined) {
            return 0;
        }
        const parsed = parseInt(String(value), 10);
        return Number.isNaN(parsed) || parsed < 0 ? 0 : Math.min(50, parsed);
    };

    const isTotalCandidatesInvalid = (value) => {
        if (value === "" || value === null || value === undefined) {
            return true;
        }
        const parsed = parseInt(String(value), 10);
        return Number.isNaN(parsed) || parsed < 2;
    };

    const getMaxChoicesNumber = (value) => {
        if (value === "" || value === null || value === undefined) {
            return NaN;
        }
        return parseInt(String(value), 10);
    };

    const isMaxChoicesInvalid = (maxChoicesValue, totalCandidatesValue) => {
        if (maxChoicesValue === "" || maxChoicesValue === null || maxChoicesValue === undefined) {
            return true;
        }
        const maxChoicesNum = getMaxChoicesNumber(maxChoicesValue);
        if (Number.isNaN(maxChoicesNum) || maxChoicesNum < 1) {
            return true;
        }
        const totalNum = parseTotalCandidates(totalCandidatesValue);
        return maxChoicesNum > totalNum;
    };

    // Candidates management
    const resizeCandidateSlots = (rawCount) => {
        const n = parseTotalCandidates(rawCount);
        setForm((prev) => {
            const names = [...prev.candidateNames];
            const pictures = [...prev.candidatePictures];
            while (names.length < n) {
                names.push("");
                pictures.push("");
            }
            while (names.length > n) {
                names.pop();
                pictures.pop();
            }
            return {
                ...prev,
                totalCandidates: rawCount === null || rawCount === undefined ? "" : String(rawCount),
                candidateNames: names,
                candidatePictures: pictures,
            };
        });
        setCandidateImages((prev) => {
            const imgs = [...prev];
            while (imgs.length < n) imgs.push("");
            while (imgs.length > n) imgs.pop();
            return imgs;
        });
    };

    const handleTotalCandidatesChange = (e) => {
        resizeCandidateSlots(e.target.value);
    };

    const handleCandidateFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const names = event.target.result
                .split(/\r?\n/)
                .flatMap((line) => line.split(/[,;\t]/))
                .map((name) => name.trim())
                .filter((name) => name.length > 0);

            if (names.length < 2) {
                setError("Candidate file must contain at least 2 names");
                setTimeout(() => setError(""), 3000);
                return;
            }

            const uniqueNames = [...new Set(names.map((n) => n.trim()))];
            resizeCandidateSlots(uniqueNames.length);
            setForm((prev) => ({
                ...prev,
                candidateNames: uniqueNames,
                candidatePictures: uniqueNames.map((_, i) => prev.candidatePictures[i] || ""),
            }));
            setSuccess(`Loaded ${uniqueNames.length} candidate name(s) from file.`);
            setTimeout(() => setSuccess(""), 4000);
            e.target.value = "";
        };
        reader.readAsText(file);
    };

    const removeCandidate = (index) => {
        setForm((prev) => {
            const names = prev.candidateNames.filter((_, i) => i !== index);
            const pictures = prev.candidatePictures.filter((_, i) => i !== index);
            return {
                ...prev,
                totalCandidates: names.length === 0 ? "" : String(names.length),
                candidateNames: names,
                candidatePictures: pictures,
            };
        });
        setCandidateImages((prev) => prev.filter((_, i) => i !== index));
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

    const isFormReadyForSubmit = () => {
        const validCandidateNames = form.candidateNames.filter(name => name.trim() !== '');
        return !isSubmitting
            && !isTotalCandidatesInvalid(form.totalCandidates)
            && !isMaxChoicesInvalid(form.maxChoices, form.totalCandidates)
            && validCandidateNames.length >= 2
            && !form.candidateNames.some(name => !name || !name.trim())
            && !hasDuplicateNames();
    };

    const validateForm = () => {
        if (isTotalCandidatesInvalid(form.totalCandidates)) {
            setError("Total number of candidates must be at least 2");
            return false;
        }

        if (form.candidateNames.some(name => !name || !name.trim())) {
            setError("All candidate names are required");
            return false;
        }

        const validCandidateNames = form.candidateNames.filter(name => name.trim() !== '');
        if (validCandidateNames.length < 2) {
            setError("At least 2 candidates are required for an election");
            return false;
        }

        if (hasDuplicateNames()) {
            setError("Candidate names must be unique. Please remove any duplicate names.");
            return false;
        }

        if (isMaxChoicesInvalid(form.maxChoices, form.totalCandidates)) {
            setError("Max choices must be at least 1 and cannot exceed the total number of candidates");
            return false;
        }

        if (form.electionPrivacy === "private" && form.voterEmails.length === 0) {
            setError("Voter list is required for private elections");
            return false;
        }

        if (form.electionEligibility === "listed" && form.voterEmails.length === 0) {
            setError("Voter list is required for listed eligibility elections");
            return false;
        }

        const guardianCount = parseInt(form.guardianNumber) || 0;
        const quorumCount = parseInt(form.quorumNumber) || 0;

        if (guardianCount <= 0) {
            setError("Number of guardians must be at least 1");
            return false;
        }

        if (quorumCount <= 0) {
            setError("Quorum number must be at least 1");
            return false;
        }

        if (quorumCount > guardianCount) {
            setError(`Quorum number (${quorumCount}) cannot be greater than the number of guardians (${guardianCount})`);
            return false;
        }

        const maxChoicesVal = getMaxChoicesNumber(form.maxChoices);
        if (Number.isNaN(maxChoicesVal) || maxChoicesVal < 1) {
            setError("Max choices must be at least 1");
            return false;
        }
        if (maxChoicesVal > validCandidateNames.length) {
            setError(`Max choices (${maxChoicesVal}) cannot exceed the number of candidates (${validCandidateNames.length})`);
            return false;
        }

        const winnerNoVal = getMaxChoicesNumber(form.winnerNo);
        if (Number.isNaN(winnerNoVal) || winnerNoVal < 1) {
            setError("Number of winners must be at least 1");
            return false;
        }
        if (winnerNoVal > validCandidateNames.length) {
            setError(`Number of winners (${winnerNoVal}) cannot exceed the number of candidates (${validCandidateNames.length})`);
            return false;
        }

        if (form.guardianEmails.length === 0 || form.guardianEmails.length < guardianCount) {
            setError(`At least ${guardianCount} guardian emails are required`);
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!canCreateElections) {
            setError("You are not allowed to create elections.");
            return;
        }

        if (!validateForm()) {
            return;
        }

        setError("");
        setShowConfirmModal(true);
    };

    const confirmCreateElection = async () => {
        const validCandidateNames = form.candidateNames.filter(name => name.trim() !== '');

        setError("");
        setIsSubmitting(true);

        try {
            const electionData = {
                ...form,
                maxChoices: getMaxChoicesNumber(form.maxChoices),
                winnerNo: getMaxChoicesNumber(form.winnerNo || form.maxChoices),
                partyNames: validCandidateNames.map((_, index) => `${index + 1}`),
                partyPictures: []
            };

            const response = await electionApi.createElection(electionData);
            setShowConfirmModal(false);
            setSuccess("Election created successfully!");

            setTimeout(() => {
                navigate(`/election-page/${response.electionId}`);
            }, 2000);
        } catch (err) {
            console.error("Error creating election:", err);
            setError(err.message || "Failed to create election. Please try again.");
            setShowConfirmModal(false);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render Email Tags Component
    const renderEmailTag = (email, onRemove) => (
        <div
            key={email}
            className="bg-glacier text-ink px-2 py-1 rounded-md inline-flex items-center mr-2 mb-2"
        >
            <span className="mr-1">{email}</span>
            <button
                type="button"
                onClick={() => onRemove(email)}
                className="text-brand hover:text-brand-dark"
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
                    className="px-4 py-2 hover:bg-glacier cursor-pointer flex items-center justify-between transition-colors"
                    onClick={() => addGuardianEmail(suggestion.email)}
                >
                    <div className="flex items-center flex-1">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white mr-3 font-semibold">
                            @
                        </div>
                        <div className="flex-1">
                            <div className="font-medium text-gray-800">{suggestion.email}</div>
                            <div className="text-xs text-gray-500 capitalize">
                                {suggestion.source ? `${suggestion.source} account` : "Registered user"}
                            </div>
                        </div>
                    </div>
                    <div className="text-brand text-sm">
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
                <div className="bg-glacier border border-blue-300 text-ink px-4 py-3 rounded mb-4">
                    Verifying your election creation permission...
                </div>
            )}

            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                </div>
            )}

            {success && (
                <div className="bg-sage-soft border border-green-400 text-sage px-4 py-3 rounded mb-4">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand h-24"
                        />
                    </div>

                    <div className="rounded-md border border-brand/20 bg-glacier p-3 text-sm text-ink">
                        Election start and end time are set later, after key ceremony completion.
                    </div>
                </div>

                {/* Co-Administrators */}
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
                    <h2 className="text-xl font-semibold mb-2 text-gray-700">Co-Administrators</h2>
                    <p className="text-sm text-gray-600 mb-4">
                        Optionally add co-admins who can manage this election with the same permissions as you.
                        Co-admin assignments are permanent once the election is created.
                    </p>
                    <VoterListEditor
                        emails={form.coAdminEmails}
                        onChange={setCoAdminEmails}
                        onRemove={removeCoAdminEmail}
                        onRemoveAll={removeAllCoAdminEmails}
                        emptyMessage="No co-admin emails added yet"
                        entityLabel="co-admin"
                    />
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
                                    className="form-radio h-5 w-5 text-brand"
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
                                    className="form-radio h-5 w-5 text-brand"
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
                                    className="form-radio h-5 w-5 text-brand"
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
                                    className="form-radio h-5 w-5 text-brand"
                                />
                                <span className="ml-2 text-gray-700">Anyone Can Vote</span>
                            </label>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="inline-flex items-start gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                name="sendBallotReceipt"
                                checked={form.sendBallotReceipt}
                                onChange={(e) => setForm((prev) => ({ ...prev, sendBallotReceipt: e.target.checked }))}
                                className="form-checkbox h-5 w-5 text-brand mt-0.5"
                            />
                            <span>
                                <span className="block text-gray-700 font-medium">Send ballot receipts by email</span>
                                <span className="block text-sm text-gray-600 mt-1">
                                    When enabled, voters receive an email receipt after casting their ballot. Admins and co-admins can change this later on the election page.
                                </span>
                            </span>
                        </label>
                    </div>

                    {(form.electionPrivacy === "private" || form.electionEligibility === "listed") && (
                        <div className="mb-4">
                            <label className="block text-gray-700 font-medium mb-3">
                                Voter Emails
                                {form.electionPrivacy === "private" && <span className="text-red-500">*</span>}
                            </label>
                            <VoterListEditor
                                emails={form.voterEmails}
                                onChange={setVoterEmails}
                                onRemove={removeVoterEmail}
                                onRemoveAll={removeAllVoterEmails}
                            />
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
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
                                    <div className="mt-2 p-2 bg-sage-soft border border-green-200 rounded text-sm text-sage">
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
                        <div className="mb-3 p-4 bg-glacier border border-brand/20 rounded-md">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                                <div>
                                    <p className="text-sm font-medium text-gray-700">Upload Guardian Emails (CSV/TXT)</p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Upload a file with one email per line or comma-separated. This will automatically set the guardian count and quorum.
                                    </p>
                                </div>
                                <label className="cursor-pointer inline-flex items-center justify-center w-full sm:w-auto bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-md text-sm font-medium transition-colors">
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
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
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
                    <div className="mb-5">
                        <h2 className="text-xl font-semibold text-gray-700">Candidates</h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Set how many candidates voters can choose from, then enter each name below. Photos are optional.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className="block text-gray-700 font-medium mb-2">
                                Total Candidates <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                value={form.totalCandidates}
                                onChange={handleTotalCandidatesChange}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                                    isTotalCandidatesInvalid(form.totalCandidates)
                                        ? "border-red-500 bg-red-50 focus:ring-red-500"
                                        : "border-gray-300 focus:ring-brand"
                                }`}
                            />
                            {isTotalCandidatesInvalid(form.totalCandidates) && (
                                <p className="mt-1 text-xs text-red-600">
                                    Total number of candidates must be at least 2
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-gray-700 font-medium mb-2">
                                Max Choices <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="maxChoices"
                                value={form.maxChoices}
                                onChange={handleChange}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                                    isMaxChoicesInvalid(form.maxChoices, form.totalCandidates)
                                        ? "border-red-500 bg-red-50 focus:ring-red-500"
                                        : "border-gray-300 focus:ring-brand"
                                }`}
                            />
                            {isMaxChoicesInvalid(form.maxChoices, form.totalCandidates) && (
                                <p className="mt-1 text-xs text-red-600">
                                    Max choices must be at least 1 and cannot exceed the total number of candidates
                                </p>
                            )}
                            {!isMaxChoicesInvalid(form.maxChoices, form.totalCandidates) && getMaxChoicesNumber(form.maxChoices) > 1 && (
                                <p className="text-xs text-brand mt-1">
                                    Voters can select up to {getMaxChoicesNumber(form.maxChoices)} candidates.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-gray-700 font-medium mb-2">
                                Number of Winners <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="winnerNo"
                                value={form.winnerNo}
                                onChange={handleChange}
                                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                                    isMaxChoicesInvalid(form.winnerNo, form.totalCandidates)
                                        ? "border-red-500 bg-red-50 focus:ring-red-500"
                                        : "border-gray-300 focus:ring-brand"
                                }`}
                            />
                            {isMaxChoicesInvalid(form.winnerNo, form.totalCandidates) && (
                                <p className="mt-1 text-xs text-red-600">
                                    Number of winners must be at least 1 and cannot exceed the total number of candidates
                                </p>
                            )}
                            {!isMaxChoicesInvalid(form.winnerNo, form.totalCandidates) && (
                                <p className="text-xs text-amber-700 mt-1">
                                    Top {getMaxChoicesNumber(form.winnerNo)} candidate{getMaxChoicesNumber(form.winnerNo) === 1 ? '' : 's'} will be declared winner{getMaxChoicesNumber(form.winnerNo) === 1 ? '' : 's'}.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => candidateFileInputRef.current?.click()}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-brand/20 bg-glacier text-brand-dark text-sm font-medium hover:bg-glacier"
                        >
                            <FiUpload className="h-4 w-4" />
                            Import Names (CSV/TXT)
                        </button>
                        <input
                            ref={candidateFileInputRef}
                            type="file"
                            accept=".csv,.txt"
                            onChange={handleCandidateFileUpload}
                            className="hidden"
                        />
                        <span className="text-xs text-gray-500">One candidate name per line or comma-separated</span>
                    </div>

                    <div className="space-y-3 mb-5">
                        {form.candidateNames.map((name, index) => {
                            const candidateValidation = getCandidateNameValidation(index, name);
                            const isNameBlank = !name || !name.trim();
                            return (
                                <div key={index} className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <span className="mt-2 text-xs font-semibold text-gray-500 w-6">{index + 1}.</span>
                                    <div className="flex-1 min-w-0">
                                        <input
                                            type="text"
                                            value={name}
                                            placeholder={`Candidate ${index + 1} name`}
                                            onChange={(e) => handleCandidateChange(index, 'candidateNames', e.target.value)}
                                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                                                !candidateValidation.isValid
                                                    ? 'border-red-500 bg-red-50 focus:ring-red-500'
                                                    : isNameBlank
                                                    ? 'border-red-500 bg-red-50 focus:ring-red-500'
                                                    : 'border-gray-300 bg-white focus:ring-brand'
                                            }`}
                                        />
                                        {!candidateValidation.isValid && (
                                            <p className="mt-1 text-xs text-red-600">{candidateValidation.message}</p>
                                        )}
                                        {candidateValidation.isValid && isNameBlank && (
                                            <p className="mt-1 text-xs text-red-600">Candidate name is required</p>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 w-12">
                                        <ImageUpload
                                            currentImage={candidateImages[index]}
                                            onImageUpload={(file) => handleImageChange(index, file)}
                                            uploadType="candidate"
                                            size="mini"
                                            placeholder=""
                                            iconOnly
                                        />
                                    </div>
                                    {form.candidateNames.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => removeCandidate(index)}
                                            className="mt-1 text-xs text-red-500 hover:text-red-700"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {form.candidateNames.some((name) => name.trim()) && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <h3 className="text-sm font-semibold text-slate-800 mb-3">Added Candidates</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {form.candidateNames
                                    .map((name, index) => ({ name, index, image: candidateImages[index] }))
                                    .filter((item) => item.name.trim())
                                    .map((item) => (
                                        <div key={item.index} className="flex items-center gap-3 rounded-lg border border-white bg-white px-3 py-2 shadow-sm">
                                            {item.image ? (
                                                <img src={item.image} alt={item.name} className="h-10 w-10 rounded-full object-cover" />
                                            ) : (
                                                <div className="h-10 w-10 rounded-full bg-glacier text-brand-dark flex items-center justify-center">
                                                    <FiUser className="h-4 w-4" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                                                <p className="text-xs text-gray-500">Candidate {item.index + 1}</p>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {(form.candidateNames.filter(name => name.trim() !== '').length < 2 || hasDuplicateNames()) && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                            {form.candidateNames.filter(name => name.trim() !== '').length < 2 && (
                                <p>• At least 2 candidates are required</p>
                            )}
                            {hasDuplicateNames() && (
                                <p>• Remove duplicate candidate names before proceeding</p>
                            )}
                        </div>
                    )}
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
                        disabled={!isFormReadyForSubmit()}
                        className={`w-full sm:w-auto px-6 py-3 text-white rounded-md ${!isFormReadyForSubmit()
                                ? 'bg-gray-400 cursor-not-allowed'
                                : 'bg-brand hover:bg-brand'
                            }`}
                    >
                        {isSubmitting ? 'Creating...' : 'Create Election'}
                    </button>
                </div>
            </form>

            {showConfirmModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
                        <div className="border-b border-gray-200 px-6 py-4">
                            <h2 className="text-xl font-bold text-gray-900">Confirm Election Details</h2>
                            <p className="text-sm text-gray-600 mt-1">Review everything before creating this election.</p>
                        </div>
                        <div className="px-6 py-5 space-y-5 text-sm">
                            <section>
                                <h3 className="font-semibold text-gray-900 mb-2">Basic Information</h3>
                                <p><span className="font-medium">Title:</span> {form.electionTitle}</p>
                                <p><span className="font-medium">Description:</span> {form.electionDescription || '—'}</p>
                            </section>
                            <section>
                                <h3 className="font-semibold text-gray-900 mb-2">Settings</h3>
                                <p><span className="font-medium">Privacy:</span> {form.electionPrivacy}</p>
                                <p><span className="font-medium">Eligibility:</span> {form.electionEligibility}</p>
                                <p><span className="font-medium">Max choices:</span> {form.maxChoices}</p>
                                <p><span className="font-medium">Winners:</span> Top {form.winnerNo || form.maxChoices}</p>
                                <p><span className="font-medium">Ballot receipts:</span> {form.sendBallotReceipt ? 'Enabled' : 'Disabled'}</p>
                            </section>
                            <section>
                                <h3 className="font-semibold text-gray-900 mb-2">Co-Admins ({form.coAdminEmails.length})</h3>
                                <p className="text-gray-700">{form.coAdminEmails.length ? form.coAdminEmails.join(', ') : 'None'}</p>
                            </section>
                            <section>
                                <h3 className="font-semibold text-gray-900 mb-2">Voters ({form.voterEmails.length})</h3>
                                <p className="text-gray-700 break-words">{form.voterEmails.length ? form.voterEmails.join(', ') : 'None / open eligibility'}</p>
                            </section>
                            <section>
                                <h3 className="font-semibold text-gray-900 mb-2">Guardians ({form.guardianEmails.length})</h3>
                                <p><span className="font-medium">Count / Quorum:</span> {form.guardianNumber} / {form.quorumNumber}</p>
                                <p className="text-gray-700 break-words mt-1">{form.guardianEmails.join(', ')}</p>
                            </section>
                            <section>
                                <h3 className="font-semibold text-gray-900 mb-2">Candidates ({form.candidateNames.filter(n => n.trim()).length})</h3>
                                <ol className="list-decimal list-inside text-gray-700 space-y-1">
                                    {form.candidateNames.filter(n => n.trim()).map((name) => (
                                        <li key={name}>{name}</li>
                                    ))}
                                </ol>
                            </section>
                        </div>
                        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-gray-200 px-6 py-4">
                            <button
                                type="button"
                                onClick={() => setShowConfirmModal(false)}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Go Back
                            </button>
                            <button
                                type="button"
                                onClick={confirmCreateElection}
                                disabled={isSubmitting}
                                className="px-5 py-2.5 rounded-lg bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
                            >
                                {isSubmitting ? 'Creating...' : 'Confirm & Create Election'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CreateElection;
