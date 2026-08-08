import React from "react";
import { useAccount } from "@/context/AccountContext";
import { ChevronDown, Wallet, Layers } from "lucide-react";
import { Link } from "react-router-dom";

export default function AccountSwitcher({ compact = false }) {
  const { accounts, activeId, active, setActive } = useAccount();
  const [open, setOpen] = React.useState(false);

  const totalBalance = accounts.reduce((s,a) => s + (a.balance || 0), 0);

  return (
    <div className="relative" data-testid="account-switcher">
      <button onClick={()=>setOpen(!open)} data-testid="account-switcher-btn"
        className={`flex items-center gap-2 rounded-xl border border-[#E8E8F1] bg-white hover:border-[#7C3AED] text-sm ${compact?"h-9 px-3":"h-11 px-4"}`}>
        <div className={`rounded-lg bg-[#F3E8FF] flex items-center justify-center ${compact?"w-6 h-6":"w-8 h-8"}`}>
          {activeId==="all" ? <Layers className="w-3.5 h-3.5 text-[#7C3AED]"/> : <Wallet className="w-3.5 h-3.5 text-[#7C3AED]"/>}
        </div>
        <div className="text-left">
          <div className="font-semibold leading-tight">{activeId==="all"?"All Accounts":active?.name||"—"}</div>
          <div className="text-[10px] text-[#6D6D82] tjfx-mono leading-tight">
            {activeId==="all" ? `${accounts.length} accounts · $${totalBalance.toFixed(2)}` : `${active?.account_type||""} · $${(active?.balance||0).toFixed(2)}`}
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-[#6D6D82]"/>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={()=>setOpen(false)}/>
          <div className="absolute z-50 mt-2 w-72 rounded-2xl border border-[#E8E8F1] bg-white shadow-xl p-2 animate-in" data-testid="account-switcher-menu">
            <button onClick={()=>{setActive("all"); setOpen(false);}} data-testid="acc-opt-all"
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left ${activeId==="all"?"bg-[#F3E8FF]":"hover:bg-[#F6F6FB]"}`}>
              <div className="w-8 h-8 rounded-lg bg-[#F3E8FF] flex items-center justify-center"><Layers className="w-4 h-4 text-[#7C3AED]"/></div>
              <div>
                <div className="text-sm font-semibold">All Accounts</div>
                <div className="text-[11px] text-[#6D6D82] tjfx-mono">{accounts.length} · $ {totalBalance.toFixed(2)}</div>
              </div>
            </button>
            <div className="text-[10px] text-[#A1A1AA] px-3 py-1 uppercase tracking-wide">Accounts</div>
            {accounts.length===0 && <div className="p-3 text-xs text-[#6D6D82]">No accounts yet. <Link to="/settings" className="text-[#7C3AED] font-medium">Add one</Link></div>}
            {accounts.map(a => (
              <button key={a.id} onClick={()=>{setActive(a.id); setOpen(false);}} data-testid={`acc-opt-${a.id}`}
                className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left ${activeId===a.id?"bg-[#F3E8FF]":"hover:bg-[#F6F6FB]"}`}>
                <div className="w-8 h-8 rounded-lg bg-[#F3E8FF] flex items-center justify-center"><Wallet className="w-4 h-4 text-[#7C3AED]"/></div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{a.name}</div>
                  <div className="text-[11px] text-[#6D6D82] truncate">{a.broker} · {a.account_type}</div>
                </div>
                <div className="text-xs tjfx-mono text-[#6D6D82]">${(a.balance||0).toFixed(2)}</div>
              </button>
            ))}
            <Link to="/settings" onClick={()=>setOpen(false)} className="block text-center text-xs text-[#7C3AED] font-medium py-2 hover:bg-[#F6F6FB] rounded-lg">+ Manage accounts</Link>
          </div>
        </>
      )}
    </div>
  );
}
