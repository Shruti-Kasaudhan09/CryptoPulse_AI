/** Colors map to CSS variables (see src/index.css) so light/dark mode is a
 *  single variable swap rather than duplicated classes everywhere. */
const v = (name) => `var(--${name})`;

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        page: v("page"),
        surface: v("surface"),
        raised: v("raised"),
        ink: v("ink"),
        ink2: v("ink-2"),
        muted: v("muted"),
        line: v("line"),
        grid: v("grid"),
        accent: v("accent"),
        accent2: v("accent-2"),
        surfacesolid: v("surface-solid"),
        good: v("good-text"),
        bad: v("bad-text"),
        warn: v("warn-text"),
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Space Grotesk", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
