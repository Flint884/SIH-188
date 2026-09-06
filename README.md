# AI-Based Fake Identity and Document Screening System

An AI-assisted border checkpoint platform for identity enrollment, document screening, OCR extraction, biometric verification, tampering analysis, adaptive immigration interviews, audit trails, and officer-led clearance decisions.

The application is designed as an operator workflow: every automated result is presented as evidence for an authorized officer. The system does not replace the officer's final decision.

## Capabilities

- Secure officer login with role-based portal access.
- Admin portal selection for enrollment, verification, analytics, and audit workflows.
- Identity enrollment with document upload, OCR extraction, manual correction, and face capture.
- Document validation against required fields, dates, identity data, nationality, and MRZ consistency.
- Registry lookup and scanned-document comparison against stored identity records.
- Live document tampering and forgery analysis.
- Camera-based face capture with image quality checks and liveness indicators.
- Biometric comparison between stored/document photos and live captures.
- Adaptive AI immigration pre-screening interview with text and microphone input.
- Country-name normalization for equivalent values such as `India`, `Republic of India`, `Bharat`, and `IND`.
- Risk assessment and final officer decision workflow.
- Analytics, active alerts, manual review queue, audit logs, and screening reports.
- Persistent local JSON database under `data/` for development and demonstration.

## Technology

- React 19 and TypeScript
- Vite 6
- Express 4
- Tailwind CSS 4
- Google Gemini through `@google/genai`
- Motion and Lucide React for interface behavior and icons
- `tsx` for the development server
- `esbuild` for the production server bundle

## Requirements

- Node.js 20 or newer recommended
- npm
- A Gemini API key for live AI OCR, tampering, face, or interview features
- A browser with camera and microphone permissions for biometric and voice workflows

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/Flint884/SIH-188.git
cd SIH-188
npm install
```

Create a local environment file named `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Do not commit `.env`, `.env.local`, or API keys. These files are ignored by Git.

## Run Locally

Start the full application server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The development command starts the Express server, which serves the Vite frontend and exposes the application API routes.

## Demo Accounts

The login screen includes quick role presets. The seeded development accounts are:

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `Admin@Pass123` |
| Data Officer | `officer_data` | `Enroll@Pass123` |
| Verification Officer | `officer_verify` | `Verify@Pass123` |
| Analyst | `analyst_user` | `Analyze@Pass123` |
| Viewer | `viewer_guest` | `View@Pass123` |

These credentials are for local development and demonstration only. Replace the seeded accounts before any production deployment.

## Main Workflows

### Enrollment Portal

1. Upload or capture an identity document.
2. Run OCR extraction.
3. Review and correct extracted fields when authorized.
4. Validate the identity and document data.
5. Capture and store a face reference.
6. Save the identity record to the local database.

### Verification Portal

1. Upload or capture a physical document.
2. Run OCR and registry lookup.
3. Compare the scan with stored records.
4. Run tampering and forensic checks.
5. Capture a live face image.
6. Run biometric matching and liveness checks.
7. Optionally conduct the adaptive immigration interview.
8. Run the existing risk and final decision workflow.
9. Review, clear, or route the case for manual officer review.

### Analytics and Audit

Administrators and authorized analysts can inspect screening totals, decisions, risk distributions, alerts, verification sessions, and audit events from the portal navigation.

## Useful Commands

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Type-check the project
npm run lint

# Build the frontend and production server bundle
npm run build

# Preview the Vite frontend build
npm run preview

# Start the production server after building
npm start
```

The production build writes the frontend to `dist/` and bundles the server as `dist/server.cjs`.

## API Health Check

When the application is running, verify the server with:

```text
GET http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "..."
}
```

## Project Structure

```text
.
├── data/
│   ├── checkpoint_db.json        Local persistent development database
│   └── checkpoint_db.seed.json   Seed data used to initialize the database
├── public/                       Static assets
├── server.ts                     Express server and API routes
├── server/
│   ├── ai.ts                     Gemini-backed AI operations
│   ├── auth.ts                   Password and session handling
│   ├── db.ts                     Local persistence and repositories
│   └── interview.ts              Adaptive immigration interview logic
├── src/
│   ├── components/               Portal and workflow components
│   ├── context/                  Authentication state
│   ├── utils/                    Frontend utilities
│   ├── App.tsx                   Application shell and portal routing
│   ├── index.css                 Global visual system and dark theme
│   └── types.ts                  Shared TypeScript contracts
├── index.html                    Frontend entry document
├── package.json                  Scripts and dependencies
├── tsconfig.json                 TypeScript configuration
└── vite.config.ts                Vite configuration
```

## Data and Privacy Notes

- Development records are stored locally in `data/checkpoint_db.json`.
- Do not use real passport, biometric, or personally identifiable information in local demos.
- Keep API keys in environment files or a managed secret store.
- Review Gemini and hosting privacy requirements before processing sensitive information.
- Production deployments should use a durable database, managed secrets, HTTPS, secure cookies or token storage, audit retention controls, and least-privilege access.

## AI Configuration

If `GEMINI_API_KEY` is not configured, the application can still start and non-AI interface flows remain available. AI-backed operations may return fallback behavior or a configuration error depending on the workflow.

The adaptive interview attempts supported Gemini models and falls back to deterministic local reasoning when the AI service is unavailable.

## Validation

Before submitting changes, run:

```bash
npm run lint
npm run build
```

For camera, microphone, OCR, and AI workflows, also test in a browser with the required permissions enabled and confirm the API health endpoint responds successfully.

## Security Disclaimer

This project is an academic and demonstration system. It is not a certified border-control, immigration, identity, biometric, or fraud-detection product. Automated outputs must be reviewed by qualified personnel and must not be used as the sole basis for decisions affecting a person.
