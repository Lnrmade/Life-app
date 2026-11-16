import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life",
    short_name: "Life",
    description: "Track gym, sport, sleep, work and money. Your character grows with you.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0c0c0e",
    theme_color: "#0c0c0e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // On Android, "Share" from a browser or shop app can send a link straight to the wishlist.
    share_target: {
      action: "/wishlist",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
    shortcuts: [
      { name: "Groceries", url: "/groceries" },
      { name: "Wishlist", url: "/wishlist" },
    ],
  };
}
