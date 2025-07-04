# Demo Data Tracking

This document tracks where demo/mocked data is used throughout the Media Tool application.

## Generated/Calculated Data

### Campaign Pacing Values

- **Location**: `/backend/src/models/Campaign.ts` - `transformFromMongo()` method
- **Description**: Generates realistic delivery and spend pacing values based on campaign ID hash
- **Logic**:
  - 20% of campaigns show over-pacing (100-150%)
  - 80% show normal pacing (40-95%)
  - Spend pacing is usually lower than delivery pacing

### Current User Selection

- **Location**: `/frontend/src/contexts/UserContext.tsx`
- **Description**: Randomly selects an account manager from the database as the "current user"
- **Note**: In production, this would come from authentication

## Database-Populated Data

### Users

- **Location**: Database collection: `users`
- **Populated by**: `update-users-and-assign-teams.ts` script
- **Data**: 326 real users with randomly assigned roles

### Campaign Teams

- **Location**: Database collection: `campaigns` - `team` field
- **Populated by**: `update-users-and-assign-teams.ts` script
- **Data**: Each campaign has randomly assigned account managers and media traders from the users collection

## Static/Hardcoded Data

### Avatar Styles List

- **Location**: `/frontend/src/pages/Settings.tsx`
- **Data**: List of 30 DiceBear avatar styles

### Role Options

- **Location**: `/frontend/src/pages/Settings.tsx`
- **Data**: Static list of available roles for selection

### Navigation Structure

- **Location**: `/frontend/src/components/Layout.tsx`
- **Data**: Static navigation menu structure

### Calendar Events (My Schedule)

- **Location**: `/frontend/src/pages/MySchedule.tsx`
- **Data**: Mock events array with sample meetings and reviews
- **Note**: In production, these would come from a calendar integration

## Placeholder Pages

- **Location**: `/frontend/src/App.tsx`
- **Pages with placeholder content**:
  - Accounts
  - Line Items
  - Media Plans
  - Platform Buys
  - Reports
  - Invoices
  - Users

## External APIs

### DiceBear Avatars

- **URL Pattern**: `https://api.dicebear.com/9.x/{style}/svg?seed={name}`
- **Used in**:
  - `/frontend/src/components/Layout.tsx`
  - `/frontend/src/pages/CampaignList.tsx`
  - `/frontend/src/pages/Settings.tsx`
- **Note**: Generates avatars dynamically based on user names

## Future Production Replacements

1. **User Authentication**: Replace random user selection with actual authentication
2. **Pacing Data**: Replace calculated values with actual metrics from ad platforms
3. **Team Assignments**: Replace random assignments with actual organizational structure
4. **Placeholder Pages**: Implement full functionality for all placeholder pages
