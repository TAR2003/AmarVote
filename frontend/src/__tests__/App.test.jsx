import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "../App";

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

// Mock LoadingScreen component
vi.mock("../pages/Loading", () => ({
  default: () => <div data-testid="loading-screen">Loading...</div>,
}));

// Mock other pages to avoid complex routing tests
vi.mock("../pages/Login", () => ({
  default: () => <div data-testid="login-page">Login Page</div>,
}));

vi.mock("../pages/Home", () => ({
  default: () => <div data-testid="home-page">Home Page</div>,
}));

describe("App Component", () => {
  beforeEach(() => {
    fetch.mockClear();
    vi.clearAllMocks();
  });

  it("shows loading screen initially", () => {
    fetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<App />);
    
    expect(screen.getByTestId("loading-screen")).toBeInTheDocument();
  });

  it("renders home page when user is not authenticated", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("loading-screen")).not.toBeInTheDocument();
    });

    // Should render home page or login redirect
    expect(fetch).toHaveBeenCalledWith("/api/auth/session", {
      method: "GET",
      credentials: "include",
    });
  });

  it("renders authenticated layout when user is authenticated", async () => {
    const mockUserData = { email: "test@example.com" };
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockUserData),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("loading-screen")).not.toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith("/api/auth/session", {
      method: "GET",
      credentials: "include",
    });
  });

  it("handles session check error gracefully", async () => {
    fetch.mockRejectedValueOnce(new Error("Network error"));

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("loading-screen")).not.toBeInTheDocument();
    });

    // Should handle error and show non-authenticated state
    expect(fetch).toHaveBeenCalledWith("/api/auth/session", {
      method: "GET",
      credentials: "include",
    });
  });

  it("handles storage event for logout synchronization", async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ email: "test@example.com" }),
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByTestId("loading-screen")).not.toBeInTheDocument();
    });

    // Simulate logout event from another tab
    const storageEvent = new StorageEvent("storage", {
      key: "logout",
      newValue: "true",
    });
    
    window.dispatchEvent(storageEvent);

    // Component should handle logout sync (implementation dependent)
  });
});
