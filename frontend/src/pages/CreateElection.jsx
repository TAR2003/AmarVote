import React, { useState } from "react";

const CreateElection = () => {
    const [form, setForm] = useState({
        title: "",
        privacy: "public",
        eligibility: "",
        voterEmails: [],
        guardianNumber: 1,
        guardianEmails: [""]
        ,candidateNumber: 1,
        candidates: [{ name: "", party: "", description: "" }]
    });

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
                .filter(email => email.length > 0);
            setForm((prev) => ({ ...prev, voterEmails: emails }));
        };
        reader.readAsText(file);
    };

    const handleGuardianEmailChange = (idx, value) => {
        const emails = [...form.guardianEmails];
        emails[idx] = value;
        setForm((prev) => ({ ...prev, guardianEmails: emails }));
    };

    const handleGuardianNumberChange = (e) => {
        const number = parseInt(e.target.value, 10) || 1;
        setForm((prev) => ({
            ...prev,
            guardianNumber: number,
            guardianEmails: Array(number).fill("").map((v, i) => prev.guardianEmails[i] || "")
        }));
    };

    const handleCandidateNumberChange = (e) => {
        const number = parseInt(e.target.value, 10) || 1;
        setForm((prev) => ({
            ...prev,
            candidateNumber: number,
            candidates: Array(number).fill("").map((v, i) => prev.candidates && prev.candidates[i] ? prev.candidates[i] : { name: "", party: "", description: "" })
        }));
    };

    const handleCandidateChange = (idx, field, value) => {
        const updated = [...form.candidates];
        updated[idx] = { ...updated[idx], [field]: value };
        setForm((prev) => ({ ...prev, candidates: updated }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // TODO: Submit logic here
        alert("Election Created!\n" + JSON.stringify(form, null, 2));
    };

    return (
        <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow-md mt-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">Create Election</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                    <label className="block text-gray-700 font-medium mb-1">Election Title</label>
                    <input
                        type="text"
                        name="title"
                        value={form.title}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-gray-700 font-medium mb-1">Privacy Type</label>
                    <select
                        name="privacy"
                        value={form.privacy}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                    </select>
                </div>
                <div>
                    <label className="block text-gray-700 font-medium mb-1">Eligibility of Voter List (Upload CSV of Emails)</label>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleVoterCSVUpload}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {form.voterEmails.length > 0 && (
                        <div className="mt-2 text-sm text-green-700">
                            {form.voterEmails.length} emails loaded.
                        </div>
                    )}
                </div>
                <div>
                    <label className="block text-gray-700 font-medium mb-1">Candidate Number</label>
                    <input
                        type="number"
                        name="candidateNumber"
                        min="1"
                        value={form.candidateNumber}
                        onChange={handleCandidateNumberChange}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-gray-700 font-medium mb-1">Candidates</label>
                    {Array.from({ length: form.candidateNumber }).map((_, idx) => (
                        <div key={idx} className="mb-4 p-4 border rounded-lg bg-gray-50">
                            <label className="block text-gray-600 font-medium mb-1">Candidate #{idx + 1}</label>
                            <input
                                type="text"
                                value={form.candidates[idx]?.name || ""}
                                onChange={e => handleCandidateChange(idx, "name", e.target.value)}
                                required
                                placeholder="Candidate Name"
                                className="w-full px-3 py-2 border rounded-lg mb-2"
                            />
                            <input
                                type="text"
                                value={form.candidates[idx]?.party || ""}
                                onChange={e => handleCandidateChange(idx, "party", e.target.value)}
                                required
                                placeholder="Party Name"
                                className="w-full px-3 py-2 border rounded-lg mb-2"
                            />
                            <textarea
                                value={form.candidates[idx]?.description || ""}
                                onChange={e => handleCandidateChange(idx, "description", e.target.value)}
                                required
                                placeholder="Short Description"
                                className="w-full px-3 py-2 border rounded-lg"
                            />
                        </div>
                    ))}
                </div>
                <div>
                    <label className="block text-gray-700 font-medium mb-1">Guardian Number</label>
                    <input
                        type="number"
                        name="guardianNumber"
                        min="1"
                        value={form.guardianNumber}
                        onChange={handleGuardianNumberChange}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div>
                    <label className="block text-gray-700 font-medium mb-1">Guardian Emails</label>
                    {Array.from({ length: form.guardianNumber }).map((_, idx) => (
                        <input
                            key={idx}
                            type="email"
                            value={form.guardianEmails[idx] || ""}
                            onChange={(e) => handleGuardianEmailChange(idx, e.target.value)}
                            required
                            placeholder={`Guardian Email #${idx + 1}`}
                            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 mb-2"
                        />
                    ))}
                </div>
                <button
                    type="submit"
                    className="w-full py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Create Election
                </button>
            </form>
        </div>
    );
};

export default CreateElection;
