const express = require('express');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Local Database (In-Memory Simulation)
let userWallets = {
  "user_123": { balance: 1000 }
};

let withdrawalQueue = [];
let pendingDeposits = [];

// 1. Get User Balance
app.get('/api/balance/:userId', (req, res) => {
  const userId = req.params.userId || 'user_123';
  const balance = userWallets[userId] ? userWallets[userId].balance : 1000;
  res.json({ success: true, balance });
});

// 2. Manual Deposit Request (User UTR submit karta hai)
app.post('/api/request-deposit', (req, res) => {
  const { userId, amount, utrNumber } = req.body;

  if (!amount || !utrNumber) {
    return res.status(400).json({ success: false, message: "Amount and UTR are required!" });
  }

  const depositEntry = {
    id: `DEP_${Date.now()}`,
    userId: userId || 'user_123',
    amount: parseInt(amount),
    utrNumber,
    status: 'PENDING_APPROVAL',
    createdAt: new Date()
  };

  pendingDeposits.push(depositEntry);
  console.log("📥 New Deposit Request:", depositEntry);

  res.json({ 
    success: true, 
    message: "Deposit request submitted! Admin will verify UTR and update balance.", 
    data: depositEntry 
  });
});

// 3. Withdrawal Request (Queued in Processing Pool)
app.post('/api/withdraw', (req, res) => {
  const { userId, amount, upiId } = req.body;
  const uid = userId || 'user_123';

  if (!userWallets[uid]) {
    userWallets[uid] = { balance: 1000 };
  }

  if (userWallets[uid].balance < amount) {
    return res.status(400).json({ success: false, message: "Insufficient Balance!" });
  }

  // Balance locally deduct karke queue me daalo
  userWallets[uid].balance -= parseInt(amount);

  const queueEntry = {
    id: `WTH_${Date.now()}`,
    userId: uid,
    amount: parseInt(amount),
    upiId,
    status: 'PROCESSING',
    createdAt: new Date()
  };

  withdrawalQueue.push(queueEntry);
  console.log("📤 New Withdrawal Request:", queueEntry);

  res.json({ 
    success: true, 
    message: `Withdrawal of ₹${amount} queued! Status: PROCESSING (Waiting for Pool Funds)`,
    remainingBalance: userWallets[uid].balance,
    queueData: queueEntry
  });
});

// 4. Admin API: Get All Requests
app.get('/api/admin/pending-requests', (req, res) => {
  res.json({
    pendingDeposits,
    withdrawalQueue
  });
});

// 5. Admin API: Approve Deposit
app.post('/api/admin/approve-deposit', (req, res) => {
  const { depositId } = req.body;
  const index = pendingDeposits.findIndex(d => d.id === depositId);

  if (index !== -1) {
    const dep = pendingDeposits.splice(index, 1)[0];
    if (!userWallets[dep.userId]) userWallets[dep.userId] = { balance: 0 };
    userWallets[dep.userId].balance += dep.amount;
    return res.json({ success: true, message: "Deposit Approved! Balance credited.", newBalance: userWallets[dep.userId].balance });
  }

  res.status(404).json({ success: false, message: "Deposit request not found!" });
});

// 6. Admin API: Approve Withdrawal
app.post('/api/admin/approve-withdrawal', (req, res) => {
  const { withdrawalId } = req.body;
  const index = withdrawalQueue.findIndex(w => w.id === withdrawalId);

  if (index !== -1) {
    const approved = withdrawalQueue.splice(index, 1)[0];
    return res.json({ success: true, message: "Withdrawal Approved & Processed!", approved });
  }

  res.status(404).json({ success: false, message: "Withdrawal request not found!" });
});

const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
