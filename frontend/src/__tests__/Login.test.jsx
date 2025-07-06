import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import Login from "../pages/Login";

// Mock fetch
globalThis.fetch = vi.fn();

// Mock toast notifications
vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => <div data-testid="toaster" />,
}));

// Mock Layout component
vi.mock("../pages/Layout", () => ({
  default: ({ children }) => <div data-testid="layout">{children}</div>,
}));

// Mock react-router-dom functions
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ state: null }),
  };
});

// Wrapper component for React Router
const RouterWrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("Login Component", () => {
  const mockSetUserEmail = vi.fn();

  beforeEach(() => {
    fetch.mockClear();
    mockNavigate.mockClear();
    mockSetUserEmail.mockClear();
    vi.clearAllMocks();
  });

  it("renders login form elements", () => {
    render(<Login setUserEmail={mockSetUserEmail} />, {
      wrapper: RouterWrapper,
    });

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("allows user to type in email and password fields", async () => {
    const user = userEvent.setup();
    render(<Login setUserEmail={mockSetUserEmail} />, {
      wrapper: RouterWrapper,
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");

    expect(emailInput).toHaveValue("test@example.com");
    expect(passwordInput).toHaveValue("password123");
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<Login setUserEmail={mockSetUserEmail} />, {
      wrapper: RouterWrapper,
    });

    const passwordInput = screen.getByLabelText(/password/i);
    
    // First type a password to make the toggle button appear
    await user.type(passwordInput, "test123");
    
    expect(passwordInput).toHaveAttribute("type", "password");

    // Find the toggle button by its role and click it
    const toggleButton = passwordInput.parentElement.querySelector('.cursor-pointer');
    expect(toggleButton).toBeInTheDocument();
    
    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(toggleButton);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("submits form with valid credentials", async () => {
    const user = userEvent.setup();
    const mockResponseData = { email: "test@example.com" };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResponseData),
    });

    render(<Login setUserEmail={mockSetUserEmail} />, {
      wrapper: RouterWrapper,
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    expect(fetch).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123",
      }),
    });

    await waitFor(() => {
      expect(mockSetUserEmail).toHaveBeenCalledWith("test@example.com");
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("displays error message on failed login", async () => {
    const user = userEvent.setup();
    const errorMessage = "Invalid login credentials";

    fetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ message: errorMessage }),
    });

    render(<Login setUserEmail={mockSetUserEmail} />, {
      wrapper: RouterWrapper,
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "wrongpassword");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });

    expect(mockSetUserEmail).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows loading state during form submission", async () => {
    const user = userEvent.setup();

    // Mock a slow response
    fetch.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: () => Promise.resolve({ email: "test@example.com" }),
            });
          }, 100);
        })
    );

    render(<Login setUserEmail={mockSetUserEmail} />, {
      wrapper: RouterWrapper,
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    // Should show loading state
    expect(submitButton).toBeDisabled();

    // Wait for submission to complete
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
    });
  });

  it("handles network errors gracefully", async () => {
    const user = userEvent.setup();

    fetch.mockRejectedValueOnce(new Error("Network error"));

    render(<Login setUserEmail={mockSetUserEmail} />, {
      wrapper: RouterWrapper,
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /sign in/i });

    await user.type(emailInput, "test@example.com");
    await user.type(passwordInput, "password123");
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });
});
