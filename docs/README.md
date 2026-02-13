# Apex Scout Manager - Documentation Index

Welcome to the Apex Scout Manager documentation. This folder is organized by function to help you find what you need quickly.

---

## 📚 Documentation Structure

### 🚀 [Getting Started](Getting%20Started/)
**Start here if you're new to the project**
- `GETTING_STARTED_V2.md` - Quick start guide for development
- `TEST_ACCOUNTS.md` - Test user credentials for development
- `DEVELOPMENT_SEED_DATA.md` - How to seed development data

---

### 🏗️ [Architecture](Architecture/)
**Understand how the system is designed**
- `DATABASE_SCHEMA.md` - Complete database schema and relationships
- `Hierarchy Definitions.md` - Organization hierarchy (Council → Troop → Members)
- `Account Access Schema.md` - User roles and access control model

---

### ✨ [Features](Features/)
**Implementation details for specific features**
- **Member Details** - Member profile editing and management
  - `Member-Details/IMPLEMENTATION_PLAN.md` - Complete implementation plan for member editing

*More features coming soon*

---

### 🚢 [Deployment](Deployment/)
**Everything about running the application**
- `docker_compose.md` - Docker setup and configuration
- `DATABASE_MIGRATION_V2.md` - Database migration procedures
- `LOGGING.md` - Logging configuration
- `INTEGRATION_TESTING_CHECKLIST.md` - Testing procedures
- `UI_UX_COMPLETION_SUMMARY.md` - UI/UX implementation summary

---

### 🛡️ [Compliance](Compliance/)
**Security and compliance documentation**
- `CLAUDE.md` - Claude AI implementation guidelines (if using Claude features)
- `GEMINI.md` - Gemini AI implementation guidelines (if using Gemini features)

---

### 🗂️ [Resources](Resources/)
**External resources and brand guidelines**

#### Girl Scout Resources
- Brand guidelines and official materials
- Badge PDFs for each level (Daisy, Brownie, Junior, Cadette, Senior, Ambassador)
- Cookie sales information and implementation specs

#### Scouting America Resources
- Cub Scouts organization materials
- Scouts BSA organization materials
- Venturing and Sea Scouts resources
- Brand guidelines and popcorn information

#### COPPA Compliance
- `COPPA_COMPLIANCE_REVIEW.md` - Complete COPPA compliance analysis (CRITICAL - READ IF HANDLING USERS UNDER 13)

#### Other Organizations
- Navigators USA resources

---

### 🛣️ [Roadmap](Roadmap/)
**Project timeline and planning**
- `CHANGELOG.md` - Version history and changes
- `Version Roadmap.md` - Future versions and planned features
- `FUTURE_FEATURES.md` - Features planned for future phases
- `IMPLEMENTATION_SUMMARY.md` - Summary of what's been built

---

### 📦 [_Archive](/_Archive/)
**Historical and deprecated documentation**
- `v2-Implementation-Original/` - Complete v2 implementation phase documentation
- `v3 Project Documentation/` - Older v3 planning (archived)
- `v4 Project Documentation/` - Older v4 planning (archived)

---

## 🔍 Quick Navigation

### By Role

**👨‍💻 Developers**
1. Start: [Getting Started](Getting%20Started/GETTING_STARTED_V2.md)
2. Understand: [Architecture](Architecture/)
3. Setup: [Deployment](Deployment/docker_compose.md)
4. Reference: [Features](Features/)

**🔒 Security/Compliance**
1. Read: [COPPA Compliance](Resources/COPPA%20Information/COPPA_COMPLIANCE_REVIEW.md) (if handling minors)
2. Reference: [Compliance](Compliance/)
3. Check: [Deployment](Deployment/INTEGRATION_TESTING_CHECKLIST.md)

**🎨 Design/UX**
1. Reference: [UI/UX Summary](Deployment/UI_UX_COMPLETION_SUMMARY.md)
2. Brand: [Resources/Girl Scout Resources/](Resources/)

**👔 Project Managers**
1. Status: [Roadmap](Roadmap/IMPLEMENTATION_SUMMARY.md)
2. Future: [Roadmap/FUTURE_FEATURES.md](Roadmap/FUTURE_FEATURES.md)
3. Timeline: [Roadmap/Version Roadmap.md](Roadmap/Version%20Roadmap.md)

---

### By Topic

| Topic | Files |
|-------|-------|
| **Database** | [Architecture/DATABASE_SCHEMA.md](Architecture/DATABASE_SCHEMA.md) |
| **Users & Auth** | [Architecture/Account Access Schema.md](Architecture/Account%20Access%20Schema.md) |
| **Testing** | [Deployment/INTEGRATION_TESTING_CHECKLIST.md](Deployment/INTEGRATION_TESTING_CHECKLIST.md) |
| **Deployment** | [Deployment/docker_compose.md](Deployment/docker_compose.md) |
| **Compliance (COPPA)** | [Resources/COPPA Information/](Resources/COPPA%20Information/) |
| **Girl Scout Badges** | [Resources/Girl Scout Resources/](Resources/Girl%20Scout%20Resources/) |
| **Scouting America** | [Resources/Scouting America Resources/](Resources/Scouting%20America%20Resources/) |

---

## ⚠️ Important Notes

### COPPA Compliance (READ IF HANDLING USERS UNDER 13)
If your application includes users under 13, **MUST READ** [COPPA Compliance Review](Resources/COPPA%20Information/COPPA_COMPLIANCE_REVIEW.md). This document identifies critical compliance issues that must be fixed before production deployment.

### Development vs Production
- Use `TEST_ACCOUNTS.md` for development credentials
- `DEVELOPMENT_SEED_DATA.md` explains how to populate test data
- See [Deployment/docker_compose.md](Deployment/docker_compose.md) for setup

### Brand Resources
- Girl Scout brand guidelines: [Resources/Girl Scout Resources/](Resources/Girl%20Scout%20Resources/)
- Scouting America guidelines: [Resources/Scouting America Resources/](Resources/Scouting%20America%20Resources/)

---

## 📝 File Naming Convention

- **UPPERCASE_FILENAME.md** - Major guides and references
- **Title Case Filename.md** - Detailed implementations and specifications
- **lowercase_name.md** - Quick references and tools

---

## 🔗 Related Files Outside Docs

- **Project Code**: `/data/ASM/` - Main application code
- **Implementation Plans**: `docs/Features/` - Feature-specific plans
- **Development Guide**: `claude_code_usage_guide.md` - How to use Claude Code

---

## 📅 Last Updated

- Structure: 2026-02-12
- Reference: Check individual files for last update dates

---

## ❓ Can't Find Something?

1. **Check the [_Archive](/_Archive/)** folder for historical documentation
2. **Search by topic** using the table above
3. **Check Features folder** for specific feature documentation
4. **Read Resources folder** for external brand materials

---

**Welcome to ASM Development! 🎉**
