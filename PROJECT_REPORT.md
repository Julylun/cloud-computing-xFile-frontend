# XFile Cloud File-Sharing Platform

## Project Report

**Project:** xFile
**Project type:** Cloud-computing course project — file storage and sharing
**Report date:** 16 November 2026
**Implementation:** Next.js frontend and NestJS backend

> This report follows the chapter structure of the supplied sample, adapting its network-monitoring topics to the actual xFile file-sharing system. It describes the repository implementation, not a claim that the system is deployed as a production cloud service.

# CHAPTER 1. OVERVIEW OF THE PROJECT

## 1.1. Overview of Cloud File Sharing

### 1.1.1. Concept of Cloud File Sharing

Cloud file sharing enables users to upload a file to a service and make it available to other people through a controlled link. A typical service stores file metadata separately from file contents, authenticates owners, and checks access rules before returning a file.

xFile implements this workflow as a web application. Registered users upload and manage files, create one or more share links for a file, and select access and expiration rules. A guest can upload a smaller file and immediately receive a temporary share link. The frontend provides the user interface, while a REST API manages accounts, metadata, access checks, and file operations.

The current backend stores file contents on its local filesystem and stores metadata in PostgreSQL. Therefore, the application demonstrates a cloud-file-sharing architecture, but the current local-disk storage implementation is not itself a distributed cloud object-storage service.

### 1.1.2. Characteristics of the xFile System

- **Owner-based file management:** An authenticated user can upload files and manage links associated with files they own.
- **Multiple links per file:** A single file can be shared through separate links with different settings.
- **Configurable access:** Links can be public, private, or password-protected. The backend also supports email allowlists and team-based access checks.
- **Expiration controls:** A link can expire at a specified time or after a configured number of downloads.
- **Guest sharing:** An unauthenticated guest can upload a file up to 50 MB; the generated guest link expires after 24 hours.
- **Analytics:** The implementation records link views and successful downloads, and exposes file-level totals, unique anonymous browser identifiers, latest access time, daily counts, and recent activity.
- **No real-time streaming dashboard:** Analytics are retrieved through API requests when the Analytics page loads or its selected file/period changes. They are not a continuously streamed monitoring feed.

### 1.1.3. Application Architecture and Data Flow

xFile uses a three-part logical flow:

1. **Browser and frontend:** The Next.js application renders registration, sign-in, upload, sharing, dashboard, and analytics screens. It sends API requests through `/api/backend`.
2. **Backend API:** The NestJS service validates DTOs, authenticates users, applies ownership and link-access rules, coordinates database operations, and streams file downloads.
3. **Persistence:** PostgreSQL stores users, files, links, access rules, and analytics events. The file bytes are stored separately under the backend upload directory; the database stores a `storage_key`.

**Upload flow:** The browser sends multipart form data → the backend validates the upload limit → Multer writes a temporary file → the storage service sanitizes the name and moves it to the configured upload directory → PostgreSQL stores the file metadata and storage key → the frontend can create a share link for the uploaded file.

**Share/download flow:** A recipient opens a link → the backend loads the link and file metadata and checks status, expiration, password, and applicable access restrictions → a valid download increments the counters and records a download event → the backend streams the file from disk.

**Analytics flow:** The frontend sends an anonymous browser identifier with public-link view and download requests → the backend stores only a SHA-256 hash of that identifier with the event → an authenticated owner requests analytics → the backend aggregates events for non-deleted links belonging to the selected file → the frontend presents totals, a daily chart, and recent activity.

## 1.2. Reason for Choosing the Project

File sharing is a practical cloud-computing use case that combines web clients, APIs, databases, storage, identity, authorization, and network transfers. It offers clear end-to-end workflows that can be demonstrated and tested: upload, create a link, access the link under different rules, download, and inspect usage.

The project also provides an opportunity to study an important cloud architecture boundary: storing metadata in a relational database while storing large file objects outside that database. The current disk-based implementation makes development accessible, while exposing the changes needed for a scalable object-storage deployment.

## 1.3. Goals of the Project

The project goals are to:

1. Provide a browser-based interface for uploading, managing, and sharing files.
2. Support account registration with email verification, sign-in, profile changes, and password changes for authenticated users.
3. Allow owners to create links with different access and expiration settings.
4. Support temporary guest uploads and links.
5. Protect files through authentication, ownership checks, access rules, and safe file-path handling.
6. Record view/download activity and present analytics per file.
7. Keep file metadata and file contents in separate storage systems.
8. Provide API documentation and repeatable commands for development and testing.

