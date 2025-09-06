self.addEventListener('install', (e) => {
  self.skipWaiting()
  e.waitUntil(caches.open('todo-v1').then(cache => cache.addAll(['/','/manifest.webmanifest'])))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim())
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.origin === location.origin) {
    e.respondWith(caches.match(e.request).then(resp => resp || fetch(e.request)))
  }
})
