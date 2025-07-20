import React, { useState, useEffect } from "react";

// --- Environment variable: Backend API URL ---
// Ensure you set REACT_APP_API_URL in your .env file at build time
const API_URL = process.env.REACT_APP_API_URL;

// Utility to fetch with auth token (from localStorage)
const fetchWithAuth = (url, options = {}) => {
  const token = localStorage.getItem("auth_token");
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "Content-Type": "application/json",
    },
  });
};

// ===============================
// PUBLIC_INTERFACE
// Main App
// ===============================
function App() {
  // --- UI and User State ---
  const [theme] = useState("light");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Auth Forms State ---
  const [authMode, setAuthMode] = useState("login"); // "login" | "signup"
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [authError, setAuthError] = useState("");

  // --- Notes State ---
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [activeNoteId, setActiveNoteId] = useState(null); // id of selected note
  const [activeNoteEdit, setActiveNoteEdit] = useState(false);
  const [noteForm, setNoteForm] = useState({ title: "", content: "" });
  const [noteError, setNoteError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredNotes, setFilteredNotes] = useState([]);

  // ===============================
  // Effect: Check for user session
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const username = localStorage.getItem("user_email");
    if (token && username) {
      setUser({ email: username });
    }
    setLoading(false);
  }, []);

  // ===============================
  // Effect: Fetch notes (on login or refresh)
  useEffect(() => {
    if (user) {
      fetchNotes();
    }
    // eslint-disable-next-line
  }, [user]);

  // ===============================
  // Effect: Filter notes by search
  useEffect(() => {
    let filtered = notes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = notes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.content && n.content.toLowerCase().includes(q))
      );
    }
    setFilteredNotes(filtered);
  }, [searchQuery, notes]);

  // ===============================
  // PUBLIC_INTERFACE
  // Authentication: Login/Signup/Logout
  const handleAuthFormChange = (e) => {
    setAuthForm({ ...authForm, [e.target.name]: e.target.value });
  };

  // PUBLIC_INTERFACE
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      const endpoint =
        authMode === "login" ? "/auth/login" : "/auth/signup";
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Auth failed");
      localStorage.setItem("auth_token", data.token);
      localStorage.setItem("user_email", authForm.email);
      setUser({ email: authForm.email });
      setAuthForm({ email: "", password: "" });
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // PUBLIC_INTERFACE
  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user_email");
    setUser(null);
    setNotes([]);
    setActiveNoteId(null);
    setActiveNoteEdit(false);
    setSearchQuery("");
  };

  // ===============================
  // PUBLIC_INTERFACE
  // CRUD Operations (API)
  const fetchNotes = async () => {
    setNotesLoading(true);
    setNoteError("");
    try {
      const res = await fetchWithAuth(`${API_URL}/notes`);
      if (res.status === 401) throw new Error("Session expired. Log in again.");
      if (!res.ok) throw new Error("Failed to fetch notes.");
      const data = await res.json();
      setNotes(data.notes || []);
      if (data.notes && data.notes.length > 0) {
        setActiveNoteId(data.notes[0].id);
      }
    } catch (e) {
      setNoteError(e.message);
    }
    setNotesLoading(false);
  };

  // PUBLIC_INTERFACE
  const handleSelectNote = (id) => {
    if (activeNoteEdit) return; // disable switching while editing
    setActiveNoteId(id);
    setNoteForm({});
    setActiveNoteEdit(false);
  };

  // PUBLIC_INTERFACE
  const handleNewNote = () => {
    setActiveNoteId(null);
    setActiveNoteEdit(true);
    setNoteForm({ title: "", content: "" });
    setNoteError("");
  };

  // PUBLIC_INTERFACE
  const handleEditNote = () => {
    const note = notes.find((n) => n.id === activeNoteId);
    if (note) {
      setNoteForm({ title: note.title, content: note.content || "" });
      setActiveNoteEdit(true);
      setNoteError("");
    }
  };

  // PUBLIC_INTERFACE
  const handleDeleteNote = async (id) => {
    if (!window.confirm("Delete this note? This action cannot be undone.")) return;
    try {
      const res = await fetchWithAuth(`${API_URL}/notes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed.");
      setNotes((prev) => prev.filter((n) => n.id !== id));
      setActiveNoteId((prev) => {
        const idx = notes.findIndex((n) => n.id === prev);
        // Show previous note, or first, or null
        if (notes.length > 1) {
          const nextIdx = idx === 0 ? 1 : idx - 1;
          return notes[nextIdx]?.id || null;
        }
        return null;
      });
      setNoteError("");
    } catch (err) {
      setNoteError(err.message);
    }
  };

  // PUBLIC_INTERFACE
  const handleNoteFormChange = (e) => {
    setNoteForm({ ...noteForm, [e.target.name]: e.target.value });
  };

  // PUBLIC_INTERFACE
  const handleSaveNote = async (e) => {
    e.preventDefault();
    setNoteError("");
    const { title, content } = noteForm;
    if (!title?.trim()) {
      setNoteError("Note title is required.");
      return;
    }
    try {
      if (activeNoteId && activeNoteEdit) {
        // UPDATE
        const res = await fetchWithAuth(`${API_URL}/notes/${activeNoteId}`, {
          method: "PUT",
          body: JSON.stringify({ title, content }),
        });
        if (!res.ok) throw new Error("Update failed");
        setNotes((prev) =>
          prev.map((n) =>
            n.id === activeNoteId ? { ...n, title, content } : n
          )
        );
        setActiveNoteEdit(false);
      } else {
        // CREATE
        const res = await fetchWithAuth(`${API_URL}/notes`, {
          method: "POST",
          body: JSON.stringify({ title, content }),
        });
        if (!res.ok) throw new Error("Creation failed");
        const data = await res.json();
        setNotes((prev) => [{ ...data.note }, ...prev]);
        setActiveNoteId(data.note.id);
        setActiveNoteEdit(false);
      }
      setNoteForm({});
      setNoteError("");
    } catch (e) {
      setNoteError(e.message);
    }
  };

  // PUBLIC_INTERFACE
  const handleCancelEdit = () => {
    setNoteForm({});
    setActiveNoteEdit(false);
    setNoteError("");
  };

  // ===============================
  // UI RENDERING
  // ===============================

  // Auth UI
  if (loading) return <div className="loading">Loading...</div>;
  if (!user)
    return (
      <div className="app-auth bg-center">
        <div className="auth-card">
          <h2 className="brand-title">📝 Notes App</h2>
          <form onSubmit={handleAuth} className="auth-form">
            <label>
              Email
              <input
                type="email"
                name="email"
                required
                autoFocus
                value={authForm.email}
                onChange={handleAuthFormChange}
                autoComplete="username"
              />
            </label>
            <label>
              Password
              <input
                type="password"
                name="password"
                required
                value={authForm.password}
                onChange={handleAuthFormChange}
                autoComplete={authMode === "signup" ? "new-password" : "current-password"}
              />
            </label>
            <div className="auth-actions">
              <button className="btn accent" type="submit">
                {authMode === "login" ? "Log In" : "Sign Up"}
              </button>
            </div>
            {authError && <div className="error-msg">{authError}</div>}
          </form>
          <div className="toggle-auth-mode">
            {authMode === "login" ? (
              <>
                Don't have an account?{" "}
                <button className="link-btn" type="button" onClick={() => { setAuthMode("signup"); setAuthError(""); }}>
                  Sign up
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button className="link-btn" type="button" onClick={() => { setAuthMode("login"); setAuthError(""); }}>
                  Log in
                </button>
              </>
            )}
          </div>
          <p className="copyright">&copy; {new Date().getFullYear()} Notes App</p>
        </div>
      </div>
    );

  // Main App UI
  const note = notes.find((n) => n.id === activeNoteId);
  return (
    <div className={`notes-app-ui theme-${theme}`}>
      {/* Top navigation */}
      <nav className="navbar">
        <div className="navbar-left">
          <span className="brand-title">📝 Notes</span>
        </div>
        <div className="navbar-center">
          <input
            className="searchbar"
            type="text"
            placeholder="Search notes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search notes"
          />
        </div>
        <div className="navbar-right">
          <span className="navbar-user">{user.email}</span>
          <button className="btn navbar-logout" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </nav>

      {/* Main layout: SidePanel + Content */}
      <div className="main-layout">
        {/* Side panel: notes list */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <button className="btn new-note-btn" onClick={handleNewNote}>
              + New Note
            </button>
          </div>
          <ul className="notes-list">
            {notesLoading ? (
              <li className="loading">Loading notes...</li>
            ) : filteredNotes.length ? (
              filteredNotes.map((n) => (
                <li
                  key={n.id}
                  className={
                    "notes-list-item" +
                    (n.id === activeNoteId && !activeNoteEdit
                      ? " active"
                      : "")
                  }
                  onClick={() => handleSelectNote(n.id)}
                >
                  <div className="note-title">{n.title || <em>Untitled</em>}</div>
                  <div className="note-date">
                    {n.updated_at
                      ? new Date(n.updated_at).toLocaleString()
                      : ""}
                  </div>
                </li>
              ))
            ) : (
              <li>No notes found.</li>
            )}
          </ul>
        </aside>
        {/* Main Content: note view/edit */}
        <section className="main-content">
          {noteError && (
            <div className="error-msg error-inline">{noteError}</div>
          )}
          {/* Editing or creating new note */}
          {activeNoteEdit ? (
            <form className="note-form" onSubmit={handleSaveNote}>
              <input
                className="note-form-title"
                name="title"
                type="text"
                required
                placeholder="Title"
                value={noteForm.title}
                onChange={handleNoteFormChange}
                maxLength={120}
                autoFocus
              />
              <textarea
                className="note-form-content"
                name="content"
                rows={10}
                placeholder="Your note..."
                value={noteForm.content}
                onChange={handleNoteFormChange}
                maxLength={4000}
              />
              <div className="note-form-actions">
                <button className="btn primary" type="submit">
                  {activeNoteId ? "Save Changes" : "Save Note"}
                </button>
                <button className="btn secondary" type="button" onClick={handleCancelEdit}>
                  Cancel
                </button>
              </div>
            </form>
          ) : note ? (
            // Note view mode
            <div className="note-view">
              <h2 className="note-title">{note.title}</h2>
              <div className="note-content">{note.content}</div>
              <div className="note-meta">
                <span>
                  Last updated:{" "}
                  {note.updated_at
                    ? new Date(note.updated_at).toLocaleString()
                    : "-"}
                </span>
              </div>
              <div className="actions-group">
                <button className="btn primary" onClick={handleEditNote}>
                  Edit
                </button>
                <button
                  className="btn danger"
                  onClick={() => handleDeleteNote(note.id)}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : notes.length === 0 ? (
            // No notes yet -- encourage create
            <div className="empty-msg">
              <p>You have no notes yet. Create one to get started!</p>
              <button className="btn accent" onClick={handleNewNote}>
                + New Note
              </button>
            </div>
          ) : (
            <div className="empty-msg">
              <p>Select a note to view, or create a new one!</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
