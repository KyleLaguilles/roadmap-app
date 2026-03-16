import { useState, useEffect } from "react";
import Splash from "./components/Splash.jsx";
import Navbar from "./components/Navbar.jsx";
import HomePage from "./pages/HomePage.jsx";
import CoachPage from "./pages/CoachPage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";

export default function App() {
  const [page, setPage]               = useState("home");
  const [showSplash, setShowSplash]   = useState(true);
  const [results, setResults]         = useState(null);
  const [studentProfile, setProfile]  = useState(null);
  const [uploadedFiles, setFiles]     = useState({});

  // Auto-dismiss splash
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 2900);
    return () => clearTimeout(t);
  }, []);

  const handleAnalysisComplete = (data, profile) => {
    setResults(data);
    setProfile(profile);
    setPage("results");
  };

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <div className="grid-bg" />

      {showSplash && (
        <Splash onDone={() => setShowSplash(false)} />
      )}

      <Navbar
        currentPage={page}
        onNavigate={setPage}
        onReplaySplash={() => setShowSplash(true)}
      />

      <main style={{ position: "relative", zIndex: 1 }}>
        {page === "home" && (
          <HomePage
            uploadedFiles={uploadedFiles}
            setUploadedFiles={setFiles}
            onContinue={() => setPage("coach")}
          />
        )}
        {page === "coach" && (
          <CoachPage
            uploadedFiles={uploadedFiles}
            onBack={() => setPage("home")}
            onComplete={handleAnalysisComplete}
          />
        )}
        {page === "results" && (
          <ResultsPage
            results={results}
            studentProfile={studentProfile}
            onBack={() => setPage("coach")}
          />
        )}
      </main>
    </div>
  );
}
