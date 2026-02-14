import { db } from "../firebase/firebase-config.js";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// -------------------------------
// Load accounts into table and calculate totals
// -------------------------------
async function loadAccounts() {
  const snapshot = await getDocs(collection(db, "banks"));
  const tbody = document.getElementById("bankBody");
  tbody.innerHTML = "";

  let totalCash = 0, totalWallet = 0, totalBank = 0;

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${data.name}</td>
      <td>${data.type}</td>
      <td>Rs.${data.balance}</td>
    `;
    tbody.appendChild(tr);

    if (data.type === "cash") totalCash += data.balance;
    else if (data.type === "wallet") totalWallet += data.balance;
    else if (data.type === "bank") totalBank += data.balance;
  });

  // Update totals dynamically
  document.getElementById("totalCash").textContent = totalCash;
  document.getElementById("totalWallet").textContent = totalWallet;
  document.getElementById("totalCapital").textContent = totalCash + totalWallet + totalBank;
}

// -------------------------------
// Deposit money into an account
// -------------------------------
async function depositMoney(accountId, amount) {
  if (!accountId || amount <= 0) return alert("Select account and enter valid amount");

  const accountRef = doc(db, "banks", accountId);
  const accountSnap = await getDoc(accountRef);
  const accountData = accountSnap.data();

  await updateDoc(accountRef, { balance: accountData.balance + amount });
  await addDoc(collection(db, "bankTransactions"), {
    accountId,
    type: "deposit",
    amount,
    timestamp: serverTimestamp()
  });

  await loadAccounts();
}

// -------------------------------
// Withdraw money from wallet/bank (not cash in hand)
// -------------------------------
async function withdrawMoney(accountId, amount) {
  if (!accountId || amount <= 0) return alert("Select account and enter valid amount");

  const accountRef = doc(db, "banks", accountId);
  const accountSnap = await getDoc(accountRef);
  const accountData = accountSnap.data();

  if (accountData.type === "cash") return alert("Cannot withdraw from cash in hand");
  if (amount > accountData.balance) return alert("Insufficient funds");

  await updateDoc(accountRef, { balance: accountData.balance - amount });
  await addDoc(collection(db, "bankTransactions"), {
    accountId,
    type: "withdraw",
    amount,
    timestamp: serverTimestamp()
  });

  await loadAccounts();
}

// -------------------------------
// Add new bank/wallet
// -------------------------------
async function addNewAccount(name, type, balance) {
  if (!name || !type || isNaN(balance)) return alert("Invalid input");

  const id = name.toLowerCase().replace(/\s+/g,"_");
  await setDoc(doc(db,"banks",id),{ name, type, balance });
  await loadAccounts();
}

// -------------------------------
// Button event listeners
// -------------------------------
document.getElementById("depositBtn")?.addEventListener("click", () => {
  const accountId = document.getElementById("bankSelect").value;
  const amount = Number(document.getElementById("depositAmount").value);
  depositMoney(accountId, amount);
});

document.getElementById("withdrawBtn")?.addEventListener("click", () => {
  const accountId = document.getElementById("bankSelect").value;
  const amount = Number(document.getElementById("withdrawAmount").value);
  withdrawMoney(accountId, amount);
});

document.getElementById("addAccountBtn")?.addEventListener("click", async () => {
  const name = prompt("Enter account name:");
  const type = prompt("Enter type (cash/bank/wallet):").toLowerCase();
  const balance = Number(prompt("Enter initial balance:"));
  await addNewAccount(name, type, balance);
});

// -------------------------------
// Initialize page
// -------------------------------
await loadAccounts();
