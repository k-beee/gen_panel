"use client";
import { useState, useEffect, useCallback } from "react";
import { CONTRACT_ADDRESS, connectWallet, readClient, shortAddr, type WalletState } from "@/lib/genlayer";
import { TransactionStatus } from "genlayer-js/types";

type Case = {
  id: string;
  plaintiff: string;
  defendant: string;
  title: string;
  complaint: string;
  evidence: string;
  defense: string;
  defense_evidence: string;
  stake: string;
  defendant_stake: string;
  status: number;
  ruling: string;
  created_at: number;
  deadline: number;
  appealed_by: string;
  appeal_ruling: string;
  appeal_deadline?: number;
};

const STATUS_TEXT = [
  "Filed (Awaiting Defense)",
  "Active Adjudication",
  "Judged (Appeal Window Open)",
  "Appealed (Under Supreme Review)",
  "Defaulted",
  "Finalized & Disbursed"
];

const STATUS_COLORS = [
  "#f59e0b", // Amber
  "#0ea5e9", // Sky blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#ef4444", // Red
  "#10b981"  // Emerald
];

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, client: null });
  const [cases, setCases] = useState<Case[]>([]);
  const [charter, setCharter] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Case | null>(null);
  const [showFile, setShowFile] = useState(false);
  const [form, setForm] = useState({ title: "", complaint: "", evidence: "", defendant: "", stake: "", duration: "24" });
  const [defense, setDefense] = useState({ text: "", evidence: "" });
  const [tx, setTx] = useState("");

  const load = useCallback(async () => {
    try {
      const rc = readClient();
      try {
        setCharter(await rc.readContract({ address: CONTRACT_ADDRESS, functionName: "get_charter", args: [] }) as string);
      } catch {}
      const count = Number(await rc.readContract({ address: CONTRACT_ADDRESS, functionName: "get_case_count", args: [] }));
      const out: Case[] = [];
      for (let i = 1; i <= count; i++) {
        const raw = await rc.readContract({ address: CONTRACT_ADDRESS, functionName: "get_case", args: [String(i)] });
        out.push(JSON.parse(raw as string));
      }
      setCases(out.reverse());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleConnect() {
    setTx("Connecting wallet...");
    try {
      const w = await connectWallet();
      setWallet(w);
      setTx("");
    } catch (e: any) {
      setTx(e.message);
    }
  }

  async function send(fn: string, args: any[], value?: bigint) {
    if (!wallet.client) {
      setTx("Please connect your wallet first.");
      return;
    }
    setLoading(true);
    setTx("Executing transaction on GenVM...");
    try {
      const hash = await wallet.client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName: fn,
        args,
        value: value ?? BigInt(0)
      });
      await wallet.client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED });
      setTx("Transaction successful!");
      setTimeout(() => setTx(""), 3000);
      await load();
      setSelected(null);
      setShowFile(false);
    } catch (e: any) {
      setTx(e.message);
    }
    setLoading(false);
  }

  const formatStake = (wei: string) => {
    return (Number(wei) / 10 ** 18).toFixed(2);
  };

  const getStatusLabel = (c: Case) => {
    return STATUS_TEXT[c.status] || "Unknown";
  };

  return (
    <div style={containerStyle}>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header Banner */}
      <div style={headerStyle}>
        <div style={logoWrapperStyle}>
          <span style={logoStyle}>🛡️ GenPanel</span>
          <span style={logoSubtitleStyle}>Intelligent Arbitration Protocol</span>
        </div>
        {wallet.address ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={walletBadgeStyle}>
              <div style={walletDotStyle} />
              <span style={walletAddressStyle}>{shortAddr(wallet.address)}</span>
            </div>
            <button
              onClick={() => setWallet({ address: null, client: null })}
              style={btnDisconnectStyle}
            >
              Disconnect
            </button>
          </div>
        ) : (
          <button onClick={handleConnect} style={btnConnectStyle}>
            Connect Wallet
          </button>
        )}
      </div>

      {/* System Stats / Charter Banner */}
      {charter && (
        <div style={charterContainerStyle}>
          <div style={charterTitleStyle}>📜 Active DAO Charter / Arbitration Rules</div>
          <p style={charterTextStyle}>{charter}</p>
        </div>
      )}

      {tx && <div style={statusBannerStyle}>{tx}</div>}

      <div style={mainLayoutStyle}>
        {/* Cases Docket */}
        <div style={sidebarStyle}>
          <div style={sidebarHeaderStyle}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Docket Records</h3>
            <button onClick={() => setShowFile(true)} style={btnCreateStyle}>
              + Create Dispute
            </button>
          </div>

          <div style={casesListStyle}>
            {cases.length === 0 && (
              <div style={emptyStateStyle}>No active disputes on record.</div>
            )}
            {cases.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c)}
                style={{
                  ...caseItemStyle,
                  borderColor: selected?.id === c.id ? "#0ea5e9" : "#1e293b",
                  background: selected?.id === c.id ? "#131e35" : "#0f172a"
                }}
              >
                <div style={caseHeaderStyle}>
                  <span style={caseIdStyle}>Dispute #{c.id}</span>
                  <span
                    style={{
                      ...statusBadgeStyle,
                      background: `${STATUS_COLORS[c.status]}20`,
                      color: STATUS_COLORS[c.status]
                    }}
                  >
                    {getStatusLabel(c)}
                  </span>
                </div>
                <div style={caseTitleStyle}>{c.title}</div>
                <div style={caseActorsStyle}>
                  <span>{shortAddr(c.plaintiff)}</span>
                  <span style={{ color: "#64748b" }}> vs </span>
                  <span>{shortAddr(c.defendant)}</span>
                </div>
                <div style={caseStakesStyle}>Escrow Pool: {formatStake(c.stake)} GEN</div>
              </div>
            ))}
          </div>
        </div>

        {/* Dispute Details & Panel */}
        <div style={contentStyle}>
          {selected ? (
            <div style={detailsCardStyle}>
              <div style={detailsHeaderStyle}>
                <div>
                  <h2 style={detailsTitleStyle}>{selected.title}</h2>
                  <div style={detailsMetaStyle}>
                    <span>Dispute ID: {selected.id}</span>
                    <span style={{ color: "#334155" }}>|</span>
                    <span style={{ color: STATUS_COLORS[selected.status] }}>
                      {getStatusLabel(selected)}
                    </span>
                  </div>
                </div>
                <div style={escrowCounterStyle}>
                  <div style={escrowLabelStyle}>Locked Escrow Pool</div>
                  <div style={escrowValStyle}>
                    {formatStake(
                      String(BigInt(selected.stake) + BigInt(selected.defendant_stake))
                    )}{" "}
                    GEN
                  </div>
                </div>
              </div>

              {/* Progress Timeline Stepper */}
              <div style={stepperStyle}>
                {[
                  { label: "Dispute Filed", active: selected.status >= 0 },
                  { label: "Defense Submitted", active: selected.status >= 1 || selected.status === 4 },
                  { label: "Judged", active: selected.status >= 2 && selected.status !== 4 },
                  { label: "Resolved / Escrow Disbursed", active: selected.status === 5 }
                ].map((step, idx) => (
                  <div key={idx} style={stepItemStyle}>
                    <div
                      style={{
                        ...stepDotStyle,
                        background: step.active ? "#10b981" : "#1e293b",
                        boxShadow: step.active ? "0 0 10px rgba(16,185,129,0.5)" : "none"
                      }}
                    >
                      {idx + 1}
                    </div>
                    <span style={{ ...stepLabelStyle, color: step.active ? "#f8fafc" : "#475569" }}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Case Materials */}
              <div style={materialsGridStyle}>
                <div style={materialsBlockStyle}>
                  <div style={blockHeaderPlaintiffStyle}>Plaintiff Claims & Evidence</div>
                  <div style={blockContentStyle}>
                    <strong>Complaint Rules Violated:</strong>
                    <p style={paragraphStyle}>{selected.complaint}</p>
                    <strong>Evidence Dossier:</strong>
                    <p style={paragraphStyle}>{selected.evidence}</p>
                    <div style={metaBadgeStyle}>Staked: {formatStake(selected.stake)} GEN</div>
                  </div>
                </div>

                <div style={materialsBlockStyle}>
                  <div style={blockHeaderDefendantStyle}>Defendant Response & Evidence</div>
                  <div style={blockContentStyle}>
                    {selected.defense ? (
                      <>
                        <strong>Defense Narrative:</strong>
                        <p style={paragraphStyle}>{selected.defense}</p>
                        <strong>Refutation Evidence:</strong>
                        <p style={paragraphStyle}>{selected.defense_evidence}</p>
                        <div style={metaBadgeStyle}>Staked: {formatStake(selected.defendant_stake)} GEN</div>
                      </>
                    ) : (
                      <div style={emptyDefenseStyle}>
                        <span>Awaiting defendant submission...</span>
                        {selected.deadline && (
                          <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
                            Deadline: {new Date(selected.deadline * 1000).toLocaleString()}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Rulings Section */}
              {selected.ruling && (
                <div style={rulingSectionStyle}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#38bdf8" }}>
                    🏛️ GenVM Panel Consensus Judgment
                  </h4>
                  {(() => {
                    const r = JSON.parse(selected.ruling);
                    return (
                      <div style={rulingBoxStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span>
                            <strong>Verdict:</strong>{" "}
                            <span style={{ color: r.verdict === "plaintiff" ? "#10b981" : "#ef4444" }}>
                              {r.verdict.toUpperCase()} WINS
                            </span>
                          </span>
                          <span>
                            <strong>Violation Verified:</strong>{" "}
                            {r.violation_found ? "✅ Yes" : "❌ No"}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontStyle: "italic", lineHeight: 1.5 }}>
                          {r.reasoning}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Appeal Rulings Section */}
              {selected.appeal_ruling && (
                <div style={{ ...rulingSectionStyle, borderColor: "#ec4899" }}>
                  <h4 style={{ margin: "0 0 12px 0", fontSize: 16, color: "#f472b6" }}>
                    ⚖️ Supreme Appeal Panel final Adjudication
                  </h4>
                  {(() => {
                    const r = JSON.parse(selected.appeal_ruling);
                    return (
                      <div style={rulingBoxStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span>
                            <strong>Verdict:</strong>{" "}
                            <span style={{ color: r.verdict === "plaintiff" ? "#10b981" : "#ef4444" }}>
                              {r.verdict.toUpperCase()} WINS (OVERRULED / UPHELD)
                            </span>
                          </span>
                        </div>
                        <p style={{ margin: 0, fontStyle: "italic", lineHeight: 1.5 }}>
                          {r.reasoning}
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Interactive Panel Operations */}
              <div style={operationsBarStyle}>
                {/* Defendant submits response */}
                {selected.status === 0 && wallet.address?.toLowerCase() === selected.defendant?.toLowerCase() && (
                  <div style={opCardStyle}>
                    <h4 style={{ margin: "0 0 10px 0" }}>Submit Legal Defense</h4>
                    <textarea
                      placeholder="Explain why the claims are invalid..."
                      value={defense.text}
                      onChange={(e) => setDefense({ ...defense, text: e.target.value })}
                      style={textareaStyle}
                      rows={3}
                    />
                    <textarea
                      placeholder="Add links/evidence dossiers..."
                      value={defense.evidence}
                      onChange={(e) => setDefense({ ...defense, evidence: e.target.value })}
                      style={textareaStyle}
                      rows={2}
                    />
                    <button
                      onClick={() =>
                        send(
                          "submit_defense",
                          [selected.id, defense.text, defense.evidence],
                          BigInt(selected.stake)
                        )
                      }
                      disabled={loading || !defense.text}
                      style={btnPrimaryStyle}
                    >
                      Post Stake & Submit Defense ({formatStake(selected.stake)} GEN)
                    </button>
                  </div>
                )}

                {/* Plaintiff claims default judgment */}
                {selected.status === 0 && wallet.address?.toLowerCase() === selected.plaintiff?.toLowerCase() && (
                  <div style={opCardStyle}>
                    <h4 style={{ margin: "0 0 8px 0" }}>Claim Default Resolution</h4>
                    <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 12px 0" }}>
                      If the defendant fails to answer before the deadline, you can dissolve the case and reclaim your stake.
                    </p>
                    <button
                      onClick={() => send("claim_default_judgment", [selected.id])}
                      disabled={loading}
                      style={{ ...btnPrimaryStyle, background: "#ef4444" }}
                    >
                      Claim Default & Dissolve Escrow
                    </button>
                  </div>
                )}

                {/* Request AI judgment */}
                {selected.status === 1 && (
                  <div style={opCardStyle}>
                    <h4 style={{ margin: "0 0 8px 0" }}>Trigger AI Adjudication</h4>
                    <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 12px 0" }}>
                      Both parties have staked and submitted their arguments. The GenVM validators will evaluate the case.
                    </p>
                    <button
                      onClick={() => send("judge_case", [selected.id])}
                      disabled={loading}
                      style={{ ...btnPrimaryStyle, background: "#8b5cf6" }}
                    >
                      ⚖️ Adjudicate Case
                    </button>
                  </div>
                )}

                {/* Appeal Case */}
                {selected.status === 2 && (
                  <div style={opCardStyle}>
                    <h4 style={{ margin: "0 0 8px 0" }}>Appeal Panel Ruling</h4>
                    <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 12px 0" }}>
                      Disagree with the judgment? Deposit a matching appeal bond to escalate this to the Supreme Court.
                    </p>
                    <button
                      onClick={() => send("appeal_case", [selected.id], BigInt(selected.stake))}
                      disabled={loading}
                      style={{ ...btnPrimaryStyle, background: "#ec4899" }}
                    >
                      File Supreme Appeal ({formatStake(selected.stake)} GEN)
                    </button>
                  </div>
                )}

                {/* Finalize Case */}
                {selected.status === 2 && (
                  <div style={opCardStyle}>
                    <h4 style={{ margin: "0 0 8px 0" }}>Disburse Escrow Pool</h4>
                    <p style={{ fontSize: 13, color: "#94a3b8", margin: "0 0 12px 0" }}>
                      Once the appeal window passes, you can release the locked stakes to the winning party.
                    </p>
                    <button
                      onClick={() => send("finalize_case", [selected.id])}
                      disabled={loading}
                      style={{ ...btnPrimaryStyle, background: "#10b981" }}
                    >
                      Release & Disburse Funds
                    </button>
                  </div>
                )}

                {/* Trigger Appeal judgment */}
                {selected.status === 3 && (
                  <div style={opCardStyle}>
                    <h4 style={{ margin: "0 0 8px 0" }}>Trigger Appeal Review</h4>
                    <button
                      onClick={() => send("judge_appeal", [selected.id])}
                      disabled={loading}
                      style={{ ...btnPrimaryStyle, background: "#db2777" }}
                    >
                      ⚖️ Resolve Supreme Appeal
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={noCaseSelectedStyle}>
              <span style={{ fontSize: 48 }}>⚖️</span>
              <h3>No Case Selected</h3>
              <p style={{ color: "#64748b" }}>Select a dispute from the docket list to begin resolution review.</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Case Modal */}
      {showFile && (
        <div onClick={() => setShowFile(false)} style={modalOverlayStyle}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              send(
                "file_case",
                [form.title, form.complaint, form.evidence, form.defendant, Number(form.duration)],
                BigInt(form.stake) * BigInt(10 ** 18)
              );
            }}
            style={modalContentStyle}
          >
            <h3 style={{ marginTop: 0, marginBottom: 20 }}>File Dispute Case</h3>
            <label style={labelStyle}>Case Title</label>
            <input
              placeholder="e.g. Failure to deliver service contracts"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              style={inputStyle}
            />
            <label style={labelStyle}>Defendant Wallet Address (0x...)</label>
            <input
              placeholder="0x..."
              value={form.defendant}
              onChange={(e) => setForm({ ...form, defendant: e.target.value })}
              required
              style={inputStyle}
            />
            <label style={labelStyle}>Complaints (Which charter rules were violated?)</label>
            <textarea
              placeholder="Explain which rules were breached..."
              value={form.complaint}
              onChange={(e) => setForm({ ...form, complaint: e.target.value })}
              required
              rows={3}
              style={textareaStyle}
            />
            <label style={labelStyle}>Evidence (Files, links, details)</label>
            <textarea
              placeholder="Links to assets, GitHub commits, etc..."
              value={form.evidence}
              onChange={(e) => setForm({ ...form, evidence: e.target.value })}
              required
              rows={3}
              style={textareaStyle}
            />
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Filing Stake (GEN)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="100"
                  value={form.stake}
                  onChange={(e) => setForm({ ...form, stake: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Resolution Timeout (hours)</label>
                <input
                  type="number"
                  placeholder="24"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>
            </div>
            <button type="submit" disabled={loading} style={btnSubmitStyle}>
              Submit Legal Dispute
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Styling (Modern Glassmorphic Enterprise Dark Theme)
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#090d16",
  color: "#f8fafc",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  padding: "0 0 40px 0"
};

const headerStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.6)",
  backdropFilter: "blur(12px)",
  borderBottom: "1px solid #1e293b",
  padding: "16px 40px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  position: "sticky",
  top: 0,
  zIndex: 10
};

const logoWrapperStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column"
};

const logoStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "-0.5px"
};

const logoSubtitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  marginTop: 2
};

const btnConnectStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 20px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
  boxShadow: "0 4px 12px rgba(14, 165, 233, 0.25)"
};

const btnDisconnectStyle: React.CSSProperties = {
  background: "transparent",
  color: "#ef4444",
  border: "1px solid #ef4444",
  borderRadius: "8px",
  padding: "8px 14px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
  transition: "all 0.2s"
};

const walletBadgeStyle: React.CSSProperties = {
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: "20px",
  padding: "6px 14px",
  display: "flex",
  alignItems: "center",
  gap: 8
};

const walletDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  background: "#10b981",
  boxShadow: "0 0 8px #10b981"
};

const walletAddressStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#cbd5e1"
};

const charterContainerStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "24px auto 0",
  padding: "18px 24px",
  background: "rgba(30, 41, 59, 0.4)",
  border: "1px solid #1e293b",
  borderRadius: "12px",
  backdropFilter: "blur(6px)"
};

const charterTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#38bdf8",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: 8
};

const charterTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.6,
  color: "#cbd5e1"
};

const statusBannerStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "16px auto 0",
  padding: "12px 20px",
  background: "#1e1b4b",
  border: "1px solid #312e81",
  borderRadius: "8px",
  color: "#a5b4fc",
  fontSize: 14,
  textAlign: "center"
};

const mainLayoutStyle: React.CSSProperties = {
  maxWidth: 1200,
  margin: "24px auto 0",
  display: "flex",
  gap: 24,
  padding: "0 24px"
};

const sidebarStyle: React.CSSProperties = {
  width: 380,
  flexShrink: 0
};

const sidebarHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 16
};

const btnCreateStyle: React.CSSProperties = {
  background: "#10b981",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "8px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer"
};

const casesListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12
};

const caseItemStyle: React.CSSProperties = {
  border: "1px solid #1e293b",
  borderRadius: "10px",
  padding: "16px",
  cursor: "pointer",
  transition: "all 0.2s"
};

const caseHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8
};

const caseIdStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#94a3b8"
};

const statusBadgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: "12px"
};

const caseTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  marginBottom: 8,
  color: "#f1f5f9"
};

const caseActorsStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#cbd5e1",
  marginBottom: 10
};

const caseStakesStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#38bdf8"
};

