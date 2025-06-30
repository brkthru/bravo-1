import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function inspectRealData() {
  const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');

  try {
    await client.connect();
    const db = client.db('mediatool_v2');

    // Check teams collection
    console.log('=== TEAMS COLLECTION ===');
    const teams = await db.collection('teams').find({}).limit(5).toArray();
    console.log('Sample team:', JSON.stringify(teams[0], null, 2));

    // Check users with more detail
    console.log('\n=== USERS COLLECTION ===');
    const users = await db.collection('users').find({}).limit(5).toArray();
    console.log('Sample user fields:', Object.keys(users[0]));
    console.log('User example:', {
      name: `${users[0].firstName} ${users[0].lastName}`,
      role: users[0].role,
      teamId: users[0].teamId,
    });

    // Check if there's account-team mapping
    console.log('\n=== ACCOUNT-TEAM RELATIONSHIPS ===');
    const accountWithTeam = await db.collection('accounts').findOne({ teamId: { $exists: true } });
    if (accountWithTeam) {
      const team = await db.collection('teams').findOne({ _id: accountWithTeam.teamId });
      console.log('Account:', accountWithTeam.name);
      console.log('Team:', team?.name);
    }

    // Check strategy status values
    console.log('\n=== STRATEGY STATUS VALUES ===');
    const statusValues = await db.collection('strategies').distinct('status');
    console.log('Unique status values:', statusValues);

    // Check media activity calculation
    console.log('\n=== MEDIA ACTIVITY DATA ===');
    const mediaBuysWithStatus = await db
      .collection('mediaBuys')
      .aggregate([
        { $match: { status: { $exists: true } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $limit: 10 },
      ])
      .toArray();
    console.log('Media buy statuses:', mediaBuysWithStatus);

    // Check if line items have budget info
    console.log('\n=== LINE ITEM BUDGETS ===');
    const lineItemsWithBudget = await db
      .collection('lineItems')
      .find({
        $or: [
          { budget: { $exists: true } },
          { plannedBudget: { $exists: true } },
          { totalBudget: { $exists: true } },
        ],
      })
      .limit(5)
      .toArray();
    console.log('Line items with budget fields:', lineItemsWithBudget.length);

    // Check platform entities for budget/spend
    console.log('\n=== PLATFORM ENTITIES ===');
    const platformEntity = await db.collection('platformEntities').findOne({
      $or: [{ spend: { $exists: true } }, { budget: { $exists: true } }],
    });
    console.log('Platform entity with financial data:', platformEntity ? 'Found' : 'Not found');

    // Check if campaigns collection existed before migration
    console.log('\n=== ORIGINAL CAMPAIGNS? ===');
    const backupExists = await db.collection('campaigns_backup').findOne({});
    if (backupExists) {
      console.log('Backup campaign structure:', Object.keys(backupExists));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

inspectRealData();
