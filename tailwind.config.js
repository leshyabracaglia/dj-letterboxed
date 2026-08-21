/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        ink: "#12121a",
        paper: "#f7f6f3",
        accent: "#ff5470",
        muted: "#8a8a99",
      },
    },
  },
  plugins: [],
};
