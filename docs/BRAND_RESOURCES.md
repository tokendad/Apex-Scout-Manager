# Apex Scout Manager - Brand Resources

This document contains official brand resources for both **Scouting America** (formerly Boy Scouts of America) and **Girl Scouts of the USA** to ensure consistent branding across the Apex Scout Manager application.

---

## Scouting America Brand Guidelines

### Primary Resources

1. **Scouting America Brand Guidelines (2024)**
   - URL: https://pathwaytoadventure.org/wp-content/uploads/2024/05/Scouting-America-Brand-Guidelines-2024-BC.pdf
   - Contains: Official logos, color palettes, typography, usage guidelines
   - Format: PDF
   - Year: 2024

2. **Scouting America Brand Asset Library**
   - URL: https://scouting.webdamdb.com/bp/#/
   - Contains: Official logos, images, marketing materials
   - Access: Digital asset management system

3. **Scouting America Design System (Zeplin)**
   - URL: https://scene.zeplin.io/project/59b6b6554fc4d8840a822300
   - Contains: Design specifications, components, style guide
   - Platform: Zeplin design collaboration tool

4. **Cub Scout Color Chart**
   - URL: https://www.reddit.com/media?url=https%3A%2F%2Fpreview.redd.it%2Fcub-scout-hex-color-chart-v0-h0fpv6m067uc1.png%3Fwidth%3D658%26format%3Dpng%26auto%3Dwebp%26s%3Df9ad5d793e38f35bb1d5c99a7851ee8785a3ea09
   - Contains: Official hex color codes for Cub Scout ranks
   - Format: PNG image with hex codes

---

## Girl Scouts of the USA Brand Guidelines

### Primary Resources

1. **GSEMA (Girl Scouts of Eastern Massachusetts) Brand Resources**
   - URL: https://www.gsema.org/en/get-involved/be-a-champion/gsema-brand-resources.html
   - Contains: Brand guidelines, logos, messaging resources
   - Region: Eastern Massachusetts

2. **GSNC (Girl Scouts of North Carolina) Brand Guidelines**
   - URL: https://www.gsnc.org/en/members/for-volunteers/brand.html
   - Contains: Brand guidelines for volunteers, usage rules
   - Region: North Carolina

3. **Girl Scouts of Arizona - Graphic Guidelines (2021)**
   - URL: https://www.girlscoutsaz.org/content/dam/girlscoutsaz-redesign/documents/volunteer-resources/brand-pr-marketing/graphic-guidelines_2021.pdf
   - Contains: Comprehensive graphic guidelines, logo usage, colors
   - Format: PDF
   - Year: 2021

4. **Girl Scout Diamonds - Brand Colors**
   - URL: https://www.girlscoutsdiamonds.org/content/dam/girlscoutsdiamonds-redesign/documents/forms-and-docs-8-22-forward/Girl%20Scout%20Brand%20Colors.pdf
   - Contains: Official Girl Scout brand color palette with hex codes
   - Format: PDF
   - Region: Arkansas, Oklahoma, Texas

### Girl Scout Grade Levels

Girl Scouts uses grade-based levels instead of ranks:

| Grade Level | Program Name | Age Range |
|-------------|--------------|-----------|
| K-1 | Daisy | 5-6 years |
| 2-3 | Brownie | 7-8 years |
| 4-5 | Junior | 9-10 years |
| 6-8 | Cadette | 11-13 years |
| 9-10 | Senior | 14-15 years |
| 11-12 | Ambassador | 16-17 years |

**Note**: Girl Scout level colors to be extracted from brand color PDF.

---

## Brand Elements to Implement

### Scouting America Colors
- **Primary Colors**: To be extracted from brand guidelines
- **Secondary Colors**: To be extracted from brand guidelines
- **Cub Scout Rank Colors**: Official colors defined below

### Girl Scouts Colors
- **Primary Colors**: To be extracted from brand color PDF
- **Secondary Colors**: To be extracted from brand color PDF
- **Level Colors**: To be extracted from regional brand guidelines (Daisy, Brownie, Junior, Cadette, Senior, Ambassador)

### Cub Scout Rank Colors

Each rank has three color levels for design flexibility:

