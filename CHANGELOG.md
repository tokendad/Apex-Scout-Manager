# Changelog

All notable changes to GSCTracker will be documented in this file.

## [1.2.0] - 2026-01-21

### Removed
- **Digital Cookie Sync (Scraping)** removed to comply with Girl Scouts Digital Cookie Terms of Service.
- **Puppeteer dependencies** removed to reduce application size and complexity.

## [1.1.0] - 2026-01-20

### Added
- **Edit Order functionality** for manual orders - edit customer info, cookies, payment details
- **Status color coding** for Recent Sales table:
  - Green: Complete/Delivered orders
  - Yellow: Shipped orders
  - Blue: In-Person delivery orders
  - Red: Awaiting Payment orders
- **Status legend** below Recent Sales table
- **Order Complete button** replaced checkbox with styled button
- **Multiple payment methods** support with dynamic QR code generation
- **Bordered settings sections** for better visual organization in Settings page

### Changed
- **Digital Cookie Sync** no longer requires Orders Page URL - automatically detected after login
- **Scraper performance** improved with parallel tab processing (3x-5x faster)
- **Cookie Breakdown** now shows individual cookie types instead of "Assorted" for synced orders
- **Online orders** from Digital Cookie sync are automatically marked as Paid
- **Upload Photo button** renamed to "Upload Profile Photo" and moved above Store URL
- **README** updated with corrected Digital Cookie sync instructions

### Fixed
- **Order details extraction** from Digital Cookie - now captures phone, email, address correctly
- **Security vulnerabilities** - replaced vulnerable `xlsx` package with `exceljs`

### Security
- Resolved Dependabot alerts:
  - GHSA-4r6h-8v6p-xvw6 (Prototype Pollution in SheetJS)
  - GHSA-5pgg-2g8v-p4x9 (SheetJS ReDoS vulnerability)

## [1.0.0] - 2026-01-19

### Added
- Initial release
- Cookie sales tracking with individual and event sales
- Digital Cookie sync integration
- Profile management with photo upload
- QR code generation for store links
- Dark mode support
- SQLite database storage
- Docker support
