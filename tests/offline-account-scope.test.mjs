import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

const source = await readFile(new URL("../public/offline.js", import.meta.url), "utf8");

function loadOfflinePage(seed = {}) {
  const values = new Map(Object.entries(seed));
  const listeners = new Map();
  const elements = new Map(["#amount", "#description", "#status", "#note-form", "#retry"].map((key) => [key, {}]));
  const localStorage = {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const document = {
    querySelector: (selector) => elements.get(selector),
  };
  const window = { location: { href: "" } };
  elements.get("#note-form").addEventListener = (name, callback) => listeners.set(`form:${name}`, callback);
  elements.get("#retry").addEventListener = (name, callback) => listeners.set(`retry:${name}`, callback);
  vm.runInNewContext(source, { document, localStorage, window, JSON });
  return { values, listeners, elements };
}

test("las notas offline se leen y escriben bajo el usuario activo", () => {
  const { values, listeners, elements } = loadOfflinePage({
    alpedo_active_user_id: "12",
    alpedo_offline_capture_12: JSON.stringify({ userId: 12, amount: "25000", description: "Nota propia" }),
    alpedo_offline_capture_13: JSON.stringify({ userId: 13, amount: "99000", description: "Nota ajena" }),
  });
  assert.equal(elements.get("#amount").value, "25000");
  assert.equal(elements.get("#description").value, "Nota propia");

  elements.get("#amount").value = "30000";
  elements.get("#description").value = "Otra nota";
  listeners.get("form:submit")({ preventDefault() {} });
  assert.deepEqual(JSON.parse(values.get("alpedo_offline_capture_12")), {
    userId: "12", amount: "30000", description: "Otra nota",
  });
  assert.equal(JSON.parse(values.get("alpedo_offline_capture_13")).description, "Nota ajena");
});

test("no permite guardar si falta la cuenta activa o cambió desde que abrió la página", () => {
  const first = loadOfflinePage();
  first.elements.get("#amount").value = "2000";
  first.elements.get("#description").value = "Sin usuario";
  first.listeners.get("form:submit")({ preventDefault() {} });
  assert.match(first.elements.get("#status").textContent, /Iniciá sesión/);
  assert.equal(first.values.size, 0);

  const second = loadOfflinePage({ alpedo_active_user_id: "12" });
  second.values.set("alpedo_active_user_id", "13");
  second.elements.get("#amount").value = "2000";
  second.elements.get("#description").value = "Cuenta anterior";
  second.listeners.get("form:submit")({ preventDefault() {} });
  assert.match(second.elements.get("#status").textContent, /La cuenta activa cambió/);
  assert.equal(second.values.has("alpedo_offline_capture_13"), false);
});
