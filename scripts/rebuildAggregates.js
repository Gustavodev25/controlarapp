const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json'); // User must provide this

if (!serviceAccount) {
    console.error('Please provide service-account.json in the scripts folder.');
    process.exit(1);
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function rebuildAggregates(userId) {
    console.log(`Starting aggregate rebuild for user: ${userId}`);

    // 1. Clear existing aggregates
    const analyticsRef = db.collection('users').doc(userId).collection('analytics_monthly');
    const existing = await analyticsRef.get();
    const batchDelete = db.batch();
    existing.docs.forEach(doc => batchDelete.delete(doc.ref));
    await batchDelete.commit();
    console.log(`Cleared ${existing.size} existing aggregate records.`);

    const aggregates = {}; // Map<monthKey, Summary>

    // 2. Process Checking Account Transactions
    const txRef = db.collection('users').doc(userId).collection('transactions');
    const txSnap = await txRef.get();
    console.log(`Processing ${txSnap.size} checking transactions...`);

    txSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.date) return;
        const monthKey = data.date.substring(0, 7);

        if (!aggregates[monthKey]) initAggregate(aggregates, monthKey);

        const amount = Number(data.amount || 0);
        if (data.type === 'expense') {
            aggregates[monthKey].checkingExpense += amount;
            aggregates[monthKey].categoryTotals[data.category || 'Outros'] =
                (aggregates[monthKey].categoryTotals[data.category || 'Outros'] || 0) + amount;
        } else if (data.type === 'income') {
            aggregates[monthKey].checkingIncome += amount;
        }
        aggregates[monthKey].checkingCount++;
    });

    // 3. Process Credit Card Transactions
    const ccRef = db.collection('users').doc(userId).collection('creditCardTransactions');
    const ccSnap = await ccRef.get();
    console.log(`Processing ${ccSnap.size} credit card transactions...`);

    ccSnap.docs.forEach(doc => {
        const data = doc.data();
        if (!data.date) return;
        // Use invoiceMonthKey if available, otherwise date
        // Note: In firebase.ts we aggregated by DATE for "spending".
        // Let's stick to DATE to match the logic we implemented in firebase.ts
        const monthKey = data.date.substring(0, 7);

        if (!aggregates[monthKey]) initAggregate(aggregates, monthKey);

        const amount = Number(data.amount || 0);
        // Assumption: Credit card tx are expenses
        aggregates[monthKey].creditTotal += amount;
        aggregates[monthKey].creditCount++;

        const cardId = data.cardId || 'unknown';
        if (!aggregates[monthKey].creditByCard[cardId]) {
            aggregates[monthKey].creditByCard[cardId] = { total: 0, count: 0 };
        }
        aggregates[monthKey].creditByCard[cardId].total += amount;
        aggregates[monthKey].creditByCard[cardId].count++;

        aggregates[monthKey].categoryTotals[data.category || 'Outros'] =
            (aggregates[monthKey].categoryTotals[data.category || 'Outros'] || 0) + amount;
    });

    // 4. Write Aggregates
    const batchWrite = db.batch();
    let count = 0;

    for (const [key, data] of Object.entries(aggregates)) {
        const ref = analyticsRef.doc(key);
        batchWrite.set(ref, {
            ...data,
            updatedAt: new Date().toISOString(),
            schemaVersion: 1
        });
        count++;
    }

    await batchWrite.commit();
    console.log(`Successfully wrote ${count} monthly aggregate records.`);
}

function initAggregate(aggs, key) {
    aggs[key] = {
        monthKey: key,
        checkingIncome: 0,
        checkingExpense: 0,
        checkingCount: 0,
        creditTotal: 0,
        creditCount: 0,
        creditByCard: {},
        categoryTotals: {}
    };
}

// Check for user ID argument
const targetUserId = process.argv[2];
if (!targetUserId) {
    console.error('Usage: node rebuildAggregates.js <userId>');
    process.exit(1);
}

rebuildAggregates(targetUserId)
    .then(() => {
        console.log('Done.');
        process.exit(0);
    })
    .catch(err => {
        console.error('Error:', err);
        process.exit(1);
    });
