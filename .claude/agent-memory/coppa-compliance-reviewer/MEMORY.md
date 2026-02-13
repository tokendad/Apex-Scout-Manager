# COPPA Compliance Review Memory

## Project Context
**Application**: Apex Scout Manager (ASM) - Multi-user Girl Scout/Scouting America troop management
**Tech Stack**: Node.js, Express, PostgreSQL, Vanilla JS
**User Base**: Scouts (including children under 13), parents, troop leaders, council admins

## Age Verification Implementation
- **isMinor() function** (auth.js:532): Calculates age < 13 for COPPA
- **Age threshold**: Correctly uses 13 (not 18) per COPPA requirements
- Minor status stored in `users.isMinor` boolean field (auto-calculated from dateOfBirth)

## Database Schema - Personal Information Fields
Located in: `/data/ASM/migrations/002_create_schema.sql`

**Users table PII**:
- firstName, lastName, email (required)
- phone, address (optional, added in migration 006)
- dateOfBirth, photoUrl (optional)
- parentEmail (required for minors)
- parentConsentDate, parentConsentIP (fields exist but NOT currently used)
- Password fields: password_hash, passwordResetToken, passwordResetExpires

**Account activation**:
- isActive: Set to FALSE for minors at registration (line 543)
- emailVerified: Always FALSE initially
- Minors see message: "Parental consent required" but no actual consent mechanism implemented

## Critical COPPA Gaps Identified

### 1. NO PARENTAL CONSENT MECHANISM (CRITICAL)
- parentEmail collected but NO verification sent
- parentConsentDate and parentConsentIP fields exist but NEVER populated
- Comment in code: "TODO: Send email with reset link" (line 2049)
- Minors marked isActive=FALSE but no way to activate after consent

### 2. NO PRIVACY POLICY
- No privacy policy document found in codebase
- Registration forms don't link to privacy policy
- No disclosure of what data is collected or how it's used

### 3. INCOMPLETE DATA MINIMIZATION
- Collects address, phone without clear necessity justification
- Payment method URLs (Venmo/PayPal) stored without parental consent for minors

## Positive Findings

### Account Deletion (server.js:2224-2288)
- Soft delete implementation with 30-day retention
- Minors CANNOT self-delete (line 2242-2245)
- Anonymization: email changed to "deleted_[id]@deleted.local"
- PII cleared: phone, address set to NULL
- Audit trail: data_deletion_requests table tracks who requested deletion
- **Note**: Does NOT clear dateOfBirth, photoUrl, firstName, lastName

### Age Calculation
- Correct implementation of under-13 threshold
- Proper age calculation considering month/day (auth.js:514-525)

### Privilege System
- Parents have 'H' (household) scope for edit_personal_info
- Scouts limited to 'S' (self) scope by default
- edit_personal_info privilege properly enforced

## File Locations
- Age verification: `/data/ASM/auth.js` (lines 514-534)
- Registration: `/data/ASM/server.js` (lines 478-583)
- Account deletion: `/data/ASM/server.js` (lines 2224-2288)
- User schema: `/data/ASM/migrations/002_create_schema.sql` (lines 10-29)
- Edit member UI: `/data/ASM/public/index.html` (lines 1265+)
- Registration form: `/data/ASM/public/register.html`

## Recommendations Logged
See detailed compliance review for full remediation plan.
