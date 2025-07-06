// src/pages/AllElections.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AllElections from "../pages/AllElections";
import * as api from "../utils/api";

// 1) Mock the API module
vi.mock("../utils/api", () => ({
  fetchAllElections: vi.fn(),
}));

// 2) Mock react-router navigate if your component uses it
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// 3) Simple Router wrapper
const RouterWrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("AllElections Component", () => {
//   it("renders loading state initially", () => {
//     // Never resolves → stays loading
//     api.fetchAllElections.mockReturnValue(new Promise(() => {}));

//     render(<AllElections />, { wrapper: RouterWrapper });

//     expect(screen.getByText(/loading/i)).toBeInTheDocument();
//   });

    it("displays an error message on fetch failure", async () => {
  // Make the mock reject
  api.fetchAllElections.mockRejectedValueOnce(new Error("Network Failure"));

  render(<AllElections />, { wrapper: RouterWrapper });

  // Your component should render something like: <h3 role="alert">Error loading elections</h3>
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent(/error loading elections/i);
});
  it("displays elections after successful fetch", async () => {
    const mockData = [
      { electionId: "1", electionTitle: "Test Election" },
    ];
    api.fetchAllElections.mockResolvedValueOnce(mockData);

    render(<AllElections />, { wrapper: RouterWrapper });

    // Wait for the title of your mock election to appear
    expect(
      await screen.findByText("Test Election")
    ).toBeInTheDocument();
  });
});