const contentStyle: React.CSSProperties = {
  flexGrow: 1
};

const detailsCardStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "16px",
  padding: "32px"
};

const detailsHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #1e293b",
  paddingBottom: 24
};

const detailsTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 24,
  fontWeight: 700
};

const detailsMetaStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  fontSize: 13,
  color: "#64748b",
  marginTop: 8
};

const escrowCounterStyle: React.CSSProperties = {
  background: "#1e293b",
  borderRadius: "10px",
  padding: "10px 16px",
  textAlign: "right"
};

const escrowLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#94a3b8",
  textTransform: "uppercase"
};

const escrowValStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: "#10b981",
  marginTop: 2
};

const stepperStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  margin: "32px 0",
  padding: "0 10px"
};

const stepItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  width: "22%"
};

const stepDotStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 12,
  fontWeight: 700,
  color: "#ffffff"
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  marginTop: 8,
  textAlign: "center"
};

const materialsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 20,
  marginBottom: 28
};

const materialsBlockStyle: React.CSSProperties = {
  background: "#090d16",
  border: "1px solid #1e293b",
  borderRadius: "12px",
  overflow: "hidden"
};

const blockHeaderPlaintiffStyle: React.CSSProperties = {
  background: "rgba(14, 165, 233, 0.1)",
  color: "#38bdf8",
  padding: "12px 18px",
  fontWeight: 600,
  fontSize: 13,
  borderBottom: "1px solid #1e293b"
};