## 1.4. Scope and Target Users

### 1.4.1. Scope of the Project

The project includes:

- A Next.js frontend built with React and TypeScript.
- A NestJS REST API.
- PostgreSQL data access through Prisma.
- Registered-user file upload with a backend limit of 500 MB per file and a request limit of up to 1,000 files.
- Guest upload up to 50 MB with a 24-hour link lifetime.
- Link creation, listing, deletion, protected sharing, and time/download-count expiration.
- Analytics event storage and an owner-facing Analytics page.
- Local filesystem storage configured through `UPLOAD_DIR`.

The project does not currently provide a production object-storage adapter, a deployment topology with redundant application instances, continuous event streaming, or a full administrative/operations console. The frontend contains some screens whose matching backend operations are not currently exposed (for example, complete team administration or a forgot-password workflow); their presence in the interface should not be interpreted as proof that those backend capabilities are complete.

### 1.4.2. Target Users

- **Registered users:** Upload files, manage their links, update their profile, and review analytics for files they own.
- **Recipients:** Open public links or access restricted links when they satisfy the configured conditions.
- **Guests:** Upload a limited-size file without creating an account and share it through a temporary link.
- **Project developers and evaluators:** Run the frontend and backend, inspect API behavior, and verify the data model and workflows.

# CHAPTER 2. THEORETICAL BACKGROUND

## 2.1. Fundamental Concepts of Cloud File-Sharing Systems

### 2.1.1. Cloud Storage and File-Sharing Services

A file-sharing service usually stores two categories of data:

- **Object data:** The file's bytes, which may be large and are commonly stored in a filesystem or object-storage service.
- **Metadata:** The owner, original name, MIME type, size, storage location key, timestamps, and sharing configuration.

Separating these categories avoids putting large binary files into ordinary relational rows and allows metadata to be queried independently. In xFile, PostgreSQL stores metadata and the backend filesystem stores file bytes. Replacing local disk with shared object storage is a future step for multi-instance or geographically distributed deployment.

### 2.1.2. Authentication, Authorization, and Share Links

Authentication answers “who is making the request?” Authorization answers “is that identity allowed to perform this operation?” xFile uses JWT-based authentication for protected API operations and checks file ownership before permitting a user to create or inspect owner-specific resources.

Share links provide a separate access path for recipients. A link can be public, private, or password-protected. Email allowlists and team membership can further restrict eligible recipients. Time expiration and download-count limits bound the lifetime or use of a link. These checks are performed by the backend; the frontend is not the security boundary.

Passwords are hashed with bcrypt before storage. Auth-token records store a token hash rather than the raw token. User-submitted DTOs are validated by NestJS's global validation pipe.

### 2.1.3. Metadata Separation and Storage Safety

The database stores a `storage_key` rather than a user-supplied absolute path. The storage service sanitizes filenames, generates a unique directory identifier, resolves the storage key beneath the configured upload root, and checks that the resolved path remains within that root. Downloads are streamed from the resolved local file path.

This design reduces path traversal risk and makes database records independent of the exact root directory. It does not by itself provide remote object storage, replicated durability, or cross-machine file availability.

## 2.2. Technologies and Tools

### 2.2.1. Next.js, React, and TypeScript

The frontend uses Next.js 16 with the App Router, React 19, and TypeScript. Route-level pages compose reusable UI and screen components. A typed API helper handles requests, bearer-token attachment, error responses, downloads, and the anonymous analytics visitor identifier.

The `next.config.ts` rewrite forwards `/api/backend/:path*` to the backend URL configured by `XFILE_BACKEND_URL`, defaulting to `http://localhost:3000`. This gives the browser a same-origin API path during local development.

### 2.2.2. NestJS REST API

The backend uses NestJS 12 and separates API behavior into modules, controllers, services, DTOs, guards, and infrastructure providers. Controllers define HTTP routes; services hold business logic; guards protect authenticated routes; and DTO validation checks request data.

Swagger is configured at `/api/docs` and describes the backend API. The server reads its listening port from `PORT`, defaulting to port 3000.

### 2.2.3. PostgreSQL and Prisma ORM

