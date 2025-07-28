# eCFR Analyzer

**Monorepo** containing:

- **Backend**: Express API + MongoDB ingestion
- **Frontend**: Next.js 15 dashboard

Live demo: [https://ecfrview.com](https://ecfrview.com)
Testing: https://ecfr-api.onrender.com



---

## 📖 Table of Contents

1. [Prerequisites](#-prerequisites)
2. [Local Setup](#-local-setup)
   - [Backend](#backend)
   - [Frontend](#frontend)

3. [Running the Ingestion Script](#-running-the-ingestion-script)
4. [Deployment on Render](#-deployment-on-render)
5. [Custom Domain](#-custom-domain)
6. [Assignment Feedback](#-assignment-feedback)

---

## 1. 🛠 Prerequisites

- **Node.js** ≥ 18
- **npm** (bundled with Node)
- **MongoDB** (Atlas)

---

## 2.🚀 Local Setup

### Start with Backend

In root:
cd backend
npm install
npm run dev
You should see:
	✅ Mongoose connection is open; starting API…
	✅ MongoDB connected to ecfr
	🚀 API listening on port 3000

### Frontend

In root:
cd frontend
npm install
Now check: http://localhost:3001

You should see both frontend and backend working!

---

Additional Info As Needed

# Proxy API calls to your local backend:
# edit next.config.js: `/api/*` → `http://localhost:3000`

npm run dev       # http://localhost:3001

# configure your .env in the backend:

# backend/.env
MONGO_URI=mongodb+srv://youngberry2014:jYpNsPB7J7Dg9fR5@cluster0.oq02z5r.mongodb.net/?retryWrites=true&w=major$

PORT=3000



# Ingest data:
npm run ingest    # fetch & compute metrics into MongoDB

# Start API:
npm start         # http://localhost:3001
```

API endpoints:

- `GET /api/agencies`
- `GET /api/agencies/:title/metrics`
- `GET /api/agencies/:title/history`
- `GET /api/health`

---


```

- Dashboard UI: [http://localhost:3001](http://localhost:3001)
- Health check: `curl -I http://localhost:3001/api/health`

---

## 📑 Running the Ingestion Script

The ingestion script (`backend/scripts/ingest.js`) will:

1. Fetch the latest version date for each CFR Title
2. Download full XML for each Title
3. Compute metrics (word count, ref-density, def-frequency, checksum)
4. Store metrics in MongoDB

Invoke:

```bash
cd backend
npm run ingest
```


---

## ☁️ Deployment on Render

**ecfr-api** (Web Service):

- Build & Start: `npm start`
- Health check: `/api/health`

**ecfr-view** (Web Service):

- Build: `npm ci && npm run build`
- Start: `npm run start`
- Proxy `/api/*` → `https://ecfr-api.onrender.com` via `next.config.js`

Attached custom domain `ecfrview.com` to frontend service.

---

## 🌐 Custom Domain
Live demo: [https://ecfrview.com](https://ecfrview.com)
Testing: https://ecfr-api.onrender.com

Verify:

```bash
curl -I https://ecfrview.com/api/health
# HTTP/2 200 OK
```

---
Joseph's Machine
 └─> GitHub Monorepo (josephowadee/ecfr-api)
      └─> GitHub Actions
            ├─> build & test frontend + backend
            ├─> push Docker images to ghcr.io/josephowadee
            └─> trigger deploy jobs
                  ├─> Render “ecfr-api” Web Service ← backend image
                  └─> Render “ecfr-view” Web Service ← frontend image
                        └─ Custom domain CNAME: ecfrview.com → ecfr-view.onrender.com
---


## 📝 AssignmentInfo

- **Duration**: \~2 hours

- **Feedback**: 
Working on this mini project taught refreshed my knowledge about the end-to-end lifecycle of a modern web app. I deepened my understanding of Next.js’s App Router especially balancing static vs. dynamic rendering, suspense boundaries for client hooks, and configuring custom rewrites to proxy API calls. Also building the ingestion script and MongoDB schema sharpened my skills in Node.js data-pipeline design, XML parsing with xml2js, and checksum validation for integrity. If I had more time, I would have added automated tests (both unit for the ingestion logic and e2e for the dashboard), CI/CD linting checks, and improved error-handling/retry logic on the server. I will also explore graph-based visualizations for more complex cross-reference mapping as I noticed on the MongoDB Atlas site

I am proficient in React and Next.js so I just architected the dashboard’s component hierarchy, and leverage React hooks for polling and URL-driven state, and integrate Recharts for the responsive chairs.
On the backend, my Node.js/MongoDB experience enabled me to design a lean metrics store, write efficient ingestion loops, and structure RESTful routes with Next.js API endpoints.

- **Live Links**:
  - Frontend: [https://ecfrview.com](https://ecfrview.com)
  - Backend API: [https://ecfr-api.onrender.com](https://ecfr-api.onrender.com)
- **Screenshots**: stored in `frontend/screenshots/`

---

Thank you for reviewing!

Joseph Owadee

