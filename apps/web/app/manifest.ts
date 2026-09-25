import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anorganická chemie",
    short_name: "Anorganika",
    description: "Offline výuková aplikace pro anorganickou chemii.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f6f7",
    theme_color: "#0a6a9e",
    lang: "cs",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
