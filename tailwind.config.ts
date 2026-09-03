import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./client/index.html", "./client/src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // OST brand palette — "The Science Road"
        primary: {
          DEFAULT: "#0A193D",
          50: "#eef0f6",
          100: "#d3d8e7",
          200: "#a8b1cf",
          300: "#7d8ab7",
          400: "#52639f",
          500: "#374a86",
          600: "#142a5c",
          700: "#0A193D",
          800: "#081530",
          900: "#070B22",
        },
        secondary: {
          DEFAULT: "#FF3D82",
          50: "#ffe9f1",
          100: "#ffd0e2",
          200: "#ff9dc2",
          300: "#FF7BAA",
          400: "#FF3D82",
          500: "#E62E70",
          600: "#C81361",
          700: "#9c0f4c",
          800: "#700b37",
          900: "#450722",
        },
        turq: {
          DEFAULT: "#62DDD1",
          light: "#8CE7DE",
          text: "#0C8479",
          bg: "rgba(98,221,209,0.16)",
        },
        canvas: {
          DEFAULT: "#070B22",
          light: "#0D1440",
        },
        offwhite: "#F2EFE9",
        amber: {
          text: "#8A5A00",
          light: "#FFD666",
          bg: "rgba(255,209,72,0.22)",
        },
      },
      fontFamily: {
        sans: ["Hanken Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        montserrat: ["Hanken Grotesk", "sans-serif"],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        card: "0 4px 24px -8px rgba(29, 40, 83, 0.12)",
        "card-hover": "0 12px 40px -12px rgba(29, 40, 83, 0.22)",
      },
    },
  },
  plugins: [],
} satisfies Config;
