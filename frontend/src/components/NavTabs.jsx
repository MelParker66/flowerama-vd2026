import { NavLink } from "react-router-dom";

const TABS = [
  { path: "/", label: "Dashboard", colorClass: "tab-dashboard" },
  { path: "/warehouse", label: "Warehouse", colorClass: "tab-warehouse" },
  { path: "/sent-to-shop", label: "Sent to Shop", colorClass: "tab-sent-to-shop" },
  { path: "/shop", label: "Shop", colorClass: "tab-shop" },
  { path: "/history", label: "History", colorClass: "tab-history" },
  { path: "/manage-products", label: "Manage Products", colorClass: "tab-manage-products" },
];

export default function NavTabs() {
  return (
    <nav className="tabs">
      {TABS.map((tab) => (
        <NavLink
          key={tab.path}
          to={tab.path}
          className={`tabBtn ${tab.colorClass}`}
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}

