# GSCTracker
Girl Scout Cookie Tracker

A mobile-responsive web application for tracking Girl Scout Cookie sales. Designed to work seamlessly on both Android and iPhone devices.

## Features

- 🔒 **Secure Authentication**: Username/password login with encrypted data storage (COPPA compliant)
- 📱 **Mobile-First Design**: Optimized for phone screens with responsive layout
- 🍪 **Track Cookie Sales**: Record sales by cookie type, quantity, customer, and payment status
- 💳 **Payment Methods**: Manage multiple payment options (Venmo, PayPal, etc.) with dynamic QR code generation
- 📅 **Event Management**: Track booth sales, inventory, and donations with support for editing event details
- 📊 **Sales Summary**: View total boxes sold, revenue, and donation stats at a glance
- 📈 **Cookie Breakdown**: See which cookies are selling best
- 👤 **Scout Profile**: Personalize with photo, goal tracking, and shareable store/payment links
- 💾 **Persistent Data**: SQLite database storage with encryption for sensitive data
- 🌓 **Dark Mode Support**: Automatically adapts to system dark mode preference
- ⚙️ **Data Management**: Import/Export capabilities and bulk deletion tools

## Screenshots

### Mobile View - Profile Tab
![Mobile Profile Tab](screenshots/mobile-profile.png)

### Mobile View - Summary Tab
![Mobile Summary Tab](screenshots/mobile-summary.png)

### Mobile View - Individual Sales Tab
![Mobile Individual Sales Tab](screenshots/mobile-individual-sales.png)

### Mobile View - Events Tab
![Mobile Events Tab](screenshots/mobile-events.png)

### Mobile View - Settings Tab
![Mobile Settings Tab](screenshots/mobile-settings.png)

## Cookie Types Included (2026 Season)

**Classic Cookies:**
- Thin Mints® - Crisp chocolate cookies with mint coating (vegan)
- Samoas® / Caramel deLites® - Cookies with caramel, coconut, and chocolate
- Tagalongs® / Peanut Butter Patties® - Peanut butter layered cookies with chocolate
- Trefoils® / Shortbread - Classic shortbread cookies
- Do-si-dos® / Peanut Butter Sandwich - Oatmeal cookies with peanut butter filling
- Lemon-Ups® - Crispy lemon cookies with inspiring messages
- Lemonades® - Shortbread with tangy lemon icing
- Adventurefuls® - Brownie-inspired cookies with caramel crème and sea salt

**NEW for 2026:**
- Exploremores™ - Rocky road ice cream-inspired sandwich cookies

**Gluten-Free Options:**
- Toffee-tastic® - Buttery cookies with toffee bits (gluten-free)
- Caramel Chocolate Chip - Chewy cookies with caramel and chocolate (gluten-free)

**Note:** Cookies are typically $6 per box, but prices may vary by region ($5-$7).

## Usage

### First-Time Setup

1. **Start the application** (see installation methods below)
2. **Navigate to the login page** at `http://localhost:3000/login.html`
3. **Create your account**:
   - Click "Create one" to register
   - Enter a username (3-20 characters)
   - Choose a secure password (minimum 8 characters)
   - Optionally add email, first name, and last name
4. **Log in** with your new credentials

### Using Docker (Recommended)

The easiest way to run GSCTracker is using Docker:

```bash
# Set environment variables for security (REQUIRED for production)
export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# Start the application
docker-compose up -d

# Access at http://localhost:8080
```

For detailed Docker configuration options, see [docs/docker_compose.md](docs/docker_compose.md).

### Local Development (Without Docker)

Since GSCTracker uses a Node.js backend with SQLite, you cannot just open `index.html`.

1. **Install Dependencies:**
   ```bash
   npm install
   ```
2. **Set Environment Variables (Optional for development):**
   ```bash
   export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
   ```
3. **Start the Server:**
   ```bash
   npm start
   ```
4. **Access the App:**
   Open [http://localhost:3000](http://localhost:3000) in your browser.
   You'll be redirected to the login page to create your account.

## Security & COPPA Compliance

GSCTracker v2.0 includes comprehensive security features:

- 🔐 **Encrypted Data Storage**: Sensitive data encrypted with AES-256-GCM
- 🔑 **Secure Authentication**: Bcrypt password hashing (12 rounds) with account lockout
- 🍪 **Secure Sessions**: HTTP-only cookies with 24-hour expiration
- 🛡️ **Security Headers**: Content Security Policy, HSTS, and XSS protection
- 🚦 **Rate Limiting**: Prevents brute force attacks (5 login attempts per 15 minutes)
- 📝 **Audit Logging**: All authentication events logged for security monitoring

For detailed security setup and COPPA compliance information, see [docs/SECURITY.md](docs/SECURITY.md).

### Production Deployment

For production use with HTTPS/TLS (required for COPPA compliance):

1. Set up a reverse proxy (nginx/Caddy) with SSL certificates
2. Configure environment variables: `ENCRYPTION_KEY`, `SESSION_SECRET`, `NODE_ENV=production`
3. Enable HTTPS-only mode in your reverse proxy
4. See [docs/SECURITY.md](docs/SECURITY.md) for detailed setup instructions

## Configuration

### Payment Methods
1. Go to **Settings**.
2. Add your payment providers (e.g., Venmo, PayPal) and their profile URLs.
3. The **Profile** tab will automatically generate and display QR codes for each method.

## Mobile Access

For the best mobile experience:

### iOS (iPhone/iPad):
1. Open the app URL in Safari (e.g., `http://your-server:3000`)
2. Tap the share button
3. Select "Add to Home Screen"
4. Access the tracker like a native app from your home screen

### Android:
1. Open the app URL in Chrome (e.g., `http://your-server:3000`)
2. Tap the menu (three dots)
3. Select "Add to Home Screen"
4. Access the tracker from your home screen

## Technical Details

- **Backend**: Node.js with Express server
- **Database**: SQLite (better-sqlite3) for persistent data storage
- **Frontend**: Pure HTML/CSS/JavaScript
- **API**: RESTful endpoints for CRUD operations
- **Logging**: Winston with daily rotation and colored output (see [LOGGING.md](LOGGING.md))
- **Responsive Design**: Uses CSS Grid, Flexbox, and media queries
- **Cross-Browser Compatible**: Works on all modern browsers
- **Viewport Optimized**: Proper meta tags for mobile rendering
- **Touch-Friendly**: 48px minimum touch targets following accessibility guidelines

## Browser Support

- iOS Safari 12+
- Android Chrome 80+
- Desktop Chrome, Firefox, Safari, Edge (latest versions)

## Data Storage

All data is stored in a SQLite database (`gsctracker.db`) in the `/data` directory. The database is persistent across container restarts when using the Docker volume mount. The application uses a Node.js backend with Express to serve the web interface and provide REST API endpoints for data operations.

## Logging

GSCTracker includes comprehensive error logging with:
- Colored console output (green for info, yellow for warnings, red for errors)
- Automatic daily log rotation
- 7-day log retention
- Separate error log files

Logs are stored in `/data/logs/` and are included in the Docker volume mount. For more details, see [LOGGING.md](LOGGING.md).

## Changelog

For a detailed history of changes, features, and fixes, see [CHANGELOG.md](CHANGELOG.md).

The changelog is automatically updated when pull requests are merged. Contributors should:
- Use descriptive PR titles (they become changelog entries)
- Add appropriate labels (`feature`, `bug`, `documentation`, etc.)
- Follow conventional commit prefixes (`feat:`, `fix:`, `docs:`, etc.)
