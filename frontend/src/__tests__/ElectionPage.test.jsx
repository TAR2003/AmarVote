// src/__tests__/ElectionPage.test.jsx
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

// Mock react-router-dom
vi.mock("react-router-dom", async () => {
    const actual = await vi.importActual("react-router-dom");
    return {
        ...actual,
        useParams: () => ({ id: "123" }),
    };
});

// Mock electionApi
vi.mock("../utils/electionApi", () => ({
    electionApi: {
        getElectionById: vi.fn(),
    },
}));

import { electionApi } from "../utils/electionApi";
import ElectionPage from "../pages/ElectionPage";

describe("ElectionPage Component", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders election information when data is loaded", async () => {
        const mockElection = {
            electionId: "123",
            electionTitle: "Mock Election",
            electionDescription: "This is a mock.",
            startingTime: "2025-07-01T00:00:00Z",
            endingTime: "2025-07-02T00:00:00Z",
            electionChoices: [],
            userRoles: ["voter"],
            hasVoted: false,
        };
        electionApi.getElectionById.mockResolvedValueOnce(mockElection);

        render(
            <MemoryRouter initialEntries={["/elections/123"]}>
                <Routes>
                    <Route path="/elections/:id" element={<ElectionPage />} />
                </Routes>
            </MemoryRouter>
        );

        // More specific query to handle multiple elements
        const electionTitles = await screen.findAllByText(/Mock Election/);
        expect(electionTitles.length).toBeGreaterThan(0); // At least one exists
        expect(screen.getByText(/This is a mock\./)).toBeInTheDocument();
    });

    it("displays an error message on API failure", async () => {
        electionApi.getElectionById.mockRejectedValueOnce(new Error("Fetch failed"));

        render(
            <MemoryRouter initialEntries={["/elections/123"]}>
                <Routes>
                    <Route path="/elections/:id" element={<ElectionPage />} />
                </Routes>
            </MemoryRouter>
        );

        // More flexible error detection that works with different implementations
        await waitFor(() => {
            // Check for common error indicators
            const errorIndicator = screen.queryByRole('alert') ||
                screen.queryByText(/error/i) ||
                screen.queryByText(/fail/i) ||
                screen.queryByText(/unable/i) ||
                screen.queryByText(/fetch/i);

            expect(errorIndicator).toBeInTheDocument();
        }, { timeout: 2000 }); // Extended timeout for async operations
    });
    it("displays loading indicator while fetching election data", async () => {
        const mockElection = {
            electionId: "123",
            electionTitle: "Mock Election",
            // ... other fields
        };

        // Delay the mock response
        electionApi.getElectionById.mockImplementationOnce(
            () => new Promise((resolve) => setTimeout(() => resolve(mockElection), 200))
        );

        render(
            <MemoryRouter initialEntries={["/elections/123"]}>
                <Routes>
                    <Route path="/elections/:id" element={<ElectionPage />} />
                </Routes>
            </MemoryRouter>
        );

        // Look for common loading text patterns
        expect(screen.getByText(/loading/i)).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
        });
    });
});