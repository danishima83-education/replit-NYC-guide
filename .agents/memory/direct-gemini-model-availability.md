---
name: Direct Gemini model availability
description: Model access behavior observed with the NYC guide's direct Google API key.
---

On November 7, 2026, the direct Gemini API rejected `gemini-2.5-flash` for this workspace's key and recommended `gemini-3.8-flash`. A `generateContent` request to that model timed out; the recommended Interactions API returned a temporary 503 high-demand error. The key and API route reached Google's service, but successful generation was not confirmed.

**Why:** Gemini model availability changed, and Google's recommended replacement was temporarily overloaded during verification.

**How to apply:** Use the Interactions API for this model and verify with a small authenticated request when the service is available. Never print or log the API key; treat 503 as temporary and avoid repeated retries.
