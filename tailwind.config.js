/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        papel: "#F4F1E6",   // hoja del cuaderno
        hoja: "#FFFDF5",    // fichas y campos
        tinta: "#121212",   // texto y bordes
        grafito: "#5F5C52", // texto secundario
        lima: "#CDF152",    // resaltador
        limaOscura: "#B5DC3A",
        amarillo: "#FFC300", // franja superior
        rojo: "#E03B2C",     // margen y errores
        linea: "#E2DCC9",    // renglones
      },
      fontFamily: {
        display: ["Figtree", "system-ui", "sans-serif"],
        body: ["Figtree", "system-ui", "sans-serif"],
        mono: ["'Space Mono'", "ui-monospace", "monospace"],
        mano: ["Caveat", "cursive"],
      },
      boxShadow: {
        duro: "4px 4px 0 0 #121212",
        duroSm: "2px 2px 0 0 #121212",
        duroLg: "7px 7px 0 0 #121212",
      },
      keyframes: {
        revelar: { "0%": { backgroundPosition: "0 0" }, "100%": { backgroundPosition: "56px 0" } },
        entrar: { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "none" } },
      },
      animation: {
        revelar: "revelar 1.1s linear infinite",
        entrar: "entrar .3s ease-out both",
      },
    },
  },
  plugins: [],
};
