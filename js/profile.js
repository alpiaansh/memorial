const auth = window.MemoflixAuth;

const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const statComments = document.getElementById("statComments");
const statLikes = document.getElementById("statLikes");
const statMessages = document.getElementById("statMessages");
const logoutBtn = document.getElementById("logoutBtn");

const session = auth?.getSession?.();
const currentUser = auth?.getCurrentUser?.();

if (!auth?.cloudEnabled || !session?.access_token || !currentUser?.id) {
  window.location.href = "login.html";
}

const apiGet = async (path) => {
  const res = await fetch(`${auth.supabaseUrl}${path}`, {
    headers: {
      ...auth.authHeaders(session.access_token),
      Prefer: "count=exact"
    }
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(`Fetch gagal (${res.status})`);
  }
  return Array.isArray(data) ? data : [];
};

const loadStats = async () => {
  const userId = encodeURIComponent(currentUser.id);
  profileName.textContent = currentUser.name;
  profileEmail.textContent = currentUser.email;
  const [comments, likes, messages] = await Promise.all([
    apiGet(`/rest/v1/memorial_comments?select=id&user_id=eq.${userId}`),
    apiGet(`/rest/v1/memorial_likes?select=id&user_id=eq.${userId}`),
    apiGet(`/rest/v1/secret_messages?select=id&sender_user_id=eq.${userId}`)
  ]);

  statComments.textContent = String(comments.length);
  statLikes.textContent = String(likes.length);
  statMessages.textContent = String(messages.length);
};

loadStats().catch(() => {
  statComments.textContent = "-";
  statLikes.textContent = "-";
  statMessages.textContent = "-";
});

logoutBtn?.addEventListener("click", async () => {
  await auth.signOut();
  window.location.href = "login.html";
});
