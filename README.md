# GSCTracker
Girl Scout Cookie Tracker

A mobile-responsive web application for tracking Girl Scout Cookie sales. Designed to work seamlessly on both Android and iPhone devices.

## Features

- 📱 **Mobile-First Design**: Optimized for phone screens with responsive layout
- 🍪 **Track Cookie Sales**: Record sales by cookie type, quantity, and customer
- 📊 **Sales Summary**: View total boxes sold and number of sales at a glance
- 📈 **Cookie Breakdown**: See which cookies are selling best
- 💾 **Local Storage**: Data persists between sessions using browser local storage
- 🌓 **Dark Mode Support**: Automatically adapts to system dark mode preference
- ✨ **Touch-Optimized**: Large touch targets and smooth mobile interactions

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

1. Open `index.html` in any modern web browser (mobile or desktop)
2. Fill out the "Record a Sale" form:
   - Select a cookie type
   - Enter the quantity of boxes sold
   - Optionally add a customer name
3. Click "Add Sale" to record the transaction
4. View your sales summary, recent sales list, and cookie breakdown
5. Delete individual sales or clear all data as needed

## Mobile Access

For the best mobile experience:

### iOS (iPhone/iPad):
1. Open `index.html` in Safari
2. Tap the share button
3. Select "Add to Home Screen"
4. Access the tracker like a native app from your home screen

### Android:
1. Open `index.html` in Chrome
2. Tap the menu (three dots)
3. Select "Add to Home Screen"
4. Access the tracker from your home screen

## Technical Details

- **Pure HTML/CSS/JavaScript**: No dependencies or build process required
- **Responsive Design**: Uses CSS Grid, Flexbox, and media queries
- **Cross-Browser Compatible**: Works on all modern browsers
- **Viewport Optimized**: Proper meta tags for mobile rendering
- **Touch-Friendly**: 48px minimum touch targets following accessibility guidelines

## Browser Support

- iOS Safari 12+
- Android Chrome 80+
- Desktop Chrome, Firefox, Safari, Edge (latest versions)

## Data Storage

All data is stored locally in your browser using localStorage. No data is sent to any server. To backup your data, you can export it from the browser's developer tools (Application > Local Storage).
