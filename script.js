/**
 * Baby Shower de Mateo — configuración
 * Reemplazá el número con el WhatsApp que recibirá las confirmaciones
 * (código de país + número, sin + ni espacios). Ej: 54911XXXXXXXX
 */
const CONFIG = {
  whatsappNumber: "5491160148579",
  eventDate: new Date("2026-08-30T13:00:00-03:00"),
  alias: "Mateo.valentin.HOGAR",
  supabaseUrl: "https://eqztjotyfhhhcbjzqfjt.supabase.co",
  supabaseAnonKey:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVxenRqb3R5ZmhoaGNianpxZmp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3ODIyMDAsImV4cCI6MjA5MTM1ODIwMH0.I9W3ciy3vAdWK_80KzKEUq3Pg2JCLQ52jzIjx_gP7Kc",
};

const TOKEN_KEY = "mateo-gift-tokens";
const NAME_KEY = "mateo-gift-name";

const overlay = document.getElementById("envelope-overlay");
const envelopeBtn = document.getElementById("open-envelope");
const invitation = document.getElementById("invitation");
const countdownEl = document.getElementById("countdown");
const form = document.getElementById("rsvp-form");
const formNote = document.getElementById("form-note");
const copyAliasBtn = document.getElementById("copy-alias");
const wishlistEl = document.getElementById("wishlist");
const filtersEl = document.getElementById("wishlist-filters");
const statusEl = document.getElementById("wishlist-status");
const wishlistMoreBtn = document.getElementById("wishlist-more");
const claimModal = document.getElementById("claim-modal");
const claimForm = document.getElementById("claim-form");
const claimNameInput = document.getElementById("claim-name");
const claimItemName = document.getElementById("claim-item-name");
const claimError = document.getElementById("claim-error");
const claimCancel = document.getElementById("claim-cancel");

let db = null;
try {
  if (window.supabase?.createClient) {
    db = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  }
} catch (err) {
  console.error("Supabase no disponible", err);
}

let claimsByItem = {};
let activeFilter = "Todos";
let visibleCount = 6;
const PAGE_SIZE = 6;
let pendingItemId = null;

document.body.classList.add("is-locked");

/* ——— Sobre ——— */
function openEnvelope() {
  if (envelopeBtn.classList.contains("is-open")) return;

  envelopeBtn.classList.add("is-open");
  overlay.classList.add("is-opening");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const delay = reduceMotion ? 60 : 1100;

  window.setTimeout(() => {
    overlay.classList.add("is-gone");
    overlay.setAttribute("aria-hidden", "true");
    invitation.hidden = false;
    requestAnimationFrame(() => invitation.classList.add("is-visible"));
    document.body.classList.remove("is-locked");
    initReveal();

    window.setTimeout(() => {
      overlay.remove();
    }, 700);
  }, delay);
}

envelopeBtn.addEventListener("click", openEnvelope);
envelopeBtn.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    openEnvelope();
  }
});

/* ——— Countdown ——— */
function pad(n) {
  return String(n).padStart(2, "0");
}

function updateCountdown() {
  const now = new Date();
  let diff = CONFIG.eventDate - now;

  if (diff <= 0) {
    countdownEl.innerHTML =
      '<p class="closing" style="grid-column:1/-1;margin:0">¡Hoy es el gran día!</p>';
    return;
  }

  const days = Math.floor(diff / 86400000);
  diff %= 86400000;
  const hours = Math.floor(diff / 3600000);
  diff %= 3600000;
  const mins = Math.floor(diff / 60000);
  diff %= 60000;
  const secs = Math.floor(diff / 1000);

  const map = { days, hours, mins, secs };
  countdownEl.querySelectorAll("[data-unit]").forEach((el) => {
    el.textContent = pad(map[el.dataset.unit]);
  });
}

updateCountdown();
setInterval(updateCountdown, 1000);

/* ——— Reveal ——— */
function initReveal() {
  const targets = document.querySelectorAll(".section, .gallery__item, .alias-box, .rsvp");
  targets.forEach((el) => el.classList.add("reveal"));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.08, rootMargin: "0px 0px -20px 0px" }
  );

  targets.forEach((el) => io.observe(el));

  // Si ya está en pantalla (o el observer falla), mostrar igual
  window.setTimeout(() => {
    targets.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        el.classList.add("is-in");
      }
    });
  }, 100);
}

