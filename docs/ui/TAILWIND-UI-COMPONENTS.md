# Tailwind UI Components Used in Bravo

This document lists the modern Tailwind UI components and patterns used in the Bravo application redesign.

## Official Tailwind UI
[Tailwind UI](https://tailwindui.com/) is the official component library from the creators of Tailwind CSS, featuring professionally designed, fully responsive HTML components built with Tailwind CSS.

## Components Used

### 1. **Stat Cards with Icons** (Application UI / Data Display / Stats)
- **Location**: `CampaignList.tsx` - StatCard component
- **Pattern**: Stats with trending indicators
- **Features**:
  - Gradient icon backgrounds
  - Trending arrows with color indicators
  - Clean typography hierarchy
- **Reference**: [Stats sections](https://tailwindui.com/components/application-ui/data-display/stats)

### 2. **Dark Sidebar Navigation** (Application UI / Navigation / Sidebar Navigation)
- **Location**: `Layout.tsx`
- **Pattern**: Dark sidebar with user section
- **Features**:
  - Fixed dark sidebar (bg-gray-900)
  - Icon-based navigation items
  - Active state highlighting
  - User profile section at bottom
- **Reference**: [Sidebar layouts](https://tailwindui.com/components/application-ui/navigation/sidebar-navigation)

### 3. **Search Input with Icon** (Application UI / Forms / Input Groups)
- **Location**: `CampaignList.tsx` - Search bar
- **Pattern**: Input with leading icon
- **Features**:
  - Magnifying glass icon
  - Focus ring styling
  - Shadow effects
- **Reference**: [Input groups](https://tailwindui.com/components/application-ui/forms/input-groups)

### 4. **Gradient Buttons** (Application UI / Elements / Buttons)
- **Location**: `CampaignList.tsx` - New Campaign button
- **Pattern**: Primary button with gradient
- **Features**:
  - Gradient background (from-primary-600 to-primary-700)
  - Hover state transitions
  - Icon integration
- **Reference**: [Button examples](https://tailwindui.com/components/application-ui/elements/buttons)

### 5. **Progress Bars with Gradients** (Application UI / Data Display / Progress Bars)
- **Location**: `ProgressBar.tsx`
- **Pattern**: Gradient progress indicators
- **Features**:
  - Dynamic color gradients based on value
  - Shadow effects (shadow-inner, shadow-sm)
  - Smooth transitions
- **Custom implementation inspired by Tailwind UI patterns

### 6. **Card Containers** (Application UI / Layout / Containers)
- **Location**: Throughout the application
- **Pattern**: White cards with shadows
- **Features**:
  - Rounded corners (rounded-lg)
  - Subtle shadows (shadow-sm)
  - Border styling
- **Reference**: [Container layouts](https://tailwindui.com/components/application-ui/layout/containers)

### 7. **Sticky Headers** (Application UI / Navigation / Navbars)
- **Location**: `Layout.tsx` - Top bar
- **Pattern**: Sticky navigation header
- **Features**:
  - Fixed positioning (sticky top-0)
  - Z-index layering
  - Clean white background with shadow
- **Reference**: [Navbar examples](https://tailwindui.com/components/application-ui/navigation/navbars)

## Design Principles Applied

1. **Modern Color Palette**
   - Dark mode sidebar (gray-900, gray-800)
   - Gradient accents for visual interest
   - Consistent use of primary color scale

2. **Depth and Hierarchy**
   - Strategic use of shadows (shadow-inner, shadow-sm, shadow)
   - Clear visual hierarchy with typography
   - Layered components with proper z-indexing

3. **Smooth Interactions**
   - Transition effects on all interactive elements
   - Hover states with color shifts
   - Smooth progress bar animations

4. **Responsive Design**
   - Mobile-first approach with sm:, md:, lg: breakpoints
   - Flexible grid layouts
   - Adaptive component sizing

## Color System
- **Primary**: Blue scale with custom primary-400, primary-500, primary-600, primary-700
- **Grays**: Full gray scale from gray-50 to gray-900
- **Accent Colors**: Green, yellow, red for status indicators
- **Gradients**: Used for buttons, progress bars, and avatar backgrounds

This design system creates a modern, professional look that's both visually appealing and highly functional.