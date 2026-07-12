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

// Se dispara cuando llega una notificación y la app/pestaña NO está en primer plano
messaging.onBackgroundMessage((payload) => {
  const title  = payload.notification?.title || 'Kiomi Chat';
  const body   = payload.notification?.body  || '';
  const badge  = payload.data?.badge;
  const isAlarm = payload.data?.alarm === '1';

  // La Badging API vive en self.navigator, no directamente en self.
  if (badge != null && self.navigator && self.navigator.setAppBadge) {
    self.navigator.setAppBadge(Number(badge)).catch(() => {});
  }

  // La alarma sonora solo puede reproducirse con la app abierta (los service
  // workers no pueden reproducir audio). Con la app cerrada, en Android esta
  // notificación sí vibra; en iPhone no (Safari no soporta vibrar desde la web).
  self.registration.showNotification(title, {
    body,
    icon: 'public/icons/kiomi_icon.png',
    badge: 'public/icons/kiomi_icon.png',
    tag: isAlarm ? undefined : 'kiomi-chat-msg',
    requireInteraction: isAlarm,
    vibrate: isAlarm ? [400, 200, 400, 200, 400, 200, 400] : undefined,
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow('./'));
});