const blockHeaderDefendantStyle: React.CSSProperties = {
  background: "rgba(236, 72, 153, 0.1)",
  color: "#f472b6",
  padding: "12px 18px",
  fontWeight: 600,
  fontSize: 13,
  borderBottom: "1px solid #1e293b"
};

const blockContentStyle: React.CSSProperties = {
  padding: "18px"
};

const paragraphStyle: React.CSSProperties = {
  margin: "6px 0 16px 0",
  fontSize: 14,
  lineHeight: 1.6,
  color: "#cbd5e1"
};

const metaBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  fontWeight: 600,
  background: "#1e293b",
  padding: "4px 10px",
  borderRadius: "6px",
  color: "#94a3b8"
};

const emptyDefenseStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: 120,
  color: "#475569",
  fontStyle: "italic",
  fontSize: 14
};

const rulingSectionStyle: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.5)",
  border: "1px solid #334155",
  borderRadius: "12px",
  padding: "20px",
  marginBottom: 24
};

const rulingBoxStyle: React.CSSProperties = {
  background: "#090d16",
  borderRadius: "8px",
  padding: "16px",
  fontSize: 14,
  color: "#cbd5e1"
};

const operationsBarStyle: React.CSSProperties = {
  borderTop: "1px solid #1e293b",
  paddingTop: 24,
  display: "flex",
  flexDirection: "column",
  gap: 16
};

