/* Programa de fondo de la app Dentaly: guarda el "cascarón" (esta pantalla y
   el ícono) para que abra al instante. Los datos siempre vienen del sistema. */
var CACHE = 'dentaly-app-v18';
var ARCHIVOS = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'favicon.png'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }));
  self.skipWaiting();
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE && k !== 'dentaly-cfg' && k !== 'dentaly-compartidos'; }).map(function (k) { return caches.delete(k); })); }));
  self.clients.claim();
});
self.addEventListener('fetch', function (e) {
  var u = new URL(e.request.url);
  if (u.origin !== location.origin) return;   // el sistema de Google no se toca
  // 📤 (2026-11-07) Compartir → Dentaly (fotos desde la galería): se guardan aquí y se abre "Subir RX".
  if (e.request.method === 'POST' && /[/]compartir$/.test(u.pathname)) {
    e.respondWith(e.request.formData().then(function (fd) {
      var fs = fd.getAll('fotos').filter(function (f) { return f && f.size; });
      return caches.open('dentaly-compartidos').then(function (c) {
        return Promise.all(fs.map(function (f, i) {
          return c.put('compartido/' + Date.now() + '-' + i, new Response(f, { headers: { 'Content-Type': f.type || 'image/jpeg', 'X-Nombre': encodeURIComponent(f.name || ('foto' + i + '.jpg')) } }));
        }));
      }).then(function () { return Response.redirect('./?rxsubir=1&compartido=' + fs.length, 303); });
    }).catch(function () { return Response.redirect('./?rxsubir=1', 303); }));
    return;
  }
  if (e.request.method !== 'GET') return;
  if (/version[.]json$/.test(u.pathname)) return;   // la versión siempre se pregunta a internet
  // ⚡ (2026-11-05) Primero lo guardado (abre al instante, aun sin internet) y por detrás se actualiza
  // para la siguiente vez.
  var red = fetch(e.request).then(function (r) {
    if (r && r.ok) { var copia = r.clone(); caches.open(CACHE).then(function (c) { c.put(e.request, copia); }); }
    return r;
  });
  e.respondWith(caches.match(e.request, { ignoreSearch: e.request.mode === 'navigate' }).then(function (g) {
    if (g) { red.catch(function () {}); return g; }
    return red.catch(function () { return caches.match('index.html'); });
  }));
});

// 🔔 (2026-11-06) Aviso "siguiente paciente": llega un toque vacío y aquí se pide el texto al sistema.
var SISTEMA = 'https://script.google.com/macros/s/AKfycbwExKBacg6rF_7T1fQddk8YhgOCHolOXoD2JGw13KIHwdKGHHvWK9pzbGlMj1mmb9Wchw/exec';
self.addEventListener('push', function (e) {
  e.waitUntil(caches.open('dentaly-cfg').then(function (c) { return c.match('aviso-id'); })
    .then(function (r) { return r ? r.text() : ''; })
    .then(function (id) { return fetch(SISTEMA + '?aviso=1&s=' + encodeURIComponent(id)).then(function (r) { return r.json(); }); })
    .then(function (j) {
      var l = (j && j.avisos) || [];
      if (!l.length) l = [{ titulo: 'Dentaly', texto: 'Tienes un aviso nuevo.' }];
      return Promise.all(l.map(function (a) { return self.registration.showNotification(a.titulo || 'Dentaly', { body: a.texto || '', tag: a.tag || 'dentaly', renotify: true, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: a.url || '' } }); }));
    })
    .catch(function () { return self.registration.showNotification('Dentaly', { body: 'Tienes un aviso nuevo. Abre la app para verlo.', icon: 'icon-192.png', badge: 'icon-192.png' }); }));
});

// 🔔 Al tocar un aviso de tarea, se abre (o se trae al frente) la app.
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '';   // ej. '?id=P-123' abre la ficha de ese paciente
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if ('focus' in cs[i]) { if (url && 'navigate' in cs[i]) { cs[i].navigate(new URL('./' + url, self.registration.scope).href); } return cs[i].focus(); }
    return self.clients.openWindow(new URL('./' + url, self.registration.scope).href);
  }));
});