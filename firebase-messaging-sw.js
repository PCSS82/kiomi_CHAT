importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// IMPORTANTE: pega aquí el mismo objeto firebaseConfig que ya usaste al
// configurar la app (pantalla "Configuración inicial"). Un service worker
// no puede leer el localStorage de la página, así que necesita su propia copia.
firebase.initializeApp({
  apiKey: "PEGAR_AQUI",
  authDomain: "PEGAR_AQUI",
  databaseURL: "PEGAR_AQUI",
  projectId: "PEGAR_AQUI",
  messagingSenderId: "PEGAR_AQUI",
  appId: "PEGAR_AQUI"
});

const messaging = firebase.messaging();

// Sin esto, el navegador puede seguir usando una versión vieja y cacheada
// de este archivo indefinidamente (hasta cerrar TODAS las pestañas/la app
// por completo), incluso después de subir una corrección — por eso un
// arreglo puede "funcionar una vez y después dejar de funcionar": en
// realidad nunca se activó la versión nueva. skipWaiting + clients.claim
// fuerzan a que la versión nueva tome el control de inmediato.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

// Se dispara cuando llega una notificación y la app/pestaña NO está en primer plano
messaging.onBackgroundMessage((payload) => {
  const title  = payload.notification?.title || 'Kiomi Chat';
  const body   = payload.notification?.body  || '';
  const badge  = payload.data?.badge;
  const isCall = payload.data?.type === 'call';

  // La Badging API vive en self.navigator, no directamente en self.
  if (badge != null && self.navigator && self.navigator.setAppBadge) {
    self.navigator.setAppBadge(Number(badge)).catch(() => {});
  }

  // El timbre/vibración de la llamada solo puede sonar con la app abierta
  // (los service workers no pueden reproducir audio). Con la app cerrada,
  // en Android esta notificación sí vibra; en iPhone no (Safari no soporta
  // vibrar desde la web) — pero igual aparece la notificación para abrir la app.
  self.registration.showNotification(title, {
    body,
    icon: 'public/icons/kiomi_icon.png',
    badge: 'public/icons/kiomi_icon.png',
    tag: isCall ? undefined : 'kiomi-chat-msg',
    requireInteraction: isCall,
    vibrate: isCall ? [500, 300, 500, 300, 500, 300, 500] : undefined,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