const opCardStyle: React.CSSProperties = {
  background: "#1e293b",
  borderRadius: "12px",
  padding: "20px"
};

const btnPrimaryStyle: React.CSSProperties = {
  background: "#0ea5e9",
  color: "#ffffff",
  border: "none",
  borderRadius: "6px",
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  width: "100%",
  marginTop: 8
};

const noCaseSelectedStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "16px",
  padding: "80px 40px",
  textAlign: "center"
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(15, 23, 42, 0.75)",
  backdropFilter: "blur(8px)",
  display: "grid",
  placeItems: "center",
  zIndex: 100,
  padding: 20
};

const modalContentStyle: React.CSSProperties = {
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "16px",
  padding: "30px",
  maxWidth: 580,
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto"
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#94a3b8",
  marginBottom: 6,
  textTransform: "uppercase"
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#090d16",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: 14,
  boxSizing: "border-box",
  marginBottom: 16
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#090d16",
  border: "1px solid #1e293b",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: 14,
  boxSizing: "border-box",
  marginBottom: 12,
  fontFamily: "inherit"
};

const btnSubmitStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
  color: "#ffffff",
  border: "none",
  borderRadius: "8px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 14,
  boxShadow: "0 4px 12px rgba(16, 185, 129, 0.25)"
};

const emptyStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "40px 20px",
  color: "#475569",
  fontSize: 14,
  fontStyle: "italic",
  background: "#0f172a",
  border: "1px solid #1e293b",
  borderRadius: "8px"
};
