# Getting Started with GSCTracker v2.0

Welcome to GSCTracker v2.0! This guide will help you get started with the new multi-user authentication system.

---

## 🎉 What's New in v2.0

GSCTracker v2.0 transforms the application from a single-user cookie tracker into a multi-user, multi-tenant platform with enterprise-grade security and compliance features.

### Key Features
- ✅ **Multi-User Support** - Multiple scouts can use the same installation
- ✅ **User Authentication** - Secure email/password and Google OAuth login
- ✅ **Session Management** - Persistent, secure user sessions
- ✅ **COPPA Compliance** - Age verification and parental consent for minors
- ✅ **Role-Based Access Control** - Scout, Troop Leader, Council Admin, Parent roles
- ✅ **Audit Logging** - Track all authentication and important events
- ✅ **Troop Management** - Foundation for troop-level features (councils, troops, members)

---

## 🚀 Quick Start

### 1. Start the Server

The server should already be running. If not:

```bash
cd /data/GSCTracker
node server.js
```

Server will start on **http://localhost:3000**

### 2. Access the Application

Open your browser and navigate to:
- **Main App:** http://localhost:3000
- **Login:** http://localhost:3000/login.html
- **Register:** http://localhost:3000/register.html

### 3. Create Your First Account

1. Go to http://localhost:3000/register.html
2. Fill in the registration form:
   - First Name & Last Name
   - Email
   - Password (at least 8 characters with uppercase, lowercase, and numbers)
   - Date of Birth (optional, but required if under 13)
   - Parent Email (required if under 13)
3. Click "Create Account"
4. You'll be redirected to the login page

### 4. Log In

1. Go to http://localhost:3000/login.html
2. Enter your email and password
3. Click "Sign In"
4. You'll be redirected to the main application

---

## 🔐 Default Admin Account

The migration created a default admin account with access to all existing data:

- **Email:** admin@gsctracker.local
- **Password:** (No password set - register a new account or set manually)
- **Role:** council_admin

To set a password for the admin account, you can register using the same email address.

---

## 🎨 User Interface

### Login Page (`/login.html`)
- Email/password login form
- "Continue with Google" button (requires configuration)
- Link to registration page
- Error handling and user feedback

### Registration Page (`/register.html`)
- User registration form with validation
- Password strength indicator
- Age verification (COPPA compliance)
- Parent email requirement for minors
- "Sign up with Google" button (requires configuration)
- Link to login page

---

## ⚙️ Configuration

### Optional: Google OAuth Setup

To enable Google Sign-In:

1. **Create Google Cloud Project**
   - Go to https://console.cloud.google.com
   - Create a new project (or use existing)

2. **Enable Google+ API**
   - In the API Library, enable "Google+ API"

3. **Create OAuth Credentials**
   - Go to Credentials → Create Credentials → OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
   - Copy the Client ID and Client Secret

4. **Set Environment Variables**
   Create a `.env` file (copy from `.env.example`):
   ```bash
   GOOGLE_CLIENT_ID=your_client_id_here
   GOOGLE_CLIENT_SECRET=your_client_secret_here
   GOOGLE_CALLBACK_URL=http://localhost:3000/auth/google/callback
   ```

5. **Restart the Server**
   ```bash
   # Stop the server (Ctrl+C)
   # Start it again
   node server.js
   ```

### Required: Session Secret

For production deployments, set a secure session secret:

```bash
# In .env file
SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
```

---

## 📡 API Endpoints

### Authentication Endpoints

