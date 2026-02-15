const auth = window.MemoflixAuth;

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginPanel = document.getElementById("loginPanel");
const registerPanel = document.getElementById("registerPanel");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authStatus = document.getElementById("authStatus");
const logoutBtn = document.getElementById("logoutBtn");

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

const switchTab = (mode) => {
  const isLogin = mode === "login";
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);
  tabLogin.setAttribute("aria-selected", String(isLogin));
  tabRegister.setAttribute("aria-selected", String(!isLogin));
  loginPanel.classList.toggle("active", isLogin);
  registerPanel.classList.toggle("active", !isLogin);
};

const setStatus = (message, type = "info") => {
  authStatus.textContent = message;
  authStatus.classList.remove("error", "ok");
  if (type === "error") {
    authStatus.classList.add("error");
  }
  if (type === "ok") {
    authStatus.classList.add("ok");
  }
};

if (!auth?.cloudEnabled) {
  setStatus("Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_ANON_KEY.", "error");
}

const activeSession = auth?.getSession?.();
if (activeSession?.access_token) {
  window.location.replace("profile.html");
}

tabLogin?.addEventListener("click", () => switchTab("login"));
tabRegister?.addEventListener("click", () => switchTab("register"));

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = normalizeEmail(document.getElementById("loginEmail")?.value);
  const password = String(document.getElementById("loginPassword")?.value || "");

  try {
    await auth.signIn({ email, password });
    await auth.upsertProfile();
    setStatus("Login berhasil.", "ok");
    window.location.href = "profile.html";
  } catch (error) {
    setStatus(`Login gagal: ${error.message}`, "error");
  }
});

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = String(document.getElementById("registerName")?.value || "").trim();
  const email = normalizeEmail(document.getElementById("registerEmail")?.value);
  const password = String(document.getElementById("registerPassword")?.value || "");
  const passwordConfirm = String(document.getElementById("registerPasswordConfirm")?.value || "");

  if (name.length < 2) {
    setStatus("Nama minimal 2 karakter.", "error");
    return;
  }
  if (!email.endsWith("@gmail.com")) {
    setStatus("Gunakan alamat Gmail valid.", "error");
    return;
  }
  if (password.length < 6) {
    setStatus("Password minimal 6 karakter.", "error");
    return;
  }
  if (password !== passwordConfirm) {
    setStatus("Verifikasi password tidak sama.", "error");
    return;
  }

  try {
    const signUpData = await auth.signUp({ name, email, password });
    if (!signUpData?.session) {
      setStatus("Akun dibuat. Cek email untuk verifikasi, lalu login.", "ok");
      switchTab("login");
      registerForm.reset();
      return;
    }
    await auth.upsertProfile();
    setStatus("Akun berhasil dibuat dan kamu sudah login.", "ok");
    window.location.href = "profile.html";
  } catch (error) {
    setStatus(`Daftar gagal: ${error.message}`, "error");
  }
});

logoutBtn?.addEventListener("click", async () => {
  await auth.signOut();
  setStatus("Status: kamu sudah logout.");
});
