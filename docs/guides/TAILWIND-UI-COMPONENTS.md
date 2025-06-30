# UI Component Architecture in Bravo

This document describes the UI component architecture used in the Bravo application, combining HeadlessUI for behavior and Tailwind CSS for styling.

## Component Architecture Pattern

### HeadlessUI + Tailwind CSS

We use [HeadlessUI](https://headlessui.com/) for component behavior and accessibility, combined with [Tailwind CSS](https://tailwindcss.com/) for visual styling. This approach provides:

- **HeadlessUI**: Unstyled, fully accessible UI components
- **Tailwind CSS**: Utility-first CSS framework for styling

### Benefits

1. **Accessibility First**: All components are WCAG compliant out of the box
2. **Full Control**: Complete visual customization with Tailwind
3. **Consistent Behavior**: Battle-tested interaction patterns
4. **Type Safety**: Full TypeScript support

## HeadlessUI Components

### Dialog (Modal)

- **Location**: `components/ui/headless/Dialog.tsx`
- **Usage**: Confirmation dialogs, forms, alerts
- **Features**:
  - Backdrop blur and fade animations
  - Focus management and keyboard navigation
  - Compound components (Dialog.Actions, Dialog.Button)
  - Multiple size options (sm, md, lg, xl, full)

### Switch

- **Location**: `components/ui/headless/Switch.tsx`
- **Usage**: Boolean toggles, settings, preferences
- **Features**:
  - Accessible toggle with label support
  - Multiple sizes (sm, md, lg)
  - Disabled state support
  - Smooth transitions

### Menu (Dropdown)

- **Location**: `components/ui/headless/Menu.tsx`
- **Usage**: Action menus, context menus, dropdowns
- **Features**:
  - Keyboard navigation (arrow keys, enter, escape)
  - Transition animations
  - Icon support
  - Menu.Item and Menu.Divider components

### Combobox (Searchable Select)

- **Location**: `components/ui/headless/Combobox.tsx`
- **Usage**: Campaign/user selection, searchable lists
- **Features**:
  - Real-time search filtering
  - Custom filter functions
  - Keyboard navigation
  - Loading and empty states

### RadioGroup

- **Location**: Used in `ThemeToggle.tsx`
- **Usage**: Theme selection, mutually exclusive options
- **Features**:
  - Accessible radio button group
  - Custom styling per option
  - Keyboard navigation

### Disclosure (Collapsible)

- **Location**: `components/ui/headless/Disclosure.tsx`
- **Usage**: Collapsible sections, FAQs, expandable content
- **Features**:
  - Smooth expand/collapse animations
  - Chevron rotation indicator
  - Default open state option

## Tailwind UI Patterns

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
- \*\*Custom implementation inspired by Tailwind UI patterns

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

## Implementation Examples

### Dialog Example

```tsx
import { Dialog } from '../components/ui/headless';

function DeleteConfirmation({ isOpen, onClose, onConfirm }) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Campaign"
      description="This action cannot be undone."
      size="sm"
    >
      <p className="text-sm text-gray-500">
        Are you sure you want to delete this campaign? All associated data will be permanently
        removed.
      </p>
      <Dialog.Actions>
        <Dialog.Button variant="secondary" onClick={onClose}>
          Cancel
        </Dialog.Button>
        <Dialog.Button variant="danger" onClick={onConfirm}>
          Delete
        </Dialog.Button>
      </Dialog.Actions>
    </Dialog>
  );
}
```

### Menu Example

```tsx
import { Menu } from '../components/ui/headless';
import { PencilIcon, TrashIcon, DuplicateIcon } from '@heroicons/react/24/outline';

function CampaignActions({ campaign }) {
  return (
    <Menu label="Actions" align="right">
      <Menu.Item icon={PencilIcon} onClick={() => editCampaign(campaign)}>
        Edit Campaign
      </Menu.Item>
      <Menu.Item icon={DuplicateIcon} onClick={() => duplicateCampaign(campaign)}>
        Duplicate
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item icon={TrashIcon} onClick={() => deleteCampaign(campaign)}>
        Delete Campaign
      </Menu.Item>
    </Menu>
  );
}
```

### Combobox Example

```tsx
import { Combobox } from '../components/ui/headless';

function CampaignSelector({ campaigns, selected, onSelect }) {
  return (
    <Combobox
      value={selected}
      onChange={onSelect}
      options={campaigns}
      label="Select Campaign"
      placeholder="Search campaigns..."
      displayValue={(campaign) => campaign?.name || ''}
    />
  );
}
```

## Best Practices

1. **Always use HeadlessUI for interactive components** - This ensures accessibility
2. **Style with Tailwind utilities** - Maintain consistency across the app
3. **Use compound components** - Like Dialog.Actions for better organization
4. **Implement proper focus management** - HeadlessUI handles this automatically
5. **Add transitions** - Use Tailwind's transition utilities for smooth animations
