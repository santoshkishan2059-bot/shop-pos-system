import { db } from "../firebase/firebase-config.js";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// Save or Edit Expense
async function saveExpense() {


  const title = document.getElementById("expenseTitle").value.trim();
  const category = document.getElementById("expenseCategory").value;
  const amount = Number(document.getElementById("expenseAmount").value);
  const paymentMethod = document.getElementById("expensePayment").value;

  if (!title || amount <= 0) return alert("Fill all fields properly!");

  const editId = document.getElementById("saveExpense").dataset.editId;

  if (editId) {
    // Update existing
    await updateDoc(doc(db, "expenses", editId), {
      title, category, amount, paymentMethod
    });
    delete document.getElementById("saveExpense").dataset.editId;
  } else {
    // Add new
    await addDoc(collection(db, "expenses"), {
      title, category, amount, paymentMethod, createdAt: serverTimestamp()
    });
  }
await updateDoc(doc(db, "banks", selectedBankId), {
  balance: increment(-amount)
});

  // Reset form
  document.getElementById("expenseTitle").value = "";
  document.getElementById("expenseAmount").value = "";
  document.getElementById("expensePayment").value = "Cash";

  await loadExpenseHistory();
}

// Load Expense Table
async function loadExpenseHistory() {
  const snapshot = await getDocs(collection(db, "expenses"));
  const tbody = document.getElementById("expenseBody");
  tbody.innerHTML = "";
  let total = 0;

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement("tr");

    const date = data.createdAt?.toDate
      ? data.createdAt.toDate().toLocaleDateString()
      : "Pending";

    tr.innerHTML = `
      <td>${date}</td>
      <td>${data.title}</td>
      <td>${data.category}</td>
      <td>Rs. ${data.amount}</td>
      <td>${data.paymentMethod}</td>
      <td>
        <button class="edit-btn" style="margin-right:4px; padding:2px 6px; border:none; border-radius:6px; background:#ffc107; cursor:pointer;">✏️</button>
        <button class="delete-btn" style="padding:2px 6px; border:none; border-radius:6px; background:#e63946; color:#fff; cursor:pointer;">🗑️</button>
      </td>
    `;

    // Delete
    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm("Delete this expense?")) {
        await deleteDoc(doc(db, "expenses", docSnap.id));
        await loadExpenseHistory();
      }
    });

    // Edit
    tr.querySelector(".edit-btn").addEventListener("click", () => {
      document.getElementById("expenseTitle").value = data.title;
      document.getElementById("expenseCategory").value = data.category;
      document.getElementById("expenseAmount").value = data.amount;
      document.getElementById("expensePayment").value = data.paymentMethod;
      document.getElementById("saveExpense").dataset.editId = docSnap.id;
    });

    tbody.appendChild(tr);
    total += Number(data.amount);
  });

  document.getElementById("totalExpenses").textContent = total;
}

// Print Table
document.getElementById("printExpenses").addEventListener("click", () => {
  const tableHTML = document.querySelector(".expense-history table").outerHTML;
  const newWindow = window.open("", "", "width=900,height=600");
  newWindow.document.write("<html><head><title>Expenses</title>");
  newWindow.document.write("<style>table{width:100%;border-collapse:collapse} th,td{padding:10px;border:1px solid #333;text-align:left}</style>");
  newWindow.document.write("</head><body>");
  newWindow.document.write("<h2>Expenses</h2>");
  newWindow.document.write(tableHTML);
  newWindow.document.write("</body></html>");
  newWindow.document.close();
  newWindow.print();
});

// Event listener
document.getElementById("saveExpense").addEventListener("click", saveExpense);

// Initialize
(async function init() {
  await loadExpenseHistory();
})();


// After saving expense:
const cashAccountRef = doc(db, "banks", "cash_in_hand");
const cashSnap = await getDoc(cashAccountRef);
await updateDoc(cashAccountRef, { balance: cashSnap.data().balance - amount });
