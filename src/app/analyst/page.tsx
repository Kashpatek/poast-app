import App from "../poast-client";

// Dedicated route for the Analyst app within POAST. Renders the same SPA
// chrome as `/`; the URL is the bookmarkable entry point so analysts can
// land directly on /analyst without first seeing the user picker. The
// welcome tour fires automatically on first arrival via OnboardingHost.
export default function AnalystPage() {
  return <App />;
}
