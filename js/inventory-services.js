import { db } from "../firebase/firebase-config.js";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  deleteDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// -----------------------------------
// Store inventory items locally with Firestore IDs
// -----------------------------------
let inventoryData = [];

// -----------------------------------
// Generate unique barcode
// -----------------------------------
function generateBarcode() {
  return "ITEM-" + Date.now();
}

// -----------------------------------
// Convert image file to Base64
// -----------------------------------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = err => reject(err);
  });
}

// -----------------------------------
// Clear input form
// -----------------------------------
function clearForm() {
  document.getElementById("itemName").value = "";
  document.getElementById("itemPrice").value = "";
  document.getElementById("itemCost").value = "";
  document.getElementById("itemStock").value = "";
  document.getElementById("itemImage").value = "";
  document.getElementById("itemType").value = "product";
  document.getElementById("saveItem").dataset.editId = "";
  document.getElementById("barcodeCanvas").getContext("2d").clearRect(0, 0, 150, 150);
}

// -----------------------------------
// Save or Edit Inventory Item
// -----------------------------------
async function saveItem() {
  const type = document.getElementById("itemType").value;
  const name = document.getElementById("itemName").value.trim();
  const price = Number(document.getElementById("itemPrice").value);
  const cost = Number(document.getElementById("itemCost").value);
  const stock = Number(document.getElementById("itemStock").value);
  const file = document.getElementById("itemImage").files[0];
  const editId = document.getElementById("saveItem").dataset.editId;

  if (!name || !price) {
    alert("Please fill required fields!");
    return;
  }

  let imageBase64;
  if (file) imageBase64 = await fileToBase64(file);

  try {
    if (editId) {
      // Update existing item
      const docRef = doc(db, "inventory", editId);
      const updateData = {
        type,
        name,
        price,
        cost,
        stock: type === "service" ? 0 : stock
      };
      if (imageBase64 !== undefined) updateData.imageBase64 = imageBase64;

      await updateDoc(docRef, updateData);
    } else {
      // Add new item
      const barcode = generateBarcode();
      await addDoc(collection(db, "inventory"), {
        type,
        name,
        price,
        cost,
        stock: type === "service" ? 0 : stock,
        imageBase64: imageBase64 || "",
        barcode,
        createdAt: serverTimestamp()
      });

      // Display QR code in the form
      QRCode.toCanvas(document.getElementById("barcodeCanvas"), barcode, { width: 120 });
    }

    clearForm();
    await loadItems();
  } catch (err) {
    console.error(err);
    alert("Error saving item: " + err.message);
  }
}

// -----------------------------------
// Delete Inventory Item
// -----------------------------------
async function deleteItem(id) {
  if (!confirm("Are you sure you want to delete this item?")) return;
  await deleteDoc(doc(db, "inventory", id));
  await loadItems();
}

// -----------------------------------
// Fill form for editing item
// -----------------------------------
function editItem(item) {
  document.getElementById("itemType").value = item.type;
  document.getElementById("itemName").value = item.name;
  document.getElementById("itemPrice").value = item.price;
  document.getElementById("itemCost").value = item.cost;
  document.getElementById("itemStock").value = item.stock;
  document.getElementById("saveItem").dataset.editId = item.id;
  if (item.barcode) QRCode.toCanvas(document.getElementById("barcodeCanvas"), item.barcode, { width: 120 });
}

