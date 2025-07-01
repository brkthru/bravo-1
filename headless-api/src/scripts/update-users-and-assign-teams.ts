import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function updateUsersAndAssignTeams() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    console.log('Updating users with roles and assigning to campaigns...\n');

    // Get all users without roles
    const usersWithoutRoles = await db
      .collection('users')
      .find({
        $or: [{ role: { $exists: false } }, { role: null }, { role: 'undefined' }],
      })
      .toArray();

    console.log(`Found ${usersWithoutRoles.length} users without roles`);

    // Define role distribution
    const roles = [
      'account_director',
      'senior_account_manager',
      'account_manager',
      'senior_media_trader',
      'media_trader',
    ];

    // Update users with random roles
    const bulkOps: any[] = [];
    usersWithoutRoles.forEach((user, index) => {
      const role = roles[index % roles.length];
      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: {
            $set: {
              role: role,
              department: role.includes('media') ? 'Media Trading' : 'Account Management',
              updatedAt: new Date(),
            },
          },
        },
      });
    });

    if (bulkOps.length > 0) {
      const result = await db.collection('users').bulkWrite(bulkOps);
      console.log(`Updated ${result.modifiedCount} users with roles\n`);
    }

    // Now get users with proper roles
    const accountManagers = await db
      .collection('users')
      .find({
        role: { $in: ['account_director', 'senior_account_manager', 'account_manager'] },
      })
      .toArray();

    const mediaTraders = await db
      .collection('users')
      .find({
        role: { $in: ['senior_media_trader', 'media_trader'] },
      })
      .toArray();

    console.log(
      `Found ${accountManagers.length} account managers and ${mediaTraders.length} media traders`
    );

    // Update campaigns with real team members
    const campaigns = await db.collection('campaigns').find({}).toArray();
    console.log(`\nUpdating ${campaigns.length} campaigns with team assignments...`);

    const campaignUpdates: any[] = [];
    campaigns.forEach((campaign) => {
      const randomAM = accountManagers[Math.floor(Math.random() * accountManagers.length)];
      const randomMT =
        mediaTraders.length > 0
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
                avatar: null,
              },
              ...(randomMT && Math.random() > 0.3
                ? {
                    // 70% chance of having a media trader
                    'team.mediaTrader': {
                      id: randomMT._id.toString(),
                      name: randomMT.name,
                      email: randomMT.email,
                      avatar: null,
                    },
                  }
                : {}),
            },
          },
        },
      };

      campaignUpdates.push(update);
    });

    // Execute updates in batches
    for (let i = 0; i < campaignUpdates.length; i += 100) {
      const batch = campaignUpdates.slice(i, i + 100);
      await db.collection('campaigns').bulkWrite(batch);
      console.log(
        `Updated ${Math.min(i + 100, campaignUpdates.length)}/${campaignUpdates.length} campaigns...`
      );
    }

    // Show sample results
    const samplesWithTeams = await db
      .collection('campaigns')
      .find({
        'team.leadAccountManager.name': { $exists: true },
      })
      .limit(5)
      .toArray();

    console.log('\nSample campaigns with team assignments:');
    samplesWithTeams.forEach((c) => {
      console.log(`\n- ${c.name}`);
      console.log(
        `  Account Manager: ${c.team.leadAccountManager.name} (${c.team.leadAccountManager.email})`
      );
      if (c.team.mediaTrader) {
        console.log(`  Media Trader: ${c.team.mediaTrader.name} (${c.team.mediaTrader.email})`);
      }
    });

    console.log('\nDone! All campaigns now have real team members assigned.');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

updateUsersAndAssignTeams();
