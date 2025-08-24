/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      typography: {
        DEFAULT: {
          css: {
            "code, blockquote > *": {
              "&::before, &::after": {
                display: "none",
              },
            },
            blockquote: {
              fontWeight: 400,
              fontStyle: "normal",
              color: "currentColor",
            },
          },
        },
      },
    },
  },
};
