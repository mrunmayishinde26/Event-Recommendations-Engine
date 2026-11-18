import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Wizard from './pages/Wizard';
import './App.css';

function App() {
  const [theme, setTheme] = useState(
    () => localStorage.getItem('ct_theme') || 'dark'
  );

  // Apply theme to <html> element so all CSS vars cascade correctly
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('ct_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <BrowserRouter>
      <div className="app-shell">
        {/* ── Sidebar ── */}
        <aside className="sidebar">
          <div className="sidebar-logo">
            <span className="logo-icon">◈</span>
            <span className="logo-text">CT<br/>Integrator</span>
          </div>

          <nav className="sidebar-nav">
            <NavLink to="/" end className={({isActive}) => isActive ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">⚡</span> Setup Wizard
            </NavLink>
          </nav>

          <div className="sidebar-footer">
            {/* ── Theme toggle ── */}
            <button
              onClick={toggleTheme}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                width: '100%',
                padding: '9px 12px',
                borderRadius: 'var(--radius)',
                border: '1px solid var(--border)',
                background: 'var(--bg-input)',
                color: 'var(--text-2)',
                cursor: 'pointer',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                marginBottom: 12,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text-1)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-2)'; }}
            >
              {/* Toggle track */}
              <span style={{
                position: 'relative',
                display: 'inline-block',
                width: 36,
                height: 20,
                borderRadius: 999,
                background: theme === 'dark' ? '#333' : '#ff5533',
                transition: 'background 0.25s',
                flexShrink: 0,
              }}>
                <span style={{
                  position: 'absolute',
                  top: 3,
                  left: theme === 'dark' ? 3 : 19,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'left 0.25s',
                  fontSize: 9,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  {theme === 'dark' ? '🌙' : '☀'}
                </span>
              </span>
              {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
            </button>

            <span className="powered-by">Powered by CleverTap API</span>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="main-content">
          <Routes>
            <Route path="/"         element={<Wizard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;