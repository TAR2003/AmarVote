import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FiUpload, FiUser, FiArrowLeft, FiArrowRight, FiCheck } from "react-icons/fi";
import { electionApi } from "../utils/electionApi";
import { uploadCandidateImage, getProfileSettings } from "../utils/api";
import { userApi } from "../utils/userApi";
import CandidatePhotoField from "../components/CandidatePhotoField";
import TruncatedCandidateName from "../components/TruncatedCandidateName";
import VoterListEditor from "../components/VoterListEditor";

const WIZARD_STEPS = [
    { id: "basics", label: "Basics", hint: "Title, description, co-admins" },
    { id: "privacy", label: "Privacy", hint: "Visibility and voter list" },
    { id: "guardians", label: "Guardians", hint: "Key holders and quorum" },
    { id: "candidates", label: "Candidates", hint: "Choices and winners" },
    { id: "review", label: "Review", hint: "Confirm and create" },
];

const CreateElection = () => {
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [emailSuggestions, setEmailSuggestions] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [canCreateElections, setCanCreateElections] = useState(false);
    const [checkingPermission, setCheckingPermission] = useState(true);
    const [wizardStep, setWizardStep] = useState(0);
    const [attemptedContinue, setAttemptedContinue] = useState(false);
    const [currentUserEmail, setCurrentUserEmail] = useState("");
    const suggestionsRef = useRef(null);
    const candidateFileInputRef = useRef(null);
    const wizardTopRef = useRef(null);

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
        candidateDescriptions: ["", ""],
        enableCandidateProfiles: false,
        totalCandidates: "2",
        maxChoices: "1",
        winnerNo: "1",
        sendBallotReceipt: false,
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

        const loadCurrentUser = async () => {
            try {
                const profile = await getProfileSettings();
                if (isMounted && profile?.email) {
                    setCurrentUserEmail(String(profile.email).trim().toLowerCase());
                }
            } catch {
                // Co-admin self-check will be skipped if profile cannot be loaded.
            }
        };
        loadCurrentUser();

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

        if (name === 'guardianNumber') {
            // Guardian count is driven by the email list; keep typed value only when empty list.
            setForm((prev) => ({
                ...prev,
                [name]: value,
            }));
        } else if (name === 'quorumNumber') {
            // Allow any input so invalid values can show validation UI.
            setForm((prev) => ({ ...prev, [name]: value }));
        } else if (name === 'electionPrivacy') {
            setForm((prev) => ({
                ...prev,
                electionPrivacy: value,
                // Private elections always require a listed voter roll.
                electionEligibility: value === 'private' ? 'listed' : prev.electionEligibility,
            }));
        } else {
            setForm((prev) => ({ ...prev, [name]: value }));
        }
    };

    // Handle voter list updates
    const setVoterEmails = (voterEmails) => {
        setForm((prev) => ({ ...prev, voterEmails }));
    };

    const setCoAdminEmails = (coAdminEmails) => {
        const creator = currentUserEmail.toLowerCase();
        const filtered = creator
            ? coAdminEmails.filter((email) => String(email).trim().toLowerCase() !== creator)
            : coAdminEmails;
        setForm((prev) => ({ ...prev, coAdminEmails: filtered }));
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

                setForm((prev) => ({ 
                    ...prev, 
                    guardianEmails: uniqueEmails,
                    guardianNumber: uniqueEmails.length.toString(),
                    // Keep existing quorum; do not auto-rewrite it.
                }));

                // Show success message
                let message = `Successfully uploaded ${uniqueEmails.length} guardian email(s)`;
                if (invalidCount > 0) {
                    message += ` (${invalidCount} invalid email(s) skipped)`;
                }
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
            
            setForm(prev => ({
                ...prev,
                guardianEmails: newGuardianEmails,
                guardianNumber: newGuardianCount.toString(),
            }));
        }
        setSearchQuery("");
        setEmailSuggestions([]);
    };

    const removeGuardianEmail = (email) => {
        const newGuardianEmails = form.guardianEmails.filter(e => e !== email);
        const newGuardianCount = newGuardianEmails.length;
        
        setForm(prev => ({
            ...prev,
            guardianEmails: newGuardianEmails,
            guardianNumber: newGuardianCount > 0 ? newGuardianCount.toString() : "",
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
            const descriptions = [...(prev.candidateDescriptions || [])];
            while (names.length < n) {
                names.push("");
                pictures.push("");
                descriptions.push("");
            }
            while (names.length > n) {
                names.pop();
                pictures.pop();
                descriptions.pop();
            }
            return {
                ...prev,
                totalCandidates: rawCount === null || rawCount === undefined ? "" : String(rawCount),
                candidateNames: names,
                candidatePictures: pictures,
                candidateDescriptions: descriptions,
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
                candidateDescriptions: uniqueNames.map((_, i) => prev.candidateDescriptions?.[i] || ""),
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
            const descriptions = (prev.candidateDescriptions || []).filter((_, i) => i !== index);
            return {
                ...prev,
                totalCandidates: names.length === 0 ? "" : String(names.length),
                candidateNames: names,
                candidatePictures: pictures,
                candidateDescriptions: descriptions,
            };
        });
        setCandidateImages((prev) => prev.filter((_, i) => i !== index));
    };

    const handleCandidateChange = (index, field, value) => {
        setForm((prev) => {
            const list = [...(prev[field] || [])];
            list[index] = value;
            return { ...prev, [field]: list };
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

    const guardianCountValue = parseInt(form.guardianNumber, 10) || form.guardianEmails.length || 0;
    const quorumCountValue = form.quorumNumber === "" ? NaN : parseInt(form.quorumNumber, 10);
    const isQuorumBlank = form.quorumNumber === "" || form.quorumNumber === null || form.quorumNumber === undefined;
    const isQuorumOutOfRange =
        !isQuorumBlank &&
        (Number.isNaN(quorumCountValue) ||
            quorumCountValue < 1 ||
            (guardianCountValue > 0 && quorumCountValue > guardianCountValue));

    const stepFieldErrors = useMemo(() => {
        const errors = {};
        const stepId = WIZARD_STEPS[wizardStep]?.id;

        if (stepId === "basics") {
            if (!form.electionTitle.trim()) {
                errors.electionTitle = "Please enter an election title.";
            }
        }

        if (stepId === "privacy") {
            if (form.electionPrivacy === "private" && form.voterEmails.length === 0) {
                errors.voterEmails = "Add at least one voter email for a private election.";
            } else if (form.electionEligibility === "listed" && form.voterEmails.length === 0) {
                errors.voterEmails = "Add the voter list for listed-eligibility elections.";
            }
        }

        if (stepId === "guardians") {
            if (guardianCountValue <= 0) {
                errors.guardianNumber = "Add at least one guardian email.";
            } else if (guardianCountValue > 20) {
                errors.guardianNumber = "Number of guardians cannot exceed 20.";
            }
            if (form.guardianEmails.length < guardianCountValue) {
                errors.guardianEmails = `Add ${guardianCountValue} guardian email${guardianCountValue === 1 ? "" : "s"}.`;
            }
            if (isQuorumBlank) {
                errors.quorumNumber = "Enter a quorum between 1 and the number of guardians.";
            } else if (Number.isNaN(quorumCountValue) || quorumCountValue < 1) {
                errors.quorumNumber = "Quorum must be at least 1.";
            } else if (guardianCountValue > 0 && quorumCountValue > guardianCountValue) {
                errors.quorumNumber = `Quorum (${quorumCountValue}) cannot exceed the number of guardians (${guardianCountValue}).`;
            }
        }

        if (stepId === "candidates") {
            if (isTotalCandidatesInvalid(form.totalCandidates)) {
                errors.totalCandidates = "Total candidates must be at least 2.";
            }
            if (form.candidateNames.some((name) => !name || !name.trim())) {
                errors.candidateNames = "Every candidate needs a name.";
            } else if (hasDuplicateNames()) {
                errors.candidateNames = "Candidate names must be unique.";
            }
            if (isMaxChoicesInvalid(form.maxChoices, form.totalCandidates)) {
                errors.maxChoices = "Max choices must be at least 1 and cannot exceed total candidates.";
            }
            if (isMaxChoicesInvalid(form.winnerNo, form.totalCandidates)) {
                errors.winnerNo = "Number of winners must be at least 1 and cannot exceed total candidates.";
            }
        }

        return errors;
    }, [
        wizardStep,
        form.electionTitle,
        form.electionPrivacy,
        form.electionEligibility,
        form.voterEmails.length,
        form.guardianNumber,
        form.guardianEmails.length,
        form.quorumNumber,
        form.totalCandidates,
        form.candidateNames,
        form.maxChoices,
        form.winnerNo,
        guardianCountValue,
        isQuorumBlank,
        quorumCountValue,
    ]);

    const isCurrentStepComplete = Object.keys(stepFieldErrors).length === 0;

    const validateWizardStep = (stepIndex = wizardStep) => {
        // Force field-level messages to appear when Continue is pressed.
        setAttemptedContinue(true);
        const previousStep = wizardStep;
        // Recompute against requested step by temporarily using stepFieldErrors for current only.
        // For navigation we validate the current step before advancing.
        if (stepIndex !== previousStep) {
            // Caller uses default current step in practice.
        }
        if (!isCurrentStepComplete) {
            const firstError = Object.values(stepFieldErrors)[0];
            if (firstError) setError(firstError);
            return false;
        }
        return true;
    };

    const goToStep = (nextIndex) => {
        setError("");
        setAttemptedContinue(false);
        setWizardStep(nextIndex);
        requestAnimationFrame(() => {
            wizardTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    };

    const handleWizardBack = () => {
        if (wizardStep === 0) {
            navigate(-1);
            return;
        }
        goToStep(wizardStep - 1);
    };

    const handleWizardNext = () => {
        if (!canCreateElections) {
            setError("You are not allowed to create elections.");
            return;
        }
        setAttemptedContinue(true);
        if (!isCurrentStepComplete) {
            const firstError = Object.values(stepFieldErrors)[0];
            if (firstError) setError(firstError);
            return;
        }
        if (wizardStep >= WIZARD_STEPS.length - 1) {
            if (!validateForm()) return;
            setError("");
            createElection();
            return;
        }
        goToStep(wizardStep + 1);
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

    const createElection = async () => {
        const validCandidateNames = form.candidateNames.filter(name => name.trim() !== '');

        setError("");
        setIsSubmitting(true);

        try {
            const validIndexes = form.candidateNames
                .map((name, index) => ({ name, index }))
                .filter(({ name }) => name.trim() !== "")
                .map(({ index }) => index);
            const {
                enableCandidateProfiles,
                totalCandidates,
                candidateDescriptions,
                ...formRest
            } = form;
            const electionData = {
                ...formRest,
                candidateNames: validCandidateNames,
                maxChoices: getMaxChoicesNumber(form.maxChoices),
                winnerNo: getMaxChoicesNumber(form.winnerNo || form.maxChoices),
                partyNames: validCandidateNames.map((_, index) => `${index + 1}`),
                partyPictures: [],
                candidatePictures: validIndexes.map((i) => form.candidatePictures[i] || ""),
                candidateDescriptions: enableCandidateProfiles
                    ? validIndexes.map((i) => (candidateDescriptions?.[i] || "").trim())
                    : validIndexes.map(() => ""),
            };

            const response = await electionApi.createElection(electionData);
            setSuccess("Election created successfully!");

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
            className="mb-2 mr-2 inline-flex items-center rounded-lg bg-glacier px-2.5 py-1.5 text-sm text-ink"
        >
            <span className="mr-1">{email}</span>
            <button
                type="button"
                onClick={() => onRemove(email)}
                className="ml-1 rounded p-0.5 text-brand-dark hover:bg-paper/70 hover:text-deep"
            >
                ×
            </button>
        </div>
    );

    // Render Email Suggestions Dropdown
    const renderEmailSuggestions = () => (
        <div
            ref={suggestionsRef}
            className="glass-panel absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-xl"
        >
            {emailSuggestions.map((suggestion, index) => (
                <div
                    key={index}
                    className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-glacier/70"
                    onClick={() => addGuardianEmail(suggestion.email)}
                >
                    <div className="flex items-center flex-1">
                        <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-dark text-sm font-semibold text-paper">
                            @
                        </div>
                        <div className="flex-1">
                            <div className="font-medium text-ink">{suggestion.email}</div>
                            <div className="text-xs text-dusk capitalize">
                                {suggestion.source ? `${suggestion.source} account` : "Registered user"}
                            </div>
                        </div>
                    </div>
                    <div className="text-sm text-brand-dark">
                        Click to add
                    </div>
                </div>
            ))}
            {emailSuggestions.length === 0 && searchQuery.length > 0 && (
                <div className="px-4 py-3 text-center text-dusk">
                    <div className="mb-1">Enter an email address</div>
                    <div className="text-xs">Suggestions will appear as you type</div>
                </div>
            )}
        </div>
    );

    return (
        <div ref={wizardTopRef} className="mx-auto max-w-4xl px-1 py-2 sm:px-2 sm:py-4 page-enter">
            <header className="mb-6 overflow-hidden rounded-3xl bg-deep-aurora px-5 py-6 text-paper shadow-lift sm:mb-8 sm:px-8 sm:py-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dusk-soft">Create election</p>
                <h1 className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">Build in clear steps</h1>
                <p className="mt-2 max-w-2xl text-base leading-relaxed text-dusk-soft">
                    Complete one section at a time. Your progress is kept until you submit.
                </p>
                <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-paper/15">
                    <div
                        className="h-full rounded-full bg-brand transition-all duration-500"
                        style={{ width: `${((wizardStep + 1) / WIZARD_STEPS.length) * 100}%` }}
                    />
                </div>
                <ol className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {WIZARD_STEPS.map((step, index) => {
                        const done = index < wizardStep;
                        const active = index === wizardStep;
                        return (
                            <li key={step.id}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (index <= wizardStep) goToStep(index);
                                    }}
                                    disabled={index > wizardStep}
                                    className={`flex w-full min-h-14 flex-col items-start gap-0.5 rounded-2xl border px-3 py-2 text-left transition ${
                                        active
                                            ? "border-brand/50 bg-paper/15"
                                            : done
                                              ? "border-white/20 bg-paper/10 hover:bg-paper/15"
                                              : "border-white/10 bg-paper/5 opacity-60"
                                    }`}
                                >
                                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-brand-light">
                                        {done ? <FiCheck className="h-3 w-3" /> : null}
                                        Step {index + 1}
                                    </span>
                                    <span className="font-display text-sm font-semibold">{step.label}</span>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </header>

            {checkingPermission && (
                <div className="mb-4 rounded-xl border border-brand/25 bg-glacier px-4 py-3 text-sm text-ink">
                    Verifying your election creation permission...
                </div>
            )}

            {error && (
                <div className="mb-4 rounded-xl border border-ember/30 bg-ember-soft px-4 py-3 text-sm text-ember" role="alert">
                    {error}
                </div>
            )}

            {success && (
                <div className="mb-4 rounded-xl border border-sage/25 bg-sage-soft px-4 py-3 text-sm text-sage">
                    {success}
                </div>
            )}

            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    handleWizardNext();
                }}
                className="space-y-5 sm:space-y-6"
            >
                {/* Basic Election Information */}
                {wizardStep === 0 && (
                <>
                <section className="surface-card p-4 sm:p-6 animate-fade-up">
                    <div className="mb-5">
                        <p className="section-kicker">Step 1 of {WIZARD_STEPS.length}</p>
                        <h2 className="mt-1 font-display text-2xl font-bold text-deep">Basics</h2>
                        <p className="mt-1 text-sm text-dusk">{WIZARD_STEPS[0].hint}</p>
                    </div>

                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-semibold text-ink">
                            Election Title <span className="text-ember">*</span>
                        </label>
                        <input
                            type="text"
                            name="electionTitle"
                            value={form.electionTitle}
                            onChange={handleChange}
                            className={`input-field ${
                                stepFieldErrors.electionTitle
                                    ? "border-ember bg-ember-soft focus:ring-ember"
                                    : ""
                            }`}
                            required
                        />
                        {stepFieldErrors.electionTitle && (
                            <p className="mt-1 text-xs text-ember">{stepFieldErrors.electionTitle}</p>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-semibold text-ink">
                            Election Description
                        </label>
                        <textarea
                            name="electionDescription"
                            value={form.electionDescription}
                            onChange={handleChange}
                            className="input-field h-28 resize-y"
                        />
                    </div>

                    <div className="rounded-xl border border-brand/20 bg-glacier/75 p-3 text-sm text-ink">
                        Election start and end time are set later, after key ceremony completion.
                    </div>
                </section>

                {/* Co-Administrators */}
                <section className="surface-card p-4 sm:p-6">
                    <p className="section-kicker">Administration</p>
                    <h2 className="mt-1 font-display text-2xl font-bold text-deep">Co-administrators</h2>
                    <p className="mb-4 mt-2 text-sm text-dusk">
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
                        excludedEmails={currentUserEmail ? [currentUserEmail] : []}
                        excludedEmailMessage="You are already the election administrator, so you cannot add yourself as a co-admin."
                    />
                </section>
                </>
                )}

                {/* Election Privacy Settings */}
                {wizardStep === 1 && (
                <section className="surface-card p-4 sm:p-6 animate-fade-up">
                    <div className="mb-5">
                        <p className="section-kicker">Step 2 of {WIZARD_STEPS.length}</p>
                        <h2 className="mt-1 font-display text-2xl font-bold text-deep">Privacy & eligibility</h2>
                        <p className="mt-1 text-sm text-dusk">{WIZARD_STEPS[1].hint}</p>
                    </div>

                    <div className="mb-4">
                        <label className="mb-3 block text-sm font-semibold text-ink">Election privacy</label>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <label className="flex min-h-11 items-center rounded-xl border border-ink/10 bg-frost px-3 text-sm font-medium text-ink">
                                <input
                                    type="radio"
                                    name="electionPrivacy"
                                    value="public"
                                    checked={form.electionPrivacy === "public"}
                                    onChange={handleChange}
                                    className="form-radio h-5 w-5 text-brand"
                                />
                                <span className="ml-2">Public</span>
                            </label>

                            <label className="flex min-h-11 items-center rounded-xl border border-ink/10 bg-frost px-3 text-sm font-medium text-ink">
                                <input
                                    type="radio"
                                    name="electionPrivacy"
                                    value="private"
                                    checked={form.electionPrivacy === "private"}
                                    onChange={handleChange}
                                    className="form-radio h-5 w-5 text-brand"
                                />
                                <span className="ml-2">Private</span>
                            </label>
                        </div>
                    </div>

                    <div className="mb-4">
                        <label className="mb-3 block text-sm font-semibold text-ink">Voter eligibility</label>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <label className="flex min-h-11 items-center rounded-xl border border-ink/10 bg-frost px-3 text-sm font-medium text-ink">
                                <input
                                    type="radio"
                                    name="electionEligibility"
                                    value="listed"
                                    checked={form.electionEligibility === "listed"}
                                    onChange={handleChange}
                                    className="form-radio h-5 w-5 text-brand"
                                />
                                <span className="ml-2">Listed voters only</span>
                            </label>

                            {form.electionPrivacy !== "private" && (
                                <label className="flex min-h-11 items-center rounded-xl border border-ink/10 bg-frost px-3 text-sm font-medium text-ink">
                                    <input
                                        type="radio"
                                        name="electionEligibility"
                                        value="unlisted"
                                        checked={form.electionEligibility === "unlisted"}
                                        onChange={handleChange}
                                        className="form-radio h-5 w-5 text-brand"
                                    />
                                    <span className="ml-2">Anyone can vote</span>
                                </label>
                            )}
                        </div>
                        {form.electionPrivacy === "private" && (
                            <p className="mt-2 text-sm text-dusk">
                                Private elections require a listed voter roll, so open voting is not available.
                            </p>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="av-check-row">
                            <input
                                type="checkbox"
                                name="sendBallotReceipt"
                                checked={form.sendBallotReceipt}
                                onChange={(e) => setForm((prev) => ({ ...prev, sendBallotReceipt: e.target.checked }))}
                                className="av-checkbox mt-0.5"
                            />
                            <span>
                                <span className="block text-sm font-semibold text-ink">Send ballot receipts by email</span>
                                <span className="mt-1 block text-sm text-dusk">
                                    When enabled, voters receive an email receipt after casting their ballot. Admins and co-admins can change this later on the election page.
                                </span>
                            </span>
                        </label>
                    </div>

                    {(form.electionPrivacy === "private" || form.electionEligibility === "listed") && (
                        <div className="mb-4">
                            <label className="mb-3 block text-sm font-semibold text-ink">
                                Voter Emails
                                {(form.electionPrivacy === "private" || form.electionEligibility === "listed") && (
                                    <span className="text-ember">*</span>
                                )}
                            </label>
                            <div
                                className={
                                    stepFieldErrors.voterEmails
                                        ? "rounded-xl border-2 border-ember p-1"
                                        : ""
                                }
                            >
                                <VoterListEditor
                                    emails={form.voterEmails}
                                    onChange={setVoterEmails}
                                    onRemove={removeVoterEmail}
                                    onRemoveAll={removeAllVoterEmails}
                                />
                            </div>
                            {stepFieldErrors.voterEmails && (
                                <p className="mt-2 text-xs text-ember">{stepFieldErrors.voterEmails}</p>
                            )}
                        </div>
                    )}
                </section>
                )}

                {/* Guardian Settings */}
                {wizardStep === 2 && (
                <section className="surface-card p-4 sm:p-6 animate-fade-up">
                    <div className="mb-5">
                        <p className="section-kicker">Step 3 of {WIZARD_STEPS.length}</p>
                        <h2 className="mt-1 font-display text-2xl font-bold text-deep">Guardians</h2>
                        <p className="mt-2 text-sm text-dusk">Set the key holders and the threshold required to decrypt election results.</p>
                    </div>

                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-semibold text-ink">
                            Guardian Emails <span className="text-ember">*</span>
                        </label>

                        <div className="mb-3 rounded-xl border border-brand/20 bg-glacier/70 p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                                <div>
                                    <p className="text-sm font-semibold text-ink">Upload guardian emails (CSV/TXT)</p>
                                    <p className="mt-1 text-xs text-dusk">
                                        Upload a file with one email per line or comma-separated. The guardian count updates automatically from the list.
                                    </p>
                                </div>
                                <label className="btn-brand w-full cursor-pointer sm:w-auto">
                                    Choose File
                                    <input
                                        type="file"
                                        accept=".txt,.csv"
                                        onChange={handleGuardianFileUpload}
                                        className="hidden"
                                    />
                                </label>
                            </div>
                            <div className="mt-2 text-xs text-dusk">
                                Supported formats: .txt, .csv (max 20 guardians)
                            </div>
                        </div>

                        <div className="mb-2">
                            <p className="mb-2 text-sm font-semibold text-ink">Or add emails manually</p>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => searchEmails(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && searchQuery.trim()) {
                                            e.preventDefault();
                                            if (emailSuggestions.length > 0) {
                                                addGuardianEmail(emailSuggestions[0].email);
                                            } else if (isValidEmail(searchQuery.trim())) {
                                                addGuardianEmail(searchQuery.trim());
                                            }
                                        }
                                    }}
                                    placeholder="Type email address (e.g., user@gmail.com)..."
                                    className={`input-field ${
                                        stepFieldErrors.guardianEmails
                                            ? "border-ember bg-ember-soft focus:ring-ember"
                                            : ""
                                    }`}
                                />

                                {emailSuggestions.length > 0 && renderEmailSuggestions()}
                            </div>
                        </div>

                        <div
                            className={`min-h-[100px] rounded-xl border bg-frost/60 p-3 ${
                                stepFieldErrors.guardianEmails || stepFieldErrors.guardianNumber
                                    ? "border-2 border-ember"
                                    : "border-ink/10"
                            }`}
                        >
                            <div className="flex flex-wrap">
                                {form.guardianEmails.length > 0 ? (
                                    form.guardianEmails.map(email => renderEmailTag(email, removeGuardianEmail))
                                ) : (
                                    <span className="text-sm text-dusk">No guardian emails added yet</span>
                                )}
                            </div>
                        </div>

                        <div className="mt-2 text-sm text-dusk">
                            <div>{form.guardianEmails.length} guardian{form.guardianEmails.length === 1 ? "" : "s"} added</div>
                            <div className="mt-1 text-xs">Upload a file for bulk import or press Enter to add an email manually.</div>
                        </div>
                        {(stepFieldErrors.guardianEmails || stepFieldErrors.guardianNumber) && (
                            <p className="mt-2 text-xs text-ember">
                                {stepFieldErrors.guardianEmails || stepFieldErrors.guardianNumber}
                            </p>
                        )}
                    </div>

                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-semibold text-ink">
                            Quorum Threshold <span className="text-ember">*</span>
                        </label>
                        <input
                            type="number"
                            name="quorumNumber"
                            value={form.quorumNumber}
                            onChange={handleChange}
                            min="1"
                            max={guardianCountValue || undefined}
                            className={`input-field ${
                                isQuorumBlank || isQuorumOutOfRange || stepFieldErrors.quorumNumber
                                    ? "border-2 border-ember bg-ember-soft focus:ring-ember"
                                    : ""
                            }`}
                            placeholder={
                                guardianCountValue > 0
                                    ? `Enter quorum (1-${guardianCountValue})`
                                    : "Add guardians first, then enter quorum"
                            }
                        />
                        <p className="mt-1 text-sm text-dusk">
                            Minimum number of guardians needed to decrypt results
                            {guardianCountValue > 0 ? ` (must be between 1 and ${guardianCountValue})` : ""}.
                            Leave this blank until you choose a value — it will not be filled automatically.
                        </p>
                        {(isQuorumBlank || isQuorumOutOfRange || stepFieldErrors.quorumNumber) && (
                            <div className="mt-2 rounded-xl border border-ember/30 bg-ember-soft p-3 text-sm text-ember">
                                {isQuorumBlank
                                    ? "Enter a quorum between 1 and the number of guardians."
                                    : isQuorumOutOfRange && guardianCountValue > 0 && quorumCountValue > guardianCountValue
                                    ? `Quorum (${quorumCountValue}) is higher than the current guardian count (${guardianCountValue}). Lower the quorum or add more guardians.`
                                    : stepFieldErrors.quorumNumber || "Quorum must be a whole number of at least 1."}
                            </div>
                        )}
                        {!isQuorumBlank && !isQuorumOutOfRange && guardianCountValue > 0 && (
                            <div className="mt-2 rounded-xl border border-sage/25 bg-sage-soft p-3 text-sm text-sage">
                                Valid quorum: {quorumCountValue} out of {guardianCountValue} guardians required
                            </div>
                        )}
                    </div>
                </section>
                )}

                {/* Candidate Information */}
                {wizardStep === 3 && (
                <section className="surface-card p-4 sm:p-6 animate-fade-up">
                    <div className="mb-5">
                        <p className="section-kicker">Step 4 of {WIZARD_STEPS.length}</p>
                        <h2 className="mt-1 font-display text-2xl font-bold text-deep">Candidates</h2>
                        <p className="mt-2 text-sm text-dusk">
                            Set how many candidates voters can choose from, then enter each name below. Photos are optional.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-ink">
                                Total Candidates <span className="text-ember">*</span>
                            </label>
                            <input
                                type="number"
                                value={form.totalCandidates}
                                onChange={handleTotalCandidatesChange}
                                className={`input-field ${
                                    isTotalCandidatesInvalid(form.totalCandidates)
                                        ? "border-red-500 bg-ember-soft focus:ring-red-500"
                                        : ""
                                }`}
                            />
                            {isTotalCandidatesInvalid(form.totalCandidates) && (
                                <p className="mt-1 text-xs text-ember">
                                    Total number of candidates must be at least 2
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-ink">
                                Max Choices <span className="text-ember">*</span>
                            </label>
                            <input
                                type="number"
                                name="maxChoices"
                                value={form.maxChoices}
                                onChange={handleChange}
                                className={`input-field ${
                                    isMaxChoicesInvalid(form.maxChoices, form.totalCandidates)
                                        ? "border-red-500 bg-ember-soft focus:ring-red-500"
                                        : ""
                                }`}
                            />
                            {isMaxChoicesInvalid(form.maxChoices, form.totalCandidates) && (
                                <p className="mt-1 text-xs text-ember">
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
                            <label className="mb-2 block text-sm font-semibold text-ink">
                                Number of Winners <span className="text-ember">*</span>
                            </label>
                            <input
                                type="number"
                                name="winnerNo"
                                value={form.winnerNo}
                                onChange={handleChange}
                                className={`input-field ${
                                    isMaxChoicesInvalid(form.winnerNo, form.totalCandidates)
                                        ? "border-red-500 bg-ember-soft focus:ring-red-500"
                                        : ""
                                }`}
                            />
                            {isMaxChoicesInvalid(form.winnerNo, form.totalCandidates) && (
                                <p className="mt-1 text-xs text-ember">
                                    Number of winners must be at least 1 and cannot exceed the total number of candidates
                                </p>
                            )}
                            {!isMaxChoicesInvalid(form.winnerNo, form.totalCandidates) && (
                                <p className="text-xs text-ink mt-1">
                                    Top {getMaxChoicesNumber(form.winnerNo)} candidate{getMaxChoicesNumber(form.winnerNo) === 1 ? '' : 's'} will be declared winner{getMaxChoicesNumber(form.winnerNo) === 1 ? '' : 's'}.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="mb-4 rounded-xl border border-ink/10 bg-frost/70 p-4">
                        <p className="section-kicker">Candidate information</p>
                        <label className="av-check-row mt-3">
                            <input
                                type="checkbox"
                                checked={form.enableCandidateProfiles}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        enableCandidateProfiles: e.target.checked,
                                    }))
                                }
                                className="av-checkbox mt-0.5"
                            />
                            <span>
                                <span className="block text-sm font-semibold text-ink">
                                    Enable candidate profiles
                                </span>
                                <span className="mt-0.5 block text-xs text-dusk">
                                    When enabled, each candidate can include a description / manifesto
                                    (paragraphs and line breaks are preserved). Photos stay available either way.
                                </span>
                            </span>
                        </label>
                    </div>

                    <div className="mb-4 flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => candidateFileInputRef.current?.click()}
                            className="btn-ghost border-brand/20 bg-glacier/70 text-brand-dark"
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
                        <span className="text-xs text-dusk">One candidate name per line or comma-separated</span>
                    </div>

                    <div className="space-y-3 mb-5">
                        {form.candidateNames.map((name, index) => {
                            const candidateValidation = getCandidateNameValidation(index, name);
                            const isNameBlank = !name || !name.trim();
                            return (
                                <div key={index} className="rounded-xl border border-ink/10 bg-frost/60 p-3 sm:p-4">
                                    <div className="flex items-start gap-3">
                                        <span className="mt-3 w-6 text-xs font-semibold text-dusk">{index + 1}.</span>
                                        <div className="min-w-0 flex-1 space-y-3">
                                            <input
                                                type="text"
                                                value={name}
                                                placeholder={`Candidate ${index + 1} name`}
                                                onChange={(e) => handleCandidateChange(index, 'candidateNames', e.target.value)}
                                                className={`input-field ${
                                                    !candidateValidation.isValid
                                                        ? 'border-red-500 bg-ember-soft focus:ring-red-500'
                                                        : isNameBlank
                                                        ? 'border-red-500 bg-ember-soft focus:ring-red-500'
                                                        : 'bg-paper'
                                                }`}
                                            />
                                            {!candidateValidation.isValid && (
                                                <p className="text-xs text-ember">{candidateValidation.message}</p>
                                            )}
                                            {candidateValidation.isValid && isNameBlank && (
                                                <p className="text-xs text-ember">Candidate name is required</p>
                                            )}

                                            <div>
                                                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-dusk">
                                                    Candidate image
                                                </p>
                                                <CandidatePhotoField
                                                    imageUrl={candidateImages[index] || form.candidatePictures[index]}
                                                    candidateName={name}
                                                    onUpload={(file) => handleImageChange(index, file)}
                                                    onRemove={() => {
                                                        setCandidateImages((prev) => {
                                                            const next = [...prev];
                                                            next[index] = "";
                                                            return next;
                                                        });
                                                        setForm((prev) => {
                                                            const pics = [...prev.candidatePictures];
                                                            pics[index] = "";
                                                            return { ...prev, candidatePictures: pics };
                                                        });
                                                    }}
                                                />
                                            </div>

                                            {form.enableCandidateProfiles && (
                                                <div>
                                                    <label
                                                        htmlFor={`candidate-manifesto-${index}`}
                                                        className="mb-2 block text-xs font-semibold uppercase tracking-wide text-dusk"
                                                    >
                                                        Description / Manifesto
                                                    </label>
                                                    <textarea
                                                        id={`candidate-manifesto-${index}`}
                                                        rows={4}
                                                        value={form.candidateDescriptions?.[index] || ""}
                                                        onChange={(e) =>
                                                            handleCandidateChange(
                                                                index,
                                                                "candidateDescriptions",
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Optional bio or manifesto. Use line breaks and bullet-style lines as needed."
                                                        className="input-field min-h-[6rem] resize-y whitespace-pre-wrap"
                                                    />
                                                    <p className="mt-1 text-xs text-dusk">
                                                        Formatting tip: blank lines create paragraphs; start lines with • or - for bullets.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                        {form.candidateNames.length > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => removeCandidate(index)}
                                                className="mt-1 min-h-9 shrink-0 rounded-lg px-2 text-xs font-semibold text-ember hover:bg-ember-soft hover:text-ember"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {form.candidateNames.some((name) => name.trim()) && (
                        <div className="rounded-xl border border-ink/10 bg-frost/70 p-4">
                            <h3 className="mb-3 text-sm font-semibold text-ink">Added candidates</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {form.candidateNames
                                    .map((name, index) => ({
                                        name,
                                        index,
                                        image: candidateImages[index] || form.candidatePictures[index],
                                        description: form.enableCandidateProfiles
                                            ? form.candidateDescriptions?.[index]
                                            : "",
                                    }))
                                    .filter((item) => item.name.trim())
                                    .map((item) => (
                                        <div key={item.index} className="flex items-start gap-3 rounded-lg border border-white bg-paper px-3 py-2 shadow-sm">
                                            {item.image ? (
                                                <img src={item.image} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                                            ) : (
                                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-glacier text-brand-dark">
                                                    <FiUser className="h-4 w-4" />
                                                </div>
                                            )}
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium text-ink">
                                                    <TruncatedCandidateName name={item.name} lines={1} />
                                                </p>
                                                <p className="text-xs text-dusk">Candidate {item.index + 1}</p>
                                                {item.description?.trim() && (
                                                    <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-dusk">
                                                        {item.description.trim()}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    )}

                    {(form.candidateNames.filter(name => name.trim() !== '').length < 2 || hasDuplicateNames()) && (
                        <div className="mt-4 p-3 bg-ceremonial-soft border border-yellow-200 rounded-md text-sm text-ink">
                            {form.candidateNames.filter(name => name.trim() !== '').length < 2 && (
                                <p>• At least 2 candidates are required</p>
                            )}
                            {hasDuplicateNames() && (
                                <p>• Remove duplicate candidate names before proceeding</p>
                            )}
                        </div>
                    )}
                </section>
                )}

                {wizardStep === 4 && (
                <section className="surface-card p-4 sm:p-6 animate-fade-up">
                    <div className="mb-5">
                        <p className="section-kicker">Step 5 of {WIZARD_STEPS.length}</p>
                        <h2 className="mt-1 font-display text-2xl font-bold text-deep">Review</h2>
                        <p className="mt-2 text-sm text-dusk">Confirm everything looks right, then create the election.</p>
                    </div>
                    <div className="space-y-3 text-sm">
                        <div className="rounded-2xl border border-ink/10 bg-frost/70 p-4">
                            <p className="section-kicker">Basics</p>
                            <p className="mt-1 font-display text-lg font-semibold text-deep">{form.electionTitle || "—"}</p>
                            <p className="mt-1 text-dusk">{form.electionDescription || "No description"}</p>
                            <p className="mt-2 text-dusk">Co-admins: {form.coAdminEmails.length ? form.coAdminEmails.join(", ") : "None"}</p>
                        </div>
                        <div className="rounded-2xl border border-ink/10 bg-frost/70 p-4">
                            <p className="section-kicker">Privacy</p>
                            <p className="mt-1 text-ink"><span className="font-semibold">Visibility:</span> {form.electionPrivacy}</p>
                            <p className="text-ink"><span className="font-semibold">Eligibility:</span> {form.electionEligibility}</p>
                            <p className="text-ink"><span className="font-semibold">Voters:</span> {form.voterEmails.length || (form.electionEligibility === "unlisted" ? "Open" : "None")}</p>
                            <p className="text-ink"><span className="font-semibold">Receipts:</span> {form.sendBallotReceipt ? "Enabled" : "Disabled"}</p>
                        </div>
                        <div className="rounded-2xl border border-ink/10 bg-frost/70 p-4">
                            <p className="section-kicker">Guardians</p>
                            <p className="mt-1 text-ink">{form.guardianNumber} guardians · quorum {form.quorumNumber}</p>
                            <p className="mt-1 break-words text-dusk">{form.guardianEmails.join(", ") || "—"}</p>
                        </div>
                        <div className="rounded-2xl border border-ink/10 bg-frost/70 p-4">
                            <p className="section-kicker">Candidates</p>
                            <p className="mt-1 text-ink">Max choices {form.maxChoices} · winners {form.winnerNo}</p>
                            <p className="mt-1 text-ink">
                                Profiles: {form.enableCandidateProfiles ? "Enabled" : "Disabled"}
                            </p>
                            <ol className="mt-2 list-inside list-decimal space-y-2 text-ink">
                                {form.candidateNames.map((name, idx) => {
                                    if (!name.trim()) return null;
                                    const desc = form.enableCandidateProfiles
                                        ? form.candidateDescriptions?.[idx]
                                        : "";
                                    return (
                                        <li key={`${name}-${idx}`} className="min-w-0">
                                            <TruncatedCandidateName name={name} lines={1} />
                                            {desc?.trim() && (
                                                <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-xs text-dusk">
                                                    {desc.trim()}
                                                </p>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        </div>
                    </div>
                </section>
                )}

                <div className="wizard-rail">
                <div className="surface-card flex flex-col-reverse gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <button
                        type="button"
                        onClick={handleWizardBack}
                        className="btn-ghost w-full sm:w-auto"
                    >
                        <FiArrowLeft className="h-4 w-4" />
                        {wizardStep === 0 ? "Cancel" : "Back"}
                    </button>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <p className="text-center text-xs text-dusk sm:mr-2 sm:text-left">
                            {wizardStep + 1} / {WIZARD_STEPS.length}
                        </p>
                        <button
                            type="submit"
                            disabled={
                                checkingPermission ||
                                !canCreateElections ||
                                isSubmitting ||
                                (wizardStep < 4 && !isCurrentStepComplete) ||
                                (wizardStep === 4 && !isFormReadyForSubmit())
                            }
                            className="btn-brand w-full sm:w-auto"
                        >
                            {wizardStep === 4 ? (
                                isSubmitting ? "Creating..." : "Create election"
                            ) : (
                                <>
                                    Continue
                                    <FiArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
                </div>
            </form>
        </div>
    );
};

export default CreateElection;
