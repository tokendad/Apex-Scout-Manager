# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Danger Zone section in Settings with data management buttons (Delete All Sales, Delete All Donations, Clear Import History)
- API endpoints for data deletion: `DELETE /api/sales`, `DELETE /api/donations`, `DELETE /api/import-history`
- Detailed order logging during Digital Cookie sync showing customer names, box counts, dates, and order numbers
- Documentation for future scraper improvements (`docs/DIGITAL_COOKIE_SCRAPER_IMPROVEMENTS.md`)
- Digital Cookie Sync feature to automatically import orders from Girl Scouts Digital Cookie platform
- New Digital Cookie Sync settings section with email/password authentication
- Test connection and sync now buttons for Digital Cookie integration
- Puppeteer-based web scraper service (`services/digitalCookieScraper.js`) with stealth plugin
- New database fields for sync tracking: `digitalCookieEmail`, `digitalCookiePassword`, `digitalCookieStoreUrl`, `lastSyncTime` in profile table
- New database fields for donations: `orderNumber`, `source`, `boxCount`
- New `import_history` table to track synced orders and prevent duplicates
- API endpoints for Digital Cookie sync: `POST /api/scrape`, `POST /api/scrape/test`, `GET /api/scrape/status`
- Profile tab displaying scout photo, Store QR code, and Payment QR code
- Payment QR code functionality in Settings for payment method display
- Cookie details section on Profile with official Girl Scout cookie images and descriptions
- Order grouping in sales list - orders grouped by customer name with clickable details
- Order details modal showing customer info, cookie breakdown, and payment summary
- Additional payment tracking in order details with save functionality
- Multi-cookie order entry - Record a Sale form now supports multiple cookies per order
- Cookie selection table with boxes and cases columns for each cookie type
- XLSX import feature in Settings to import Digital Cookie export files
- New database fields: orderNumber, orderType, orderStatus, customerEmail
- Settings tab with theme switching (Light/Dark/System preference)
- Manual theme control that persists across sessions via localStorage
- Add Docker Hub publish workflow with manual trigger and nightly schedule ([#24](https://github.com/tokendad/GSCTracker/pull/24))
- Add event sales tracking with inventory management and donations ([#22](https://github.com/tokendad/GSCTracker/pull/22))
- Add individual sales tracking with customer contact info and payment details ([#21](https://github.com/tokendad/GSCTracker/pull/21))
- Add Girl Scout profile, goals, sales categorization, and donation tracking ([#20](https://github.com/tokendad/GSCTracker/pull/20))
- Add missing changelog entries from workflow outage period ([#19](https://github.com/tokendad/GSCTracker/pull/19))
- SQLite database storage with Node.js/Express REST API backend ([#8](https://github.com/tokendad/GSCTracker/pull/8))
- Screenshot directory with automated UI change capture workflow ([#10](https://github.com/tokendad/GSCTracker/pull/10))
- Persistent top bar navigation with three screens (Profile, Individual Sales, Events) ([#14](https://github.com/tokendad/GSCTracker/pull/14))
- Comprehensive error logging with Winston, daily rotation, and colored output ([#16](https://github.com/tokendad/GSCTracker/pull/16))

### Changed
- Improved Digital Cookie scraper login reliability with expanded selectors and JavaScript fallback
- Digital Cookie scraper now correctly handles cookie consent banners
- Scraper uses exact Digital Cookie selectors: `#username`, `#password`, `#loginButton`, `#acceptAllCookieButton`
- Dockerfile now includes Chromium and dependencies for Puppeteer web scraping
- Added puppeteer, puppeteer-extra, and puppeteer-extra-plugin-stealth dependencies
- Redesigned tab navigation with 5 tabs: Profile, Summary, Individual, Events, Settings
- Renamed Dashboard tab to "Sales Summary"
- Updated Record a Sale form layout: Customer info first, then cookie selection table, then payment section
- Updated cookie list to 9 official Girl Scout cookies: Thin Mints, Samoas, Tagalongs, Trefoils, Do-si-dos, Lemon-Ups, Adventurefuls, Exploremores, Toffee-tastic
- Sales table now shows orders grouped by customer with order details on click
- Orders with "Shipped" status auto-check as complete
- Cookie import mapping updated to support regional cookie name variations
- Move all documentation files to /docs folder
- Use npm script for screenshot capture in workflow ([#25](https://github.com/tokendad/GSCTracker/pull/25))

### Deprecated

### Removed

### Fixed
- Fixed Digital Cookie scraper duplicate order detection - removed VIEW link parsing that caused duplicate entries
- Fixed scraper to skip action words (View, Edit, Delete) when parsing customer names
- Fixed `waitForTimeout` deprecation by replacing with Promise-based timeout
- Fix top bar navigation to match PR#14 design - moved nav below header with 3 tabs (Profile, Individual, Events) using icons above text
- Fix YAML syntax errors in changelog workflow ([#17](https://github.com/tokendad/GSCTracker/pull/17))
  - Resolved issues from 21 consecutive failed workflow runs between PR #7 (which created the workflow) and PR #17
  - Fixed YAML parsing errors: changed `'on':` to `on:` and corrected heredoc indentation in multiline script
  - All 21 failures showed 0 jobs executed due to GitHub Actions being unable to parse the workflow file
  - Root cause: Heredoc content at column 0 while surrounding bash script was indented to column 10, causing YAML parser to fail with "could not find expected ':'"
  - Solution: Indented heredoc content to maintain YAML validity and added `sed` command to normalize output file

### Security

## [1.0.0] - 2026-01-18

### Added
- Mobile-first responsive design optimized for phone screens
- Cookie sales tracking with quantity and customer name
- Sales summary showing total boxes sold and number of sales
- Cookie breakdown displaying which cookies are selling best
- Local storage for data persistence between sessions
- Dark mode support that adapts to system preferences
- Touch-optimized interface with large touch targets
- Support for all 2026 Girl Scout Cookie varieties including new Exploremores™
- Docker support with docker-compose configuration
- Ability to delete individual sales or clear all data
- Add to Home Screen capability for iOS and Android devices

[Unreleased]: https://github.com/tokendad/GSCTracker/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tokendad/GSCTracker/releases/tag/v1.0.0
