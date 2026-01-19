# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed
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
