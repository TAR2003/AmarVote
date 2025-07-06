import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import Hello from "../pages/Hello";

// Mock fetch globally
globalThis.fetch = vi.fn();

describe("Hello Component", () => {
  beforeEach(() => {
    // Reset fetch mock before each test
    fetch.mockClear();
    fetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("Default test message"),
    });
  });

  it("renders loading message initially", () => {
    fetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
    render(<Hello />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("displays backend message on successful fetch", async () => {
    const mockMessage = "Backend is healthy!";
    fetch.mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(mockMessage),
    });

    render(<Hello />);

    await waitFor(() => {
      expect(screen.getByText(mockMessage)).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith("/api/health", {
      credentials: "include",
    });
  });

  it("displays error message on fetch failure", async () => {
    fetch.mockRejectedValueOnce(new Error("Network error"));

    render(<Hello />);

    await waitFor(() => {
      expect(screen.getByText("Error: Network error")).toBeInTheDocument();
    });
  });

  it("displays error message on non-ok response", async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
    });

    render(<Hello />);

    await waitFor(() => {
      expect(
        screen.getByText("Error: Failed to fetch /api/health")
      ).toBeInTheDocument();
    });
  });

  it("renders with correct structure", () => {
    fetch.mockImplementationOnce(() => new Promise(() => {})); // Never resolves
    render(<Hello />);
    
    expect(screen.getByRole("heading", { name: "Backend says:" })).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });
});
