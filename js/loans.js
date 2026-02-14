import { db } from "../firebase/firebase-config.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let loansData = [];

// -------------------------------
// Save or Update Loan
// -------------------------------
async function saveLoan() {
  const name = document.getElementById("loanName").value.trim();
  const contact = document.getElementById("loanContact").value.trim();
  const totalAmount = Number(document.getElementById("loanAmount").value);
  const monthlyPayment = Number(document.getElementById("monthlyPayment").value);
  const dueDate = document.getElementById("dueDate").value;
  const notes = document.getElementById("loanNotes").value.trim();

  if (!name || !totalAmount || !monthlyPayment || !dueDate) return alert("Fill all required fields");

  const editId = document.getElementById("saveLoan").dataset.editId;
  let remainingAmount = totalAmount;

  if (editId) {
    const loanRef = doc(db, "loans", editId);
    const loanSnap = loansData.find(l => l.id === editId);
    remainingAmount = loanSnap ? loanSnap.remainingAmount : totalAmount;

    await updateDoc(loanRef, { name, contact, totalAmount, monthlyPayment, dueDate, notes, remainingAmount });
    delete document.getElementById("saveLoan").dataset.editId;
  } else {
    await addDoc(collection(db, "loans"), {
      name, contact, totalAmount, remainingAmount, monthlyPayment, dueDate, notes,
      createdAt: serverTimestamp()
    });
  }

  alert("Loan saved successfully");

  // Reset form
  document.getElementById("loanName").value = "";
  document.getElementById("loanContact").value = "";
  document.getElementById("loanAmount").value = "";
  document.getElementById("monthlyPayment").value = "";
  document.getElementById("dueDate").value = "";
  document.getElementById("loanNotes").value = "";

  await loadLoans();
}

// -------------------------------
// Record a Payment
// -------------------------------
async function payLoan(loanId) {
  const loan = loansData.find(l => l.id === loanId);
  if (!loan) return;

  const payment = Number(prompt(`Enter payment amount (Remaining: Rs.${loan.remainingAmount})`));
  if (!payment || payment <= 0) return alert("Invalid amount");
  if (payment > loan.remainingAmount) return alert("Payment exceeds remaining loan");

  const loanRef = doc(db, "loans", loanId);
  const newRemaining = loan.remainingAmount - payment;

  await updateDoc(loanRef, { remainingAmount: newRemaining });

  await addDoc(collection(db, "loanPayments"), { loanId, amount: payment, timestamp: serverTimestamp() });

  alert("Payment recorded successfully");
  await loadLoans();
}

// -------------------------------
// Load Loans into Table with Reminders
// -------------------------------
async function loadLoans() {
  const tbody = document.getElementById("loanBody");
  tbody.innerHTML = "";
  loansData = [];

  const snapshot = await getDocs(collection(db, "loans"));
  if (snapshot.empty) {
    tbody.innerHTML = `<tr><td colspan="8">No loans found</td></tr>`;
    return;
  }

  const today = new Date();
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    data.id = docSnap.id;
    loansData.push(data);

    const tr = document.createElement("tr");
    const dateAdded = data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : "-";

    // Highlight row if overdue or due today
    const due = new Date(data.dueDate);
    let rowStyle = "";
    if (data.remainingAmount > 0) {
      if (due.toDateString() === today.toDateString()) rowStyle = "background:#ffeeba"; // due today
      else if (due < today) rowStyle = "background:#f8d7da"; // overdue
    }

    tr.innerHTML = `
      <td>${dateAdded}</td>
      <td>${data.name}</td>
      <td>${data.contact || "-"}</td>
      <td>Rs. ${data.totalAmount}</td>
      <td>Rs. ${data.remainingAmount}</td>
      <td>Rs. ${data.monthlyPayment}</td>
      <td>${data.dueDate}</td>
      <td>
        <button class="pay-btn" style="margin-right:4px; padding:2px 6px; border:none; border-radius:6px; background:#1fa64a; color:#fff; cursor:pointer;">💵 Pay</button>
        <button class="edit-btn" style="margin-right:4px; padding:2px 6px; border:none; border-radius:6px; background:#ffc107; cursor:pointer;">✏️</button>
        <button class="delete-btn" style="padding:2px 6px; border:none; border-radius:6px; background:#e63946; color:#fff; cursor:pointer;">🗑️</button>
      </td>
    `;

    if (rowStyle) tr.style = rowStyle;

    tr.querySelector(".pay-btn").addEventListener("click", () => payLoan(docSnap.id));
    tr.querySelector(".edit-btn").addEventListener("click", () => {
      document.getElementById("loanName").value = data.name;
      document.getElementById("loanContact").value = data.contact || "";
      document.getElementById("loanAmount").value = data.totalAmount;
      document.getElementById("monthlyPayment").value = data.monthlyPayment;
      document.getElementById("dueDate").value = data.dueDate;
      document.getElementById("loanNotes").value = data.notes || "";
      document.getElementById("saveLoan").dataset.editId = docSnap.id;
    });
    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm("Delete this loan?")) {
        await deleteDoc(doc(db, "loans", docSnap.id));
        await loadLoans();
      }
    });

    tbody.appendChild(tr);
  });
}

// -------------------------------
// Print Table
// -------------------------------
document.getElementById("printLoans").addEventListener("click", () => {
  const tableHTML = document.querySelector(".loan-history table").outerHTML;
  const newWindow = window.open("", "", "width=900,height=600");
  newWindow.document.write("<html><head><title>Loans</title>");
  newWindow.document.write("<style>table{width:100%;border-collapse:collapse} th,td{padding:10px;border:1px solid #333;text-align:left}</style>");
  newWindow.document.write("</head><body>");
  newWindow.document.write("<h2>Loan Records</h2>");
  newWindow.document.write(tableHTML);
  newWindow.document.write("</body></html>");
  newWindow.document.close();
  newWindow.print();
});

// -------------------------------
// Event Listener
// -------------------------------
document.getElementById("saveLoan").addEventListener("click", saveLoan);

// -------------------------------
// Initialize
// -------------------------------
(async function init() {
  await loadLoans();
})();