PostgreSQL stores relational application data. Prisma provides the schema, generated TypeScript client, migrations, and typed database access. The principal entities include users, auth tokens, files, links, teams, link/team associations, email allowlists, and analytics events.

The file model and link model implement a one-file-to-many-links relationship: link settings can differ even when links refer to the same file. The database connection is configured outside the schema through the Prisma configuration and environment variables.

### 2.2.4. Multer and Local Filesystem Storage

Multer handles multipart uploads in the NestJS/Express request pipeline. Authenticated file uploads use the configured 500 MB per-file limit; the guest endpoint uses a 50 MB limit. The `StorageService` writes files beneath `UPLOAD_DIR`, or beneath the backend's default `uploads` directory when that setting is absent.

### 2.2.5. JWT, bcrypt, Swagger, and Vitest

- **JWT:** Carries authenticated identity between the frontend and backend.
- **bcryptjs:** Hashes user passwords and password-protected link secrets.
- **Swagger:** Publishes an interactive API description at `/api/docs`.
- **Vitest:** Runs focused unit tests for services.
- **ESLint / Oxlint:** Checks frontend and backend source code.

## 2.3. Data Model and Analytics Metrics

### 2.3.1. Core Relational Data

The data model centers on:

- `User` → owns zero or more `File` records.
- `File` → has a storage key and can be associated with multiple `Link` records.
- `Link` → carries a slug, access mode, status, expiration configuration, and download counters.
- `LinkTeam` and `LinkEmailAllowlist` → represent additional recipient restrictions.
- `LinkAnalyticsEvent` → records a `view` or `download` event, a visitor hash, and a timestamp.

Foreign keys and indexes support ownership checks, link lookup, cleanup, and time-bounded analytics queries. Deleting a link cascades its event records; file deletion and cleanup behavior is coordinated by backend services.

### 2.3.2. Analytics Metrics

The Analytics API supports:

- **View count:** Number of recorded link metadata views.
- **Download count:** Number of successful downloads recorded by the backend.
- **Unique visitors:** Distinct anonymous browser identifiers, counted by the stored hash.
- **Last accessed:** Timestamp of the latest recorded view or download.
- **Per-file analytics:** Events and download counters are aggregated across the selected file's non-deleted links.
- **Daily series and recent activity:** Daily view/download values for 7, 30, or 90 days and up to 20 recent events.

The visitor identifier is randomly generated by the browser and persisted in local storage. The backend stores its SHA-256 hash instead of the original identifier. This is a pseudonymous analytics measure, not a verified count of distinct people: clearing browser storage or using another browser/device produces a different identifier.

### 2.3.3. Link Access and Expiration Metrics

The service distinguishes download count from access count. A successful download increments the link's download and access counters. A time-limited link uses `expires_at`; a count-limited link uses `max_access_count`. Guest links are assigned a 24-hour expiration. An expired or disabled link is rejected by the backend before file access.

## 2.4. Application Data Pipeline

### 2.4.1. Upload and Download Processing

**Upload:** The client sends a multipart request. The upload interceptor applies request/file limits and writes to temporary storage. The service validates ownership or guest conditions, sanitizes the filename, moves the file into its permanent storage location, and stores the file record in PostgreSQL.

**Download:** The client requests a link's download route. The service checks that the link exists and is active, applies expiration and download-count rules, validates password and recipient restrictions where configured, verifies the physical file exists, increments counters, records the download event, and returns a stream response.

### 2.4.2. Analytics Event Recording and Query Processing

View events are recorded when a valid public link's metadata is requested; the authenticated owner is excluded from view counting. Download events are recorded after the download has passed access and file-existence checks. Analytics queries aggregate event rows by file and time window. The frontend renders the returned series as a daily chart and shows totals and recent events.

Analytics depend on the database migration that creates the event table. Historical event dates and visitor identifiers cannot be reconstructed for activity that occurred before that migration; previously accumulated download counters remain available as counters but do not provide historical event detail.

# CHAPTER 3. INSTALLATION AND RESULTS

## 3.1. Installation and Environment Preparation

### Prerequisites

- A supported Node.js installation and npm.
- The frontend and backend repositories.
- A PostgreSQL database reachable from the backend.
- Sufficient local disk space for uploaded files.

### Backend setup

From the backend directory:

```powershell
npm install
npm run prisma:generate
npm run prisma:deploy
npm run start:dev
```

