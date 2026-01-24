// Force Netlify full rebuild v2
// Trigger Netlify rebuild
import { useEffect } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import "./styles/app.css";

import Header from "./components/Header";

import Dashboard from "./pages/Dashboard";
import Warehouse from "./pages/Warehouse";
import SentToShop from "./pages/SentToShop";
import Shop from "./pages/Shop";
import History from "./pages/History";
import ManageProducts from "./pages/ManageProducts";


export default function App() {
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <Header />
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/warehouse" element={<Warehouse />} />
          <Route path="/sent-to-shop" element={<SentToShop />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/history" element={<History />} />
          <Route path="/manage-products" element={<ManageProducts />} />
        </Routes>
      </main>
    </div>
  );
}

// END OF FILE. No changes needed here for this part of the pipeline as per instructions.
