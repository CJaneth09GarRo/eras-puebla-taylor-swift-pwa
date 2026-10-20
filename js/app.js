// El catálogo y el progreso tienen persistencias distintas: SQLite remoto y IndexedDB local.
import { localDb } from "./local-db.js";
import { initFanTools } from "./fan-tools.js";

// Utilidades y referencias a elementos compartidos por la página.
const $ = selector => document.querySelector(selector);
const root = document.documentElement;
const grid = $("#erasGrid");
const imageBase = "assets/img/eras/";
const status = $("#catalogStatus");
let ERAS = [];
let fanTools;
const homeProfile = {
  year: "De Nashville a la cima del mundo",
  title: "Taylor Swift",
  text: "Cantautora, productora, directora y empresaria estadounidense. Desde Nashville hasta la cima del mundo, ha construido una carrera que cruza géneros y generaciones.",
  image: "assets/img/taylor-midnights.jpg",
  alt: "Taylor Swift en una fotografía promocional de Midnights"
};
// Builds accessible era cards from the SQLite API response.
function renderEras() {
  grid.replaceChildren();
  ERAS.forEach((era, index) => {
    const article = document.createElement("article");
    article.className = "era-card";
    const button = document.createElement("button");
    button.className = "card";
    button.type = "button";
    button.style.setProperty("--a", era.colorA);
    button.style.setProperty("--b", era.colorB);
    button.setAttribute("aria-label", `Ver la era ${era.name}, ${era.year}`);
    const image = document.createElement("img");
    image.src = `${imageBase}${era.image}`;
    image.alt = era.alt;
    image.loading = "lazy";
    const copy = document.createElement("span");
    copy.className = "card-copy";
    const title = document.createElement("b");
    title.textContent = era.name;
    const year = document.createElement("span");
    year.textContent = String(era.year);
    copy.append(title, year);
    button.append(image, copy);
    button.addEventListener("click", () => setEra(index));
    article.append(button);
    grid.appendChild(article);
  });
  window.erasCatalog = ERAS;
  status.textContent = "Catálogo listo.";
}

// Load fresh data online or the last service-worker response offline.
async function loadEras() {
  try {
    const response = await fetch("./api/eras");
    if (!response.ok) throw new Error(`API respondió ${response.status}`);
    ERAS = await response.json();
    if (!Array.isArray(ERAS) || ERAS.length === 0) throw new Error("La API devolvió un catálogo vacío.");
    fanTools = await initFanTools(ERAS);
    renderEras();
    const savedEra = localStorage.getItem("era");
    if (savedEra !== null && Number.isInteger(Number(savedEra)) && Number(savedEra) >= 0 && Number(savedEra) < ERAS.length) {
      await setEra(Number(savedEra), false);
    }
  } catch (error) {
    console.error("No se pudo cargar el catálogo de eras.", error);
    status.textContent = "No se pudo cargar el catálogo. Conéctate a internet una vez o inicia el backend local.";
    status.dataset.state = "error";
  }
}

loadEras();

// Selección de era: actualiza colores, portada, texto y preferencia local.
async function setEra(index, countVisit = true) {
  const era = ERAS[index];
  if (!era) return;

  root.style.setProperty("--c1", era.colorA);
  root.style.setProperty("--c2", era.colorB);
  $("#heroYear").textContent = `Era ${era.year}`;
  $("#heroTitle").textContent = era.name;
  $("#heroText").textContent = era.description;
  $("#artistFacts").hidden = true;
  const heroImage = $("#heroImage");
  heroImage.src = `${imageBase}${era.image}`;
  heroImage.alt = era.alt;
  document.querySelectorAll(".card").forEach((card, cardIndex) => {
    const selected = index === cardIndex;
    card.classList.toggle("on", selected);
    card.setAttribute("aria-pressed", String(selected));
  });
  try {
    localStorage.setItem("era", String(index));
  } catch (error) {
    console.warn("No se pudo guardar la era seleccionada.", error);
  }
  const visit = countVisit
    ? await localDb.recordEraVisit(era.key)
    : await localDb.get("eraVisits", era.key);
  await renderEraDetails(era, visit?.count || 0);
  if (countVisit) await fanTools?.refreshLocalSummary();
}

