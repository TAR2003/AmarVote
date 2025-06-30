import React, { useState } from "react";

const CreateElection = () => {
    const [form, setForm] = useState({
        title: "",
        privacy: "public",
        eligibility: "",
        guardianNumber: 1,
        guardianEmails: [""]
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
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
                    <label className="block text-gray-700 font-medium mb-1">Eligibility of Voter List</label>
                    <input
                        type="text"
                        name="eligibility"
                        value={form.eligibility}
                        onChange={handleChange}
                        placeholder="e.g. All registered users"
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
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
