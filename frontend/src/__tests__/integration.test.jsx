import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import OtpLogin from "../pages/OtpLogin";
import Dashboard from "../pages/Dashboard";

// Mock fetch
globalThis.fetch = vi.fn();

// Mock complex components
vi.mock("../pages/Dashboard", () => ({
  default: () => <div data-testid="dashboard">Dashboard Page</div>,
}));

vi.mock("../pages/Layout", () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => <div data-testid="toaster" />,
}));

// Test App wrapper with routing
const TestApp = ({ initialEntries = ["/otp-login"] } = {}) => {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/" element={<OtpLogin setUserEmail={vi.fn()} />} />
        <Route path="/otp-login" element={<OtpLogin setUserEmail={vi.fn()} />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </MemoryRouter>
  );
};

describe("Integration Tests", () => {
  beforeEach(() => {
    fetch.mockClear();
    vi.clearAllMocks();
  });

  describe("Login to Dashboard Flow", () => {
    it("successfully logs in and navigates to dashboard", async () => {
      const user = userEvent.setup();

      // Mock successful login response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "test@example.com" }),
      });

      render(<TestApp />);

      // Fill in login form
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      // Wait for navigation to dashboard
      await waitFor(() => {
        expect(screen.getByTestId("dashboard")).toBeInTheDocument();
      });

      expect(fetch).toHaveBeenCalledWith("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: "test@example.com",
          password: "password123",
        }),
      });
    });

    it("handles failed login and stays on login page", async () => {
      const user = userEvent.setup();

      // Mock failed login response
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: "Invalid credentials" }),
      });

      render(<TestApp initialEntries={["/login"]} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "wrongpassword");
      await user.click(loginButton);

      // Should show error and stay on login page
      await waitFor(() => {
        expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
      });

      // Should still be on login page (dashboard should not be present)
      expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });
  });

  describe("Form Validation", () => {
    it("validates email format", async () => {
      const user = userEvent.setup();

      render(<TestApp initialEntries={["/login"]} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole("button", { name: /sign in/i });

      // Enter invalid email
      await user.type(emailInput, "invalid-email");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      // HTML5 validation should prevent submission
      expect(fetch).not.toHaveBeenCalled();
    });

    it("requires all fields to be filled", async () => {
      const user = userEvent.setup();

      render(<TestApp initialEntries={["/login"]} />);

      const loginButton = screen.getByRole("button", { name: /sign in/i });

      // Try to submit empty form
      await user.click(loginButton);

      // Should not make API call with empty fields
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("handles network errors", async () => {
      const user = userEvent.setup();

      // Mock network failure
      fetch.mockRejectedValueOnce(new Error("Network Error"));

      render(<TestApp initialEntries={["/login"]} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText("Network Error")).toBeInTheDocument();
      });
    });

    it("handles server errors", async () => {
      const user = userEvent.setup();

      // Mock server error
      fetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.reject(new Error("JSON parse error")),
      });

      render(<TestApp initialEntries={["/login"]} />);

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const loginButton = screen.getByRole("button", { name: /sign in/i });

      await user.type(emailInput, "test@example.com");
      await user.type(passwordInput, "password123");
      await user.click(loginButton);

      await waitFor(() => {
        expect(screen.getByText("Invalid login credentials")).toBeInTheDocument();
      });
    });
  });
});
