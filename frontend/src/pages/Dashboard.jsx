import { useMemo, useEffect } from "react";
import { useData } from "../context/DataContext";

// Status helper function based on aheadBehind = produced - planned
function getStatusMeta(planned, produced, aheadBehind) {
  const progress = planned > 0 ? (produced / planned) : 0;
  
  // Rule 1: If planned > 0 AND produced === 0 AND aheadBehind === -planned
  if (planned > 0 && produced === 0 && aheadBehind === -planned) {
    return {
      label: "Needs Coffee",
      className: "status-needs-coffee"
    };
  }
  
  // Rule 2: If planned > 0 AND aheadBehind < 0 AND progress >= 0.80
  if (planned > 0 && aheadBehind < 0 && progress >= 0.80) {
    return {
      label: "You Got This!!",
      className: "status-coffee-working"
    };
  }
  
  // Rule 3: If aheadBehind === 0
  if (aheadBehind === 0) {
    return {
      label: "CELEBRATE!!!",
      className: "status-drink-water"
    };
  }
  
  // Rule 4: If aheadBehind > 0
  if (aheadBehind > 0) {
    return {
      label: "Abundance",
      className: "status-drink-water"
    };
  }
  
  // Rule 5: Else (remaining behind cases, aheadBehind < 0)
  return {
    label: "Needs Coffee",
    className: "status-needs-coffee"
  };
}

export default function Dashboard() {
  const { summaryData, loading } = useData();
  const totals = summaryData?.totals || {};
  const byProduct = summaryData?.byProduct || {};

  // Prevent page scrolling when Dashboard is mounted
  useEffect(() => {
    document.body.classList.add("noPageScroll");
    return () => document.body.classList.remove("noPageScroll");
  }, []);

  // Process data: convert byProduct object to array and sort alphabetically by product name
  const processedData = useMemo(() => {
    return Object.entries(byProduct)
      .map(([product, data]) => ({
        product,
        ...data
      }))
      .sort((a, b) => a.product.localeCompare(b.product, undefined, { sensitivity: 'base' }));
  }, [byProduct]);

  // Use totals from backend summary
  const totalPlanned = totals.planned ?? 0;
  const totalProduced = totals.produced ?? 0;
  const totalSentToShop = totals.sentToShop ?? 0;
  const totalSold = totals.sold ?? 0;
  const totalNet = totals.net ?? 0;

  if (loading) {
    return (
      <div className="dashboardPage">
        <div className="dashboardTop">
          <h2>Dashboard</h2>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboardPage">
      <div className="dashboardTop">
        <h2>Dashboard</h2>

        <div className="kpiRow">
          <div className="kpi red">
            <div className="kpiLabel">TOTAL PLANNED</div>
            <div className="kpiValue">{totalPlanned}</div>
          </div>

          <div className="kpi red">
            <div className="kpiLabel">TOTAL PRODUCED</div>
            <div className="kpiValue">{totalProduced}</div>
          </div>

          <div className="kpi red">
            <div className="kpiLabel">TOTAL SENT TO SHOP</div>
            <div className="kpiValue">{totalSentToShop}</div>
          </div>

          <div className="kpi green">
            <div className="kpiLabel">TOTAL SHOP</div>
            <div className="kpiValue">{totalSold}</div>
          </div>

          <div className="kpi gray">
            <div className="kpiLabel">TOTAL NET</div>
            <div className="kpiValue">{totalNet}</div>
          </div>
        </div>
      </div>

      <div className="dashboardTableWrap">
        <table className="dashboardTable">
          <thead className="dashboardThead">
            <tr>
              <th>Product</th>
              <th className="col-date">Date Mod.</th>
              <th className="col-num col-planned">Planned</th>
              <th className="col-num col-produced">Produced</th>
              <th className="col-num col-sent">Sent to Shop</th>
              <th className="col-num col-shop">Shop</th>
              <th className="col-num col-net">At WH</th>
              <th className="col-num col-ahead">Ahead/Behind</th>
              <th>Status Prod</th>
            </tr>
          </thead>
          <tbody>
            {processedData.length === 0 ? (
              <tr>
                <td colSpan="9" className="emptyRow">No data yet</td>
              </tr>
            ) : (
              processedData.map((row) => {
                const planned = row.planned ?? 0;
                const produced = row.produced ?? 0;
                const aheadBehind = row.aheadBehind ?? 0;
                
                // Calculate status using frontend logic
                const statusMeta = getStatusMeta(planned, produced, aheadBehind);
                
                const netValue = row.net ?? 0;
                const isNetNegative = netValue < 0;
                
                  return (
                    <tr key={row.product}>
                      <td className="col-product">{row.product}</td>
                      <td className="col-date">
                        {row.dateModified
                          ? new Date(row.dateModified).toLocaleDateString('en-US', {
                              month: '2-digit',
                              day: '2-digit',
                              year: '2-digit',
                            })
                          : ""}
                      </td>
                      <td className="col-num col-planned">{planned}</td>
                      <td className="col-num col-produced">{produced}</td>
                      <td className="col-num col-sent">{row.sentToShop ?? 0}</td>
                      <td className="col-num col-shop">{row.sold ?? 0}</td>
                      <td 
                        className="col-num col-net"
                        style={isNetNegative ? { color: '#c0392b', fontWeight: 600 } : {}}
                      >
                        {netValue}
                      </td>
                      <td className="col-num col-ahead">{aheadBehind}</td>
                      <td className="col-status">
                        <span className={`status-cell ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
