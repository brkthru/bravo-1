import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function checkUsersAndAssignTeams() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('mediatool_v2');
    
    console.log('Checking users and team assignments...\n');
    
    // Get all users
    const users = await db.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users in the database\n`);
    
    if (users.length > 0) {
      console.log('Sample users:');
      users.slice(0, 10).forEach(user => {
        console.log(`- ${user.name} (${user.role}) - ID: ${user._id}`);
      });
      console.log('');
    }
    
    // Check if campaigns have proper team IDs
    const campaignsWithTeamIds = await db.collection('campaigns').find({
      $or: [
        { 'team.leadAccountManager.id': { $exists: true, $ne: null } },
        { 'team.mediaTrader.id': { $exists: true, $ne: null } }
      ]
    }).limit(5).toArray();
    
    console.log(`Campaigns with team IDs: ${campaignsWithTeamIds.length}`);
    
    if (users.length === 0) {
      console.log('\nNo users found! Creating sample users...');
      
      const sampleUsers = [
        { name: 'Sarah Johnson', role: 'account_director', email: 'sarah.johnson@company.com' },
        { name: 'Michael Chen', role: 'senior_account_manager', email: 'michael.chen@company.com' },
        { name: 'Jessica Martinez', role: 'account_manager', email: 'jessica.martinez@company.com' },
        { name: 'David Wilson', role: 'senior_media_trader', email: 'david.wilson@company.com' },
        { name: 'Emily Thompson', role: 'media_trader', email: 'emily.thompson@company.com' },
        { name: 'Robert Taylor', role: 'account_manager', email: 'robert.taylor@company.com' },
        { name: 'Maria Garcia', role: 'media_trader', email: 'maria.garcia@company.com' },
        { name: 'James Anderson', role: 'senior_account_manager', email: 'james.anderson@company.com' },
        { name: 'Lisa Brown', role: 'account_manager', email: 'lisa.brown@company.com' },
        { name: 'Christopher Lee', role: 'media_trader', email: 'christopher.lee@company.com' },
        { name: 'Amanda White', role: 'account_director', email: 'amanda.white@company.com' },
        { name: 'Daniel Harris', role: 'senior_media_trader', email: 'daniel.harris@company.com' },
      ];
      
      const result = await db.collection('users').insertMany(
        sampleUsers.map(user => ({
          ...user,
          employeeId: `EMP${Math.floor(1000 + Math.random() * 9000)}`,
          department: user.role.includes('media') ? 'Media Trading' : 'Account Management',
          isActive: true,
          avatar: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );
      
      console.log(`Created ${result.insertedCount} sample users`);
      
      // Refetch users
      const newUsers = await db.collection('users').find({}).toArray();
      users.push(...newUsers);
    }
    
    // Now assign random users to campaigns without proper team assignments
    const accountManagers = users.filter(u => 
      u.role?.includes('account') || u.role === 'account_manager' || u.role === 'senior_account_manager'
    );
    const mediaTraders = users.filter(u => 
      u.role?.includes('media') || u.role === 'media_trader' || u.role === 'senior_media_trader'
    );
    
    console.log(`\nFound ${accountManagers.length} account managers and ${mediaTraders.length} media traders`);
    
    if (accountManagers.length > 0) {
      // Update campaigns with random team assignments
      const campaigns = await db.collection('campaigns').find({}).limit(100).toArray();
      
      let updateCount = 0;
      const updates = [];
      
      for (const campaign of campaigns) {
        const randomAM = accountManagers[Math.floor(Math.random() * accountManagers.length)];
        const randomMT = mediaTraders.length > 0 
          ? mediaTraders[Math.floor(Math.random() * mediaTraders.length)]
          : null;
        
        const update = {
          updateOne: {
            filter: { _id: campaign._id },
            update: {
              $set: {
                'team.leadAccountManager': {
                  id: randomAM._id.toString(),
                  name: randomAM.name,
                  email: randomAM.email,
                  avatar: randomAM.avatar
                },
                ...(randomMT && Math.random() > 0.3 ? { // 70% chance of having a media trader
                  'team.mediaTrader': {
                    id: randomMT._id.toString(),
                    name: randomMT.name,
                    email: randomMT.email,
                    avatar: randomMT.avatar
                  }
                } : {})
              }
            }
          }
        };
        
        updates.push(update);
        updateCount++;
        
        if (updates.length >= 50) {
          await db.collection('campaigns').bulkWrite(updates);
          console.log(`Updated ${updateCount} campaigns with team assignments...`);
          updates.length = 0;
        }
      }
      
      if (updates.length > 0) {
        await db.collection('campaigns').bulkWrite(updates);
      }
      
      console.log(`\nTotal updated: ${updateCount} campaigns with team assignments`);
      
      // Show sample results
      const samplesWithTeams = await db.collection('campaigns').find({
        'team.leadAccountManager.name': { $exists: true }
      }).limit(5).toArray();
      
      console.log('\nSample campaigns with team assignments:');
      samplesWithTeams.forEach(c => {
        console.log(`- ${c.name}`);
        console.log(`  Account Manager: ${c.team.leadAccountManager.name}`);
        if (c.team.mediaTrader) {
          console.log(`  Media Trader: ${c.team.mediaTrader.name}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkUsersAndAssignTeams();