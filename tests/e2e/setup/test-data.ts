/**
 * E2E Test Data Configuration
 * 
 * Uses a specific timestamped export to ensure consistent test results
 */

export const TEST_DATA_CONFIG = {
  // Timestamp of the data export to use for tests
  dataTimestamp: '20250622-072326',
  
  // Path to the test data
  dataPath: 'exports/raw/20250622-072326',
  
  // Expected data counts
  expectedCounts: {
    totalCampaigns: 13417,
    totalLineItems: 3343,
    totalStrategies: 13417,
  },
  
  // Sample campaign data from the export
  sampleCampaigns: {
    first: {
      name: 'Aces Automotive Repair - Phoenix location 1',
      campaignNumber: 'CN-13999',
      accountName: 'Maricopa County Election',
    },
    searchResults: {
      // When searching for "Virginia"
      virginia: [
        'Foodbank of Southeastern Virginia',
        'Donate Life Virginia 2025 - 2026',
        'Virginia Aquarium - TEST Campaign',
        'Sail 250 Virginia - Traditional Media'
      ],
      // When searching for "Hotel"
      hotel: [
        "Harrah's Ak-Chin Hotel & Casino 2026",
        'Grand Park Hotel - Branson - Evergreen',
        'Grand Park Hotel - Branson - Brand',
      ]
    }
  }
};

/**
 * Helper to get a known campaign by index from the test data
 */
export function getKnownCampaign(index: number) {
  // These are the first few campaigns in the test data
  const knownCampaigns = [
    { name: 'Aces Automotive Repair - Phoenix location 1', number: 'CN-13999' },
    { name: 'Good Things Store', number: 'CN-13959' },
    { name: 'Chartway - Share Certificates', number: 'CN-13958' },
    { name: "Harrah's Ak-Chin Hotel & Casino 2026", number: 'CN-13957' },
    { name: 'FreshCut Lawn & Landscape', number: 'CN-13956' },
  ];
  
  return knownCampaigns[index] || knownCampaigns[0];
}