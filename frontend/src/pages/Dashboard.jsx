import React from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard({ userEmail, setUserEmail }) {
    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            const res = await fetch("http://localhost:8080/api/auth/logout", {
                method: "POST",
                credentials: "include", // send cookies so backend can clear it
            });

            if (!res.ok) throw new Error("Logout failed");

            setUserEmail(""); // clear email from app state
            localStorage.setItem("logout", Date.now()); // notify other tabs
            navigate("/login");
        } catch (err) {
            console.error("Logout error:", err);
        }
    };

    if (!userEmail) {
        // If no email, user is probably logged out or not authenticated
        return <p>You are not logged in. Please login first.</p>;
    }

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
            <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-md text-center">
                <h1 className="text-2xl font-bold text-blue-600 mb-4">Welcome to AmarVote</h1>
                <p className="text-gray-700 mb-2">
                    <strong>Email:</strong> {userEmail}
                </p>
                <button
                    onClick={handleLogout}
                    className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
                >
                    Log Out
                </button>
            </div>
        </div>
    );
}