// Presenta el álbum, las canciones y las acciones personales de la era seleccionada.
async function renderEraDetails(era, visitCount) {
  const details = $("#eraDetails");
  const heading = document.createElement("h3");
  heading.textContent = `${era.name} · ${era.year}`;
  const description = document.createElement("p");
  description.textContent = era.description;
  const metadata = document.createElement("p");
  metadata.className = "era-metadata";
  metadata.textContent = `Género: ${era.genre} · Estética: ${era.aesthetic} · Sencillo destacado: ${era.leadSingle}`;
  const visits = document.createElement("p");
  visits.className = "visit-count";
  visits.textContent = `Has visitado esta era ${visitCount} ${visitCount === 1 ? "vez" : "veces"}.`;

  const actions = document.createElement("div");
  actions.className = "form-actions";
  for (const [category, label] of [["era", "Era"], ["album", "Álbum"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-secondary favorite-button";
    button.setAttribute("aria-label", `Marcar ${label.toLowerCase()} ${era.name} como favorito`);
    await fanTools.updateFavoriteButton(button, category, era.key, era.name, era.key);
    actions.append(button);
  }

  const songsHeading = document.createElement("h4");
  songsHeading.textContent = `Canciones destacadas (${era.tracks.length})`;
  const songList = document.createElement("ol");
  songList.className = "track-list";
  for (const track of era.tracks) {
    const row = document.createElement("li");
    row.className = "track-row";
    const title = document.createElement("strong");
    title.textContent = track.title;
    const clue = document.createElement("p");
    clue.textContent = track.clue;
    const controls = document.createElement("div");
    controls.className = "form-actions";
    const youtubeLink = document.createElement("a");
    const youtubeQuery = new URLSearchParams({ search_query: `Taylor Swift ${era.name} ${track.title} official audio` });
    youtubeLink.href = `https://www.youtube.com/results?${youtubeQuery}`;
    youtubeLink.target = "_blank";
    youtubeLink.rel = "noopener noreferrer";
    youtubeLink.className = "song-youtube-link";
    youtubeLink.textContent = "Buscar y reproducir en YouTube";
    youtubeLink.setAttribute("aria-label", `Buscar ${track.title} de ${era.name} en YouTube`);
    const favorite = document.createElement("button");
    favorite.type = "button";
    favorite.className = "btn btn-secondary favorite-button";
    favorite.setAttribute("aria-label", `Marcar ${track.title} como favorita`);
    await fanTools.updateFavoriteButton(favorite, "song", `${era.key}:${track.title}`, track.title, era.key);
    const addToPlaylist = document.createElement("button");
    addToPlaylist.type = "button";
    addToPlaylist.className = "btn btn-secondary";
    addToPlaylist.dataset.addTrack = "true";
    addToPlaylist.textContent = "Añadir a playlist";
    addToPlaylist.disabled = $("#playlistPicker").disabled;
    addToPlaylist.addEventListener("click", () => fanTools.addTrackToPlaylist(track, era));
    controls.append(youtubeLink, favorite, addToPlaylist);
    row.append(title, clue, controls);
    songList.append(row);
  }
  details.replaceChildren(heading, description, metadata, visits, actions, songsHeading, songList);
  details.hidden = false;
}

// Restablece la portada biográfica y evita que una era elegida oculte el perfil al volver a Inicio.
// Restore the biography when the user returns to the home section.
function showHomeProfile() {
  root.style.setProperty("--c1", "#7b2ff7");
  root.style.setProperty("--c2", "#f107a3");
  $("#heroYear").textContent = homeProfile.year;
  $("#heroTitle").textContent = homeProfile.title;
  $("#heroText").textContent = homeProfile.text;
  $("#heroImage").src = homeProfile.image;
  $("#heroImage").alt = homeProfile.alt;
  $("#artistFacts").hidden = false;
  document.querySelectorAll(".card").forEach(card => {
    card.classList.remove("on");
    card.setAttribute("aria-pressed", "false");
  });
  $("#eraDetails").hidden = true;
  try {
    localStorage.removeItem("era");
  } catch (error) {
    console.warn("No se pudo limpiar la era seleccionada.", error);
  }
}

// Menú responsivo.
const burger = $("#burger");
const menu = $("#menu");
document.querySelectorAll('a[href="#inicio"]').forEach(link => {
  link.addEventListener("click", showHomeProfile);
});
burger.addEventListener("click", () => {
  const isOpen = menu.classList.toggle("open");
  burger.setAttribute("aria-expanded", String(isOpen));
});
menu.addEventListener("click", event => {
  if (event.target.closest("a")) {
    menu.classList.remove("open");
    burger.setAttribute("aria-expanded", "false");
  }
});

// Service worker: registra el nombre de archivo con la capitalización exacta para hosting sensible a mayúsculas.
if ("serviceWorker" in navigator) {
  addEventListener("load", () => {
    navigator.serviceWorker.register("./ServiceWorker.js", { updateViaCache: "none" }).catch(error => {
      console.error("No se pudo registrar el service worker.", error);
    });
  });
}

// Instalación PWA: usa el diálogo nativo cuando está disponible y explica alternativas.
let installPrompt;
const installButton = $("#installBtn");
const installHelp = $("#installHelp");

addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  installPrompt = event;
  installButton.textContent = "Instalar app";
  installHelp.textContent = "La aplicación está lista para instalarse en este dispositivo.";
});

installButton.addEventListener("click", async () => {
  if (!installPrompt) {
    installHelp.textContent = "Si no aparece la instalación automática, abre el menú del navegador y elige “Instalar aplicación” o “Agregar a pantalla de inicio”. La instalación requiere publicar la app en HTTPS (o usar localhost).";
    return;
  }

  installPrompt.prompt();
  const choice = await installPrompt.userChoice;
  installHelp.textContent = choice.outcome === "accepted"
    ? "Instalación aceptada. Busca Eras Puebla entre tus aplicaciones."
    : "La instalación se canceló. Puedes intentarlo de nuevo desde el menú del navegador.";
  installPrompt = null;
});

addEventListener("appinstalled", () => {
  installPrompt = null;
  installButton.hidden = true;
  installHelp.textContent = "Eras Puebla quedó instalada en este dispositivo.";
});
