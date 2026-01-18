import NavTabs from "./NavTabs";

export default function Header() {
  return (
    <header className="topBar">
      <div className="topBarInner">
        <div className="brand">
          <span className="brandTitle">FLOWERAMA Valentines Day 2026</span>
          <span className="brandSub">(We got this!)</span>
        </div>
        <NavTabs />
      </div>
    </header>
  );
}

