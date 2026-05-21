import type { Preview } from "@storybook/react-vite";
import { useEffect } from "react";
import "../src/storybook.css";

const preview: Preview = {
  parameters: {
    layout: "centered",
    backgrounds: { disable: true },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
  globalTypes: {
    theme: {
      description: "Voila theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", icon: "sun", title: "Light" },
          { value: "dark", icon: "moon", title: "Dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, context) => {
      const isDark = context.globals.theme === "dark";
      useEffect(() => {
        document.documentElement.classList.toggle("dark", isDark);
      }, [isDark]);
      return (
        <div className="font-sans">
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
