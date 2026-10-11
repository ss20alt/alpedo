const key = "alpedo_offline_capture";
const amount = document.querySelector("#amount");
const description = document.querySelector("#description");
const status = document.querySelector("#status");
try {
  const note = JSON.parse(localStorage.getItem(key) || "null");
  if (note && typeof note === "object") {
    amount.value = note.amount || "";
    description.value = note.description || "";
    status.textContent = "Hay una nota guardada en este dispositivo.";
  }
} catch { /* Almacenamiento no disponible. */ }
document.querySelector("#note-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!amount.value || !description.value.trim()) return;
  try {
    localStorage.setItem(key, JSON.stringify({ amount: amount.value, description: description.value.trim() }));
    status.textContent = "Nota guardada. Recuperala al cargar un movimiento.";
  } catch {
    status.textContent = "No se pudo guardar la nota en este navegador.";
  }
});
document.querySelector("#retry").addEventListener("click", () => { window.location.href = "/"; });
