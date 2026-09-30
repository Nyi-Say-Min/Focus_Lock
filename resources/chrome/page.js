const status = document.getElementById("status");
const form = document.getElementById("pair");
const back = document.getElementById("return");
const ext = typeof browser === "undefined" ? chrome : browser;
let original;
try {
  const url = new URL(location.hash.slice(1));
  if (/^https?:$/.test(url.protocol) && !url.username && !url.password) original = url;
} catch {
  /* Directly opening the break page has no return destination. */
}
form.hidden = !!original;
back.hidden = !original;
if (original) {
  document.getElementById("heading").textContent = "Break time!";
  document.getElementById("site").textContent = original?.hostname || "Website blocked";
  back.addEventListener("click", () => {
    if (original && !back.disabled) location.replace(original.href);
  });
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = document.getElementById("token");
  if (!/^[a-f0-9]{64}$/.test(input.value.trim())) {
    status.textContent = "Paste the 64-character pairing code.";
    return;
  }
  await ext.storage.local.set({ token: input.value.trim() });
  input.value = "";
  status.textContent = "Pairing…";
});
async function render() {
  const { state, status: connection } = await ext.storage.session.get(["state", "status"]);
  if (!original) {
    status.textContent = connection || "Waiting for FocusLock…";
    return;
  }
  const active =
    original &&
    state &&
    state.until > Date.now() &&
    state.leaseUntil > Date.now() &&
    state.domains.some((domain) => original.hostname === domain || original.hostname.endsWith(`.${domain}`));
  back.disabled = !original || !!active;
  status.textContent = active
    ? `${Math.ceil((state.until - Date.now()) / 1000)} seconds remaining`
    : "You can return to your website.";
}
setInterval(() => void render(), 1000);
void render();