#### Register a New User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "2015-01-01",  # Optional
  "parentEmail": "parent@example.com"  # Required if under 13
}
```

#### Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

#### Get Current User
```bash
GET /api/auth/me
# Requires authentication (session cookie)
```

#### Logout
```bash
POST /api/auth/logout
# Requires authentication (session cookie)
```

#### Get Notifications
```bash
GET /api/notifications
# Requires authentication (session cookie)
```

---

## 🗄️ Database Changes

### New Tables
- `users` - User accounts and authentication
- `sessions` - Active user sessions
- `councils` - Girl Scout councils
- `troops` - Girl Scout troops within councils
- `troop_members` - Scout membership in troops
- `troop_goals` - Troop-level sales goals
- `audit_log` - Security and compliance audit trail
- `data_deletion_requests` - COPPA data deletion tracking
- `notifications` - User notifications

### Modified Tables
- `profile` - Added `userId` column
- `sales` - Added `userId` column
- `donations` - Added `userId` column
- `events` - Added `userId` and `troopId` columns

### Migration
All existing data has been migrated to a default admin user (ID: 1).

Backup location: `/data/gsctracker.db.backup.[timestamp]`

---

## 🧪 Testing

### Manual Testing Checklist

1. **Registration**
   - [ ] Register a new adult user (18+)
   - [ ] Register a minor user (under 13) - should require parent email
   - [ ] Try registering with same email twice - should fail
   - [ ] Try weak password - should fail validation

2. **Login**
   - [ ] Login with registered credentials
   - [ ] Try login with wrong password - should fail
   - [ ] Try login with non-existent email - should fail
   - [ ] Verify session persists across page refreshes

3. **Logout**
   - [ ] Logout successfully
   - [ ] Verify cannot access protected endpoints after logout

4. **Google OAuth** (if configured)
   - [ ] Click "Continue with Google"
   - [ ] Authorize with Google account
   - [ ] Verify redirected back to app
   - [ ] Verify logged in with Google account

### API Testing with curl

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "firstName": "Test",
    "lastName": "User"
  }'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123"
  }' \
  -c cookies.txt

# Get current user (uses saved cookies)
curl http://localhost:3000/api/auth/me \
  -b cookies.txt

# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt
```

---

## 🔒 Security Features

### Implemented
- ✅ Password hashing with bcryptjs (12 rounds)
- ✅ Session-based authentication with secure cookies
- ✅ HttpOnly cookies (prevents XSS attacks)
- ✅ SameSite cookie protection (prevents CSRF)
- ✅ Password strength validation
- ✅ Email format validation
- ✅ Rate limiting on API endpoints
- ✅ Audit logging for authentication events
- ✅ COPPA compliance (age verification, parental consent)

### Recommended for Production
- 🔜 HTTPS/TLS encryption (required for secure cookies)
- 🔜 Email verification
- 🔜 Password reset flow
- 🔜 Account lockout after failed login attempts
- 🔜 Two-factor authentication (2FA)
- 🔜 Security headers (helmet.js)
- 🔜 CORS configuration for production domain

---

## 📝 Current Limitations

1. **Existing API Endpoints** - Sales, donations, events, and profile endpoints do not yet require authentication (backward compatibility)
2. **Single Profile** - Profile endpoint still returns single profile, needs multi-user support
3. **No Email Service** - Email verification and password reset require email service integration
4. **No Admin UI** - User management requires direct database access or API calls
5. **Google OAuth** - Requires manual configuration (not enabled by default)

---

## 🐛 Troubleshooting

### "Google OAuth not configured" warning
This is normal if you haven't set up Google OAuth credentials. The warning can be safely ignored if you don't plan to use Google Sign-In.

### Cannot log in after registration
- Verify the registration was successful (check for success message)
- Ensure you're using the correct email and password
- Check server logs: `tail -f /data/logs/gsctracker-*.log`

### Session not persisting
- Ensure cookies are enabled in your browser
- If using HTTPS, verify `NODE_ENV=production` is set
- Check that SESSION_SECRET is configured

### Database errors
- Check that migration ran successfully: `node migrations/verify-migration.js`
- Restore from backup if needed: `cp /data/gsctracker.db.backup.[timestamp] /data/gsctracker.db`

---

## 📚 Next Steps

### For Users
1. Create your account
2. Explore the new authentication features
3. Test the login/logout functionality
4. Set up Google OAuth (optional)

### For Developers
1. Review the implementation status: `/docs/V2_IMPLEMENTATION_STATUS.md`
2. Check the roadmap: `/docs/FUTURE_FEATURES.md`
3. Add authentication to existing API endpoints
4. Implement email verification
5. Build admin user management UI

---

## 📞 Support

- **Documentation:** `/docs/` directory
- **Issues:** Create an issue on GitHub
- **Logs:** `/data/logs/gsctracker-*.log`

---

## 🎯 Version Information

- **Version:** 2.0.0-alpha.1
- **Branch:** v2.0
- **Last Updated:** 2026-01-23
- **Phase:** 1 (Foundation) - Complete

---

**Happy Tracking! 🍪**
