import "./globals.css";
import RegistrarSW from "@/components/RegistrarSW";

export const metadata = {
  title: "Taller de imágenes",
  description: "Panel interno para generar imágenes con la API de OpenAI",
  manifest: "/manifest.webmanifest",
};

export const viewport = { themeColor: "#FFC300" };

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&family=Figtree:wght@400;500;600;800;900&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body>
        <div className="espiral" aria-hidden />
        <div className="margen" aria-hidden />
        {children}
        <RegistrarSW />
      </body>
    </html>
  );
}
