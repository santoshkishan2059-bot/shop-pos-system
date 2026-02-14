import { db } from "../firebase/firebase-config.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, increment, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

let inventoryData = [];

// -----------------------------
// Load products
// -----------------------------
async function loadProducts() {
  const snapshot = await getDocs(collection(db, "inventory"));
  const select = document.getElementById("productSelect");
  select.innerHTML = "";
  inventoryData = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    data.id = docSnap.id;

    if (data.type === "product") {
      inventoryData.push(data);
      const option = document.createElement("option");
      option.value = data.id;
      option.textContent = `${data.name} | Stock: ${data.stock}`;
      select.appendChild(option);
    }
  });
}

// -----------------------------
// Save or Edit Purchase
// -----------------------------
async function savePurchase() {
  const productId = document.getElementById("productSelect").value;
  const quantity = Number(document.getElementById("quantity").value);
  const costPrice = Number(document.getElementById("costPrice").value);
  const sellingPrice = Number(document.getElementById("sellingPrice").value);
  const supplier = document.getElementById("supplier").value;
  const paymentMethod = document.getElementById("paymentMethod").value;

  if (!productId || quantity <= 0) return alert("Fill required fields");

  const product = inventoryData.find(p => p.id === productId);
  const newStock = product.stock + quantity;
  const totalCost = quantity * costPrice;

  const editId = document.getElementById("savePurchase").dataset.editId;
  let previousPayment = null;
  let previousTotalCost = 0;

  // If editing, get previous purchase data
  if (editId) {
    const prevDoc = await getDoc(doc(db, "purchases", editId));
    if (prevDoc.exists()) {
      previousPayment = prevDoc.data().paymentMethod;
      previousTotalCost = prevDoc.data().totalCost || 0;

      // Refund previous payment to Cash/eSewa
      const prevAccountRef = doc(db, "banks", previousPayment === "Cash" ? "cash_in_hand" : "esewa_wallet");
      await updateDoc(prevAccountRef, { balance: increment(previousTotalCost) });
    }
  }

  // -----------------------------
  // Update inventory stock
  // -----------------------------
  await updateDoc(doc(db, "inventory", productId), {
    stock: newStock,
    price: sellingPrice || product.price
  });

  if (editId) {
    // Update existing purchase
    await updateDoc(doc(db, "purchases", editId), {
      productId,
      productName: product.name,
      quantity,
      costPrice,
      totalCost,
      supplier,
      paymentMethod
    });
    delete document.getElementById("savePurchase").dataset.editId;
  } else {
    // Add new purchase
    await addDoc(collection(db, "purchases"), {
      productId,
      productName: product.name,
      quantity,
      costPrice,
      totalCost,
      supplier,
      paymentMethod,
      createdAt: serverTimestamp()
    });
  }

  // -----------------------------
  // Deduct from Cash / eSewa in real-time
  // -----------------------------
  const accountRef = doc(db, "banks", paymentMethod === "Cash" ? "cash_in_hand" : "esewa_wallet");
  const accountSnap = await getDoc(accountRef);
  const accountData = accountSnap.exists() ? accountSnap.data() : { balance: 0 };

  if (totalCost > accountData.balance) return alert("Insufficient balance in " + paymentMethod);
  await updateDoc(accountRef, { balance: increment(-totalCost) });

  alert("Purchase saved successfully");

  // Reset form
  document.getElementById("quantity").value = 1;
  document.getElementById("costPrice").value = "";
  document.getElementById("sellingPrice").value = "";
  document.getElementById("supplier").value = "";
  document.getElementById("paymentMethod").value = "Cash";

  await loadProducts();
  await loadPurchaseHistory();
}

// -----------------------------
// Load Purchase Table
// -----------------------------
async function loadPurchaseHistory() {
  const tbody = document.getElementById("purchaseBody");
  tbody.innerHTML = "";

  const snapshot = await getDocs(collection(db, "purchases"));

  if (snapshot.empty) {
    tbody.innerHTML = `<tr><td colspan="8">No purchase records found</td></tr>`;
    return;
  }

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    let date = "Pending";
    if (data.createdAt && data.createdAt.toDate) date = data.createdAt.toDate().toLocaleString();

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${date}</td>
      <td>${data.productName || "-"}</td>
      <td>${data.quantity || 0}</td>
      <td>Rs. ${data.costPrice || 0}</td>
      <td>Rs. ${data.totalCost || 0}</td>
      <td>${data.supplier || "-"}</td>
      <td>${data.paymentMethod || "-"}</td>
      <td>
        <button class="edit-btn" style="margin-right:4px; padding:2px 6px; border:none; border-radius:6px; background:#ffc107; cursor:pointer;">✏️</button>
        <button class="delete-btn" style="padding:2px 6px; border:none; border-radius:6px; background:#e63946; color:#fff; cursor:pointer;">🗑️</button>
      </td>
    `;

    // Edit
    tr.querySelector(".edit-btn").addEventListener("click", () => {
      document.getElementById("productSelect").value = data.productId;
      document.getElementById("quantity").value = data.quantity;
      document.getElementById("costPrice").value = data.costPrice;
      document.getElementById("sellingPrice").value = data.totalCost / data.quantity;
      document.getElementById("supplier").value = data.supplier;
      document.getElementById("paymentMethod").value = data.paymentMethod;
      document.getElementById("savePurchase").dataset.editId = docSnap.id;
    });

    // Delete
    tr.querySelector(".delete-btn").addEventListener("click", async () => {
      if (confirm("Delete this purchase?")) {
        // Refund Cash/eSewa before deleting
        const accountRef = doc(db, "banks", data.paymentMethod === "Cash" ? "cash_in_hand" : "esewa_wallet");
        await updateDoc(accountRef, { balance: increment(data.totalCost) });

        await deleteDoc(doc(db, "purchases", docSnap.id));
        await loadPurchaseHistory();
      }
    });

    tbody.appendChild(tr);
  });
}

// -----------------------------
// Print Table
// -----------------------------
document.getElementById("printPurchases").addEventListener("click", () => {
  const tableHTML = document.querySelector(".purchase-history table").outerHTML;
  const newWindow = window.open("", "", "width=900,height=600");
  newWindow.document.write("<html><head><title>Purchases</title>");
  newWindow.document.write("<style>table{width:100%;border-collapse:collapse} th,td{padding:10px;border:1px solid #333;text-align:left}</style>");
  newWindow.document.write("</head><body>");
  newWindow.document.write("<h2>Purchases</h2>");
  newWindow.document.write(tableHTML);
  newWindow.document.write("</body></html>");
  newWindow.document.close();
  newWindow.print();
});

// -----------------------------
// Event listener
// -----------------------------
document.getElementById("savePurchase").addEventListener("click", savePurchase);

// -----------------------------
// Init
// -----------------------------
(async function init() {
  await loadProducts();
  await loadPurchaseHistory();
})();
