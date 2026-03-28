import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase.js";

const MOODS = [
  { emoji: "🌟", label: "Amazing", color: "#8B7355", bg: "rgba(139,115,85,0.07)" },
  { emoji: "😊", label: "Good", color: "#7A9E7E", bg: "rgba(122,158,126,0.07)" },
  { emoji: "😐", label: "Meh", color: "#A09890", bg: "rgba(160,152,144,0.07)" },
  { emoji: "😔", label: "Low", color: "#8891A5", bg: "rgba(136,145,165,0.07)" },
  { emoji: "😤", label: "Tough", color: "#B8806A", bg: "rgba(184,128,106,0.07)" },
];
const PROMPTS = ["What was the highlight of your day?","What challenged you today?","What are you grateful for right now?","What did you learn today?","Who made your day better?","What would you do differently?","What surprised you today?","What's on your mind right now?"];
const TAGS = ["work","personal","health","relationships","creativity","learning","travel","self-care"];
const GOAL_ICONS = ["🎯","💪","📚","💰","✈️","🧠","❤️","🚀","🎨","🏃"];

const getGreeting = () => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; };
const fmtDate = (d) => new Date(d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const daysLeft = () => Math.max(0, Math.ceil((new Date(2026,11,31) - new Date()) / 86400000));
const yearPct = () => Math.min(100, Math.max(0, ((new Date() - new Date(2026,0,1)) / (new Date(2026,11,31) - new Date(2026,0,1))) * 100));

function TypeWriter({ text, speed = 16 }) {
  const [d, setD] = useState("");
  const i = useRef(0);
  useEffect(() => {
    setD(""); i.current = 0;
    if (!text) return;
    const iv = setInterval(() => { i.current++; setD(text.slice(0, i.current)); if (i.current >= text.length) clearInterval(iv); }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);
  return <span>{d}<span className="caret">|</span></span>;
}

function GoalCard({ goal, onUpdate, onRemove, onAddMs, onToggleMs, expanded, onToggle }) {
  const [showMs, setShowMs] = useState(false);
  const [msT, setMsT] = useState("");
  const done = goal.progress >= 100;
  return (
    <div className={"gc" + (done ? " gc-done" : "")}>
      <div className="gc-h" onClick={onToggle}>
        <span className="gc-i">{goal.icon}</span>
        <div className="gc-inf">
          <div className="gc-n">{goal.text}</div>
          <div className="gc-br">
            <div className="gc-tr"><div className="gc-fl" style={{ width: goal.progress + "%", background: done ? "#7A9E7E" : "var(--stone)" }} /></div>
            <span className="gc-p">{goal.progress}%</span>
          </div>
        </div>
        <span className="gc-ar">{expanded ? "−" : "+"}</span>
      </div>
      {expanded && (
        <div className="gc-b">
          <div className="gc-btns">
            {[-10,-5,5,10].map(v => (
              <button key={v} className={"gb" + (v > 0 ? " pl" : "")} onClick={() => onUpdate(goal.id, v)}>{v > 0 ? "+" : ""}{v}</button>
            ))}
          </div>
          <div className="ms-s">
            <div className="ms-l">Milestones</div>
            {(goal.milestones || []).map(m => (
              <div key={m.id} className="ms-i" onClick={() => onToggleMs(goal.id, m.id)}>
                <span className={"ms-c" + (m.done ? " dn" : "")}>{m.done ? "✓" : ""}</span>
                <span className={"ms-t" + (m.done ? " dn" : "")}>{m.text}</span>
              </div>
            ))}
            {showMs ? (
              <input className="ms-in" placeholder="e.g. Complete Week 1" value={msT} autoFocus
                onChange={e => setMsT(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && msT.trim()) { onAddMs(goal.id, msT.trim()); setMsT(""); setShowMs(false); } }}
                onBlur={() => { if (!msT.trim()) setShowMs(false); }} />
            ) : <button className="ms-a" onClick={() => setShowMs(true)}>+ Add milestone</button>}
          </div>
          <button className="gc-rm" onClick={() => onRemove(goal.id)}>Remove</button>
        </div>
      )}
    </div>
  );
}

function GoalsPanel({ goals, setGoals, saveGoal, deleteGoal, updateGoal }) {
  const [nw, setNw] = useState("");
  const [ic, setIc] = useState(0);
  const [adding, setAdding] = useState(false);
  const [exp, setExp] = useState(null);
  const r = useRef(null);
  useEffect(() => { if (adding && r.current) r.current.focus(); }, [adding]);

  const add = async () => {
    if (!nw.trim()) return;
    const goal = { text: nw.trim(), icon: GOAL_ICONS[ic], progress: 0, milestones: [] };
    const saved = await saveGoal(goal);
    if (saved) { setGoals(p => [...p, saved]); }
    setNw(""); setIc(0); setAdding(false);
  };

  const upd = async (id, d) => {
    const goal = goals.find(g => g.id === id);
    if (!goal) return;
    const newProgress = Math.max(0, Math.min(100, goal.progress + d));
    await updateGoal(id, { progress: newProgress });
    setGoals(p => p.map(g => g.id === id ? { ...g, progress: newProgress } : g));
  };

  const rm = async (id) => {
    await deleteGoal(id);
    setGoals(p => p.filter(g => g.id !== id));
  };

  const aMs = async (gid, t) => {
    const goal = goals.find(g => g.id === gid);
    if (!goal) return;
    const newMs = [...(goal.milestones || []), { id: Date.now(), text: t, done: false }];
    await updateGoal(gid, { milestones: newMs });
    setGoals(p => p.map(g => g.id === gid ? { ...g, milestones: newMs } : g));
  };

  const tMs = async (gid, mid) => {
    const goal = goals.find(g => g.id === gid);
    if (!goal) return;
    const newMs = (goal.milestones || []).map(m => m.id === mid ? { ...m, done: !m.done } : m);
    await updateGoal(gid, { milestones: newMs });
    setGoals(p => p.map(g => g.id === gid ? { ...g, milestones: newMs } : g));
  };

  const comp = goals.filter(g => g.progress >= 100).length;
  const avg = goals.length ? Math.round(goals.reduce((s, g) => s + g.progress, 0) / goals.length) : 0;

  return (
    <div>
      <p className="side-yr">2026</p>
      <h2 className="side-title">Goals</h2>
      <p className="side-sub">{daysLeft()} days remaining this year</p>
      <div className="yp">
        <div className="yp-r"><span>Year progress</span><span>{Math.round(yearPct())}%</span></div>
        <div className="yp-tr"><div className="yp-fl" style={{ width: yearPct() + "%" }} /></div>
      </div>
      {goals.length > 0 && (
        <div className="gs-row">
          {[["Goals",goals.length],["Done",comp],["Avg",avg+"%"]].map(([l,v]) => (
            <div key={l} className="gs-card"><div className="gs-v">{v}</div><div className="gs-l">{l}</div></div>
          ))}
        </div>
      )}
      <div className="gc-list">
        {goals.map(g => <GoalCard key={g.id} goal={g} onUpdate={upd} onRemove={rm} onAddMs={aMs} onToggleMs={tMs}
          expanded={exp === g.id} onToggle={() => setExp(exp === g.id ? null : g.id)} />)}
      </div>
      {adding ? (
        <div className="af">
          <div className="af-icons">{GOAL_ICONS.map((x, i) => (
            <button key={i} className={"af-ib" + (ic === i ? " s" : "")} onClick={() => setIc(i)}>{x}</button>
          ))}</div>
          <input ref={r} className="af-inp" placeholder="e.g. Run a half marathon" value={nw}
            onChange={e => setNw(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
          <div className="af-act">
            <button className="af-c" onClick={() => { setAdding(false); setNw(""); }}>Cancel</button>
            <button className="af-a" disabled={!nw.trim()} onClick={add}>Add</button>
          </div>
        </div>
      ) : <button className="af-trig" onClick={() => setAdding(true)}>+ Add a goal</button>}
      {goals.length === 0 && <p className="side-empty">Set your intentions for 2026 and revisit them with each reflection.</p>}
    </div>
  );
}

export default function App() {
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState(null);
  const [journal, setJournal] = useState("");
  const [selTags, setSelTags] = useState([]);
  const [pIdx, setPIdx] = useState(0);
  const [refl, setRefl] = useState("");
  const [isGen, setIsGen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [hist, setHist] = useState(false);
  const [expE, setExpE] = useState(null);
  const [goals, setGoals] = useState([]);
  const [sOpen, setSOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const tR = useRef(null);
  const [ch, setCh] = useState(0);

  // ── Load data from Supabase on mount ──
  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: ent }, { data: gls }] = await Promise.all([
          supabase.from("entries").select("*").order("created_at", { ascending: false }),
          supabase.from("goals").select("*").order("created_at", { ascending: true }),
        ]);
        if (ent) setEntries(ent);
        if (gls) setGoals(gls);
      } catch (err) { console.error("Load error:", err); }
      setLoading(false);
    };
    load();
    setPIdx(Math.floor(Math.random() * PROMPTS.length));
  }, []);

  useEffect(() => { if (step === 1 && tR.current) tR.current.focus(); }, [step]);

  // ── Supabase CRUD helpers ──
  const saveEntry = useCallback(async (entry) => {
    const row = {
      mood_emoji: entry.mood?.emoji || null,
      mood_label: entry.mood?.label || null,
      journal: entry.journal,
      tags: entry.tags,
      reflection: entry.reflection,
    };
    const { data, error } = await supabase.from("entries").insert(row).select().single();
    if (error) { console.error("Save entry error:", error); return null; }
    return data;
  }, []);

  const saveGoal = useCallback(async (goal) => {
    const { data, error } = await supabase.from("goals").insert({
      text: goal.text, icon: goal.icon, progress: goal.progress, milestones: goal.milestones,
    }).select().single();
    if (error) { console.error("Save goal error:", error); return null; }
    return data;
  }, []);

  const deleteGoal = useCallback(async (id) => {
    await supabase.from("goals").delete().eq("id", id);
  }, []);

  const updateGoal = useCallback(async (id, updates) => {
    await supabase.from("goals").update(updates).eq("id", id);
  }, []);

  // ── AI Reflection ──
  const genRefl = async () => {
    setIsGen(true); setStep(3);
    try {
      const ml = mood !== null ? MOODS[mood].label : "not specified";
      const ts = selTags.length > 0 ? selTags.join(", ") : "none";
      const gs = goals.length > 0 ? goals.map(g => `${g.icon} ${g.text} (${g.progress}%)`).join("; ") : "none set";

      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content: `You are a warm, thoughtful journaling companion. Based on a diary entry, provide:
1. **A Reflection** — Empathetic reflection on their day (2-3 sentences).
2. **A Lesson or Insight** — One meaningful takeaway (1-2 sentences).
3. **Goal Connection** — If any 2026 goals relate to today's entry, mention it with encouragement (1-2 sentences). Skip if none connect.
4. **A Gentle Prompt for Tomorrow** — One question or tiny challenge (1 sentence).
Be warm, genuine, concise. No platitudes. Be specific.
Mood: ${ml} | Tags: ${ts} | 2026 goals: ${gs}
Entry: "${journal}"` }] }),
      });
      const data = await res.json();
      setRefl(data.content?.map(c => c.text || "").join("\n") || "Sit with what you wrote today. The act of noticing is itself the lesson.");
    } catch { setRefl("Sit with what you wrote today. Every entry is a quiet step toward clarity."); }
    setIsGen(false);
  };

  const save = async () => {
    const entry = { mood: mood !== null ? MOODS[mood] : null, journal, tags: selTags, reflection: refl };
    const saved = await saveEntry(entry);
    if (saved) { setEntries(p => [saved, ...p]); }
    setStep(4);
  };

  const reset = () => { setStep(0); setMood(null); setJournal(""); setSelTags([]); setRefl(""); setCh(0); setPIdx(Math.floor(Math.random() * PROMPTS.length)); };

  if (loading) {
    return (
      <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#F7F5F2", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#A39E98", fontSize: 16 }}>
        Loading your diary...
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300;1,400&display=swap');
        :root{--serif:'Cormorant Garamond',Georgia,serif;--sans:'DM Sans',-apple-system,sans-serif;--bg:#F7F5F2;--surface:#FFF;--surface-alt:#F0EDE9;--ink:#2C2825;--ink2:#6B6560;--ink3:#A39E98;--stone:#8B7355;--stone-l:rgba(139,115,85,0.08);--bd:rgba(0,0,0,0.06);--bdh:rgba(0,0,0,0.10);--sh-s:0 1px 3px rgba(0,0,0,0.04);--sh-m:0 4px 16px rgba(0,0,0,0.05);--sh-l:0 8px 30px rgba(0,0,0,0.06);--r:14px}
        .dr{font-family:var(--sans);background:var(--bg);color:var(--ink);min-height:100vh;-webkit-font-smoothing:antialiased;letter-spacing:-0.01em}
        .dr *{box-sizing:border-box;margin:0;padding:0}
        .layout{display:flex;min-height:100vh}
        .side{width:300px;min-width:300px;background:var(--surface);border-right:1px solid var(--bd);padding:40px 28px;overflow-y:auto;max-height:100vh;position:sticky;top:0}
        .s-tog{display:none;position:fixed;bottom:28px;left:28px;z-index:100;background:var(--surface);border:1px solid var(--bd);color:var(--ink);width:44px;height:44px;border-radius:22px;font-size:18px;cursor:pointer;box-shadow:var(--sh-m);font-family:inherit;align-items:center;justify-content:center}
        .s-ov{display:none}
        @media(max-width:860px){.side{position:fixed;left:0;top:0;height:100vh;z-index:90;transform:translateX(-100%);transition:transform .3s ease;box-shadow:var(--sh-l)}.side.open{transform:translateX(0)}.s-tog{display:flex}.s-ov{display:block;position:fixed;inset:0;z-index:80;background:rgba(44,40,37,0.15);opacity:0;pointer-events:none;transition:opacity .3s}.s-ov.vis{opacity:1;pointer-events:auto}}
        .main{flex:1;min-width:0;padding:56px 48px 96px;max-width:660px;margin:0 auto}
        @media(max-width:860px){.main{padding:36px 24px 80px}}
        .side-yr{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--stone);margin-bottom:8px;font-weight:500}
        .side-title{font-family:var(--serif);font-size:30px;font-weight:400;color:var(--ink);margin-bottom:4px;letter-spacing:-0.02em}
        .side-sub{font-size:14px;color:var(--ink3);margin-bottom:28px;font-weight:300}
        .side-empty{font-size:14px;color:var(--ink3);line-height:1.7;text-align:center;padding:24px 0;font-weight:300}
        .yp{margin-bottom:28px}.yp-r{display:flex;justify-content:space-between;font-size:12px;color:var(--ink3);text-transform:uppercase;letter-spacing:1.2px;margin-bottom:8px;font-weight:500}.yp-tr{height:2px;background:var(--surface-alt);border-radius:2px;overflow:hidden}.yp-fl{height:100%;background:var(--stone);border-radius:2px;transition:width 1s}
        .gs-row{display:flex;gap:8px;margin-bottom:28px}.gs-card{flex:1;text-align:center;background:var(--surface-alt);border-radius:10px;padding:14px 4px}.gs-v{font-family:var(--serif);font-size:24px;color:var(--ink);font-weight:400}.gs-l{font-size:11px;color:var(--ink3);text-transform:uppercase;letter-spacing:1px;margin-top:3px;font-weight:500}
        .gc-list{display:flex;flex-direction:column;gap:6px;margin-bottom:18px}.gc{background:var(--surface-alt);border-radius:10px;overflow:hidden;transition:all .2s}.gc:hover{background:#EBE8E4}.gc-done{background:rgba(122,158,126,0.08)}
        .gc-h{display:flex;align-items:center;gap:10px;padding:13px 14px;cursor:pointer}.gc-i{font-size:19px;flex-shrink:0}.gc-inf{flex:1;min-width:0}.gc-n{font-size:14px;color:var(--ink);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.gc-br{display:flex;align-items:center;gap:8px}.gc-tr{flex:1;height:2px;background:var(--bd);border-radius:2px;overflow:hidden}.gc-fl{height:100%;border-radius:2px;transition:width .4s}.gc-p{font-size:12px;color:var(--ink3);min-width:28px;text-align:right;font-weight:500}.gc-ar{color:var(--ink3);font-size:15px;flex-shrink:0;font-weight:300}
        .gc-b{padding:2px 14px 14px;animation:fu .2s}.gc-btns{display:flex;gap:6px;margin:10px 0}.gb{flex:1;padding:7px;border-radius:8px;border:none;background:var(--surface);color:var(--ink3);font-size:13px;cursor:pointer;font-family:inherit;transition:all .15s;font-weight:500}.gb:hover{color:var(--ink)}.gb.pl{background:var(--stone-l);color:var(--stone)}.gb.pl:hover{opacity:.8}
        .ms-s{margin-top:6px}.ms-l{font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:var(--ink3);margin-bottom:8px;font-weight:500}.ms-i{display:flex;align-items:center;gap:8px;padding:4px 0;cursor:pointer}.ms-c{width:18px;height:18px;border-radius:4px;border:1.5px solid var(--bdh);display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--stone);flex-shrink:0;transition:all .15s}.ms-c.dn{background:var(--stone);color:#FFF;border-color:var(--stone)}.ms-t{font-size:14px;color:var(--ink2)}.ms-t.dn{text-decoration:line-through;color:var(--ink3)}.ms-a{background:none;border:none;color:var(--ink3);font-size:13px;cursor:pointer;padding:4px 0;font-family:inherit}.ms-a:hover{color:var(--stone)}.ms-in{width:100%;background:var(--surface);border:1px solid var(--bd);border-radius:8px;padding:7px 10px;font-size:14px;color:var(--ink);font-family:inherit;outline:none;margin-top:4px}.ms-in:focus{border-color:var(--stone)}.gc-rm{margin-top:12px;background:none;border:none;color:#B8806A;font-size:13px;cursor:pointer;font-family:inherit;opacity:.6}.gc-rm:hover{opacity:1}
        .af-trig{width:100%;padding:13px;border-radius:10px;border:1.5px dashed var(--bdh);background:transparent;color:var(--ink3);font-size:15px;cursor:pointer;font-family:inherit;transition:all .2s}.af-trig:hover{border-color:var(--stone);color:var(--stone);background:var(--stone-l)}.af{background:var(--surface-alt);border-radius:10px;padding:16px;animation:fu .2s}.af-icons{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px}.af-ib{width:32px;height:32px;border-radius:8px;border:none;background:var(--surface);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s}.af-ib:hover{background:#EBE8E4}.af-ib.s{background:var(--stone-l);box-shadow:0 0 0 1.5px var(--stone)}.af-inp{width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--bd);background:var(--surface);color:var(--ink);font-size:15px;font-family:inherit;outline:none;margin-bottom:10px}.af-inp:focus{border-color:var(--stone)}.af-inp::placeholder{color:var(--ink3)}.af-act{display:flex;gap:8px;justify-content:flex-end}.af-c{padding:7px 16px;border-radius:8px;border:none;background:var(--surface);color:var(--ink3);font-size:14px;cursor:pointer;font-family:inherit}.af-a{padding:7px 16px;border-radius:8px;border:none;background:var(--stone);color:#FFF;font-size:14px;cursor:pointer;font-family:inherit;font-weight:500}.af-a:disabled{opacity:.3;cursor:not-allowed}
        .hdr{margin-bottom:56px;animation:fd .6s ease}.hdr-d{font-size:14px;color:var(--ink3);margin-bottom:12px;letter-spacing:1px;text-transform:uppercase;font-weight:500}.hdr-g{font-family:var(--serif);font-size:48px;font-weight:300;color:var(--ink);line-height:1.1;margin-bottom:8px;letter-spacing:-0.03em}.hdr-s{font-size:17px;color:var(--ink3);font-weight:300}
        .nav{display:flex;gap:0;margin-bottom:44px}.np{flex:1;background:transparent;border:none;border-bottom:1.5px solid transparent;color:var(--ink3);padding:10px 0;font-size:15px;cursor:pointer;font-family:inherit;transition:all .25s;font-weight:400;letter-spacing:.3px}.np:hover{color:var(--ink2)}.np.act{color:var(--ink);border-bottom-color:var(--stone)}
        .ss{animation:fu .4s}.sl{font-size:13px;letter-spacing:2px;text-transform:uppercase;color:var(--ink3);margin-bottom:20px;font-weight:500}.st{font-family:var(--serif);font-size:34px;font-weight:300;color:var(--ink);margin-bottom:8px;letter-spacing:-0.02em}.sd{font-size:16px;color:var(--ink3);margin-bottom:32px;font-weight:300;line-height:1.6}
        .mg{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}.mmb{display:flex;flex-direction:column;align-items:center;gap:8px;padding:20px 18px;border-radius:var(--r);background:var(--surface);border:1.5px solid transparent;cursor:pointer;transition:all .25s;font-family:inherit;min-width:82px;box-shadow:var(--sh-s)}.mmb:hover{transform:translateY(-2px);box-shadow:var(--sh-m)}.mmb.sel{border-color:var(--stone);box-shadow:var(--sh-m)}.me{font-size:30px}.ml{font-size:13px;color:var(--ink3);font-weight:400;letter-spacing:.5px}.mmb.sel .ml{color:var(--stone)}
        .jp{font-family:var(--serif);font-size:21px;color:var(--ink3);margin-bottom:16px;padding-left:16px;border-left:1.5px solid var(--stone);font-weight:300;font-style:italic;line-height:1.4}.jt{width:100%;min-height:220px;background:var(--surface);border:1px solid var(--bd);border-radius:var(--r);padding:24px;font-family:var(--sans);font-size:16px;line-height:1.9;color:var(--ink);resize:vertical;outline:none;transition:border-color .2s,box-shadow .2s;box-shadow:var(--sh-s);font-weight:300}.jt::placeholder{color:var(--ink3)}.jt:focus{border-color:var(--stone);box-shadow:0 0 0 3px var(--stone-l)}.cc{text-align:right;font-size:13px;color:var(--ink3);margin-top:8px}.pr{background:none;border:1px solid var(--bd);color:var(--ink3);font-size:13px;padding:3px 10px;border-radius:6px;cursor:pointer;font-family:inherit;margin-left:10px;transition:all .15s}.pr:hover{color:var(--stone);border-color:var(--stone)}
        .tg{display:flex;flex-wrap:wrap;gap:8px}.tc{padding:9px 20px;border-radius:20px;background:var(--surface);border:1px solid var(--bd);color:var(--ink2);font-size:15px;cursor:pointer;transition:all .2s;font-family:inherit;box-shadow:var(--sh-s)}.tc:hover{border-color:var(--bdh);color:var(--ink)}.tc.sel{background:var(--stone);color:#FFF;border-color:var(--stone)}
        .rc{background:var(--surface);border:none;border-radius:var(--r);padding:32px;box-shadow:var(--sh-m);position:relative;overflow:hidden}.rc::before{content:'';position:absolute;top:0;left:0;width:2px;height:100%;background:var(--stone);opacity:.3}.rt{font-size:16px;line-height:2;color:var(--ink);font-weight:300;white-space:pre-wrap;padding-left:4px}
        .gen{display:flex;flex-direction:column;align-items:center;gap:20px;padding:56px 0}.gd{display:flex;gap:6px}.dot{width:6px;height:6px;border-radius:50%;background:var(--stone);animation:pu 1.6s infinite;opacity:.25}.dot:nth-child(2){animation-delay:.25s}.dot:nth-child(3){animation-delay:.5s}.gt{font-size:15px;color:var(--ink3);font-weight:300;font-style:italic}
        .bp{background:var(--stone);color:#FFF;border:none;padding:14px 34px;border-radius:10px;font-size:16px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .2s;margin-top:32px}.bp:hover{opacity:.88}.bp:disabled{opacity:.3;cursor:not-allowed}.bs{background:transparent;color:var(--ink3);border:1px solid var(--bd);padding:11px 24px;border-radius:10px;font-size:15px;cursor:pointer;font-family:inherit;transition:all .15s}.bs:hover{border-color:var(--bdh);color:var(--ink2)}.br{display:flex;gap:10px;align-items:center;margin-top:32px;flex-wrap:wrap}
        .pb{display:flex;gap:8px;justify-content:center;margin-bottom:40px}.pd{width:5px;height:5px;border-radius:50%;background:var(--bdh);transition:all .3s}.pd.act{background:var(--stone);transform:scale(1.5)}.pd.dn{background:var(--stone);opacity:.25}
        .he{background:var(--surface);border:none;border-radius:var(--r);padding:22px 24px;margin-bottom:10px;cursor:pointer;transition:all .2s;box-shadow:var(--sh-s)}.he:hover{box-shadow:var(--sh-m)}.hed{font-size:13px;color:var(--ink3);letter-spacing:1px;text-transform:uppercase;font-weight:500}.hp{font-size:15px;color:var(--ink2);margin-top:8px;line-height:1.6;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-weight:300}.hm{display:inline-flex;align-items:center;gap:5px;margin-top:6px;font-size:14px;color:var(--ink3)}.ht{display:flex;gap:5px;margin-top:10px;flex-wrap:wrap}.htg{font-size:12px;padding:3px 9px;border-radius:6px;background:var(--surface-alt);color:var(--ink3);font-weight:500;letter-spacing:.3px}
        .ex{margin-top:18px;padding-top:18px;border-top:1px solid var(--bd);animation:fu .2s}.el{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink3);margin-bottom:8px;font-weight:500}.et{font-size:15px;color:var(--ink2);line-height:1.8;white-space:pre-wrap;font-weight:300}
        .si{font-size:48px;text-align:center;margin-bottom:16px;animation:sci .4s}.sm{font-family:var(--serif);font-size:32px;text-align:center;color:var(--ink);margin-bottom:8px;font-weight:300;letter-spacing:-0.02em}.ssb{text-align:center;font-size:16px;color:var(--ink3);font-weight:300}.es{text-align:center;padding:40px 0;color:var(--ink3);font-size:16px;font-weight:300}.caret{animation:bl 1s step-end infinite;font-weight:200;color:var(--stone)}
        @keyframes fu{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fd{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes sci{from{opacity:0;transform:scale(.8)}to{opacity:1;transform:scale(1)}}
        @keyframes pu{0%,100%{opacity:.2;transform:scale(1)}50%{opacity:.8;transform:scale(1.1)}}
        @keyframes bl{50%{opacity:0}}
      `}</style>

      <div className="dr">
        <button className="s-tog" onClick={() => setSOpen(!sOpen)}>{sOpen ? "✕" : "🎯"}</button>
        <div className={"s-ov" + (sOpen ? " vis" : "")} onClick={() => setSOpen(false)} />
        <div className="layout">
          <aside className={"side" + (sOpen ? " open" : "")}>
            <GoalsPanel goals={goals} setGoals={setGoals} saveGoal={saveGoal} deleteGoal={deleteGoal} updateGoal={updateGoal} />
          </aside>
          <main className="main">
            <div className="hdr">
              <div className="hdr-d">{fmtDate(new Date())}</div>
              <h1 className="hdr-g">{getGreeting()}.</h1>
              <p className="hdr-s">A quiet space to reflect, capture, and grow.</p>
            </div>
            <div className="nav">
              <button className={"np" + (!hist ? " act" : "")} onClick={() => setHist(false)}>Today's Entry</button>
              <button className={"np" + (hist ? " act" : "")} onClick={() => setHist(true)}>Past Entries{entries.length > 0 && ` (${entries.length})`}</button>
            </div>
            {hist ? (
              <div className="ss">
                <div className="sl">Your Journey</div>
                {entries.length === 0 ? <div className="es">No entries yet. Begin your first reflection today.</div> :
                  entries.map(e => (
                    <div key={e.id} className="he" onClick={() => setExpE(expE === e.id ? null : e.id)}>
                      <div className="hed">{fmtDate(e.created_at)}</div>
                      {e.mood_emoji && <div className="hm">{e.mood_emoji} {e.mood_label}</div>}
                      <div className="hp">{e.journal}</div>
                      {e.tags?.length > 0 && <div className="ht">{e.tags.map(t => <span key={t} className="htg">{t}</span>)}</div>}
                      {expE === e.id && (
                        <div className="ex">
                          <div className="el">Full Entry</div><div className="et">{e.journal}</div>
                          {e.reflection && <><div className="el" style={{marginTop:16}}>AI Reflection</div><div className="et">{e.reflection}</div></>}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <>
                {step < 4 && <div className="pb">{[0,1,2,3].map(i => <div key={i} className={"pd" + (i === step ? " act" : i < step ? " dn" : "")} />)}</div>}
                {step === 0 && (
                  <div className="ss">
                    <div className="sl">Step One</div>
                    <h2 className="st">How are you feeling?</h2>
                    <p className="sd">Choose what resonates with your day so far.</p>
                    <div className="mg">{MOODS.map((m, i) => (
                      <button key={m.label} className={"mmb" + (mood === i ? " sel" : "")} onClick={() => setMood(i)}>
                        <span className="me">{m.emoji}</span><span className="ml">{m.label}</span>
                      </button>
                    ))}</div>
                    <div style={{textAlign:"center"}}><button className="bp" disabled={mood === null} onClick={() => setStep(1)}>Continue</button></div>
                  </div>
                )}
                {step === 1 && (
                  <div className="ss">
                    <div className="sl">Step Two</div>
                    <h2 className="st">Tell me about your day.</h2>
                    <div>
                      <div className="jp">{PROMPTS[pIdx]}<button className="pr" onClick={() => setPIdx((pIdx+1) % PROMPTS.length)}>↻ new</button></div>
                      <textarea ref={tR} className="jt" placeholder="Let your thoughts arrive naturally..." value={journal} onChange={e => { setJournal(e.target.value); setCh(e.target.value.length); }} />
                      <div className="cc">{ch} characters</div>
                    </div>
                    <div className="br"><button className="bs" onClick={() => setStep(0)}>← Back</button><button className="bp" disabled={journal.trim().length < 10} onClick={() => setStep(2)}>Continue</button></div>
                  </div>
                )}
                {step === 2 && (
                  <div className="ss">
                    <div className="sl">Step Three</div>
                    <h2 className="st">Tag your day.</h2>
                    <p className="sd">Select any themes present today. These help reveal patterns over time.</p>
                    <div className="tg">{TAGS.map(t => <button key={t} className={"tc" + (selTags.includes(t) ? " sel" : "")} onClick={() => setSelTags(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])}>{t}</button>)}</div>
                    <div className="br"><button className="bs" onClick={() => setStep(1)}>← Back</button><button className="bp" onClick={genRefl}>Generate Reflection</button></div>
                  </div>
                )}
                {step === 3 && (
                  <div className="ss">
                    <div className="sl">Reflection</div>
                    <h2 className="st">Here's what I noticed.</h2>
                    {isGen ? (
                      <div className="gen"><div className="gd"><div className="dot"/><div className="dot"/><div className="dot"/></div><div className="gt">Reading between the lines...</div></div>
                    ) : (
                      <><div className="rc"><div className="rt"><TypeWriter text={refl} speed={14}/></div></div>
                        <div className="br"><button className="bs" onClick={() => setStep(2)}>← Back</button><button className="bp" onClick={save}>Save Entry</button></div></>
                    )}
                  </div>
                )}
                {step === 4 && (
                  <div className="ss">
                    <div className="si">📖</div>
                    <div className="sm">Entry saved.</div>
                    <div className="ssb">Another quiet mark in the arc of your year.</div>
                    <div style={{textAlign:"center"}}>
                      <button className="bp" onClick={reset}>Write Another</button>
                      <div style={{marginTop:14}}><button className="bs" onClick={() => setHist(true)}>View Past Entries</button></div>
                    </div>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
