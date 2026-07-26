const CACHE_NAME = "arranjo-campo-v1.4.3";

const FILES_TO_CACHE = [
  "./index.html",
  "./login.html",
  "./Cadastro.html",
  "./Registro_S13.html",
  "./S_13.html",
  "./manifest.json",

  // JS principal
  "./js/index.js",
  "./js/home.js",
  "./js/Cadastro.js",
  "./js/Firebaseconfig.js",
  "./js/generatePdf.js",
  "./js/Registro_S13.js",
  "./js/S_13.js",
  "./js/UnifiedDataManager.js",

  // Painel
  "./Painel/painel.html",
  "./Painel/gerenciamento_escala.html",
  "./Painel/script.js",
  "./Painel/style.css",

  // Território
  "./Territorio/index_territorio.html",
  "./Territorio/Mapa.html",
  "./Territorio/especial.html",
  "./Territorio/imprimir.html",
  "./Territorio/view_progamacao.html",
  "./Territorio/Index.js",
  "./Territorio/Prog_campo.js",
  "./Territorio/tela_cheia.js",
  "./Territorio/mapas_territorio.js",
  "./Territorio/view_progamacao.js",
  "./Territorio/imprimir.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] Cacheando arquivos");
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Não interceptar requisições Firebase / Google APIs (precisam de rede)
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("firestore") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("gstatic")
  ) {
    return;
  }

  // Cache-first: serve do cache, senão busca na rede e armazena
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Fallback para navegação offline: retorna index.html
        if (event.request.mode === "navigate") {
          return caches.match("./index.html");
        }
      });
    })
  );
});
