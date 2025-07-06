// src/__tests__/CreateElection.test.jsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import CreateElection from "../pages/CreateElection";

// Mock react-datepicker (required for the component)
vi.mock("react-datepicker", () => ({
  default: vi.fn(({ onChange, selected }) => (
    <input
      data-testid="datepicker"
      value={selected ? selected.toString() : ""}
      onChange={(e) => onChange(new Date(e.target.value))}
    />
  )),
}));

// Mock other dependencies (minimal mocks for now)
vi.mock("react-hot-toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => <div data-testid="toaster" />,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => mockNavigate,
}));

// Wrapper component for React Router
const RouterWrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("CreateElection Component", () => {
  it("should render the basic form elements", () => {
    render(<CreateElection />, { wrapper: RouterWrapper });

    // Verify basic elements are present
    expect(screen.getByText("Create New Election")).toBeInTheDocument();
    expect(screen.getByText("Election Title")).toBeInTheDocument();
    expect(screen.getByText("Election Description")).toBeInTheDocument();
    expect(screen.getByText("Basic Information")).toBeInTheDocument();
    expect(screen.getByText("Create Election")).toBeInTheDocument();
  });
});