// -----------------------------------
// Print barcodes for full stock on A4
// -----------------------------------
function printBarcode(item) {
  if (!item.stock || item.stock <= 0) {
    alert("No stock available for printing.");
    return;
  }

  const qrSizeMm = 15;       // QR code size in mm
  const spacingMm = 5;       // spacing between QRs
  const pageMarginMm = 10;   // page margin for A4

  // Open print window
  const printWindow = window.open("", "_blank");
  printWindow.document.write(`
    <html>
      <head>
        <title>Print Barcodes</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            canvas { display: inline-block; margin: ${spacingMm}mm; }
          }
          body { display: flex; flex-wrap: wrap; padding: ${pageMarginMm}mm; }
          canvas { width: ${qrSizeMm}mm; height: ${qrSizeMm}mm; }
        </style>
      </head>
      <body></body>
    </html>
  `);
  printWindow.document.close();

  const mmToPx = mm => Math.round((mm / 25.4) * 96);
  const qrPx = mmToPx(qrSizeMm);

  printWindow.onload = async () => {
    for (let i = 0; i < item.stock; i++) {
      const canvas = printWindow.document.createElement("canvas");
      canvas.width = qrPx;
      canvas.height = qrPx;
      printWindow.document.body.appendChild(canvas);
      await QRCode.toCanvas(canvas, item.barcode, { width: qrPx, margin: 0 });
    }
    printWindow.focus();
    printWindow.print();
  };
}

// -----------------------------------
// Render inventory list
// -----------------------------------
function renderTable(items) {
  const container = document.getElementById("itemsList");
  container.innerHTML = "";

  items.forEach(item => {
    const row = document.createElement("div");
    row.classList.add("inventory-item");

    row.innerHTML = `
      <img src="${item.imageBase64 || ''}" class="item-img">
      <div class="item-info">
        <span><strong>Name:</strong> ${item.name || "-"}</span>
        <span><strong>Type:</strong> ${item.type || "-"}</span>
        <span><strong>Price:</strong> Rs.${item.price != null ? item.price : "-"}</span>
        <span><strong>Stock:</strong> ${item.stock != null ? item.stock : "-"}</span>
      </div>
      <div class="barcode-container">
        <canvas id="canvas-${item.barcode}"></canvas>
        <span class="barcode-text">${item.barcode}</span>
        <button class="print-barcode">🖨️ Print</button>
      </div>
      <div class="action-buttons">
        <button class="edit-btn">Edit</button>
        <button class="delete-btn">Delete</button>
      </div>
    `;

    container.appendChild(row);

    // Generate QR code for item
    if (item.barcode) {
      QRCode.toCanvas(document.getElementById(`canvas-${item.barcode}`), item.barcode, { width: 80 });
    }

    // Bind buttons
    row.querySelector(".print-barcode").addEventListener("click", () => printBarcode(item));
    row.querySelector(".edit-btn").addEventListener("click", () => editItem(item));
    row.querySelector(".delete-btn").addEventListener("click", () => deleteItem(item.id));
  });
}

// -----------------------------------
// Load items from Firestore
// -----------------------------------
async function loadItems() {
  const snapshot = await getDocs(collection(db, "inventory"));
  inventoryData = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    data.id = docSnap.id;
    inventoryData.push(data);
  });
  renderTable(inventoryData);
}

// -----------------------------------
// Search inventory
// -----------------------------------
document.getElementById("searchInput").addEventListener("input", e => {
  const keyword = e.target.value.toLowerCase();
  renderTable(
    inventoryData.filter(item =>
      item.name.toLowerCase().includes(keyword) ||
      item.type.toLowerCase().includes(keyword)
    )
  );
});

// -----------------------------------
// Sort inventory
// -----------------------------------
document.getElementById("sortSelect").addEventListener("change", e => {
  const value = e.target.value;
  let sorted = [...inventoryData];

  if (value === "priceAsc") sorted.sort((a,b) => a.price - b.price);
  else if (value === "priceDesc") sorted.sort((a,b) => b.price - a.price);
  else if (value === "stockAsc") sorted.sort((a,b) => a.stock - b.stock);
  else if (value === "stockDesc") sorted.sort((a,b) => b.stock - a.stock);

  renderTable(sorted);
});

// -----------------------------------
// Initialize
// -----------------------------------
document.getElementById("saveItem").addEventListener("click", saveItem);
loadItems();
