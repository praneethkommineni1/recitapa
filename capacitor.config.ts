import type { CapacitorConfig } from "@capacitor/cli";

// The iOS app is a native shell around the deployed Recitapa web app (the app needs its
// server for accounts, the feed and the AI chef). Set CAP_SERVER_URL to your deployment
// before `npx cap sync ios`, e.g. CAP_SERVER_URL=https://recitapa.example.com
const serverUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.recitapa.app",
  appName: "Recitapa",
  webDir: "ios-shell",
  backgroundColor: "#f7f5f2",
  ios: { contentInset: "never" },
  server: serverUrl
    ? { url: serverUrl, cleartext: serverUrl.startsWith("http://"), errorPath: "index.html" }
    : undefined,
};

export default config;
