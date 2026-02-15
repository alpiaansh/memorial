const memorialDataEl = document.getElementById("memorialData");
const memorialPhotos = (() => {
  try {
    const parsed = JSON.parse(memorialDataEl?.textContent || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
})();

const photoGrid = document.getElementById("photoGrid");
const timelineList = document.getElementById("timelineList");
const storyModal = document.getElementById("storyModal");
const modalPanel = document.getElementById("modalPanel");
const modalPhoto = document.getElementById("modalPhoto");
const modalTitle = document.getElementById("modalTitle");
const modalMeta = document.getElementById("modalMeta");
const modalStory = document.getElementById("modalStory");
const modalGallery = document.getElementById("modalGallery");
const modalContent = document.querySelector(".modal-content");
const closeModalTop = document.getElementById("closeModalTop");
const closeFullscreenBtn = document.getElementById("closeFullscreenBtn");
const navLinks = [...document.querySelectorAll(".nav-link")];
const AUTO_SLIDE_MS = 2800;
const HERO_SLIDE_MS = 3500;
const heroSection = document.querySelector(".hero");
const commentList = document.getElementById("commentList");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const commentSubmitBtn = commentForm?.querySelector('button[type="submit"]');
const commentLoginHint = document.getElementById("commentLoginHint");
const likeMemorialBtn = document.getElementById("likeMemorialBtn");
const openCommentsPeekBtn = document.getElementById("openCommentsPeek");
const commentsPeek = document.getElementById("commentsPeek");
const closeCommentsPeekBtn = document.getElementById("closeCommentsPeek");
const loginLink = document.getElementById("loginLink");
const auth = window.MemoflixAuth || {};
const cloudEnabled = Boolean(auth.cloudEnabled);
const COMMENTS_KEY = "memoflix_memorial_comments_v1";
const LIKES_KEY = "memoflix_memorial_likes_v1";

const monthOrder = {
  Januari: 0,
  Februari: 1,
  Maret: 2,
  April: 3,
  Mei: 4,
  Juni: 5,
  Juli: 6,
  Agustus: 7,
  September: 8,
  Oktober: 9,
  November: 10,
  Desember: 11
};

let currentGallery = [];
let currentImageIndex = 0;
let autoSlideTimer = null;
let cinemaEligible = false;
let heroSlideTimer = null;
let currentMemorialKey = "";
let pageScrollY = 0;
let floatingFadeTimer = null;

const photoFloating = document.createElement("div");
photoFloating.className = "photo-floating";
document.body.appendChild(photoFloating);

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const toMemorialKey = (item) => {
  const base = `${item.title || ""}-${item.year || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "memorial-item";
};

const parseLocalDate = (label) => {
  const [monthName, year] = label.split(" ");
  return new Date(Number(year), monthOrder[monthName] ?? 0, 1).getTime();
};

const setModalImage = (index = 0) => {
  if (currentGallery.length === 0) {
    return;
  }

  currentImageIndex = Math.max(0, Math.min(index, currentGallery.length - 1));
  modalPhoto.style.backgroundImage = `url('${currentGallery[currentImageIndex]}')`;
  photoFloating.style.backgroundImage = `url('${currentGallery[currentImageIndex]}')`;
  modalPanel.style.setProperty("--story-bg", `url('${currentGallery[currentImageIndex]}')`);

  const thumbs = [...modalGallery.querySelectorAll(".modal-thumb")];
  thumbs.forEach((thumb, thumbIndex) => {
    thumb.classList.toggle("active", thumbIndex === currentImageIndex);
  });
};

const showFloatingPhoto = () => {
  if (!isPhotoFullscreen()) {
    photoFloating.classList.remove("show", "faded");
    return;
  }

  photoFloating.classList.add("show");
  photoFloating.classList.remove("faded");
  if (floatingFadeTimer) {
    clearTimeout(floatingFadeTimer);
  }
  floatingFadeTimer = setTimeout(() => {
    photoFloating.classList.add("faded");
  }, 1500);
};

const isPhotoFullscreen = () =>
  document.fullscreenElement === modalPhoto ||
  document.webkitFullscreenElement === modalPhoto;

const exitPhotoFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    if (document.webkitFullscreenElement && document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  } catch {
    // Ignore exit fullscreen rejection.
  }
};

const startHeroCoverSlide = () => {
  if (!heroSection) {
    return;
  }

  const heroCovers = memorialPhotos
    .map((item) => item.cover)
    .filter((url) => typeof url === "string" && url.trim().length > 0);

  if (heroCovers.length === 0) {
    return;
  }

  let heroIndex = 0;
  heroSection.style.setProperty("--hero-image", `url('${heroCovers[heroIndex]}')`);

  if (heroCovers.length === 1) {
    return;
  }

  if (heroSlideTimer) {
    clearInterval(heroSlideTimer);
  }

  heroSlideTimer = setInterval(() => {
    heroIndex = (heroIndex + 1) % heroCovers.length;
    heroSection.style.setProperty("--hero-image", `url('${heroCovers[heroIndex]}')`);
  }, HERO_SLIDE_MS);
};

const updateCinemaMode = () => {
  if (!cinemaEligible) {
    storyModal.classList.remove("cinema-mode");
    return;
  }

  const shouldEnable = modalContent.scrollTop > 70;
  storyModal.classList.toggle("cinema-mode", shouldEnable);
};

const stopAutoSlide = () => {
  if (autoSlideTimer) {
    clearInterval(autoSlideTimer);
    autoSlideTimer = null;
  }
};

const startAutoSlide = () => {
  stopAutoSlide();
  if (currentGallery.length <= 1) {
    return;
  }

  autoSlideTimer = setInterval(() => {
    const nextIndex = (currentImageIndex + 1) % currentGallery.length;
    setModalImage(nextIndex);
  }, AUTO_SLIDE_MS);
};

const lockPageScroll = () => {
  pageScrollY = window.scrollY || window.pageYOffset || 0;
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  document.body.style.touchAction = "none";
};

const unlockPageScroll = () => {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.touchAction = "";
  requestAnimationFrame(() => {
    const currentY = window.scrollY || window.pageYOffset || 0;
    if (Math.abs(currentY - pageScrollY) > 2) {
      window.scrollTo(0, pageScrollY);
    }
  });
};

const renderModalGallery = () => {
  modalGallery.innerHTML = "";
  currentGallery.forEach((imageUrl, index) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "modal-thumb";
    thumb.setAttribute("aria-label", `Pilih foto ${index + 1}`);
    thumb.innerHTML = `<img src="${imageUrl}" alt="Pilihan foto ${index + 1}">`;
    thumb.addEventListener("click", () => {
      setModalImage(index);
      startAutoSlide();
    });
    modalGallery.appendChild(thumb);
  });
};

const setCommentUiState = () => {
  const currentUser = getCurrentUser();
  const canComment = Boolean(currentUser);

  if (commentInput) {
    commentInput.disabled = !canComment;
    commentInput.placeholder = canComment
      ? "Tulis komentar untuk memorial ini..."
      : "Login dulu untuk menulis komentar.";
  }

  if (commentSubmitBtn) {
    commentSubmitBtn.disabled = !canComment;
    commentSubmitBtn.style.opacity = canComment ? "1" : "0.6";
    commentSubmitBtn.style.cursor = canComment ? "pointer" : "not-allowed";
  }

  if (commentLoginHint) {
    commentLoginHint.textContent = canComment
      ? `Masuk sebagai ${currentUser.name}`
      : "Login untuk komentar";
    commentLoginHint.href = canComment ? "profile.html" : "login.html";
  }

  if (loginLink) {
    loginLink.textContent = canComment ? "Profile" : "Login";
    loginLink.href = canComment ? "profile.html" : "login.html";
  }
};

const loadLocalComments = () => {
  try {
    const raw = localStorage.getItem(COMMENTS_KEY);
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveLocalComments = (data) => {
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(data));
};

const loadLikes = () => {
  try {
    const raw = localStorage.getItem(LIKES_KEY);
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const saveLikes = (data) => {
  localStorage.setItem(LIKES_KEY, JSON.stringify(data));
};

const getAccessToken = () => auth.getSession?.()?.access_token || "";

const restRequest = async (path, options = {}) => {
  if (!cloudEnabled || !auth.supabaseUrl) {
    throw new Error("Cloud belum aktif");
  }

  const res = await fetch(`${auth.supabaseUrl}${path}`, {
    ...options,
    headers: {
      ...(auth.authHeaders ? auth.authHeaders(getAccessToken()) : {}),
      ...(options.headers || {})
    }
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.error_description)) ||
      `Request gagal (${res.status})`;
    throw new Error(msg);
  }

  return data;
};

const getCurrentUser = () => {
  return auth.getCurrentUser ? auth.getCurrentUser() : null;
};

const updateLikeButtonState = async () => {
  if (!likeMemorialBtn || !currentMemorialKey) {
    return;
  }

  const setLikeUi = (hasLiked, isLogin = true) => {
    likeMemorialBtn.textContent = !isLogin ? "Like (Login)" : hasLiked ? "Liked" : "Like";
    likeMemorialBtn.classList.toggle("is-active", Boolean(hasLiked));
    likeMemorialBtn.setAttribute("aria-pressed", hasLiked ? "true" : "false");
  };

  const currentUser = getCurrentUser();
  if (!currentUser) {
    setLikeUi(false, false);
    return;
  }

  if (cloudEnabled && getAccessToken() && currentUser.id) {
    try {
      const key = encodeURIComponent(currentMemorialKey);
      const uid = encodeURIComponent(currentUser.id);
      const rows = await restRequest(
        `/rest/v1/memorial_likes?select=id&memorial_key=eq.${key}&user_id=eq.${uid}&limit=1`
      );
      const hasLiked = Array.isArray(rows) && rows.length > 0;
      setLikeUi(hasLiked, true);
      return;
    } catch {
      // fallback local below
    }
  }

  const likes = loadLikes();
  const likedBy = Array.isArray(likes[currentMemorialKey]) ? likes[currentMemorialKey] : [];
  const email = String(currentUser.email || "").toLowerCase();
  setLikeUi(likedBy.includes(email), true);
};

const renderComments = (comments) => {
  if (!commentList) {
    return;
  }

  commentList.innerHTML = "";
  if (!comments || comments.length === 0) {
    commentList.innerHTML = '<div class="comment-item"><p class="comment-text">Belum ada komentar.</p></div>';
    return;
  }

  comments.forEach((comment) => {
    const created = new Date(comment.created_at || Date.now()).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
    const userLabel = comment.user_name || "Anonim";
    const item = document.createElement("article");
    item.className = "comment-item";
    item.innerHTML = `
      <p class="comment-meta">${escapeHtml(userLabel)} - ${created}</p>
      <p class="comment-text">${escapeHtml(comment.content)}</p>
    `;
    commentList.appendChild(item);
  });
};

const fetchComments = async (memorialKey) => {
  if (!memorialKey) {
    renderComments([]);
    return;
  }

  if (cloudEnabled && getAccessToken()) {
    try {
      const key = encodeURIComponent(memorialKey);
      const rows = await restRequest(
        `/rest/v1/memorial_comments?select=content,user_name,created_at,user_id&memorial_key=eq.${key}&order=created_at.desc`
      );
      renderComments(Array.isArray(rows) ? rows : []);
      return;
    } catch {
      // fallback local below
    }
  }

  const all = loadLocalComments();
  const comments = Array.isArray(all[memorialKey]) ? all[memorialKey] : [];
  renderComments(comments.slice().reverse());
};

const openStory = (item) => {
  currentGallery = Array.isArray(item.gallery) && item.gallery.length > 0 ? item.gallery : [item.cover];
  currentMemorialKey = toMemorialKey(item);
  modalTitle.textContent = item.title;
  modalMeta.textContent = item.year;
  modalStory.innerHTML = item.story.replace(/\n/g, "<br>");
  renderModalGallery();
  setModalImage(0);
  storyModal.classList.remove("cinema-mode");
  modalContent.scrollTop = 0;
  startAutoSlide();
  storyModal.classList.add("show");
  lockPageScroll();
  requestAnimationFrame(() => {
    const storyIsLong =
      modalStory.textContent.trim().length > 320 ||
      modalStory.scrollHeight > modalContent.clientHeight + 120;
    cinemaEligible = storyIsLong;
    updateCinemaMode();
  });
  fetchComments(currentMemorialKey);
  updateLikeButtonState();
};

const closeStory = () => {
  stopAutoSlide();
  storyModal.classList.remove("show");
  storyModal.classList.remove("cinema-mode");
  commentsPeek?.classList.remove("show");
  photoFloating.classList.remove("show", "faded");
  if (floatingFadeTimer) {
    clearTimeout(floatingFadeTimer);
    floatingFadeTimer = null;
  }
  modalPhoto.classList.remove("is-fullscreen");
  if (isPhotoFullscreen()) {
    exitPhotoFullscreen();
  }
  cinemaEligible = false;
  modalContent.scrollTop = 0;
  unlockPageScroll();
};

const createCard = (item, index) => {
  const button = document.createElement("button");
  button.className = "photo-card";
  button.type = "button";
  button.setAttribute("aria-label", "Buka cerita " + item.title);
  button.dataset.index = index;

  button.innerHTML = `
    <img src="${item.cover}" alt="${item.title}">
    <div class="card-copy">
      <h3>${item.title}</h3>
      <p>${item.short}</p>
    </div>
  `;

  button.addEventListener("click", () => openStory(item));
  return button;
};

const createTimelineItem = (item) => {
  const row = document.createElement("article");
  row.className = "timeline-item";

  row.innerHTML = `
    <p class="timeline-date">${item.year}</p>
    <div class="timeline-copy">
      <h3 class="timeline-title">${item.title}</h3>
      <p>${item.short}</p>
    </div>
    <button class="timeline-open" type="button">Buka Cerita</button>
  `;

  row.querySelector(".timeline-open").addEventListener("click", () => openStory(item));
  return row;
};

memorialPhotos.forEach((item, index) => {
  photoGrid.appendChild(createCard(item, index));
});

[...memorialPhotos]
  .sort((a, b) => parseLocalDate(a.year) - parseLocalDate(b.year))
  .forEach((item) => {
    timelineList.appendChild(createTimelineItem(item));
  });

closeModalTop?.addEventListener("click", closeStory);

likeMemorialBtn?.addEventListener("click", async () => {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    window.location.href = "login.html";
    return;
  }

  if (!currentMemorialKey) {
    return;
  }

  if (cloudEnabled && getAccessToken() && currentUser.id) {
    try {
      const key = encodeURIComponent(currentMemorialKey);
      const uid = encodeURIComponent(currentUser.id);
      const existing = await restRequest(
        `/rest/v1/memorial_likes?select=id&memorial_key=eq.${key}&user_id=eq.${uid}&limit=1`
      );
      if (Array.isArray(existing) && existing.length > 0) {
        await restRequest(
          `/rest/v1/memorial_likes?memorial_key=eq.${key}&user_id=eq.${uid}`,
          { method: "DELETE" }
        );
      } else {
        await restRequest("/rest/v1/memorial_likes", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            memorial_key: currentMemorialKey,
            user_id: currentUser.id
          })
        });
      }
      await updateLikeButtonState();
      return;
    } catch {
      // fallback local below
    }
  }

  const likes = loadLikes();
  if (!Array.isArray(likes[currentMemorialKey])) {
    likes[currentMemorialKey] = [];
  }
  const email = String(currentUser.email || "").toLowerCase();
  if (likes[currentMemorialKey].includes(email)) {
    likes[currentMemorialKey] = likes[currentMemorialKey].filter((item) => item !== email);
  } else {
    likes[currentMemorialKey].push(email);
  }
  saveLikes(likes);
  await updateLikeButtonState();
});

openCommentsPeekBtn?.addEventListener("click", () => {
  commentsPeek?.classList.add("show");
});

closeCommentsPeekBtn?.addEventListener("click", () => {
  commentsPeek?.classList.remove("show");
});

commentsPeek?.addEventListener("click", (event) => {
  if (event.target === commentsPeek) {
    commentsPeek.classList.remove("show");
  }
});

modalPhoto.addEventListener("click", async () => {
  try {
    if (!isPhotoFullscreen()) {
      await modalPhoto.requestFullscreen();
      return;
    }
    showFloatingPhoto();
  } catch {
    // Ignore fullscreen rejection in restricted browsers.
  }
});

closeFullscreenBtn?.addEventListener("click", async (event) => {
  event.stopPropagation();
  await exitPhotoFullscreen();
});

storyModal.addEventListener("click", (event) => {
  if (event.target === storyModal) {
    closeStory();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && commentsPeek?.classList.contains("show")) {
    commentsPeek.classList.remove("show");
    return;
  }

  if (event.key === "Escape" && storyModal.classList.contains("show")) {
    closeStory();
  }
});

modalContent.addEventListener("scroll", updateCinemaMode, { passive: true });

if (commentForm) {
  commentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const currentUser = getCurrentUser();
    if (!currentUser) {
      window.location.href = "login.html";
      return;
    }

    const content = String(commentInput?.value || "").trim();
    if (!content || !currentMemorialKey) {
      return;
    }

    if (cloudEnabled && getAccessToken() && currentUser.id) {
      try {
        await restRequest("/rest/v1/memorial_comments", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            memorial_key: currentMemorialKey,
            content,
            user_id: currentUser.id,
            user_name: currentUser.name
          })
        });
        commentInput.value = "";
        await fetchComments(currentMemorialKey);
        return;
      } catch {
        // fallback local below
      }
    }

    const all = loadLocalComments();
    if (!Array.isArray(all[currentMemorialKey])) {
      all[currentMemorialKey] = [];
    }

    all[currentMemorialKey].push({
      content,
      user_name: currentUser.name,
      user_email: currentUser.email,
      created_at: new Date().toISOString()
    });
    saveLocalComments(all);
    commentInput.value = "";
    fetchComments(currentMemorialKey);
  });
}

const setActiveNav = (href) => {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === href;
    link.classList.toggle("active", isActive);
  });
};

const detectActiveSection = () => {
  const memorySection = document.getElementById("our-memory");
  const timelineSection = document.getElementById("timeline");
  const y = window.scrollY + 140;

  if (timelineSection && y >= timelineSection.offsetTop) {
    setActiveNav("#timeline");
  } else if (memorySection && y >= memorySection.offsetTop) {
    setActiveNav("#our-memory");
  } else {
    setActiveNav("#our-memory");
  }
};

window.addEventListener("scroll", detectActiveSection, { passive: true });
window.addEventListener("hashchange", detectActiveSection);
detectActiveSection();

const handleFullscreenChange = () => {
  if (isPhotoFullscreen()) {
    modalPhoto.classList.add("is-fullscreen");
    stopAutoSlide();
    showFloatingPhoto();
    return;
  }

  modalPhoto.classList.remove("is-fullscreen");
  photoFloating.classList.remove("show", "faded");
  if (floatingFadeTimer) {
    clearTimeout(floatingFadeTimer);
    floatingFadeTimer = null;
  }
  if (storyModal.classList.contains("show")) {
    startAutoSlide();
  }
};

document.addEventListener("fullscreenchange", handleFullscreenChange);
document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

startHeroCoverSlide();
setCommentUiState();
