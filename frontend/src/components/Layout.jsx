import React from "react";
import styles from "./Layout.module.css";
import RightSidebar from "./RightSidebar";

export default function Layout({ children, activeTab, setActiveTab, exceptions }) {
  const navItems = [
    { id: "overview", label: "Overview", icon: "🏠" },
    { id: "reconciliations", label: "Reconciliations", icon: "⇄" },
    { id: "transactions", label: "Transactions", icon: "▤" },
    { id: "tax", label: "Tax Matches", icon: "%" },
    { id: "orchestration", label: "Orchestration", icon: "⚙" },
    { id: "cash-forecast", label: "Cash Forecast", icon: "📊" },
    { id: "reports", label: "Reports", icon: "📋" },
  ];

  const controlCentreItems = [
    { id: "exceptions", label: "Exceptions", icon: "⚠", badge: exceptions?.length || 0 },
    { id: "audit", label: "Audit Trail", icon: "✓" },
  ];

  return (
    <div className={styles.layout}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div className={styles.logo}>
            <div className={styles.logoBadge}>R</div>
            <div>
              <div className={styles.logoText}>recon.ai</div>
              <div className={styles.logoSubtext}>Close with confidence</div>
            </div>
          </div>
        </div>

        <div className={styles.workspace}>
          <div className={styles.workspaceLabel}>AC</div>
          <div>
            <div className={styles.workspaceName}>Acme Corporation</div>
            <div className={styles.workspaceType}>Finance workspace</div>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className={styles.navSection}>
          <div className={styles.navList}>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`${styles.navItem} ${
                  activeTab === item.id ? styles.active : ""
                }`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Control Centre */}
        <div className={styles.controlCentre}>
          <div className={styles.sectionTitle}>Control Centre</div>
          <div className={styles.navList}>
            {controlCentreItems.map((item) => (
              <button
                key={item.id}
                className={`${styles.navItem} ${
                  activeTab === item.id ? styles.active : ""
                }`}
                onClick={() => setActiveTab(item.id)}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
                {item.badge > 0 && (
                  <span className={styles.navBadge}>{item.badge}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className={styles.status}>
          <div className={styles.statusDot}></div>
          <span>All systems operational</span>
          <div className={styles.statusDetails}>Last synced 2 min ago</div>
          <div className={styles.agentLabel}>Recon Agent v1.0</div>
        </div>
      </aside>

      {/* Main Content */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
        <aside className={styles.rightSidebar}>
          <RightSidebar />
        </aside>
      </main>
    </div>
  );
}
