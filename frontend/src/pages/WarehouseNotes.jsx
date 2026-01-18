import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "flowerama_warehouse_notes_v1";

// Small helper to format date as YYYY-MM-DD
function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveAll(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export default function WarehouseNotes() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [noteText, setNoteText] = useState("");
  const [allNotes, setAllNotes] = useState({});

  useEffect(() => {
    setAllNotes(loadAll());
  }, []);

  useEffect(() => {
    // Persist any time notes change
    saveAll(allNotes);
  }, [allNotes]);

  const notesForDay = useMemo(() => {
    return allNotes[selectedDate] || [];
  }, [allNotes, selectedDate]);

  function addNote() {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    const newNote = {
      id: crypto?.randomUUID?.() || String(Date.now()),
      text: trimmed,
      createdAt: new Date().toISOString(),
    };

    setAllNotes((prev) => {
      const next = { ...prev };
      const existing = next[selectedDate] || [];
      next[selectedDate] = [newNote, ...existing];
      return next;
    });

    setNoteText("");
  }

  function deleteNote(id) {
    setAllNotes((prev) => {
      const next = { ...prev };
      next[selectedDate] = (next[selectedDate] || []).filter((n) => n.id !== id);
      return next;
    });
  }

  return (
    <div className="page">
      <div className="card">
        <h1 className="page-title">Warehouse Daily Notes</h1>
        <p className="page-subtitle">
          Pick a date, add production notes, and review what's needed for the next day.
        </p>

        <div className="notes-controls">
          <div className="field">
            <label className="label">Date</label>
            <input
              className="input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Production Notes</label>
            <textarea
              className="textarea"
              rows={4}
              placeholder="Example: Prep 24 dozen roses, 12 mixed bouquets, restock ribbon, confirm vase delivery…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
            />
          </div>

          <button className="btn primary" onClick={addNote}>
            Save Note
          </button>
        </div>

        <div className="notes-list">
          <div className="notes-header">
            <h2>Notes for {selectedDate}</h2>
            <span className="notes-count">{notesForDay.length} item(s)</span>
          </div>

          {notesForDay.length === 0 ? (
            <div className="empty">No notes yet for this date.</div>
          ) : (
            <ul className="notes-ul">
              {notesForDay.map((n) => (
                <li key={n.id} className="note-item">
                  <div className="note-text">{n.text}</div>
                  <div className="note-meta">
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                    <button className="btn danger small" onClick={() => deleteNote(n.id)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="notice">
          Note: Tonight this saves to your browser only (localStorage). Tomorrow we can make it shared for the whole team.
        </div>
      </div>
    </div>
  );
}






