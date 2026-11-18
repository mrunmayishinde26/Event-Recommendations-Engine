/**
 * EventLog.jsx
 * Displays a history of integrations created via the Wizard,
 * plus a live event test panel for sending manual test events to CleverTap.
 */

import React, { useState, useEffect } from 'react';

const API = '/api';

export default function EventLog() {
  const [logs, setLogs]             = useState([]);
  const [testEvent, setTestEvent]   = useState('Page Viewed');
  const [testAccount, setTestAccount] = useState('');
  const [testPasscode, setTestPasscode] = useState('');
  const [sending, setSending]       = useState(false);
  const [sendResult, setSendResult] = useState(null);

  // Load from localStorage
  useEffect(() => {
    const raw = localStorage.getItem('ct_event_log');
    if (raw) {
      try { setLogs(JSON.parse(raw)); } catch (_) {}
    }
  }, []);

  const clearLogs = () => {
    localStorage.removeItem('ct_event_log');
    setLogs([]);
  };

  const formatDate = (iso) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch { return iso; }
  };

  // ── Test Event Sender (calls CleverTap Upload API directly) ─────────────
  const sendTestEvent = async () => {
    if (!testAccount.trim() || !testPasscode.trim() || !testEvent.trim()) return;
    setSending(true);
    setSendResult(null);

    const payload = {
      d: [{
        identity:  'test_user_' + Date.now(),
        type:      'event',
        evtName:   testEvent.trim(),
        evtData: {
          source:    'CleverTap Integration Tool – Test Panel',
          page_url:  window.location.href,
          timestamp: new Date().toISOString(),
        },
      }],
    };

    try {
      const res = await fetch('https://api.clevertap.com/1/upload', {
        method:  'POST',
        headers: {
          'Content-Type':             'application/json',
          'X-CleverTap-Account-Id':   testAccount.trim(),
          'X-CleverTap-Passcode':     testPasscode.trim(),
        },
        body: JSON.stringify(payload),
      });

      // CleverTap returns 200 even for some errors, parse body carefully
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${data.error || data.raw || 'Request failed'}`);
      }
      if (data.status && data.status !== 'success') {
        throw new Error(data.error || JSON.stringify(data));
      }

      setSendResult({
        ok: true,
        message: `Event "${testEvent.trim()}" sent! Processed: ${data.processed ?? 1}. Check your CleverTap dashboard under Events → Recent Events.`,
      });
    } catch (err) {
      // Distinguish CORS / network errors from API errors
      const isCors = err instanceof TypeError && err.message.includes('fetch');
      setSendResult({
        ok: false,
        message: isCors
          ? 'Network error: CleverTap API blocked this browser request (CORS). Run the backend and use the /api/send-event endpoint instead.'
          : err.message,
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Event Log</h1>
        <p>Review past integrations and test your CleverTap connection live.</p>
      </div>

      {/* ── Live Test Panel ── */}
      <div className="card">
        <div className="card-title">⚡ Live Event Test</div>
        <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 12 }}>
          Send a test event directly to the CleverTap Upload API to verify your credentials.
        </p>
        <div className="alert alert-info" style={{ marginBottom: 20, fontSize: 12 }}>
          Calls <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>api.clevertap.com/1/upload</code> directly from your browser.
          If blocked by CORS, start the backend and use <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-1)' }}>POST /api/send-event</code> instead.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div className="field-group">
            <label className="input-label">Account ID</label>
            <input
              className="input-field"
              placeholder="ABC-XXX-XXXX"
              value={testAccount}
              onChange={(e) => setTestAccount(e.target.value)}
            />
          </div>
          <div className="field-group">
            <label className="input-label">Passcode</label>
            <input
              className="input-field"
              type="password"
              placeholder="Your CleverTap Passcode"
              value={testPasscode}
              onChange={(e) => setTestPasscode(e.target.value)}
            />
          </div>
        </div>

        <div className="field-group">
          <label className="input-label">Event Name</label>
          <input
            className="input-field"
            placeholder="e.g. Page Viewed"
            value={testEvent}
            onChange={(e) => setTestEvent(e.target.value)}
            style={{ maxWidth: 300 }}
          />
        </div>

        {sendResult && (
          <div className={`alert ${sendResult.ok ? 'alert-success' : 'alert-error'}`} style={{ marginBottom: 14 }}>
            {sendResult.ok ? '✅' : '❌'} {sendResult.message}
          </div>
        )}

        <button
          className="btn btn-primary"
          onClick={sendTestEvent}
          disabled={sending || !testAccount.trim() || !testPasscode.trim()}
        >
          {sending ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="spinner" /> Sending…
            </span>
          ) : '▶ Send Test Event'}
        </button>
      </div>

      {/* ── Integration History ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>📋 Integration History</div>
          {logs.length > 0 && (
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }} onClick={clearLogs}>
              Clear All
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="no-events">
            No integrations recorded yet.<br />
            <span style={{ fontSize: 12 }}>Complete the Setup Wizard to see your history here.</span>
          </div>
        ) : (
          <table className="log-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Website URL</th>
                <th>Account ID</th>
                <th>Events Tracked</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: 12, fontFamily: 'var(--font-mono)' }}>
                    {formatDate(log.timestamp)}
                  </td>
                  <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <a href={log.url} target="_blank" rel="noopener noreferrer"
                       style={{ color: 'var(--blue)', textDecoration: 'none' }}>
                      {log.url}
                    </a>
                  </td>
                  <td>
                    <span className="event-name-cell">{log.accountId}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {(log.events || []).slice(0, 4).map((ev) => (
                        <span key={ev} className="tag tag-blue">{ev}</span>
                      ))}
                      {(log.events || []).length > 4 && (
                        <span className="tag tag-blue">+{log.events.length - 4} more</span>
                      )}
                    </div>
                  </td>
                  <td><span className="tag tag-green">✓ Generated</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── API Reference ── */}
      <div className="card">
        <div className="card-title">📌 API Quick Reference</div>
        <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 16 }}>
          Use these endpoints directly from any server-side or client-side code.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            {
              method: 'POST',
              path:   '/api/scan',
              desc:   'Scan a website URL and detect trackable events',
              body:   '{ "url": "https://yoursite.com" }',
            },
            {
              method: 'POST',
              path:   '/api/send-event',
              desc:   'Send a single event to CleverTap',
              body:   '{ "accountId": "...", "passcode": "...", "identity": "user123", "eventName": "Product Viewed", "eventData": {} }',
            },
            {
              method: 'POST',
              path:   '/api/send-batch',
              desc:   'Send multiple events in one request (up to 200)',
              body:   '{ "accountId": "...", "passcode": "...", "events": [...] }',
            },
            {
              method: 'POST',
              path:   '/api/generate-script',
              desc:   'Generate a personalised tracker.js snippet',
              body:   '{ "accountId": "...", "passcode": "...", "backendUrl": "...", "selectedEvents": ["Page Viewed", ...] }',
            },
          ].map((ep) => (
            <div key={ep.path} style={{ borderLeft: '2px solid var(--border)', paddingLeft: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span className="tag tag-blue" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{ep.method}</span>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent)' }}>{ep.path}</code>
              </div>
              <p style={{ color: 'var(--text-2)', fontSize: 12, marginBottom: 6 }}>{ep.desc}</p>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                Body: {ep.body}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
