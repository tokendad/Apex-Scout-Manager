# Apex Scout Manager Context for Gemini

## Project Overview

**Apex Scout Manager** (ASM) is a mobile-responsive web application for full troop management and cookie sales tracking. It features a mobile-first design, works offline (mostly), and supports both individual sales and event tracking.

### Key Technologies
-   **Frontend:** Pure HTML/CSS/JavaScript (No frameworks).
-   **Backend:** Node.js with Express.
-   **Database:** SQLite (via `better-sqlite3`).
-   **Logging:** Winston (with daily rotation).
-   **Containerization:** Docker & Docker Compose.

## Architecture

### Backend (`server.js`)
-   **Server:** Express.js application handling API requests and serving static files.
-   **Database:** SQLite database (`asm.db`) stored in the `/data` directory.
-   **Initialization:** Automatically creates the data directory and initializes database tables (`sales`, `profile`, `donations`, `events`) on startup. Includes migration logic for schema updates.
-   **Middleware:**
    -   `cors`: Enables Cross-Origin Resource Sharing.
    -   `express.json`: Parses JSON request bodies.
    -   `express-rate-limit`: Limits API requests to prevent abuse.
    -   `express.static`: Serves frontend assets from `public/`.
    -   **Request Logging:** Custom middleware logs HTTP requests using Winston.

### Frontend (`public/`)
-   **Structure:** Single-page application style (though multi-page in file structure, logic is handled via DOM manipulation).
-   **Styling:** Custom CSS with responsiveness for mobile and desktop.
-   **Logic:** `script.js` handles UI interactions, API calls (fetch), and local state management.

### Data Storage
-   **Location:** `/data/asm.db`
-   **Persistence:** Docker volume mounts the `/data` directory to the host system.

## Building and Running

### Using Docker (Recommended)
The project is optimized for Docker deployment.

1.  **Start the application:**
    ```bash
    docker-compose up -d
    ```
2.  **Access:** `http://localhost:8080`
3.  **Stop:**
    ```bash
    docker-compose down
    ```

### Local Development
1.  **Install dependencies:**
    ```bash
    npm install
    ```
2.  **Start the server:**
    ```bash
    npm start
    ```
    *   Runs `node server.js`.
    *   Server defaults to port 3000 (or `PORT` env var).
    *   Data stored in `/data` (or `DATA_DIR` env var).

## API Reference

The backend exposes a RESTful API at `/api/`.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/sales` | Retrieve all sales records. |
| **POST** | `/api/sales` | Create a new sale. |
| **DELETE**| `/api/sales/:id` | Delete a specific sale. |
| **DELETE**| `/api/sales` | **DANGER:** Clear all sales data. |
| **GET** | `/api/profile` | Get user profile (goals, photo). |
| **PUT** | `/api/profile` | Update user profile. |
| **GET** | `/api/donations`| Retrieve all donations. |
| **POST** | `/api/donations`| Add a new donation. |
| **DELETE**| `/api/donations/:id` | Delete a donation. |
| **GET** | `/api/events` | Retrieve all events. |
| **POST** | `/api/events` | Create a new event. |
| **PUT** | `/api/events/:id` | Update an event. |
| **DELETE**| `/api/events/:id` | Delete an event. |
| **GET** | `/api/health` | Health check (returns database status). |

## Project Structure

```
/data/Apex-Scout-Manager/
├── .github/              # GitHub Actions workflows
├── public/               # Frontend assets
│   ├── index.html        # Main HTML file
│   ├── script.js         # Frontend logic
│   └── styles.css        # Styles
├── data/                 # Mounted volume for DB and logs (created at runtime)
├── docker-compose.yml    # Docker services config
├── Dockerfile            # Container definition
├── package.json          # Node.js dependencies
├── server.js             # Main application entry point
└── logger.js             # Winston logger configuration
```

## Development Conventions

-   **Logging:** Use the global `logger` object. Do not use `console.log` in backend code.
    -   `logger.info('message', { meta: 'data' })`
    -   `logger.error('message', { error: err })`
-   **Database:** Use `better-sqlite3` synchronous API. Prepared statements are preferred for security and performance.
-   **Error Handling:** API routes should try/catch errors and return appropriate HTTP status codes (500 for server errors, 400 for bad requests, 404 for not found).
-   **Environment Variables:**
    -   `PORT`: Server port (default: 3000).
    -   `DATA_DIR`: Directory for database and logs (default: `/data`).
-   **AI Coding Standards:**
    -   **Full Code Reviews:** When reviewing code, provide comprehensive analysis covering logic, style, security, and potential bugs. Do not summarize unless explicitly asked.
    -   **No Truncation:** When generating or modifying code, ALWAYS provide the FULL file content or the COMPLETE function/block being modified. Never use placeholders like `// ... rest of code` or `<!-- ... existing code ... -->`. The goal is to have copy-paste ready code that requires no manual stitching.
