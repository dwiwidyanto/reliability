# AeroReliability Suite (Stage 1 MVP)

A lightweight, high-performance web application designed for undergraduate aeronautics students to study systems safety and aircraft maintenance engineers to perform reliability analyses.

The application combines a **SvelteKit** frontend with a **Fastify** backend and a **SQLite** database, running as a unified, single-process container designed to run comfortably on resource-constrained VM instances (such as Oracle Cloud Free Tier via Coolify).

---

## Key Features

1. **FMEA / FMECA Builder**
   - Interactive spreadsheet-like worksheet with customizable failure modes, causes, effects, and mitigations.
   - Dynamic Risk Priority Number (RPN = Severity × Occurrence × Detectability) auto-calculations.
   - 10x10 Severity vs. Occurrence Criticality Heatmap Matrix with risk classification.
   - Aviation-specific S, O, D scale helpers mapping FAA, EASA, and MIL-STD guidelines.
   - Client-side exports: PDF safety reports and Excel (.xlsx) spreadsheets.

2. **Ishikawa (Fishbone) Diagram Creator**
   - Clickable SVG blueprint canvas displaying the aviation 6M+1 categories: Man (Personnel), Machine (Equipment), Method (Procedures), Material (Parts), Measurement (Telemetry), Mother Nature (Environment), and Management (Organization) ending in the system Effect box.
   - Canvas Inspector panel to recursively add nested details and edit cause tree nodes.
   - Client-side image downloads: Raw SVG and high-resolution PNG.

3. **Educational Platform**
   - In-app tutorials guiding students through FMEA mechanics and Fishbone RCA methodology.
   - Standard Worked Case Studies: Boeing 737 Landing Gear seal blowout FMEA, and Turbofan engine compressor stall RCA.
   - Searchable glossary of aerospace reliability engineering terminology (e.g. MSG-3, MTBF, ECAM, EICAS).

4. **Authentication & Cloud Synchronization**
   - User account registration, login, and secure session management via Lucia Auth.
   - Workspace CRUD: save, update, list, and delete analyses associated with the user account.

---

## Tech Stack & Architecture

- **Frontend**: SvelteKit (Svelte 5 with runes)
- **Styling**: TailwindCSS v4 with an aerospace cockpit dark theme
- **Backend**: Fastify (Node.js) API server
- **Database**: SQLite with Drizzle ORM
- **Auth**: Lucia Auth using `BetterSqlite3Adapter`
- **Exports**: `jsPDF` + `jspdf-autotable` and `xlsx` (SheetJS)
- **Compilation**: SvelteKit node-adapter + `esbuild` compiled single-process bundle

In production, Fastify boots up, runs database migrations automatically, mounts `/api/v1/*` routes, and passes all other traffic to SvelteKit's compiled middleware handler (`build/handler.js`). **This keeps container memory footprint under ~45MB and runs within a single process.**

---

## Getting Started

### Prerequisites
- Node.js (v18 or v20+)
- npm

### Installation
1. Clone the repository and enter the directory.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up the environment variables:
   ```bash
   cp .env.example .env
   ```

### Running in Development
Start both Fastify (port 3000) and Vite (port 5173, proxying API requests to Fastify) concurrently:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Building for Production
To test the production build locally:
1. Compile both the SvelteKit static/SSR files and bundle the Fastify server:
   ```bash
   npm run build
   ```
2. Run the compiled single-process production server:
   ```bash
   npm run start
   ```
The app will listen on port `3000`.

---

## Deployment (Docker & Coolify)

This app is pre-configured for deployment as a single container on Coolify.

### Docker Compose
You can run the container stack locally or deploy it via Docker Compose using the included `docker-compose.yml`:
```bash
docker-compose up --build -d
```
The compose service exposes container port `3000` to the Docker network and mounts a persistent SQLite database volume to `/app/data/` inside the container. In Coolify, do not publish host port `3000`; let Coolify/Traefik route your domain to the service's internal port `3000`.

### Deploying to Coolify (Oracle Cloud Free Tier)
1. **New Resource**: Create a new application in your Coolify dashboard.
2. **Repository**: Select this git repository (or select **Docker Compose** as the build pack).
3. **Configurations**:
   - Set the Build Pack to **Docker Compose** (or **Dockerfile**).
   - Coolify will automatically read the `Dockerfile` or `docker-compose.yml`.
4. **Volumes**:
   - Add a volume mount for persistent data: `reliability_data:/app/data` to ensure your SQLite database survives container upgrades and restarts.
5. **Port**:
   - Configure the destination/internal port to `3000`.
   - Do not add a host port mapping such as `3000:3000`; Coolify's reverse proxy owns the public port.
6. **Health Check**:
   - Configure the health check path to `/api/v1/health`.
7. Click **Deploy**. The build will complete in under 3 minutes and run under 50MB of RAM.