| Rank | Primary (Top) | Secondary/Light (Middle) | Tertiary/Accent (Bottom) |
|------|---------------|--------------------------|--------------------------|
| **Lion** | #FFD700 (Gold) | #FFF2CC (Light Gold) | #BC8C00 (Dark Gold) |
| **Tiger** | #E55D00 (Orange) | #FBE5D6 (Light Orange) | #AE5A21 (Dark Orange) |
| **Wolf** | #BD0300 (Red) | #FF7C80 (Light Red) | #AE5A21 (Dark Orange/Brown) |
| **Bear** | #4472C4 (Blue) | #DEEBF7 (Light Blue) | #4472C4 (Blue) |
| **Webelos** | #385723 (Green) | #E2F0D9 (Light Green) | #385723 (Green) |
| **Arrow of Light** | #582800 (Brown) | #ECDEAA (Light Brown) | #582800 (Brown) |

**Usage Guidelines:**
- **Primary**: Use for rank badges, headers, and primary identification
- **Secondary/Light**: Use for backgrounds, cards, and subtle highlights
- **Tertiary/Accent**: Use for borders, accents, and emphasis elements

### Typography
- **Primary Font**: To be determined from brand guidelines
- **Secondary Font**: To be determined from brand guidelines
- **Web-Safe Alternatives**: To be defined

### Logos
- **Main Logo**: Available in brand asset library
- **Icon Variations**: Available in brand asset library
- **Usage Guidelines**: See brand guidelines PDF

---

## Implementation Phases

### Phase 6: Mobile/UX Enhancement
**Brand Integration Priorities:**
- Extract colors from both Scouting America and Girl Scouts brand guidelines
- Implement dual-brand color system (support both organizations)
- Add Cub Scout rank colors (Scouting America)
- Add Girl Scout level colors (GSUSA)
- Implement official typography if web-safe alternatives available
- Add organization-specific logos based on troop type
- Ensure accessibility (WCAG AA) with official color palettes
- Allow troop leaders to select organization type (Scouting America vs Girl Scouts)

### Phase 8: Scale & Polish
**Brand Refinement:**
- Final polish of all brand elements for both organizations
- Print-ready logo implementations
- Dual-brand compliance audit
- Style guide documentation for developers
- Organization switcher UI for multi-organization councils

---

## Current Application Branding

### Existing Colors (to be updated)
```css
--primary-color: #1e7b3c;      /* Current green (legacy) */
--secondary-color: #f8b500;    /* Current gold (legacy) */
--background-color: #f5f5f5;   /* Light gray (legacy) */
--card-background: #ffffff;    /* White */
--text-color: #333333;         /* Dark gray */
--border-color: #dddddd;       /* Light gray */
--danger-color: #dc3545;       /* Red for alerts */
```

### Updated Default Palette (Driftwood Pearl Morning - exact)
```css
--primary-color: #A76D55;   /* Dusty Rose */
--secondary-color: #D9B23F; /* Secondary/gold accent */
--accent-color: #A0C0A1;    /* Muted green/contrast */
--deep-color: #8E5B3A;      /* Deep chocolate fallback */
--background-color: #F3E3D3; /* Soft Pearl / neutral background */
--card-background: #FFFFFF;  /* Card background */
--text-color: #333333;       /* Dark gray */
--border-color: #dddddd;     /* Light gray */
--danger-color: #dc3545;     /* Red for alerts */
```

### Recommended Updates

**For Dual-Organization Support:**
1. Add organization-specific color sets (Scouting America and Girl Scouts)
2. Implement organization switcher to toggle between brand palettes
3. Add Cub Scout rank colors (Scouting America) as CSS variables
4. Add Girl Scout level colors (GSUSA) as CSS variables
5. Create organization-specific theme modes
6. Maintain accessibility contrast ratios for both palettes

**Default Palette Strategy:**
- Use neutral colors as default (current green/gold)
- Allow troop configuration to select organization branding
- Apply organization-specific colors to rank/level badges only
- Keep core UI neutral to support both organizations

---

## Notes for Developers

### Before Implementing Brand Changes:
1. Review brand guidelines PDF thoroughly
2. Ensure all logos meet usage requirements
3. Verify color accessibility (contrast ratios)
4. Get approval for any brand element modifications
5. Test on both light and dark themes

