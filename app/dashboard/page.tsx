import { redirect } from "next/navigation";
import SettingsHeader from "@/app/settings/header";

export default function Home() {
	return (<>
		<SettingsHeader />
      <div className="shell">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, letterSpacing: "-.03em" }}>Dashboard</h1>
            <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 13 }}>
            </p>
          </div>
        </div>

          {/*<button className="btn btn-ghost" onClick={fetchSettings} disabled={loading}>
            Refresh
          </button>*/}
			</div>

		{/*<h1>LeadsDB</h1>
	  <h2>The modern sales station</h2>*/}
	</>)
}
