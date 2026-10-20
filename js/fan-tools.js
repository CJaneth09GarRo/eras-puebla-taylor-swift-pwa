// Herramientas personales: todo lo que se escribe aquí permanece en IndexedDB local.
import { localDb } from "./local-db.js";

const $ = selector => document.querySelector(selector);
const formatListeningTime = seconds => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  if (hours) return `${hours} h ${minutes} min`;
  if (minutes) return remainder ? `${minutes} min ${remainder} s` : `${minutes} min`;
  return `${remainder} s`;
};
let eras = [];
let quizSession = null;
let guessSong = null;
let timerInterval = null;
let timerState = null;

// Normaliza respuestas para no penalizar mayúsculas, tildes o puntuación.
function normalizeAnswer(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Mezcla preguntas sin modificar el catálogo recibido desde SQLite.
function shuffled(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(Math.random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function makeButton(label, className, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

// Switch one personal tool panel at a time and keep the tab state accessible.
function activateToolTab(panelId, moveFocus = false, updateHash = false) {
  const selectedTab = document.querySelector(`[data-tool-tab="${CSS.escape(panelId)}"]`);
  if (!selectedTab) return;

  document.querySelectorAll("[data-tool-tab]").forEach(tab => {
    const selected = tab === selectedTab;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  document.querySelectorAll(".tool-panel[role=tabpanel]").forEach(panel => {
    panel.hidden = panel.id !== panelId;
  });

  if (moveFocus) selectedTab.focus();
  if (updateHash) history.replaceState(null, "", `${location.pathname}${location.search}#${panelId}`);
}

// Supports pointer, keyboard arrow navigation, and links directly to a tool panel.
function initToolTabs() {
  const tabs = [...document.querySelectorAll("[data-tool-tab]")];
  const tabList = document.querySelector('[role="tablist"]');
  tabs.forEach(tab => tab.addEventListener("click", () => activateToolTab(tab.dataset.toolTab, false, true)));
  tabList.addEventListener("keydown", event => {
    const currentIndex = tabs.indexOf(document.activeElement);
    if (currentIndex < 0) return;
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;
    else return;
    event.preventDefault();
    activateToolTab(tabs[nextIndex].dataset.toolTab, true, true);
  });

  window.addEventListener("hashchange", () => {
    const panelId = location.hash.slice(1);
    if (tabs.some(tab => tab.dataset.toolTab === panelId)) activateToolTab(panelId);
  });

  const initialPanel = location.hash.slice(1);
  if (tabs.some(tab => tab.dataset.toolTab === initialPanel)) activateToolTab(initialPanel);
}

// Resume las cantidades guardadas y permite abrir una copia JSON descargable.
async function refreshLocalSummary() {
  const records = await localDb.exportAll();
  const visits = records.eraVisits.reduce((sum, visit) => sum + visit.count, 0);
  const favorites = records.favorites.length;
  const quizBest = records.quizScores.reduce((best, quiz) => Math.max(best, quiz.score), 0);
  const listeningSeconds = records.timerSessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  $("#localDbSummary").textContent =
    `IndexedDB local: ${records.eraVisits.length} eras visitadas (${visits} visitas), ${favorites} favoritos, ` +
    `${records.quizScores.length} quizzes guardados (mejor: ${quizBest}/10), ` +
    `${formatListeningTime(listeningSeconds)} de escucha y ${records.playlists.length} playlists.`;
  if ($("#localDataDetails").open) $("#localDbDump").textContent = JSON.stringify(records, null, 2);
}

// Muestra los favoritos por categoría y mantiene el contador sincronizado al borrar.
async function refreshFavorites() {
  const favorites = await localDb.getAll("favorites");
  const counts = { era: 0, album: 0, song: 0 };
  favorites.forEach(favorite => { counts[favorite.category] = (counts[favorite.category] || 0) + 1; });
  $("#favoriteCounts").textContent =
    `Eras: ${counts.era} · Álbumes: ${counts.album} · Canciones: ${counts.song} · Total: ${favorites.length}`;

  const list = $("#favoriteList");
  list.replaceChildren();
  if (!favorites.length) {
    list.textContent = "Todavía no guardas favoritos.";
    return;
  }

  for (const favorite of favorites) {
    const row = document.createElement("div");
    row.className = "saved-row";
    const label = document.createElement("span");
    label.textContent = `${favorite.title} · ${favorite.category}`;
    row.append(label, makeButton("Quitar", "btn btn-secondary", async () => {
      await localDb.delete("favorites", favorite.id);
      await refreshFavorites();
      await refreshLocalSummary();
      document.querySelectorAll(`[data-favorite-id="${CSS.escape(favorite.id)}"]`).forEach(button => {
        button.setAttribute("aria-pressed", "false");
        button.textContent = "♡ Favorito";
      });
    }));
    list.append(row);
  }
}

// Actualiza botones de favorito del detalle de era después de cada cambio.
async function updateFavoriteButton(button, category, itemId, title, eraKey) {
  const favoriteId = `${category}:${itemId}`;
  const favorite = await localDb.get("favorites", favoriteId);
  button.dataset.favoriteId = favoriteId;
  button.setAttribute("aria-pressed", String(Boolean(favorite)));
  button.textContent = favorite ? "♥ Favorito" : "♡ Favorito";
  button.addEventListener("click", async () => {
    const saved = await localDb.toggleFavorite(category, itemId, title, eraKey);
    button.setAttribute("aria-pressed", String(saved));
    button.textContent = saved ? "♥ Favorito" : "♡ Favorito";
    await refreshFavorites();
    await refreshLocalSummary();
  });
}

// Construye las opciones de era para quiz y playlist.
function populateEraPicker() {
  const select = $("#quizEra");
  select.replaceChildren();
  for (const era of eras) {
    const option = document.createElement("option");
    option.value = era.key;
    option.textContent = era.name;
    select.append(option);
  }
}

// Muestra el récord del usuario para la era seleccionada.
async function refreshQuizBest() {
  const eraKey = $("#quizEra").value;
  const era = eras.find(item => item.key === eraKey);
  const scores = (await localDb.getAll("quizScores")).filter(score => score.eraKey === eraKey);
  const best = Math.max(0, ...scores.map(score => score.score));
  $("#quizBest").textContent = `Tu mejor puntaje en quizzes de ${era?.name || "esta era"} es ${best}/10 (${scores.length} intentos).`;
}

function showQuizQuestion() {
  const question = quizSession.questions[quizSession.index];
  $("#quizProgress").textContent = `Pregunta ${quizSession.index + 1} de ${quizSession.questions.length} · Puntaje: ${quizSession.score}`;
  $("#quizClue").textContent = question.clue;
  $("#quizAnswer").value = "";
  $("#quizAnswer").focus();
}

// Guarda cada quiz de diez canciones y vuelve a mostrar el récord actualizado.
async function finishQuiz() {
  const result = { eraKey: quizSession.eraKey, score: quizSession.score, total: quizSession.questions.length, completedAt: new Date().toISOString() };
  await localDb.add("quizScores", result);
  quizSession = null;
  $("#quizForm").hidden = true;
  $("#quizResult").textContent = `Quiz terminado: ${result.score}/${result.total}.`;
  await refreshQuizBest();
  await refreshLocalSummary();
}

// Recupera minutos sumados desde sesiones completas y actualiza el panel.
async function refreshTimerTotal() {
  const sessions = await localDb.getAll("timerSessions");
  const seconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  $("#timerTotal").textContent = `Tiempo total: ${formatListeningTime(seconds)} · ${sessions.length} sesiones`;
  return seconds;
}

function renderTimer(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, "0");
  const remainder = String(safeSeconds % 60).padStart(2, "0");
  $("#timerDisplay").textContent = `${minutes}:${remainder}`;
}

// Termina una sesión una sola vez y persiste los segundos realmente transcurridos.
async function stopTimer(saveSession) {
  if (!timerState) return;
  clearInterval(timerInterval);
  timerInterval = null;
  const state = timerState;
  timerState = null;
  await localDb.delete("settings", "activeTimer");
  const elapsed = Math.min(state.durationSeconds, Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000)));
  if (saveSession && elapsed > 0) {
    await localDb.add("timerSessions", { startedAt: new Date(state.startedAt).toISOString(), durationSeconds: elapsed });
  }
  $("#startTimer").hidden = false;
  $("#stopTimer").hidden = true;
  await refreshTimerTotal();
  await refreshLocalSummary();
}

function tickTimer() {
  if (!timerState) return;
  const remaining = Math.ceil((timerState.endsAt - Date.now()) / 1000);
  renderTimer(remaining);
  if (remaining <= 0) stopTimer(true);
}

// Reanuda la sesión guardada tras una recarga y permite detenerla manualmente.
async function startTimer() {
  const minutes = Number($("#timerMinutes").value);
  if (!Number.isFinite(minutes) || minutes < 1 || minutes > 180) {
    $("#timerTotal").textContent = "Elige entre 1 y 180 minutos.";
    return;
  }
  const startedAt = Date.now();
  timerState = { startedAt, durationSeconds: Math.round(minutes * 60), endsAt: startedAt + minutes * 60_000 };
  await localDb.put("settings", { key: "activeTimer", ...timerState });
  $("#startTimer").hidden = true;
  $("#stopTimer").hidden = false;
  tickTimer();
  timerInterval = setInterval(tickTimer, 1000);
}

async function resumeTimer() {
  const saved = await localDb.get("settings", "activeTimer");
  if (!saved) return;
  timerState = { startedAt: saved.startedAt, durationSeconds: saved.durationSeconds, endsAt: saved.endsAt };
  if (timerState.endsAt <= Date.now()) return stopTimer(true);
  $("#startTimer").hidden = true;
  $("#stopTimer").hidden = false;
  tickTimer();
  timerInterval = setInterval(tickTimer, 1000);
}

// Renderiza playlists y botones para retirar canciones o eliminar una lista.
async function refreshPlaylists() {
  const playlists = await localDb.getAll("playlists");
  const list = $("#playlistList");
  const picker = $("#playlistPicker");
  list.replaceChildren();
  picker.replaceChildren();
  for (const playlist of playlists) {
    const option = document.createElement("option");
    option.value = playlist.id;
    option.textContent = playlist.name;
    picker.append(option);

    const panel = document.createElement("section");
    panel.className = "playlist-entry";
    const heading = document.createElement("h4");
    const songWord = playlist.tracks.length === 1 ? "canción" : "canciones";
    heading.textContent = `${playlist.name} · ${playlist.tracks.length} ${songWord}`;
    const renameForm = document.createElement("form");
    renameForm.className = "playlist-name-form";
    const nameInput = document.createElement("input");
    nameInput.value = playlist.name;
    nameInput.maxLength = 60;
    nameInput.setAttribute("aria-label", `Nuevo nombre para ${playlist.name}`);
    nameInput.required = true;
    const renameButton = document.createElement("button");
    renameButton.type = "submit";
    renameButton.className = "btn btn-secondary";
    renameButton.textContent = "Guardar nombre";
    renameForm.append(nameInput, renameButton);
    renameForm.addEventListener("submit", async event => {
      event.preventDefault();
      playlist.name = nameInput.value.trim().slice(0, 60);
      if (!playlist.name) return;
      await localDb.put("playlists", playlist);
      await refreshPlaylists();
    });
    panel.append(heading, renameForm);
    for (const track of playlist.tracks) {
      const row = document.createElement("div");
      row.className = "saved-row";
      const title = document.createElement("span");
      title.textContent = `${track.title} · ${track.eraName}`;
      row.append(title, makeButton("Quitar canción", "btn btn-secondary", async () => {
        playlist.tracks = playlist.tracks.filter(item => item.id !== track.id);
        await localDb.put("playlists", playlist);
        await refreshPlaylists();
        await refreshLocalSummary();
      }));
      panel.append(row);
    }
    panel.append(makeButton("Eliminar playlist", "btn btn-secondary", async () => {
      await localDb.delete("playlists", playlist.id);
      await refreshPlaylists();
      await refreshLocalSummary();
    }));
    list.append(panel);
  }
  $("#playlistPicker").disabled = playlists.length === 0;
  document.querySelectorAll("[data-add-track]").forEach(button => { button.disabled = playlists.length === 0; });
  if (!playlists.length) list.textContent = "Crea una playlist para empezar a añadir canciones.";
}

// Añade una canción al destino elegido y evita duplicados dentro de una playlist.
async function addTrackToPlaylist(track, era) {
  const playlistId = $("#playlistPicker").value;
  const playlist = await localDb.get("playlists", playlistId);
  if (!playlist) return;
  const item = { id: `${era.key}:${track.title}`, title: track.title, eraKey: era.key, eraName: era.name };
  if (playlist.tracks.some(saved => saved.id === item.id)) {
    $("#playlistStatus").textContent = "Esa canción ya está en la playlist.";
    return;
  }
  playlist.tracks.push(item);
  await localDb.put("playlists", playlist);
  $("#playlistStatus").textContent = `Se añadió ${track.title} a ${playlist.name}.`;
  await refreshPlaylists();
  await refreshLocalSummary();
}

// Crea un reto con una pista original y registra intentos y aciertos.
function startGuess() {
  const songs = eras.flatMap(era => era.tracks.map(track => ({ ...track, eraKey: era.key, eraName: era.name })));
  guessSong = songs[Math.floor(Math.random() * songs.length)];
  $("#guessClue").textContent = `${guessSong.eraName}: ${guessSong.clue}`;
  $("#guessResult").textContent = "";
  $("#guessAnswer").value = "";
  $("#guessForm").hidden = false;
  $("#guessAnswer").focus();
}

async function refreshGuessStats() {
  const songs = await localDb.getAll("guessedSongs");
  const attempts = songs.reduce((sum, song) => sum + song.attempts, 0);
  const correctAnswers = songs.reduce((sum, song) => sum + song.correctCount, 0);
  const correct = songs.filter(song => song.correctCount > 0);
  $("#guessStats").textContent = `Aciertos: ${correctAnswers} · ${correct.length} canciones distintas · ${attempts} intentos`;
}

// Descarga una instantánea de todas las colecciones para inspección o respaldo manual.
async function exportLocalData() {
  const payload = await localDb.exportAll();
  const file = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = `eras-puebla-datos-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  $("#exportStatus").textContent = "Copia JSON descargada.";
}

// Conecta formularios y render inicial cuando el catálogo de SQLite está disponible.
export async function initFanTools(catalog) {
  eras = catalog;
  initToolTabs();
  populateEraPicker();
  $("#quizEra").addEventListener("change", refreshQuizBest);
  $("#startQuiz").addEventListener("click", () => {
    const era = eras.find(item => item.key === $("#quizEra").value);
    if (!era || era.tracks.length < 10) {
      $("#quizResult").textContent = "Esta era todavía no tiene diez canciones para el quiz.";
      return;
    }
    quizSession = { eraKey: era.key, questions: shuffled(era.tracks).slice(0, 10), index: 0, score: 0 };
    $("#quizResult").textContent = "";
    $("#quizForm").hidden = false;
    showQuizQuestion();
  });
  $("#quizForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!quizSession) return;
    const question = quizSession.questions[quizSession.index];
    const correct = normalizeAnswer($("#quizAnswer").value) === normalizeAnswer(question.title);
    if (correct) quizSession.score++;
    $("#quizResult").textContent = correct ? "¡Correcto!" : `La respuesta era ${question.title}.`;
    quizSession.index++;
    if (quizSession.index === quizSession.questions.length) await finishQuiz();
    else showQuizQuestion();
  });
  $("#startTimer").addEventListener("click", startTimer);
  $("#stopTimer").addEventListener("click", () => stopTimer(true));
  $("#playlistForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const name = $("#playlistName").value.trim();
    if (!name) return;
    await localDb.put("playlists", { id: crypto.randomUUID(), name: name.slice(0, 60), tracks: [], createdAt: new Date().toISOString() });
    form.reset();
    await refreshPlaylists();
    await refreshLocalSummary();
  });
  $("#newGuess").addEventListener("click", startGuess);
  $("#guessForm").addEventListener("submit", async event => {
    event.preventDefault();
    if (!guessSong) return;
    const correct = normalizeAnswer($("#guessAnswer").value) === normalizeAnswer(guessSong.title);
    await localDb.recordGuess(`${guessSong.eraKey}:${guessSong.title}`, guessSong.title, correct);
    $("#guessResult").textContent = correct
      ? `¡Correcto! Era ${guessSong.title} (${guessSong.eraName}).`
      : "No es esa. Puedes volver a intentarlo o pedir una pista nueva.";
    if (correct) $("#guessForm").hidden = true;
    await refreshGuessStats();
    await refreshLocalSummary();
  });
  $("#exportLocalData").addEventListener("click", exportLocalData);
  $("#localDataDetails").addEventListener("toggle", async () => {
    if ($("#localDataDetails").open) {
      $("#localDbDump").textContent = JSON.stringify(await localDb.exportAll(), null, 2);
    }
  });
  $("#quizForm").hidden = true;
  $("#guessForm").hidden = true;
  await Promise.all([refreshFavorites(), refreshQuizBest(), refreshTimerTotal(), refreshPlaylists(), refreshGuessStats(), refreshLocalSummary(), resumeTimer()]);

  return {
    refreshFavorites,
    refreshLocalSummary,
    updateFavoriteButton,
    refreshPlaylists,
    addTrackToPlaylist
  };
}