### Color Variables to Add:
```css
/* Scouting America Official Colors (TBD) */
--scouting-america-primary: #??????;
--scouting-america-secondary: #??????;

/* Girl Scouts Official Colors (TBD) */
--girl-scouts-primary: #??????;
--girl-scouts-secondary: #??????;

/* Girl Scout Level Colors (TBD - extract from brand color PDF) */
--level-daisy: #??????;          /* Kindergarten - 1st grade */
--level-brownie: #??????;        /* 2nd - 3rd grade */
--level-junior: #??????;         /* 4th - 5th grade */
--level-cadette: #??????;        /* 6th - 8th grade */
--level-senior: #??????;         /* 9th - 10th grade */
--level-ambassador: #??????;     /* 11th - 12th grade */

/* Cub Scout Rank Colors - Primary (Top) */
--rank-lion-primary: #FFD700;           /* Gold */
--rank-tiger-primary: #E55D00;          /* Orange */
--rank-wolf-primary: #BD0300;           /* Red */
--rank-bear-primary: #4472C4;           /* Blue */
--rank-webelos-primary: #385723;        /* Green */
--rank-aol-primary: #582800;            /* Brown */

/* Cub Scout Rank Colors - Secondary/Light (Middle) */
--rank-lion-secondary: #FFF2CC;         /* Light Gold */
--rank-tiger-secondary: #FBE5D6;        /* Light Orange */
--rank-wolf-secondary: #FF7C80;         /* Light Red */
--rank-bear-secondary: #DEEBF7;         /* Light Blue */
--rank-webelos-secondary: #E2F0D9;      /* Light Green */
--rank-aol-secondary: #ECDEAA;          /* Light Brown */

/* Cub Scout Rank Colors - Tertiary/Accent (Bottom) */
--rank-lion-tertiary: #BC8C00;          /* Dark Gold */
--rank-tiger-tertiary: #AE5A21;         /* Dark Orange */
--rank-wolf-tertiary: #AE5A21;          /* Dark Orange/Brown */
--rank-bear-tertiary: #4472C4;          /* Blue (same as primary) */
--rank-webelos-tertiary: #385723;       /* Green (same as primary) */
--rank-aol-tertiary: #582800;           /* Brown (same as primary) */
```

### Typography Implementation:
- Check if official fonts have web licenses
- Define fallback fonts for web safety
- Implement via Google Fonts or self-hosted fonts

---

## Resources Last Updated
- **Date**: 2026-02-07
- **Added By**: Development Team
- **Review Date**: TBD

---

## Action Items

### Immediate (Current Phase):
- [ ] Review Scouting America brand guidelines PDF
- [ ] Review Girl Scouts brand color PDF
- [ ] Extract official color palettes for both organizations
- [ ] Identify official typography for both organizations
- [ ] Determine dual-brand strategy

### Phase 3.1 (Scout Profiles):
- [ ] Add organization field to scout profiles
- [ ] Add rank/level field (Cub Scout ranks or Girl Scout levels)
- [ ] Support rank/level-specific colors in scout cards

### Phase 6 (Mobile/UX):
- [ ] Implement Scouting America color scheme
- [ ] Implement Girl Scouts color scheme
- [ ] Add organization-specific logos
- [ ] Create organization switcher UI
- [ ] Update typography if applicable
- [ ] Test accessibility with both color palettes
- [ ] Add Cub Scout rank colors (Lion, Tiger, Wolf, Bear, Webelos, AoL)
- [ ] Add Girl Scout level colors (Daisy, Brownie, Junior, Cadette, Senior, Ambassador)

### Phase 8 (Polish):
- [ ] Final brand compliance review for both organizations
- [ ] Create internal dual-brand usage guide
- [ ] Document all brand elements used
- [ ] Get sign-off on brand implementation
- [ ] Test organization switcher functionality

---

## Contact & Support

### Scouting America
For questions about Scouting America brand usage:
- Refer to official brand guidelines: [Brand Guidelines PDF](https://pathwaytoadventure.org/wp-content/uploads/2024/05/Scouting-America-Brand-Guidelines-2024-BC.pdf)
- Brand Asset Library: [WebDAM](https://scouting.webdamdb.com/bp/#/)
- Legal/Trademark inquiries: [To be added if available]

### Girl Scouts of the USA
For questions about Girl Scouts brand usage:
- Refer to regional council brand guidelines (GSEMA, GSNC, Arizona, Diamonds)
- Brand Color Guide: [Girl Scout Brand Colors PDF](https://www.girlscoutsdiamonds.org/content/dam/girlscoutsdiamonds-redesign/documents/forms-and-docs-8-22-forward/Girl%20Scout%20Brand%20Colors.pdf)
- Local Council Contact: [Refer to your local Girl Scout council]

---

## Important Notes

### Multi-Organization Support
This application supports **both Scouting America and Girl Scouts** troops. Ensure:
1. Troop leaders can select their organization during setup
2. Appropriate branding displays based on organization selection
3. Rank/level systems match the organization (Cub Scout ranks vs Girl Scout levels)
4. Compliance with both organizations' trademark and brand guidelines

### Public-Facing Materials
Ensure all public-facing materials comply with the respective organization's trademark and brand guidelines. For internal troop management use, follow the dual-brand strategy outlined in this document.
