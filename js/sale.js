import { db } from "../firebase/firebase-config.js";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  addDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

document.getElementById("discountInput").addEventListener("input", updateTotals);
document.getElementById("extraChargesInput").addEventListener("input", updateTotals);

let inventoryData = [];
let cart = [];
let scanning = false;
let videoStream;

// -------------------------------
// Load inventory
// -------------------------------
async function loadInventory() {
  const snapshot = await getDocs(collection(db, "inventory"));
  inventoryData = [];
  const manualSelect = document.getElementById("manualSelect");
  manualSelect.innerHTML = '<option value="">-- Select Item --</option>';

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    data.id = docSnap.id;
    inventoryData.push(data);

    const option = document.createElement("option");
    option.value = data.barcode;
    option.textContent = `${data.name} (${data.type}) - Rs.${data.price} | Stock: ${data.stock}`;
    manualSelect.appendChild(option);
  });
}

// -------------------------------
// Add item to cart
// -------------------------------
function addToCart(barcode) {
  const item = inventoryData.find(i => i.barcode === barcode);
  if (!item) return;

  if (item.type === "product" && item.stock === 0) return;

  const existing = cart.find(c => c.barcode === barcode);

  if (existing) {
    if (item.type === "product" && existing.quantity < item.stock) {
      existing.quantity += 1;
    } else if (item.type === "service") {
      existing.quantity += 1;
    }
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  renderCart();
}

// -------------------------------
// Render cart table
// -------------------------------
function renderCart() {
  const container = document.getElementById("cartItems");
  container.innerHTML = "";

  if (!cart.length) {
    container.innerHTML = `<tr><td colspan="7" style="text-align:center">Cart is empty</td></tr>`;
    updateTotals();
    return;
  }

  cart.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><img src="${item.image || ''}" width="50"></td>
      <td>${item.name}</td>
      <td>Rs.${item.price}</td>
      <td>${item.quantity}</td>
      <td>Rs.${item.price * item.quantity}</td>
      <td>${item.barcode}</td>
      <td><button class="remove-btn">❌</button></td>
    `;
    container.appendChild(row);

    row.querySelector(".remove-btn").addEventListener("click", () => {
      cart.splice(index, 1);
      renderCart();
    });
  });

  updateTotals();
}

// -------------------------------
// Update totals
// -------------------------------
function updateTotals() {
  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const discount = Number(document.getElementById("discountInput").value) || 0;
  const extra = Number(document.getElementById("extraChargesInput").value) || 0;

  const total = subtotal - discount + extra;

  document.getElementById("subtotal").textContent = subtotal;
  document.getElementById("total").textContent = total;
}

// -------------------------------
// Complete sale
// -------------------------------
async function completeSale() {
  if (!cart.length) return alert("Cart is empty!");

  const subtotal = cart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const discount = Number(document.getElementById("discountInput").value) || 0;
  const extra = Number(document.getElementById("extraChargesInput").value) || 0;
  const total = subtotal - discount + extra;

  // -------------------------------
  // Update inventory stock
  // -------------------------------
  for (let item of cart) {
    if (item.type === "product") {
      const docRef = doc(db, "inventory", item.id);
      const newStock = item.stock - item.quantity;
      await updateDoc(docRef, { stock: newStock });
      item.stock = newStock;
    }
  }

  // -------------------------------
  // Save transaction
  // -------------------------------
  await addDoc(collection(db, "transactions"), {
    items: cart,
    subtotal: subtotal,
    discount: discount,
    extraCharges: extra,
    total: total,
    paymentMethod: document.getElementById("salePaymentMethod").value,
    createdAt: serverTimestamp()
  });

  // -------------------------------
  // Update bank / wallet balances (NEW)
  // -------------------------------
  const paymentMethod = document.getElementById("salePaymentMethod").value;
  let accountId = paymentMethod === "Cash" ? "cash_in_hand" : "esewa"; // IDs in Firestore
  const accountRef = doc(db, "banks", accountId);
  const accountSnap = await getDoc(accountRef);
  const accountData = accountSnap.exists() ? accountSnap.data() : { balance: 0 };

  await updateDoc(accountRef, { balance: (accountData.balance || 0) + total });

  // Update the display totals dynamically
  const cashSnap = await getDoc(doc(db, "banks", "cash_in_hand"));
  const esewaSnap = await getDoc(doc(db, "banks", "esewa"));

  document.getElementById("totalCash").textContent = cashSnap.exists() ? cashSnap.data().balance : 0;
  document.getElementById("totalWallet").textContent = esewaSnap.exists() ? esewaSnap.data().balance : 0;
  document.getElementById("totalCapital").textContent =
    (cashSnap.exists() ? cashSnap.data().balance : 0) + (esewaSnap.exists() ? esewaSnap.data().balance : 0);

  // -------------------------------
  cart = [];
  renderCart();
  await loadInventory();

  document.getElementById("discountInput").value = 0;
  document.getElementById("extraChargesInput").value = 0;
  updateTotals();

  alert("✅ Sale completed successfully!");
}

// -------------------------------
// Start camera scanner
// -------------------------------
document.getElementById("startCamera").addEventListener("click", async () => {
  if (scanning) return;
  scanning = true;

  const videoElem = document.getElementById("qr-reader");
  videoElem.style.display = "block";

  try {
    videoStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });

    videoElem.srcObject = videoStream;
    videoElem.setAttribute("playsinline", true);
    await videoElem.play();

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const scanLoop = () => {
      if (!scanning) return;

      canvas.width = videoElem.videoWidth;
      canvas.height = videoElem.videoHeight;

      ctx.drawImage(videoElem, 0, 0, canvas.width, canvas.height);

      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, canvas.width, canvas.height);

        if (code) {
          addToCart(code.data);
          stopCamera();
          alert("Scanned: " + code.data);
        }
      } catch (e) {}

      requestAnimationFrame(scanLoop);
    };

    scanLoop();
  } catch (err) {
    scanning = false;
    alert("Camera error: " + err.message);
  }
});

// -------------------------------
// Stop camera
// -------------------------------
function stopCamera() {
  scanning = false;

  const videoElem = document.getElementById("qr-reader");
  videoElem.pause();

  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
  }

  videoElem.style.display = "none";
}

// -------------------------------
// Manual add
// -------------------------------
document.getElementById("addSelected").addEventListener("click", () => {
  const barcode = document.getElementById("manualSelect").value;
  if (barcode) addToCart(barcode);
});

// -------------------------------
// Clear & Complete
// -------------------------------
document.getElementById("clearCart").addEventListener("click", () => {
  cart = [];
  renderCart();
});

document.getElementById("completeSale").addEventListener("click", completeSale);

// -------------------------------
// Initialize
// -------------------------------
(async function init() {
  await loadInventory();

  // -------------------------------
  // Load initial totals for Cash / Wallet display
  // -------------------------------
  const cashSnap = await getDoc(doc(db, "banks", "cash_in_hand"));
  const esewaSnap = await getDoc(doc(db, "banks", "esewa"));

  document.getElementById("totalCash").textContent = cashSnap.exists() ? cashSnap.data().balance : 0;
  document.getElementById("totalWallet").textContent = esewaSnap.exists() ? esewaSnap.data().balance : 0;
  document.getElementById("totalCapital").textContent =
    (cashSnap.exists() ? cashSnap.data().balance : 0) + (esewaSnap.exists() ? esewaSnap.data().balance : 0);
})();
