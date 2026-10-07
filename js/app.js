// Catálogo: el mismo identificador se usa en las tarjetas, las reseñas y la tabla de likes.
const ERAS = [
  { key: "taylor-swift", n: "Taylor Swift", y: 2006, a: "#6d8b48", b: "#273b2b", t: "El álbum debut country que presentó su voz de compositora.", image: "taylor-swift.svg", alt: "Ilustración campestre verde inspirada en Taylor Swift" },
  { key: "fearless", n: "Fearless", y: 2008, a: "#f5c542", b: "#9a5c12", t: "Romance adolescente, brillo dorado y cuentos de hadas hechos canción.", image: "fearless.svg", alt: "Ilustración dorada inspirada en Fearless" },
  { key: "speak-now", n: "Speak Now", y: 2010, a: "#b274d2", b: "#45205f", t: "Un álbum escrito por ella, rodeado de tonos morados y trazos dramáticos.", image: "speak-now.svg", alt: "Ilustración morada inspirada en Speak Now" },
  { key: "red", n: "Red", y: 2012, a: "#d83a42", b: "#601b27", t: "Emociones intensas, labios rojos y una mezcla de country, rock y pop.", image: "red.svg", alt: "Ilustración roja inspirada en Red" },
  { key: "1989", n: "1989", y: 2014, a: "#66b6d8", b: "#254b73", t: "Su salto al pop: cielo azul, estética Polaroid y sintetizadores.", image: "1989.svg", alt: "Ilustración azul inspirada en 1989" },
  { key: "reputation", n: "reputation", y: 2017, a: "#777777", b: "#171717", t: "Blanco y negro, tipografía de periódico y una era de reinvención.", image: "reputation.svg", alt: "Ilustración monocromática inspirada en reputation" },
  { key: "lover", n: "Lover", y: 2019, a: "#ff8ad8", b: "#6ec6ff", t: "Cielos pastel, colores brillantes y canciones sobre el amor.", image: "lover.svg", alt: "Ilustración pastel inspirada en Lover" },
  { key: "folklore", n: "folklore", y: 2020, a: "#9aa59a", b: "#303a36", t: "Bosques neblinosos y relatos íntimos de indie folk.", image: "folklore.svg", alt: "Ilustración de bosque neblinoso inspirada en folklore" },
  { key: "evermore", n: "evermore", y: 2020, a: "#c87943", b: "#493029", t: "Un paisaje otoñal y narraciones que continúan el universo folk.", image: "evermore.svg", alt: "Ilustración otoñal inspirada en evermore" },
  { key: "midnights", n: "Midnights", y: 2022, a: "#5966a9", b: "#111936", t: "Noches de insomnio, luz de luna y synth-pop introspectivo.", image: "midnights.svg", alt: "Ilustración nocturna inspirada en Midnights" },
  { key: "tortured-poets", n: "The Tortured Poets Department", y: 2024, a: "#d7cabb", b: "#625e60", t: "Una estética literaria de papel, tinta y poemas en blanco y negro.", image: "tortured-poets.svg", alt: "Ilustración de papel y tinta inspirada en The Tortured Poets Department" },
  { key: "showgirl", n: "The Life of a Showgirl", y: 2025, a: "#f05b83", b: "#116b75", t: "Luces teatrales, telones y brillo de escenario en tonos vibrantes.", image: "showgirl.svg", alt: "Ilustración teatral inspirada en The Life of a Showgirl" }
];

// Utilidades y referencias a elementos compartidos por la página.
const $ = selector => document.querySelector(selector);
const root = document.documentElement;
const grid = $("#erasGrid");
const imageBase = "assets/img/eras/";
const homeProfile = {
  year: "De Nashville a la cima del mundo",
  title: "Taylor Swift",
  text: "Cantautora, productora, directora y empresaria estadounidense. Desde Nashville hasta la cima del mundo, ha construido una carrera que cruza géneros y generaciones.",
  image: "assets/img/taylor-midnights.jpg",
  alt: "Taylor Swift en una fotografía promocional de Midnights"
};
window.erasCatalog = ERAS;

// Render de tarjetas: la selección de era y el botón de me gusta son acciones independientes.
ERAS.forEach((era, index) => {
  const article = document.createElement("article");
  article.className = "era-card";
  const button = document.createElement("button");
  button.className = "card";
  button.type = "button";
  button.style.setProperty("--a", era.a);
  button.style.setProperty("--b", era.b);
  button.setAttribute("aria-label", `Ver la era ${era.n}, ${era.y}`);
  button.innerHTML = `<img src="${imageBase}${era.image}" alt="${era.alt}" loading="lazy"><span class="card-copy"><b>${era.n}</b><span>${era.y}</span></span>`;
  button.addEventListener("click", () => setEra(index));
  const likeButton = document.createElement("button");
  likeButton.className = "era-like";
  likeButton.type = "button";
  likeButton.dataset.eraKey = era.key;
  likeButton.setAttribute("aria-label", `Me gusta la era ${era.n}`);
  likeButton.setAttribute("aria-pressed", "false");
  likeButton.innerHTML = `<span aria-hidden="true">♡</span> <span class="like-count">0</span>`;
  article.append(button, likeButton);
  grid.appendChild(article);
});

// Selección de era: actualiza colores, portada, texto y preferencia local.
function setEra(index) {
  const era = ERAS[index];
  if (!era) return;

  root.style.setProperty("--c1", era.a);
  root.style.setProperty("--c2", era.b);
  $("#heroYear").textContent = `Era ${era.y}`;
  $("#heroTitle").textContent = era.n;
  $("#heroText").textContent = era.t;
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
}

// Restablece la portada biográfica y evita que una era elegida oculte el perfil al volver a Inicio.
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
    navigator.serviceWorker.register("./ServiceWorker.js").catch(error => {
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
