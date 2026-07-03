# Automated Tests for Critical Functionality

Automated unit testing was implemented using **Jest** to ensure the reliability of the system's core scheduling logic. 

## Testing Scope
The test suite specifically targets the `WorkerService` to validate the **Dynamic Retry Backoff Calculator**. Because the system relies heavily on delaying failed jobs to prevent database thrashing, calculating the exact millisecond delay is critical. 

The tests strictly validate the following strategies:
*   **Linear Backoff:** Ensures the delay increases proportionally to the number of attempts.
*   **Exponential Backoff:** Verifies the formula properly calculates delays using the $2^n$ growth curve for aggressive rate-limiting on failing APIs.
*   **Fixed Backoff:** Confirms the delay remains constant regardless of previous attempts.

## How to Run the Tests
To execute the automated test suite locally, navigate to the backend directory and use the standard NPM test script:

```bash
cd backend
npm test
```