Configure the backend environment without committing secrets. The application requires a database connection setting (`DATABASE_URL` through the Prisma configuration), and may use `PORT`, `UPLOAD_DIR`, JWT/mail settings, and other service-specific variables. Use the project's environment template or team-provided configuration; do not copy credentials into source control.

### Frontend setup

From the frontend directory, set the backend address if it is not listening on port 3000, then start Next.js:

```powershell
$env:XFILE_BACKEND_URL = "http://localhost:3000"
npm install
npm run dev
```

Open the local address printed by Next.js. If the backend already occupies port 3000, Next.js may select another port. The frontend sends API requests through its `/api/backend` rewrite.

## 3.2. Components and Metrics Used

| Component | Responsibility |
|---|---|
| Next.js frontend | Account, upload, sharing, dashboard, and analytics user interfaces |
| NestJS API | Authentication, authorization, upload/download routes, link rules, and analytics API |
| PostgreSQL | User, file, link, access-rule, and analytics-event metadata |
| Prisma | Schema management, migrations, generated client, and database access |
| Local filesystem | Temporary and permanent uploaded file contents |
| Multer | Multipart upload parsing and upload limits |
| JWT and bcrypt | Request authentication and password hashing |

The Analytics page presents views, downloads, unique visitors, latest access, daily activity, and recent events. The selectable analytics windows are 7, 30, and 90 days.

## 3.3. Deployment and Execution

The development environment runs the backend and frontend as separate processes. The frontend rewrite connects browser requests to the backend, while the backend connects to PostgreSQL and reads/writes local files. The expected local endpoints are:

- **Frontend:** the URL printed by `npm run dev`.
- **Backend:** `http://localhost:3000` unless `PORT` overrides it.
- **Swagger API documentation:** `http://localhost:3000/api/docs`.
- **Health check:** the backend health route.

The analytics migration is located in `prisma/migrations/20261113200000_link_analytics/`. Apply it to the configured database with `npm run prisma:deploy` before using the Analytics API. The migration and generated Prisma client have been prepared and the code has been built and tested; this report does not claim that the migration has already been applied to a live/shared database.

## 3.4. Project Structure and Configuration

The workspace contains two repositories:

- **Frontend:** `src/app/` contains route pages; `src/components/` contains screens and shared UI; `src/lib/api.ts` contains API types and request helpers; `src/styles/` contains feature styles; `next.config.ts` configures the backend rewrite.
- **Backend:** `src/auth/`, `src/users/`, `src/files/`, and `src/links/` contain feature modules; `src/storage/` implements filesystem operations; `src/prisma/` provides database access; `prisma/schema.prisma` and `prisma/migrations/` define the data model and database changes.

### 3.4.1. Metrics Collection and Database Configuration

The backend owns metric/event collection. It records successful view and download events in `link_analytics_events`, including `link_id`, event type, visitor hash, and timestamp. Indexes support queries by link and creation time, event type, and visitor hash. File-level reports aggregate active/non-deleted links associated with the same file.

Database connection strings and other credentials belong in environment configuration, not in source files or the report. The analytics migration must be applied to the same database used by the running backend.

### 3.4.2. Frontend Analytics and API Configuration

The API client attaches the bearer token for authenticated requests and adds `x-analytics-visitor-id` for browser requests. The Analytics screen selects a file, queries `/links/:id/analytics?days=7|30|90`, and renders returned values. It includes loading and API-error states rather than treating a failed request as valid zero-valued statistics.

The Next.js rewrite target can be changed through `XFILE_BACKEND_URL`. Because the browser calls the frontend origin, local development does not require the browser to call the backend host directly.

## 3.5. Implementation Results and Evaluation

### 3.5.1. Backend and Frontend Verification

The following code-level checks were run during implementation:

- Prisma client generation completed successfully.
- Focused backend link-service tests passed: **15 tests**.
- Backend NestJS build completed successfully.
- Backend lint completed with existing warnings in unrelated files; no lint errors remained in the analytics changes.
- Frontend TypeScript check completed successfully.
- Frontend build completed successfully.
- Targeted frontend lint completed with an existing `<img>` optimization warning and no errors.

These checks validate compilation and service-level behavior. They do not constitute a live-database migration test, deployment test, or production load/security assessment.

### 3.5.2. User Interface Results

