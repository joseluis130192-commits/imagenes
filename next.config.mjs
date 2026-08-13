/** @type {import('next').NextConfig} */
const nextConfig = {
  // Las fuentes se cargan por <link> en el layout; no hace falta que Next las procese.
  optimizeFonts: false,
  async headers() {
    return [
      {
        // Sin esto, un service worker cacheado por el navegador te deja clavado
        // en una versión vieja después de cada deploy.
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=0, must-revalidate" }],
      },
    ];
  },
};
export default nextConfig;
