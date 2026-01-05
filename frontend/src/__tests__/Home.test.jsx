import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import Home from "../pages/Home";

// Wrapper component for React Router
const RouterWrapper = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe("Home Component", () => {
  it("renders the main heading and brand name", () => {
    render(<Home />, { wrapper: RouterWrapper });
    
    expect(screen.getByText("AmarVote")).toBeInTheDocument();
    expect(screen.getByText("🗳️")).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<Home />, { wrapper: RouterWrapper });
    
    // Get all feature links and check we have at least one
    const featureLinks = screen.getAllByRole("link", { name: /features/i });
    expect(featureLinks.length).toBeGreaterThan(0);
    
    const howItWorksLinks = screen.getAllByRole("link", { name: /how it works/i });
    expect(howItWorksLinks.length).toBeGreaterThan(0);
    
    const aboutLinks = screen.getAllByRole("link", { name: /about/i });
    expect(aboutLinks.length).toBeGreaterThan(0);
  });

  it("renders sign in and sign up buttons", () => {
    render(<Home />, { wrapper: RouterWrapper });
    
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });

  it("has correct link destinations", () => {
    render(<Home />, { wrapper: RouterWrapper });
    
    const signInLink = screen.getByRole("link", { name: /sign in/i });
    const signUpLink = screen.getByRole("link", { name: /sign up/i });
    
    expect(signInLink).toHaveAttribute("href", "/otp-login");
    expect(signUpLink).toHaveAttribute("href", "/signup");
  });

  it("renders with proper styling classes", () => {
    const { container } = render(<Home />, { wrapper: RouterWrapper });
    
    // Check if main container has the expected classes
    const mainDiv = container.firstChild;
    expect(mainDiv).toHaveClass("min-h-screen", "bg-gradient-to-br", "from-gray-50", "to-blue-50");
  });

  it("has accessible navigation structure", () => {
    render(<Home />, { wrapper: RouterWrapper });
    
    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
    expect(nav).toHaveClass("fixed", "w-full", "bg-white", "shadow-sm", "z-50");
  });
});