The main implemented screens and flows include account registration/sign-in, authenticated upload, guest upload, dashboard/file-link management, share-link viewing/downloading, profile and password settings, and Analytics. The Analytics screen displays:

1. A file selector and a time-range selector.
2. View and download totals for the selected period.
3. Unique anonymous browser visitors.
4. The most recent recorded access time.
5. Lifetime totals.
6. A daily view/download chart.
7. A recent activity list and the selected share-link path.

Screens that do not yet have corresponding backend API support may remain incomplete or demonstrative; they should not be treated as operational capabilities until connected to implemented endpoints.

### 3.5.3. Functional Verification and Limitations

**Recommended end-to-end verification after migration:**

1. Start PostgreSQL, backend, and frontend with valid environment settings.
2. Apply the analytics migration and confirm backend startup succeeds.
3. Sign in as a file owner and create or select a file with a share link.
4. Open the public share link in a separate browser/profile and confirm the view count increases.
5. Download the file successfully and confirm the download count and recent activity update.
6. Refresh from the same browser and confirm views increase while the anonymous unique-visitor count remains unchanged.
7. Open the link as the owner and confirm it does not add a view.
8. Change the range to 7, 30, and 90 days and confirm the cards and daily chart reload.
9. Request another user's link analytics and confirm that the API does not disclose that user's data.

**Current limitations:**

- File bytes are stored on local disk. A second backend instance or another machine cannot access them unless storage is migrated to a shared object-storage service or shared volume.
- Guest uploads are limited to 50 MB and guest links expire after 24 hours; authenticated uploads have a 500 MB per-file limit.
- Analytics begin accumulating after the migration is applied. Existing download counters can be shown, but pre-migration dates, views, and visitor identities cannot be recreated.
- Unique visitors are approximated by a persistent browser identifier. Different browsers/devices or cleared browser storage are counted separately; this is not person-level identity.
- The Analytics API has been build- and unit-tested, but should still be exercised against the configured PostgreSQL database after migration.
- The project is not configured in the inspected repositories as a fully orchestrated Docker Compose deployment.
- The frontend/backend integration is incomplete for some screens or product ideas (notably complete team management and password recovery). Verify endpoint availability before relying on those operations.
- Production hardening—shared durable storage, backups, rate limiting, operational monitoring, HTTPS/reverse-proxy setup, and load testing—remains necessary before a public production deployment.

# CONCLUSION

## 1. Achievements

xFile brings together a typed web frontend, a modular API, relational metadata, local file storage, and configurable sharing links. The implemented workflows cover user authentication, uploads, public and restricted links, time- and download-count expiration, and file downloads. Analytics has been added to record views and downloads, calculate anonymous unique visitors and last access, aggregate metrics per file, and display daily and recent activity in the frontend.

The codebase passes the focused backend tests, backend build, frontend type checking, and frontend production build. The analytics migration must still be applied to the target database before the feature can be verified end to end there.

## 2. Future Development Direction

1. Replace or complement local disk with S3-compatible/object storage and define lifecycle/backup policies.
2. Add integration tests that apply migrations to a disposable PostgreSQL database and exercise real upload, view, download, and analytics requests.
3. Complete backend APIs for remaining screens, including team administration and password recovery, or clearly remove/label unsupported UI.
4. Add pagination and retention/cleanup policies for event data as traffic grows.
5. Improve analytics privacy controls, document visitor-ID retention, and consider consent requirements for deployment jurisdictions.
6. Add rate limiting, structured operational logging, health/readiness checks, deployment configuration, and load testing.
7. Add authorization and security review for all share-link modes and production deployment configuration.

# REFERENCES

1. xFile backend source code and schema: [cloud-computing-xFile-backend](../cloud-computing-xFile-backend/), especially `prisma/schema.prisma`, `src/links/`, `src/files/`, and `src/storage/`.
2. xFile backend database design: [Database Design.md](../cloud-computing-xFile-backend/doc/Database%20Design.md).
3. xFile backend API documentation (when the backend is running): `http://localhost:3000/api/docs`.
4. Next.js documentation: https://nextjs.org/docs
5. React documentation: https://react.dev/learn
6. NestJS documentation: https://docs.nestjs.com/
7. Prisma documentation: https://www.prisma.io/docs
8. PostgreSQL documentation: https://www.postgresql.org/docs/
9. JSON Web Token (JWT) introduction: https://jwt.io/introduction
