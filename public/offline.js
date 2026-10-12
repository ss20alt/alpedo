const activeUserKey = "alpedo_active_user_id";
const amount = document.querySelector("#amount");
const description = document.querySelector("#description");
const status = document.querySelector("#status");
const ownerUserId = localStorage.getItem(activeUserKey);
try {
  const key = ownerUserId ? `alpedo_offline_capture_${ownerUserId}` : null;
  const note = key ? JSON.parse(localStorage.getItem(key) || "null") : null;
  if (key && note && typeof note === "object" && String(note.userId) === ownerUserId) {
    amount.value = note.amount || "";
    description.value = note.description || "";
    status.textContent = "Hay una nota guardada en este dispositivo.";
  }
} catch { /* Almacenamiento no disponible. */ }
document.querySelector("#note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!amount.value || !description.value.trim()) return;
  try {
    const userId = localStorage.getItem(activeUserKey);
    if (!userId) {
      status.textContent = "Iniciá sesión con conexión antes de guardar una nota sin conexión.";
      return;
    }
    if (userId !== ownerUserId) {
      amount.value = "";
      description.value = "";
      status.textContent = "La cuenta activa cambió. Volvé a abrir esta página para guardar una nota.";
      return;
    }
    localStorage.setItem(`alpedo_offline_capture_${userId}`, JSON.stringify({ userId, amount: amount.value, description: description.value.trim() }));
    status.textContent = "Nota guardada. Recuperala al cargar un movimiento.";
  } catch {
    status.textContent = "No se pudo guardar la nota en este navegador.";
  }
});
document.querySelector("#retry").addEventListener("click", () => { window.location.href = "/"; });
