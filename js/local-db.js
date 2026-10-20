// Persistencia privada del dispositivo: no se envía al backend ni se sincroniza entre navegadores.
const DATABASE_NAME = "eras-puebla-fan";
const DATABASE_VERSION = 1;
const STORE_NAMES = new Set([
  "settings",
  "eraVisits",
  "favorites",
  "quizScores",
  "timerSessions",
  "playlists",
  "guessedSongs"
]);

let databasePromise;

// Abre IndexedDB y crea las colecciones de la app si es la primera visita.
function openDatabase() {
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const definitions = {
        settings: { keyPath: "key" },
        eraVisits: { keyPath: "eraKey" },
        favorites: { keyPath: "id" },
        quizScores: { keyPath: "id", autoIncrement: true },
        timerSessions: { keyPath: "id", autoIncrement: true },
        playlists: { keyPath: "id" },
        guessedSongs: { keyPath: "songId" }
      };

      for (const [name, options] of Object.entries(definitions)) {
        if (!database.objectStoreNames.contains(name)) database.createObjectStore(name, options);
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error("No se pudo abrir IndexedDB."));
    request.onblocked = () => reject(new Error("Cierra otras pestañas de la PWA para actualizar IndexedDB."));
  }).catch(error => {
    databasePromise = null;
    throw error;
  });

  return databasePromise;
}

// Resuelve solo cuando termina la transacción, para no mostrar escrituras incompletas.
async function transact(storeName, mode, operation) {
  if (!STORE_NAMES.has(storeName)) throw new Error("Colección local desconocida.");
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    let result;
    transaction.oncomplete = () => {
      resolve(result instanceof IDBRequest ? result.result : result);
    };
    transaction.onerror = () => reject(transaction.error || new Error("Falló una operación local."));
    transaction.onabort = () => reject(transaction.error || new Error("Se canceló una operación local."));

    try {
      result = operation(transaction.objectStore(storeName), transaction);
    } catch (error) {
      transaction.abort();
      reject(error);
    }
  });
}

export const localDb = {
  get(storeName, key) {
    return transact(storeName, "readonly", store => store.get(key));
  },

  getAll(storeName) {
    return transact(storeName, "readonly", store => store.getAll());
  },

  put(storeName, record) {
    return transact(storeName, "readwrite", store => store.put(record));
  },

  add(storeName, record) {
    return transact(storeName, "readwrite", store => store.add(record));
  },

  delete(storeName, key) {
    return transact(storeName, "readwrite", store => store.delete(key));
  },

  // Incrementa un contador en la misma transacción para evitar perder visitas simultáneas.
  recordEraVisit(eraKey) {
    return openDatabase().then(database => new Promise((resolve, reject) => {
      const transaction = database.transaction("eraVisits", "readwrite");
      const store = transaction.objectStore("eraVisits");
      let updated;
      const request = store.get(eraKey);
      request.onsuccess = () => {
        updated = {
          eraKey,
          count: (request.result?.count || 0) + 1,
          lastVisitedAt: new Date().toISOString()
        };
        store.put(updated);
      };
      transaction.oncomplete = () => resolve(updated);
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar la visita."));
      transaction.onabort = () => reject(transaction.error || new Error("Se canceló el registro de visita."));
    }));
  },

  // Guarda o quita un favorito, identificado por categoría y elemento.
  toggleFavorite(category, itemId, title, eraKey = null) {
    const id = `${category}:${itemId}`;
    return openDatabase().then(database => new Promise((resolve, reject) => {
      const transaction = database.transaction("favorites", "readwrite");
      const store = transaction.objectStore("favorites");
      let isFavorite = false;
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          store.delete(id);
        } else {
          store.put({ id, category, itemId, title, eraKey, createdAt: new Date().toISOString() });
          isFavorite = true;
        }
      };
      transaction.oncomplete = () => resolve(isFavorite);
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo actualizar el favorito."));
      transaction.onabort = () => reject(transaction.error || new Error("Se canceló el favorito."));
    }));
  },

  // Mantiene intentos y aciertos por canción para las estadísticas del reto.
  recordGuess(songId, title, correct) {
    return openDatabase().then(database => new Promise((resolve, reject) => {
      const transaction = database.transaction("guessedSongs", "readwrite");
      const store = transaction.objectStore("guessedSongs");
      let updated;
      const request = store.get(songId);
      request.onsuccess = () => {
        updated = {
          songId,
          title,
          attempts: (request.result?.attempts || 0) + 1,
          correctCount: (request.result?.correctCount || 0) + Number(correct),
          lastPlayedAt: new Date().toISOString()
        };
        store.put(updated);
      };
      transaction.oncomplete = () => resolve(updated);
      transaction.onerror = () => reject(transaction.error || new Error("No se pudo guardar el intento."));
      transaction.onabort = () => reject(transaction.error || new Error("Se canceló el intento."));
    }));
  },

  // Exporta una copia legible de todas las colecciones locales.
  async exportAll() {
    const names = [...STORE_NAMES];
    const entries = await Promise.all(names.map(async name => [name, await localDb.getAll(name)]));
    return Object.fromEntries(entries);
  }
};