/* ——— Alias ——— */
copyAliasBtn?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(CONFIG.alias);
    copyAliasBtn.textContent = "¡Copiado!";
    setTimeout(() => {
      copyAliasBtn.textContent = "Copiar alias";
    }, 2000);
  } catch {
    copyAliasBtn.textContent = "No se pudo copiar";
  }
});

/* ——— Tokens locales ——— */
function getTokens() {
  try {
    return JSON.parse(localStorage.getItem(TOKEN_KEY) || "{}");
  } catch {
    return {};
  }
}

function setToken(itemId, token) {
  const tokens = getTokens();
  tokens[itemId] = token;
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function removeToken(itemId) {
  const tokens = getTokens();
  delete tokens[itemId];
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ——— Wishlist UI ——— */
function categories() {
  const set = new Set(window.WISHLIST_ITEMS.map((i) => i.category));
  return ["Todos", ...set];
}

function renderFilters() {
  filtersEl.innerHTML = categories()
    .map(
      (cat) =>
        `<button type="button" data-filter="${escapeHtml(cat)}" class="${
          cat === activeFilter ? "is-active" : ""
        }">${escapeHtml(cat)}</button>`
    )
    .join("");
}

filtersEl?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-filter]");
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  visibleCount = PAGE_SIZE;
  renderFilters();
  renderWishlist();
});

wishlistMoreBtn?.addEventListener("click", () => {
  visibleCount += PAGE_SIZE;
  renderWishlist();
});

function renderWishlist() {
  if (!wishlistEl || !window.WISHLIST_ITEMS?.length) {
    if (statusEl) statusEl.textContent = "No se pudo cargar la lista de regalos.";
    return;
  }

  const tokens = getTokens();
  const items = window.WISHLIST_ITEMS.filter(
    (item) => activeFilter === "Todos" || item.category === activeFilter
  );

  const claimedCount = Object.keys(claimsByItem).length;
  const total = window.WISHLIST_ITEMS.length;
  const shown = Math.min(visibleCount, items.length);
  statusEl.textContent = `${claimedCount} de ${total} regalos ya reservados · mostrando ${shown} de ${items.length}`;

  if (wishlistMoreBtn) {
    wishlistMoreBtn.hidden = visibleCount >= items.length;
    wishlistMoreBtn.textContent = `Ver más regalos (${items.length - shown})`;
  }

  wishlistEl.innerHTML = items
    .slice(0, visibleCount)
    .map((item) => {
      const claim = claimsByItem[item.id];
      const isMine = claim && tokens[item.id] === claim.claim_token;
      const claimed = Boolean(claim);

      let actionHtml;
      if (claimed && isMine) {
        actionHtml = `<button type="button" class="btn btn--release" data-action="release" data-id="${item.id}">Liberar mi reserva</button>
          <p class="gift-card__meta">Reservado por vos (${escapeHtml(claim.claimed_by)})</p>`;
      } else if (claimed) {
        actionHtml = `<button type="button" class="btn" disabled>Reservado</button>
          <p class="gift-card__meta">Lo regala ${escapeHtml(claim.claimed_by)}</p>`;
      } else {
        actionHtml = `<button type="button" class="btn btn--primary" data-action="claim" data-id="${item.id}">Yo lo regalo</button>`;
      }

      const mlLink = item.url
        ? `<a class="gift-card__ml" href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Ver producto</a>`
        : "";

      return `<article class="gift-card ${claimed ? "is-claimed" : ""}" data-id="${item.id}">
        <div class="gift-card__media">
          <img src="${item.image}" alt="${escapeHtml(item.name)}" loading="lazy" width="600" height="600" />
          <span class="gift-card__badge">${escapeHtml(item.category)}</span>
        </div>
        <div class="gift-card__body">
          <h3 class="gift-card__name">${escapeHtml(item.name)}</h3>
          ${mlLink}
          ${actionHtml}
        </div>
      </article>`;
    })
    .join("");
}

wishlistEl?.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  if (btn.dataset.action === "claim") openClaimModal(id);
  if (btn.dataset.action === "release") await releaseClaim(id);
});

