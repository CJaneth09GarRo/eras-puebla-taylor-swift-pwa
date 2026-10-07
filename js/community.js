// Módulo de comunidad: autenticación, feed, reseñas, likes y galería de Fan Art.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

// Referencias DOM, catálogo compartido y límites de archivos para subidas.
const $ = selector => document.querySelector(selector);
const status = $("#communityStatus");
const validConfig = SUPABASE_URL.startsWith("https://")
  && !SUPABASE_URL.includes("TU-PROYECTO")
  && SUPABASE_ANON_KEY.length > 20
  && !SUPABASE_ANON_KEY.includes("PEGA_AQUI");
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "video/mp4", "video/webm"
]);
const albums = window.erasCatalog || [];

// Helpers de interfaz: muestran resultados, fechas y contenido como texto seguro.
function showStatus(message, state = "info") {
  status.textContent = message;
  status.dataset.state = state;
}

function addEmptyState(container, message) {
  const paragraph = document.createElement("p");
  paragraph.className = "empty-state";
  paragraph.textContent = message;
  container.replaceChildren(paragraph);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function profileName(record) {
  return record.profiles?.display_name || "Swiftie";
}

// Sin credenciales, la página pública funciona y explica cómo completar la integración.
if (!validConfig) {
  showStatus("La comunidad está lista para conectar, pero faltan SUPABASE_URL y SUPABASE_ANON_KEY en js/supabase-config.js.", "error");
  $("#authForm").hidden = true;
  document.querySelectorAll(".era-like").forEach(button => {
    button.disabled = true;
    button.title = "Configura Supabase para activar los me gusta.";
  });
  for (const selector of ["#communityFeed", "#reviewFeed", "#fanArtGallery"]) {
    addEmptyState($(selector), "Configura Supabase siguiendo los pasos de README.md para activar el contenido compartido.");
  }
} else {
  // Inicio del cliente: utiliza solo la clave pública protegida por las políticas RLS del esquema.
  import("https://esm.sh/@supabase/supabase-js@2").then(({ createClient }) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const authForm = $("#authForm");
  const postForm = $("#communityPostForm");
  const reviewForm = $("#reviewForm");
  const fanArtForm = $("#fanArtForm");
  const signOutButton = $("#signOutButton");
  const feeds = {
    posts: $("#communityFeed"),
    reviews: $("#reviewFeed"),
    fanArt: $("#fanArtGallery")
  };
  let activeUser = null;

  // Selector de álbumes: conserva la misma lista que las tarjetas de eras.
  const reviewAlbum = $("#reviewAlbum");
  for (const album of albums) {
    const option = document.createElement("option");
    option.value = album.key;
    option.textContent = album.n;
    reviewAlbum.append(option);
  }

  // Render de tarjetas del feed y reseñas sin interpretar contenido enviado por usuarios como HTML.
  function createCommunityEntry({ title, content, author, date, detail, onDelete }) {
    const article = document.createElement("article");
    article.className = "community-entry";
    const heading = document.createElement("h3");
    heading.textContent = title;
    const body = document.createElement("p");
    body.textContent = content;
    const metadata = document.createElement("div");
    metadata.className = "community-meta";
    const byline = document.createElement("span");
    byline.textContent = `${author} · ${formatDate(date)}`;
    metadata.append(byline);
    if (detail) {
      const badge = document.createElement("span");
      badge.textContent = detail;
      metadata.append(badge);
    }
    article.append(heading, body, metadata);
    if (onDelete) {
      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "btn btn-secondary";
      removeButton.textContent = "Eliminar mi publicación";
      removeButton.addEventListener("click", onDelete);
      article.append(removeButton);
    }
    return article;
  }

  // Lectura del feed, las reseñas y la galería: errores se muestran en la interfaz.
  async function loadPosts() {
    const { data, error } = await supabase
      .from("community_posts")
      .select("id,title,content,author_id,created_at,profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!data.length) return addEmptyState(feeds.posts, "Aún no hay publicaciones. ¡Anímate a iniciar la conversación!");
    feeds.posts.replaceChildren(...data.map(post => createCommunityEntry({
      title: post.title,
      content: post.content,
      author: profileName(post),
      date: post.created_at,
      onDelete: activeUser?.id === post.author_id ? () => deleteRecord("community_posts", post.id, loadPosts) : null
    })));
  }

  async function loadReviews() {
    const { data, error } = await supabase
      .from("album_reviews")
      .select("id,album_key,rating,content,author_id,created_at,profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    if (!data.length) return addEmptyState(feeds.reviews, "Aún no hay reseñas. Comparte qué disco te gusta y por qué.");
    const albumsByKey = new Map(albums.map(album => [album.key, album.n]));
    feeds.reviews.replaceChildren(...data.map(review => createCommunityEntry({
      title: albumsByKey.get(review.album_key) || review.album_key,
      content: review.content,
      author: profileName(review),
      date: review.created_at,
      detail: `${review.rating}/5 estrellas`,
      onDelete: activeUser?.id === review.author_id ? () => deleteRecord("album_reviews", review.id, loadReviews) : null
    })));
  }

  async function loadFanArt() {
    const { data, error } = await supabase
      .from("fan_art_posts")
      .select("id,title,description,media_path,media_type,author_id,created_at,profiles(display_name)")
      .order("created_at", { ascending: false })
      .limit(60);
    if (error) throw error;
    if (!data.length) return addEmptyState(feeds.fanArt, "La galería está vacía. ¡Comparte tu primera creación!");
    const cards = data.map(art => {
      const { data: media } = supabase.storage.from("fan-art").getPublicUrl(art.media_path);
      const article = document.createElement("article");
      article.className = "fan-art-entry";
      const heading = document.createElement("h3");
      heading.textContent = art.title;
      const mediaElement = document.createElement(art.media_type.startsWith("video/") ? "video" : "img");
      mediaElement.src = media.publicUrl;
      mediaElement.alt = art.media_type.startsWith("video/") ? "" : art.title;
      if (mediaElement instanceof HTMLVideoElement) mediaElement.controls = true;
      const description = document.createElement("p");
      description.textContent = art.description || "";
      const metadata = document.createElement("div");
      metadata.className = "community-meta";
      metadata.textContent = `${profileName(art)} · ${formatDate(art.created_at)}`;
      article.append(heading, mediaElement, description, metadata);
      if (activeUser?.id === art.author_id) {
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "btn btn-secondary";
        removeButton.textContent = "Eliminar mi obra";
        removeButton.addEventListener("click", () => deleteFanArt(art));
        article.append(removeButton);
      }
      return article;
    });
    feeds.fanArt.replaceChildren(...cards);
  }

  // Operación común para borrar contenido propio según las políticas de Supabase.
  async function deleteRecord(table, id, reload) {
    try {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      showStatus("Se eliminó tu contenido.", "success");
      await reload();
    } catch (error) {
      console.error("No se pudo eliminar el contenido.", error);
      showStatus(`No se pudo eliminar: ${error.message}`, "error");
    }
  }

  // Sincroniza datos públicos y datos que dependen de la sesión autenticada.
  async function refreshCommunity() {
    try {
      await Promise.all([loadPosts(), loadReviews(), loadFanArt(), refreshEraLikes()]);
    } catch (error) {
      console.error("No se pudo cargar la comunidad.", error);
      showStatus(`No se pudo cargar el contenido: ${error.message}`, "error");
    }
  }

  async function updateSession(session) {
    activeUser = session?.user || null;
    authForm.hidden = Boolean(activeUser);
    signOutButton.hidden = !activeUser;
    postForm.hidden = !activeUser;
    reviewForm.hidden = !activeUser;
    fanArtForm.hidden = !activeUser;
    showStatus(activeUser ? `Sesión iniciada como ${activeUser.user_metadata.display_name || activeUser.email}.` : "Inicia sesión para publicar, reseñar y dar me gusta.", "success");
    await refreshCommunity();
  }

  // Registro e inicio de sesión por correo y contraseña.
  authForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(authForm);
    const email = String(formData.get("email")).trim();
    const password = String(formData.get("password"));
    const action = event.submitter?.value;
    try {
      const result = action === "signup"
        ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: String(formData.get("displayName")).trim() || "Swiftie" } }
        })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (action === "signup" && !result.data.session) {
        showStatus("Cuenta creada. Revisa tu correo para confirmar la dirección antes de iniciar sesión.", "success");
      } else {
        authForm.reset();
      }
    } catch (error) {
      console.error("No se pudo completar la autenticación.", error);
      showStatus(`No se pudo completar la autenticación: ${error.message}`, "error");
    }
  });

  signOutButton.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("No se pudo cerrar la sesión.", error);
      showStatus(`No se pudo cerrar la sesión: ${error.message}`, "error");
    }
  });

  // Creación de publicaciones de texto para el feed comunitario.
  postForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(postForm);
    try {
      const { error } = await supabase.from("community_posts").insert({
        author_id: activeUser.id,
        title: String(formData.get("title")).trim(),
        content: String(formData.get("content")).trim()
      });
      if (error) throw error;
      postForm.reset();
      await loadPosts();
      showStatus("Tu publicación ya está en el feed.", "success");
    } catch (error) {
      console.error("No se pudo publicar el mensaje.", error);
      showStatus(`No se pudo publicar: ${error.message}`, "error");
    }
  });

  // Creación de reseñas: el rango de estrellas también está validado por la base de datos.
  reviewForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(reviewForm);
    try {
      const { error } = await supabase.from("album_reviews").insert({
        author_id: activeUser.id,
        album_key: String(formData.get("album")),
        rating: Number(formData.get("rating")),
        content: String(formData.get("review")).trim()
      });
      if (error) throw error;
      reviewForm.reset();
      await loadReviews();
      showStatus("Tu reseña se publicó correctamente.", "success");
    } catch (error) {
      console.error("No se pudo publicar la reseña.", error);
      showStatus(`No se pudo publicar la reseña: ${error.message}`, "error");
    }
  });

  // Subida de Fan Art: valida tamaño y MIME, guarda el archivo y registra sus metadatos.
  fanArtForm.addEventListener("submit", async event => {
    event.preventDefault();
    const formData = new FormData(fanArtForm);
    const file = formData.get("media");
    if (!(file instanceof File) || !ACCEPTED_TYPES.has(file.type)) {
      return showStatus("Selecciona una imagen JPG, PNG, WEBP o GIF, o un video MP4 o WEBM.", "error");
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return showStatus("El archivo supera el límite de 25 MB.", "error");
    }
    const extension = file.name.split(".").pop()?.toLowerCase() || "bin";
    const mediaPath = `${activeUser.id}/${crypto.randomUUID()}.${extension}`;
    showStatus("Subiendo tu obra…", "info");
    try {
      const { error: uploadError } = await supabase.storage.from("fan-art").upload(mediaPath, file, {
        contentType: file.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("fan_art_posts").insert({
        author_id: activeUser.id,
        title: String(formData.get("title")).trim(),
        description: String(formData.get("description")).trim(),
        media_path: mediaPath,
        media_type: file.type
      });
      if (insertError) {
        await supabase.storage.from("fan-art").remove([mediaPath]);
        throw insertError;
      }
      fanArtForm.reset();
      await loadFanArt();
      showStatus("Tu Fan Art ya aparece en la galería.", "success");
    } catch (error) {
      console.error("No se pudo subir el Fan Art.", error);
      showStatus(`No se pudo subir el archivo: ${error.message}`, "error");
    }
  });

  // Elimina la ficha y el archivo de almacenamiento de una obra del usuario actual.
  async function deleteFanArt(art) {
    try {
      const { error: rowError } = await supabase.from("fan_art_posts").delete().eq("id", art.id);
      if (rowError) throw rowError;
      const { error: fileError } = await supabase.storage.from("fan-art").remove([art.media_path]);
      if (fileError) throw fileError;
      await loadFanArt();
      showStatus("Se eliminó tu obra de la galería.", "success");
    } catch (error) {
      console.error("No se pudo eliminar el Fan Art.", error);
      showStatus(`No se pudo eliminar la obra: ${error.message}`, "error");
    }
  }

  // Actualiza conteos públicos y el estado de me gusta para el usuario conectado.
  async function refreshEraLikes() {
    const [{ data: serverCounts, error: countError }, { data: ownLikes, error: likesError }] = await Promise.all([
      supabase.rpc("get_era_like_counts"),
      activeUser
        ? supabase.from("era_likes").select("era_key").eq("user_id", activeUser.id)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (countError) throw countError;
    if (likesError) throw likesError;
    const likedEras = new Set(ownLikes.map(like => like.era_key));
    const countMap = new Map();
    for (const like of serverCounts) countMap.set(like.era_key, like.like_count);
    document.querySelectorAll(".era-like").forEach(button => {
      const liked = likedEras.has(button.dataset.eraKey);
      button.querySelector(".like-count").textContent = String(countMap.get(button.dataset.eraKey) || 0);
      button.setAttribute("aria-pressed", String(liked));
      button.title = activeUser ? "Cambiar me gusta" : "Inicia sesión para dar me gusta";
    });
  }

  document.querySelectorAll(".era-like").forEach(button => {
    button.addEventListener("click", async () => {
      if (!activeUser) {
        showStatus("Inicia sesión para votar por tus eras favoritas.", "error");
        $("#comunidad").scrollIntoView({ behavior: "smooth" });
        return;
      }
      button.disabled = true;
      const alreadyLiked = button.getAttribute("aria-pressed") === "true";
      try {
        const result = alreadyLiked
          ? await supabase.from("era_likes").delete().eq("era_key", button.dataset.eraKey).eq("user_id", activeUser.id)
          : await supabase.from("era_likes").insert({ era_key: button.dataset.eraKey, user_id: activeUser.id });
        if (result.error) throw result.error;
        await refreshEraLikes();
      } catch (error) {
        console.error("No se pudo actualizar el me gusta.", error);
        showStatus(`No se pudo actualizar el voto: ${error.message}`, "error");
      } finally {
        button.disabled = false;
      }
    });
  });

  // Sesión inicial y cambios entre inicio/cierre de sesión.
  supabase.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      updateSession(session).catch(error => {
        console.error("No se pudo actualizar la sesión de comunidad.", error);
        showStatus(`No se pudo actualizar la sesión: ${error.message}`, "error");
      });
    }, 0);
  });
  supabase.auth.getSession().then(({ data, error }) => {
    if (error) throw error;
    return updateSession(data.session);
  }).catch(error => {
    console.error("No se pudo recuperar la sesión.", error);
    showStatus(`No se pudo recuperar la sesión: ${error.message}`, "error");
  });
  }).catch(error => {
    console.error("No se pudo cargar el cliente de Supabase.", error);
    showStatus("No se pudo cargar la comunidad. Revisa tu conexión a internet y vuelve a intentarlo.", "error");
  });
}
