import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import CharacterList from "./pages/CharacterList";
import Wizard from "./pages/Wizard";
import Sheet from "./pages/Sheet";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <Routes>
        <Route element={<App />}>
          <Route index element={<CharacterList />} />
          <Route path="new" element={<Wizard />} />
          <Route path="c/:id" element={<Sheet />} />
        </Route>
      </Routes>
    </HashRouter>
  </React.StrictMode>
);
