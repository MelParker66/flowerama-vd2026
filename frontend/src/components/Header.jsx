import NavTabs from "./NavTabs";

export default function Header() {
  return (
    <header className="topBar">
      <div className="topBarInner">
        <div className="brand">
          <span className="brandTitle">FLOWERAMA Production Dashboard</span>
        </div>
        <NavTabs />
      </div>
    </header>
  );
}

