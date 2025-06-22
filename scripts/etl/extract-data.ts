import { MongoClient } from 'mongodb';
import fs from 'fs/promises';
import path from 'path';

const MONGODB_URI = 'mongodb://localhost:27017';
const DATABASE_NAME = 'mediatool_v2';
const OUTPUT_DIR = './data-export';

async function extractData() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');
    
    const db = client.db(DATABASE_NAME);
    
    // Create output directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    
    // Collections to extract
    const collections = [
      'campaigns_backup',      // Main backup with 13,417 campaigns
      'lineItems',            // 3,343 line items
      'strategies',           // 13,417 strategies
      'mediaBuys',           // 56,020 media buys
      'platformEntities',     // 142,333 platform entities
      'accounts',            // Account data
      'teams',               // Team data
      'users',               // User data (currently empty)
      'channels',            // Channel definitions
      'tactics',             // Tactic definitions
      'mediaPlatforms',      // Media platform definitions
      'rateCards',           // Rate card data
      'dashboardConfigs',    // Dashboard configurations
      'metricDefinitions',   // Metric definitions
      'platformMetrics'      // Platform metrics data
    ];
    
    const extractionSummary = {};
    
    for (const collectionName of collections) {
      console.log(`\nExtracting ${collectionName}...`);
      
      try {
        const collection = db.collection(collectionName);
        const count = await collection.countDocuments();
        
        console.log(`  Found ${count} documents`);
        
        if (count > 0) {
          // For large collections, extract in batches
          const batchSize = 10000;
          const documents = [];
          
          if (count > batchSize) {
            console.log(`  Extracting in batches of ${batchSize}...`);
            let processed = 0;
            
            const cursor = collection.find({});
            
            while (await cursor.hasNext()) {
              const doc = await cursor.next();
              documents.push(doc);
              processed++;
              
              if (processed % batchSize === 0) {
                console.log(`    Processed ${processed}/${count} documents`);
              }
            }
          } else {
            // Small collection, get all at once
            const allDocs = await collection.find({}).toArray();
            documents.push(...allDocs);
          }
          
          // Save to file
          const filename = `${collectionName}.json`;
          const filepath = path.join(OUTPUT_DIR, filename);
          
          await fs.writeFile(
            filepath,
            JSON.stringify(documents, null, 2),
            'utf-8'
          );
          
          console.log(`  Saved to ${filepath}`);
          
          extractionSummary[collectionName] = {
            count,
            filename,
            size: (await fs.stat(filepath)).size
          };
        } else {
          extractionSummary[collectionName] = {
            count: 0,
            filename: null,
            size: 0
          };
        }
      } catch (error) {
        console.error(`  Error extracting ${collectionName}:`, error.message);
        extractionSummary[collectionName] = {
          error: error.message
        };
      }
    }
    
    // Save extraction summary
    const summaryPath = path.join(OUTPUT_DIR, 'extraction-summary.json');
    await fs.writeFile(
      summaryPath,
      JSON.stringify({
        extractedAt: new Date().toISOString(),
        database: DATABASE_NAME,
        collections: extractionSummary
      }, null, 2),
      'utf-8'
    );
    
    console.log('\n=== Extraction Summary ===');
    console.log(`Data extracted to: ${path.resolve(OUTPUT_DIR)}`);
    console.log(`Summary saved to: ${summaryPath}`);
    
    // Display summary
    Object.entries(extractionSummary).forEach(([collection, info]) => {
      if (info.error) {
        console.log(`${collection}: ERROR - ${info.error}`);
      } else if (info.count > 0) {
        const sizeMB = (info.size / 1024 / 1024).toFixed(2);
        console.log(`${collection}: ${info.count} documents (${sizeMB} MB)`);
      } else {
        console.log(`${collection}: Empty`);
      }
    });
    
    console.log('\nExtraction complete!');
    
  } catch (error) {
    console.error('Extraction failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

// Run the extraction
extractData();