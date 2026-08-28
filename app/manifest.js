export default function manifest() {
  return {
    name: "Taller de imágenes",
    short_name: "Taller",
    description: "Genera y edita imágenes con los modelos de Kie AI",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#FFC300",
    background_color: "#F4F1E6",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
    ],
  };
}