function openClaimModal(itemId) {
  const item = window.WISHLIST_ITEMS.find((i) => i.id === itemId);
  if (!item || !claimModal) return;
  pendingItemId = itemId;
  claimItemName.textContent = item.name;
  claimError.hidden = true;
  claimNameInput.value = localStorage.getItem(NAME_KEY) || "";
  claimModal.showModal();
  claimNameInput.focus();
}

claimCancel?.addEventListener("click", () => claimModal.close());

claimForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = claimNameInput.value.trim();
  if (name.length < 2) {
    claimError.hidden = false;
    claimError.textContent = "Escribí tu nombre completo.";
    return;
  }
  await claimGift(pendingItemId, name);
});

async function loadClaims() {
  if (!db) {
    statusEl.textContent =
      "Lista visible. Las reservas online no están disponibles ahora.";
    renderWishlist();
    return;
  }

  const { data, error } = await db.from("gift_claims").select("item_id, claimed_by, claim_token");
  if (error) {
    console.error(error);
    statusEl.textContent = "Lista visible. No se pudieron sincronizar las reservas.";
    renderWishlist();
    return;
  }
  claimsByItem = {};
  (data || []).forEach((row) => {
    claimsByItem[row.item_id] = row;
  });
  renderWishlist();
}

async function claimGift(itemId, name) {
  if (!db) {
    claimError.hidden = false;
    claimError.textContent = "Las reservas online no están disponibles.";
    return;
  }

  claimError.hidden = true;
  const confirmBtn = document.getElementById("claim-confirm");
  confirmBtn.disabled = true;
  confirmBtn.textContent = "Reservando…";

  const { data, error } = await db
    .from("gift_claims")
    .insert({ item_id: itemId, claimed_by: name })
    .select("item_id, claimed_by, claim_token")
    .single();

  confirmBtn.disabled = false;
  confirmBtn.textContent = "Confirmar";

  if (error) {
    claimError.hidden = false;
    if (error.code === "23505") {
      claimError.textContent = "Alguien más acaba de reservar este regalo.";
      await loadClaims();
    } else {
      claimError.textContent = "No se pudo reservar. Intentá de nuevo.";
    }
    return;
  }

  localStorage.setItem(NAME_KEY, name);
  setToken(itemId, data.claim_token);
  claimsByItem[itemId] = data;
  claimModal.close();
  renderWishlist();
}

async function releaseClaim(itemId) {
  if (!db) return;
  const tokens = getTokens();
  const token = tokens[itemId];
  if (!token) return;

  const { error } = await db
    .from("gift_claims")
    .delete()
    .eq("item_id", itemId)
    .eq("claim_token", token);

  if (error) {
    statusEl.textContent = "No se pudo liberar la reserva.";
    return;
  }

  removeToken(itemId);
  delete claimsByItem[itemId];
  renderWishlist();
}

function subscribeClaims() {
  if (!db) return;
  db.channel("gift_claims_live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "gift_claims" },
      () => {
        loadClaims();
      }
    )
    .subscribe();
}

/* Pintar la lista ya, aunque falle Supabase */
renderFilters();
renderWishlist();
loadClaims();
subscribeClaims();

/* ——— RSVP → WhatsApp ——— */
function getRadio(name) {
  const el = form.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value : "";
}

form?.addEventListener("submit", (e) => {
  e.preventDefault();

  if (CONFIG.whatsappNumber.includes("00000000")) {
    formNote.hidden = false;
    formNote.textContent =
      "Falta configurar el número de WhatsApp en script.js (CONFIG.whatsappNumber).";
    return;
  }

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const data = new FormData(form);
  const nombre = String(data.get("nombre") || "").trim();
  const personas = data.get("personas");
  const asistencia = getRadio("asistencia");

  const message = [
    "\u00A1Hola! Confirmo asistencia al Baby Shower de Mateo \u{1F499}",
    "",
    `*Asistencia:* ${asistencia}`,
    `*Nombre y apellido:* ${nombre}`,
    `*Cantidad de personas:* ${personas}`,
  ].join("\n");

  const url = `https://wa.me/${CONFIG.whatsappNumber}?text=${encodeURIComponent(message)}`;
  formNote.hidden = true;
  window.open(url, "_blank", "noopener,noreferrer");
});
