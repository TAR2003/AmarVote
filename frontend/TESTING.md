# Frontend Testing Guide

This document describes the testing setup and strategies for the AmarVote frontend application.

## Testing Stack

- **Vitest**: Fast unit test framework built for Vite
- **React Testing Library**: Testing utilities for React components
- **jsdom**: DOM environment for Node.js testing
- **@testing-library/jest-dom**: Custom matchers for DOM elements
- **@testing-library/user-event**: User interaction simulation

## Test Scripts

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Run tests with coverage report
npm run test:coverage
```

## Project Structure

```
src/
├── __tests__/           # Test files
│   ├── App.test.jsx
│   ├── Hello.test.jsx
│   ├── Home.test.jsx
│   ├── Login.test.jsx
│   ├── integration.test.jsx
│   └── utils.test.jsx
├── test/               # Test utilities and setup
│   ├── setup.js       # Global test setup
│   └── utils.js       # Test helper functions
└── pages/             # Application pages
```

## Testing Guidelines

### 1. Unit Tests
- Test individual components in isolation
- Mock external dependencies
- Focus on component behavior and user interactions

### 2. Integration Tests
- Test component interactions and workflows
- Test routing and navigation
- Test form submissions and API interactions

### 3. Test Organization
- Group related tests using `describe` blocks
- Use descriptive test names that explain what is being tested
- Follow the Arrange-Act-Assert pattern

### 4. Mocking Strategy
- Mock API calls using `vi.fn()`
- Mock complex components in integration tests
- Use test utilities for consistent mocking

## Example Test Structure

```javascript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe("ComponentName", () => {
  beforeEach(() => {
    // Setup before each test
    vi.clearAllMocks();
  });

  it("should render correctly", () => {
    render(<ComponentName />);
    expect(screen.getByText("Expected Text")).toBeInTheDocument();
  });

  it("should handle user interactions", async () => {
    const user = userEvent.setup();
    render(<ComponentName />);
    
    await user.click(screen.getByRole("button"));
    
    await waitFor(() => {
      expect(screen.getByText("Result")).toBeInTheDocument();
    });
  });
});
```

## Common Testing Patterns

### Testing Forms
```javascript
// Fill out form fields
await user.type(screen.getByLabelText(/email/i), "test@example.com");
await user.type(screen.getByLabelText(/password/i), "password");

// Submit form
await user.click(screen.getByRole("button", { name: /submit/i }));

// Assert results
await waitFor(() => {
  expect(mockApiCall).toHaveBeenCalledWith(expectedData);
});
```

### Testing API Calls
```javascript
// Mock fetch response
fetch.mockResolvedValueOnce({
  ok: true,
  json: () => Promise.resolve(mockData),
});

// Trigger action that makes API call
await user.click(submitButton);

// Assert API was called correctly
expect(fetch).toHaveBeenCalledWith("/api/endpoint", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(expectedData),
});
```

### Testing Navigation
```javascript
// Mock navigate function
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  ...vi.importActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Test navigation
await user.click(navigationButton);
expect(mockNavigate).toHaveBeenCalledWith("/expected-route");
```

## Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

## Running Tests

### Development Workflow
1. Write tests alongside feature development
2. Run tests in watch mode during development
3. Ensure all tests pass before committing
4. Check coverage reports regularly

### CI/CD Integration
Tests are configured to run automatically in the CI/CD pipeline and will block deployment if failing.

## Troubleshooting

### Common Issues

1. **Tests failing with "vi is not defined"**
   - Ensure globals are enabled in vite.config.js
   - Import vi from vitest if using explicit imports

2. **React Router errors in tests**
   - Wrap components with BrowserRouter in tests
   - Use the renderWithRouter utility

3. **API mocking not working**
   - Ensure fetch is mocked before the component renders
   - Clear mocks between tests in beforeEach

4. **DOM queries failing**
   - Use testing-library queries (getByRole, getByText, etc.)
   - Add data-testid attributes for complex queries

## Best Practices

1. **Write tests first** (TDD approach when possible)
2. **Test behavior, not implementation**
3. **Keep tests simple and focused**
4. **Use descriptive test names**
5. **Mock external dependencies**
6. **Test error conditions**
7. **Maintain good test coverage**
8. **Regularly review and refactor tests**

For more information, see:
- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library Documentation](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
