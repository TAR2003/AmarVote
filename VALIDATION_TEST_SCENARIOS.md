# Test Scenarios for Election Validation

## Test Case 1: Minimum Candidate Validation

### Steps:
1. Navigate to Create Election page
2. Fill in basic election information
3. Try to create election with only 1 candidate

### Expected Result:
- ❌ Submit button should be disabled
- ❌ Yellow warning box should appear: "At least 2 candidates are required to create an election"
- ❌ Form submission should be blocked

## Test Case 2: Duplicate Candidate Names

### Steps:
1. Add 2 candidates
2. Name first candidate "John Smith"
3. Name second candidate "john smith" (different case)

### Expected Result:
- ❌ Second input field should turn red background
- ❌ Error message: "⚠️ Duplicate candidate name with Candidate 1"
- ❌ Submit button should be disabled
- ❌ Warning box should show: "Remove duplicate candidate or party names before proceeding"

## Test Case 3: Duplicate Party Names

### Steps:
1. Add 2 candidates with unique names
2. Set first party as "Democratic Party"
3. Set second party as "DEMOCRATIC PARTY" (different case)

### Expected Result:
- ❌ Second party input field should turn red background
- ❌ Error message: "⚠️ Duplicate party name with Candidate 1"
- ❌ Submit button should be disabled
- ❌ Warning box should show duplicate warning

## Test Case 4: Successful Election Creation

### Steps:
1. Add 2+ candidates with unique names
2. Add unique party names for each candidate
3. Fill all required fields
4. Submit form

### Expected Result:
- ✅ All input fields should have normal styling
- ✅ No warning messages should appear
- ✅ Submit button should be enabled
- ✅ Form should submit successfully

## Test Case 5: Remove Button Validation

### Steps:
1. Start with 2 candidates
2. Try to remove one candidate

### Expected Result:
- ❌ Remove button should be disabled (gray color)
- ❌ Tooltip should show: "At least 2 candidates are required"
- ❌ Clicking remove should show error message

## Test Case 6: Real-time Validation

### Steps:
1. Add 3 candidates
2. Type duplicate name in third candidate
3. Clear the duplicate name
4. Type unique name

### Expected Result:
- ❌ Red styling appears when duplicate is typed
- ⚠️ Warning message appears immediately
- ✅ Red styling disappears when duplicate is cleared
- ✅ Submit button becomes enabled when all validation passes

## Backend Validation Test

### Steps:
1. Use API tool (Postman) to send election creation request
2. Include duplicate candidate names in request
3. Submit request

### Expected Result:
- ❌ Server should return error 400 (Bad Request)
- ❌ Error message: "Candidate names must be unique - duplicate name found: [name]"
- ❌ Election should not be created in database

## Integration Test

### Steps:
1. Bypass frontend validation (disable JavaScript)
2. Submit form with duplicate names
3. Verify backend catches the issue

### Expected Result:
- ❌ Backend validation should prevent creation
- ❌ User should see appropriate error message
- ❌ No invalid election data in database
