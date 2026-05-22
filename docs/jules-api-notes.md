# Jules API Notes

This document records the real behavior of the Jules REST API as discovered through live testing. It is intended for contributors, maintainers, and anyone building on top of this CLI.

These notes supplement (and in some cases correct) what you might infer from the Google API design guide or Jules's own documentation.

---

## Base URL

```
https://jules.googleapis.com/v1alpha
```

All endpoints are relative to this base.

---

## Authentication

Every request requires an API key passed as a header:

```
X-Goog-Api-Key: YOUR_JULES_API_KEY
```

Obtain a key from jules.google.com > Settings > API Keys. Keys are tied to your Jules account and have access to whatever repos you have connected.

There is no OAuth flow in this CLI - API key only.

---

## Session Create: Payload is FLAT

This is the most important gotcha.

The Google API design guide suggests wrapping resource creation payloads as `{ "session": { ... } }`. Jules does **not** do this. The payload is flat:

**Working payload:**
```json
{
  "prompt": "Fix the null pointer exception in UserService.findById",
  "sourceContext": {
    "source": "sources/github/acme-org/backend",
    "githubRepoContext": {
      "startingBranch": "main"
    }
  },
  "title": "Fix NPE in UserService",
  "requirePlanApproval": false
}
```

**Does NOT work (wrapped):**
```json
{
  "session": {
    "prompt": "...",
    "sourceContext": { ... }
  }
}
```

Sending the wrapped form results in a `400 INVALID_ARGUMENT` error: `"Unknown name \"session\" at 'session': Cannot find field."` - verified against the live API on 2026-03-28.

The `title` and `requirePlanApproval` fields are optional. Omitting `title` creates an untitled session. Omitting `requirePlanApproval` defaults to `false` (instant execution mode).

---

## Session States

| State | Description | Requires `requirePlanApproval`? |
|---|---|---|
| `IN_PROGRESS` | Jules is actively working on the task | No |
| `COMPLETED` | Jules finished and outputs are available | No |
| `FAILED` | Jules encountered an unrecoverable error | No |
| `PLAN_READY` | Jules generated a plan and is waiting for `approvePlan` | Yes |
| `WAITING_FOR_INPUT` | Jules has a question and is waiting for a reply | Yes |

`PLAN_READY` and `WAITING_FOR_INPUT` will never appear on sessions created with `requirePlanApproval: false`. In instant mode, sessions transition directly from `IN_PROGRESS` to either `COMPLETED` or `FAILED`.

---

## Activities: Discriminated Union Without a `type` Field

The activities array does not use a `type` field to distinguish activity kinds. Instead, each activity object contains exactly one of these keys:

| Key | Sender | Description |
|---|---|---|
| `agentMessaged` | Jules | Contains `agentMessage` string - Jules speaking to the user |
| `userMessaged` | Human or agent | Contains `userMessage` string - a reply sent via the reply endpoint |

To determine who sent an activity, check which key is present:

```javascript
if (activity.agentMessaged) {
  console.log("Jules:", activity.agentMessaged.agentMessage);
} else if (activity.userMessaged) {
  console.log("User:", activity.userMessaged.userMessage);
}
```

Do not try to read a `.type` field - it does not exist.

---

## approvePlan Endpoint

Approving a plan uses a **colon action** in the URL, not a sub-resource path:

```
POST /v1alpha/sessions/SESSION_ID:approvePlan
```

Note the colon before `approvePlan`. This follows the Google AIP-136 custom method convention. Using a slash instead of a colon (`/sessions/SESSION_ID/approvePlan`) will return 404.

Request body can be empty `{}`.

---

## Reply Endpoint

To send a message to Jules when the session is in `WAITING_FOR_INPUT`:

```
POST /v1alpha/sessions/SESSION_ID/activities
```

Request body:

```json
{
  "userMessaged": {
    "userMessage": "Your answer or instruction here"
  }
}
```

The body mirrors the discriminated union structure of the activities response - the `userMessaged` key wraps your message. Do not send a flat `{ "message": "..." }` - it will be ignored.

---

## Session Outputs

When a session reaches `COMPLETED`, the session object includes an `outputs` array. Each entry in the array is also a discriminated union:

| Key | Description |
|---|---|
| `pullRequest` | Jules opened a GitHub PR. Contains `url` and `number`. |
| `changeSet` | Jules produced a git patch but did not open a PR. |

**Both entries can appear together** - Jules may produce a changeSet and then open a PR from it. Check for both.

**The `pullRequest` entry may be absent** if the Jules GitHub App does not have write access to the repository. In that case Jules will produce only a `changeSet` (a git patch) that you would need to apply manually. This is uncommon if the GitHub App was installed correctly, but it does happen on forks or repos with restricted branch protection.

---

## Sources Format

The `name` field for a source uses the format:

```
sources/github/OWNER/REPO
```

This full name is what you pass as `sourceContext.source` when creating a session. The CLI accepts `owner/repo` shorthand on the command line and expands it to this format internally.

---

## Pagination

The sources list and sessions list endpoints both support pagination via query parameters:

```
?pageSize=100&pageToken=TOKEN_FROM_PREVIOUS_RESPONSE
```

A response with more pages includes `nextPageToken` in the response body. When `nextPageToken` is absent (or empty), you have fetched all results.

This CLI uses `pageSize=100` and does not implement multi-page fetching. If you have more than 100 sessions or sources, only the first 100 will be returned. This is a known limitation.

---

## Schedules: Not Yet Available

```
GET /v1alpha/scheduledSessions
```

Returns `404 Not Found`. The schedules feature is visible in the Jules web UI but is not yet exposed in the v1alpha REST API. This is not a bug in this CLI.

---

## Error Responses

Error responses follow standard Google API error format:

```json
{
  "error": {
    "code": 404,
    "message": "Session not found",
    "status": "NOT_FOUND"
  }
}
```

Common status codes encountered in practice:

| HTTP Status | gRPC Status | Common Cause |
|---|---|---|
| 400 | `INVALID_ARGUMENT` | Malformed payload (e.g. wrapped instead of flat) |
| 401 | `UNAUTHENTICATED` | Missing or invalid API key |
| 403 | `PERMISSION_DENIED` | API key lacks access to the requested resource |
| 404 | `NOT_FOUND` | Session/source ID does not exist, or endpoint not yet released |
| 429 | `RESOURCE_EXHAUSTED` | Rate limit hit - back off and retry |

---

## Known v1alpha Limitations

- No schedules endpoint (404)
- No pagination in this CLI (pageSize=100 cap)
- No streaming - all responses are synchronous snapshots; poll to track progress
- Session IDs are opaque strings - do not try to parse structure from them
- Sessions cannot be cancelled or deleted via the API
