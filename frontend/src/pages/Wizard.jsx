/**
 * Wizard.jsx  –  3-step intelligent event recommendation wizard
 *
 * Step 1: Enter URL
 * Step 2: Analysing (scan in progress)
 * Step 3: Recommendations — grouped by priority with full context
 */

import React, { useState, useCallback } from 'react';
import CampaignSuggestions from './CampaignSuggestions';

const API = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : '/api';

const PRIORITY_META = {
  'must-have':    { label: 'Must Have',     color: '#22c55e', bg: 'rgba(34,197,94,0.12)',  border: 'rgba(34,197,94,0.3)',  icon: '⚡' },
  'recommended':  { label: 'Recommended',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', border: 'rgba(59,130,246,0.3)', icon: '✦' },
  'nice-to-have': { label: 'Nice to Have',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',border: 'rgba(167,139,250,0.3)',icon: '◎' },
};

const CATEGORY_COLORS = {
  'Acquisition': '#f59e0b',
  'Activation':  '#3b82f6',
  'Retention':   '#22c55e',
  'Revenue':     '#ff5533',
  'Referral':    '#a78bfa',
};

function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || PRIORITY_META['nice-to-have'];
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
      letterSpacing: '0.05em', background: m.bg,
      border: `1px solid ${m.border}`, color: m.color,
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function CategoryBadge({ category }) {
  const color = CATEGORY_COLORS[category] || '#9aa0ae';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      fontSize: 10, fontWeight: 700, fontFamily: 'var(--font-mono)',
      letterSpacing: '0.06em', textTransform: 'uppercase',
      background: `${color}18`, color, border: `1px solid ${color}30`,
    }}>
      {category}
    </span>
  );
}

function EventCard({ event, selected, onToggle }) {
  const [expanded, setExpanded] = useState(false);
  const m = PRIORITY_META[event.priority] || PRIORITY_META['nice-to-have'];

  return (
    <div
      style={{
        border: `1px solid ${selected ? m.border : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        background: selected ? m.bg : 'var(--bg-input)',
        marginBottom: 10,
        transition: 'all 0.15s',
        overflow: 'hidden',
      }}
    >
      {/* ── Header row ── */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Checkbox */}
        <div
          onClick={e => { e.stopPropagation(); onToggle(); }}
          style={{
            width: 20, height: 20, borderRadius: 5, flexShrink: 0,
            border: `2px solid ${selected ? m.color : 'var(--border-hi)'}`,
            background: selected ? m.color : 'transparent',
            display: 'grid', placeItems: 'center', cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          {selected && <span style={{ color: 'white', fontSize: 12, lineHeight: 1 }}>✓</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
              {event.eventName}
            </span>
            <PriorityBadge priority={event.priority} />
            <CategoryBadge category={event.category} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>
            {event.reason}
          </p>
        </div>

        <span style={{ color: 'var(--text-3)', fontSize: 18, flexShrink: 0, transition: 'transform 0.15s',
                       transform: expanded ? 'rotate(180deg)' : 'none' }}>
          ⌄
        </span>
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div style={{ padding: '0 16px 16px 48px', borderTop: '1px solid var(--border)' }}>
          <div style={{ paddingTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                          color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 6 }}>
              When to fire
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              {event.triggerDescription}
            </p>
          </div>

          {event.suggestedProperties?.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                            color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                Suggested properties to capture
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {event.suggestedProperties.map(prop => (
                  <code key={prop} style={{
                    padding: '3px 8px', borderRadius: 5, fontSize: 11,
                    background: '#0d0f14', border: '1px solid var(--border)',
                    color: '#a8d8a8', fontFamily: 'var(--font-mono)',
                  }}>
                    {prop}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Wizard() {
  const [step, setStep]               = useState(1);
  const [url, setUrl]                 = useState('');
  const [scanning, setScanning]       = useState(false);
  const [scanError, setScanError]     = useState('');
  const [result, setResult]           = useState(null);
  const [selected, setSelected]       = useState(new Set());
  const [filterPriority, setFilter]   = useState('all');

  const handleScan = useCallback(async () => {
    if (!url.trim()) return;
    setScanning(true);
    setScanError('');
    setResult(null);
    setStep(2);

    try {
      const res  = await fetch(`${API}/scan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Scan failed');

      setResult(data);
      // Auto-select all must-have events
      setSelected(new Set(
        data.recommendedEvents
          .filter(e => e.priority === 'must-have')
          .map(e => e.eventName)
      ));
      setStep(3);
    } catch (err) {
      setScanError(err.message);
      setStep(1);
    } finally {
      setScanning(false);
    }
  }, [url]);

  const toggleEvent = name => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const selectAll   = () => setSelected(new Set(result.recommendedEvents.map(e => e.eventName)));
  const selectMust  = () => setSelected(new Set(result.recommendedEvents.filter(e => e.priority === 'must-have').map(e => e.eventName)));
  const clearAll    = () => setSelected(new Set());

  // ── Download CSV ──────────────────────────────────────────────────────────
  const downloadCSV = () => {
    const eventsToExport = result.recommendedEvents.filter(e => selected.has(e.eventName));
    const website  = result.url || url;
    const vertical = result.businessVertical || '';

    const escape = (v) => {
      const s = String(v == null ? '' : v);
      // Always wrap in quotes and escape inner quotes
      return '"' + s.replace(/"/g, '""') + '"';
    };

    const row = (...cols) => cols.map(escape).join(',');
    const blank = '';
    const sectionHeader = (title) => `\r\n"${title}"\r\n`;

    // ── Section 1: Event Summary ──────────────────────────────────────────
    const summaryLines = [
      sectionHeader('EVENT SUMMARY'),
      row('Event Name', 'Priority', 'Category', 'Reason', 'When to Fire', 'Suggested Properties', 'Website', 'Business Vertical', 'Website Type'),
    ];
    eventsToExport.forEach(e => {
      summaryLines.push(row(
        e.eventName,
        e.priority,
        e.category,
        e.reason,
        e.triggerDescription,
        (e.suggestedProperties || []).join(' | '),
        website,
        vertical,
        result.websiteType || ''
      ));
    });

    // ── Section 2: Properties Breakdown ──────────────────────────────────
    const propLines = [
      sectionHeader('PROPERTIES BREAKDOWN'),
      row('Event Name', 'Property Name', 'Sample Value', 'Data Type'),
    ];
    eventsToExport.forEach(e => {
      const props = e.suggestedProperties || [];
      if (props.length === 0) {
        propLines.push(row(e.eventName, 'Date', 'new Date()', 'Date'));
      } else {
        props.forEach(prop => {
          const sv = sampleValue(prop);
          const sample = sv.replace(/^"|"$/g, '').replace(/new Date\(\)/, 'new Date()');
          const isMoneyProp = /price|amount|revenue|value|cost|fee|fare|total|subtotal|tax|discount|charge|earning|spend|payment|order.?value|transaction.?amount/i.test(prop);
        const isPurchaseEvent = /purchas|order|booking|payment|checkout|transaction|revenue|buy|paid/i.test(e.eventName);
        const dtype = sv === 'new Date()' ? 'Date'
                      : (isMoneyProp || isPurchaseEvent && /^\d+(\.\d+)?$/.test(sv)) ? 'Float'
                      : /^\d+(\.\d+)?$/.test(sv) ? 'Integer'
                      : 'String';
          propLines.push(row(e.eventName, prop, sample, dtype));
        });
      }
    });

    // ── Section 3: Implementation Code ───────────────────────────────────
    const codeLines = [
      sectionHeader('IMPLEMENTATION CODE'),
      row('Event Name', 'CleverTap SDK Call', 'Notes'),
    ];
    eventsToExport.forEach(e => {
      const code = singleEventCode(e);
      codeLines.push(row(
        isChargedEvent(e.eventName) ? 'Charged (' + e.eventName + ')' : e.eventName,
        code,
        isChargedEvent(e.eventName)
          ? 'Use CleverTap Charged event — unlocks revenue analytics & LTV'
          : 'Trigger: ' + e.triggerDescription
      ));
    });

    // ── Combine all sections ──────────────────────────────────────────────
    const allLines = [
      ...summaryLines,
      blank,
      ...codeLines,
      blank,
      ...propLines,
    ];

    const csv = allLines.join('\r\n');

    // ── Trigger download ──────────────────────────────────────────────────
    const blob    = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);
    const hostname = (() => { try { return new URL(website).hostname.replace('www.', ''); } catch { return 'website'; } })();
    const link     = document.createElement('a');
    link.href      = blobUrl;
    link.download  = `clevertap-events-${hostname}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

    const visibleEvents = result?.recommendedEvents?.filter(e =>
    filterPriority === 'all' || e.priority === filterPriority
  ) || [];

  // ── Generate CleverTap SDK code — correct format with commas and spacing
  const sampleValue = (prop) => {
    const p = prop.toLowerCase();
    if (p.includes('date') || p.includes('time') || p === 'timestamp') return 'new Date()';
    if (p.includes('price') || p.includes('amount') || p.includes('value') || p.includes('revenue') || p.includes('cost')) return '59.99';
    if (p.includes('quantity') || p.includes('qty') || p.includes('count') || p.includes('units')) return '1';
    if (p.includes('rating') || p.includes('score') || p.includes('stars')) return '4.5';
    if (p.includes('url') || p.includes('link') || p.includes('href')) return 'window.location.href';
    if (p.includes('product name') || p === 'name') return '"Product Name"';
    if (p.includes('category')) return '"Category Name"';
    if (p.includes('brand')) return '"Brand Name"';
    if (p.includes('sku') || p.includes('product id') || p.includes('item id')) return '"SKU-001"';
    if (p.includes('id')) return '"ID-001"';
    if (p.includes('email')) return '"user@example.com"';
    if (p.includes('phone')) return '"+91XXXXXXXXXX"';
    if (p.includes('status')) return '"active"';
    if (p.includes('source') || p.includes('medium') || p.includes('channel')) return '"organic"';
    if (p.includes('currency')) return '"INR"';
    if (p.includes('city') || p.includes('location') || p.includes('region')) return '"Mumbai"';
    if (p.includes('gender')) return '"Male"';
    if (p.includes('age')) return '25';
    if (p.includes('platform') || p.includes('device')) return '"Web"';
    if (p.includes('plan')) return '"Basic"';
    if (p.includes('coupon') || p.includes('discount') || p.includes('promo')) return '"SAVE10"';
    return `"value"`;
  };

  // Detect if an event should use CleverTap's special Charged event
  const isChargedEvent = (eventName) => {
    return /purchas|payment.?success|payment.?complet|order.?success|order.?complet|order.?confirm|transaction.?success|booking.?confirm|booking.?success|checkout.?success|checkout.?complet|charged|revenue.?record|sale.?complet/i.test(eventName);
  };

  // Build the Charged event code block
  const buildChargedCode = (e) => {
    const props = e.suggestedProperties || [];
    // Separate amount/payment props from item-level props
    const chargeProps = ['Amount', 'Payment Mode', 'Charged ID'];
    const itemProps   = props.filter(p => !/amount|payment|charged.?id|transaction.?id|order.?id/i.test(p));
    const topProps    = ['Amount: 299.00', 'Payment Mode: "UPI"', 'Charged ID: "ORD-001"'];

    const itemLines = itemProps.length > 0
      ? itemProps.map(p => '      "' + p + '": ' + sampleValue(p)).join(',\n')
      : '      "Product Name": "Sample Product",\n      "Quantity": 1,\n      "Price": 299.00';

    return (
      '// ⚡ Use CleverTap\'s special Charged event for "' + e.eventName + '"\n' +
      '// This unlocks built-in revenue analytics, LTV, and repeat purchase tracking.\n' +
      'clevertap.event.push("Charged", {\n' +
      '  "Amount": 299.00,          // Total transaction amount (Float, required)\n' +
      '  "Payment Mode": "UPI",     // e.g. Credit Card, UPI, Net Banking, Wallet\n' +
      '  "Charged ID": "ORD-001",   // Unique order/transaction ID\n' +
      '  "Items": [\n' +
      '    {\n' +
      itemLines + '\n' +
      '    }\n' +
      '  ]\n' +
      '});'
    );
  };

  const generateSDKCode = (events) => {
    return events.map(e => {
      if (isChargedEvent(e.eventName)) return buildChargedCode(e);
      const props = e.suggestedProperties || [];
      const lines = props.length > 0
        ? props.map((prop, i) => {
            const isLast = i === props.length - 1;
            return '  "' + prop + '": ' + sampleValue(prop) + (isLast ? '' : ',');
          })
        : ['  "Date": new Date()'];
      return 'clevertap.event.push("' + e.eventName + '", {\n' + lines.join('\n') + '\n});';
    }).join('\n\n');
  };

  // Per-event code snippet for individual display
  const singleEventCode = (e) => {
    if (isChargedEvent(e.eventName)) return buildChargedCode(e);
    const props = e.suggestedProperties || [];
    const lines = props.length > 0
      ? props.map((prop, i) => {
          const isLast = i === props.length - 1;
          return '  "' + prop + '": ' + sampleValue(prop) + (isLast ? '' : ',');
        })
      : ['  "Date": new Date()'];
    return 'clevertap.event.push("' + e.eventName + '", {\n' + lines.join('\n') + '\n});';
  };

    const [copiedCode, setCopiedCode] = React.useState(false);

  const copySDKCode = async () => {
    const list = result.recommendedEvents.filter(e => selected.has(e.eventName));
    const code = generateSDKCode(list);
    try { await navigator.clipboard.writeText(code); } catch {}
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const copySelected = copySDKCode; // keep button wired up

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <h1>Event Recommendation Engine</h1>
        <p>Enter any website URL — we'll analyse it and recommend the right CleverTap events for that business.</p>
      </div>

      {/* ── Step 1: URL Input ── */}
      {(step === 1 || step === 2) && (
        <div className="card">
          <div className="card-title">
            <span className="step-badge">1</span>
            Enter Website URL
          </div>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>
            Paste any website URL. Our AI will scan the site, identify the business type, and
            recommend the most impactful CleverTap events to track — with reasons specific to that business.
          </p>

          <div className="input-row">
            <input
              className="input-field"
              type="url"
              placeholder="https://yourwebsite.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !scanning && url.trim() && handleScan()}
              disabled={scanning}
            />
            <button
              className="btn btn-primary"
              onClick={handleScan}
              disabled={scanning || !url.trim()}
            >
              {scanning
                ? <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span className="spinner" /> Analysing…</span>
                : '⚡ Analyse Website'}
            </button>
          </div>

          {scanError && (
            <div className="alert alert-error" style={{ marginTop: 14 }}>
              ❌ {scanError}
            </div>
          )}

          {scanning && (
            <div style={{ marginTop: 20 }}>
              <div className="alert alert-info" style={{ marginBottom: 8 }}>
                🌐 Step 1 of 3 — Loading homepage, discovering internal links…
              </div>
              <div className="alert alert-info" style={{ marginBottom: 8 }}>
                🔍 Step 2 of 3 — Crawling key pages (product, cart, checkout, login, search…)
              </div>
              <div className="alert alert-info">
                🤖 Step 3 of 3 — AI analysing full site and recommending events…
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 10 }}>
                Multi-page scan takes 30–60 seconds depending on site size.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 3: Results ── */}
      {step === 3 && result && (
        <>
          {/* Business context card */}
          <div className="card" style={{ borderColor: 'var(--border-hi)', background: '#13151c' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                                  color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                    Business Vertical
                  </span>
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)',
                               marginBottom: 6 }}>
                  {result.businessVertical}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                  {result.websiteType}
                </div>
                {result.pageTypes && result.pageTypes.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {result.pageTypes.map(pt => (
                      <span key={pt} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4,
                        background: 'var(--bg-input)', border: '1px solid var(--border)',
                        color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                        {pt}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div style={{ flex: 2, minWidth: 260 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                               color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                  Site Summary
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7 }}>
                  {result.businessDescription}
                </p>
              </div>

              <div style={{ flexShrink: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, textAlign: 'center' }}>
                  {[
                    { n: result.scanSummary.mustHave,    label: 'Must Have',    color: '#22c55e' },
                    { n: result.scanSummary.recommended, label: 'Recommended',  color: '#3b82f6' },
                    { n: result.scanSummary.niceToHave,  label: 'Nice to Have', color: '#a78bfa' },
                    { n: result.scanSummary.totalEventsRecommended, label: 'Total Events', color: '#ff5533' },
                  ].map(({ n, label, color }) => (
                    <div key={label} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)',
                                              borderRadius: 'var(--radius)', padding: '10px 14px' }}>
                      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>{n}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {result.analyticsInsight && (
              <div style={{ marginTop: 18, paddingTop: 18, borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                               color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 8 }}>
                  💡 Analytics Insight
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, fontStyle: 'italic' }}>
                  {result.analyticsInsight}
                </p>
              </div>
            )}
          </div>

          {/* Event list */}
          <div className="card">
            {/* Toolbar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                           flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                Recommended Events
                <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-2)' }}>
                  ({selected.size} selected)
                </span>
              </div>

              {/* Filter pills */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['all','must-have','recommended','nice-to-have'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '5px 12px', borderRadius: 999, fontSize: 11,
                      fontFamily: 'var(--font-mono)', fontWeight: 700, cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: filterPriority === f ? 'var(--accent)' : 'var(--bg-input)',
                      color: filterPriority === f ? 'white' : 'var(--text-2)',
                    }}
                  >
                    {f === 'all' ? 'All' : PRIORITY_META[f]?.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick select row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={selectMust}>
                ⚡ Select Must-Have
              </button>
              <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={selectAll}>
                Select All
              </button>
              <button className="btn btn-ghost" style={{ padding: '5px 12px', fontSize: 12 }} onClick={clearAll}>
                Clear
              </button>
            </div>

            {/* Event cards */}
            {visibleEvents.length === 0 ? (
              <div className="no-events">No events in this filter.</div>
            ) : (
              visibleEvents.map(event => (
                <EventCard
                  key={event.eventName}
                  event={event}
                  selected={selected.has(event.eventName)}
                  onToggle={() => toggleEvent(event.eventName)}
                />
              ))
            )}
          </div>

          {/* SDK Code Block — always shown when events are selected */}
          {selected.size > 0 && (
            <div className="card" style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div className="card-title" style={{ marginBottom: 0 }}>
                  CleverTap SDK Code
                  <span style={{ marginLeft: 10, fontWeight: 400, color: 'var(--text-2)', fontSize: 11 }}>
                    {selected.size} event{selected.size !== 1 ? 's' : ''} selected
                  </span>
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: '8px 18px', fontSize: 13 }}
                  onClick={copySDKCode}
                >
                  {copiedCode ? '✓ Copied!' : '📋 Copy Code'}
                </button>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14, lineHeight: 1.6 }}>
                Copy and paste these calls at the right trigger points in your code.
                Replace the sample values with real variables from your application.
              </p>

              <pre style={{
                background: '#0d0f14',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                padding: '20px',
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                lineHeight: 1.9,
                color: '#a8d8a8',
                overflowX: 'auto',
                whiteSpace: 'pre',
                maxHeight: 520,
                overflowY: 'auto',
              }}>
                {generateSDKCode(result.recommendedEvents.filter(e => selected.has(e.eventName)))}
              </pre>
            </div>
          )}

          {/* Bottom action row */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
            <button className="btn btn-ghost" onClick={() => { setStep(1); setResult(null); }}>
              ← Scan Another Site
            </button>
            <button
              className="btn btn-primary"
              onClick={downloadCSV}
              disabled={selected.size === 0}
              title="Download selected events with properties and code as CSV"
            >
              ⬇ Download CSV ({selected.size} event{selected.size !== 1 ? 's' : ''})
            </button>
          </div>

          {/* ── CleverTap Integration Notes ── */}
          <div className="card" style={{ marginTop: 20, borderColor: 'rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.04)' }}>
            <div className="card-title" style={{ color: '#f59e0b' }}>📌 CleverTap Integration Notes</div>

            {/* Charged Event */}
            {result.recommendedEvents.some(e => /purchas|order|booking|payment|checkout|transaction|charged|buy/i.test(e.eventName)) && (
              <div style={{ marginBottom: 20, padding: '14px 16px', borderRadius: 'var(--radius)', background: 'rgba(255,85,51,0.08)', border: '1px solid rgba(255,85,51,0.25)' }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⚡ Use the Special "Charged" Event for Purchases
                </div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.7, marginBottom: 10 }}>
                  CleverTap has a reserved system event called <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 12 }}>Charged</code> specifically
                  for recording purchases and transactions. You should use this instead of a custom "Purchase Completed" or "Order Placed" event.
                  It unlocks built-in revenue analytics, LTV calculation, repeat purchase tracking, and customer segmentation in CleverTap.
                </p>
                <pre style={{ background: '#0d0f14', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#a8d8a8', overflowX: 'auto', lineHeight: 1.8 }}>{`clevertap.event.push("Charged", {
  "Amount": 1299.00,          // Total transaction amount — always required
  "Payment Mode": "UPI",      // e.g. Credit Card, UPI, Net Banking, Wallet
  "Charged ID": "ORD-20240317-001",  // Unique order/transaction ID
  "Items": [                  // Array of items in the cart
    {
      "Product Name": "Noise Cancelling Headphones",
      "Category": "Electronics",
      "Quantity": 1,
      "Price": 1299.00
    }
  ]
});`}</pre>
                <p style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 8 }}>
                  💡 The <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Amount</code> property must always be a Float. The <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>Items</code> array supports up to 256 items per transaction.
                </p>
              </div>
            )}
<CampaignSuggestions result={result} selected={selected} />
            {/* System Events */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', marginBottom: 10 }}>
                🤖 System Events — Auto-Tracked (No Code Needed)
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
                The following events are automatically recorded by CleverTap after you install the SDK. You do <strong style={{ color: 'var(--text-1)' }}>not</strong> need to write any code for these:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
                {[
                  { name: 'App Launched',        desc: 'Every time the app/site is opened' },
                  { name: 'App Installed',        desc: 'First launch after install' },
                  { name: 'App Uninstalled',      desc: 'Tracked via silent push' },
                  { name: 'Web Session Started',  desc: 'Web equivalent of App Launched' },
                  { name: 'UTM Visited',          desc: 'User arrives via UTM campaign link' },
                  { name: 'Notification Sent',    desc: 'Campaign message dispatched' },
                  { name: 'Notification Viewed',  desc: 'User sees an in-app / web notification' },
                  { name: 'Notification Clicked', desc: 'User taps/clicks a campaign message' },
                  { name: 'Push Impressions',     desc: 'Push notification delivered to device' },
                  { name: 'App Version Changed',  desc: 'User updated the app' },
                  { name: 'Session Concluded',    desc: 'After 20 min inactivity' },
                  { name: 'Channel Subscribed',   desc: 'User opts into push (Android 13+)' },
                ].map(ev => (
                  <div key={ev.name} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 2 }}>{ev.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{ev.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Best Practices */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', marginBottom: 10 }}>
                ✅ CleverTap Event Best Practices
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { icon: '📏', tip: 'Start with a max of 5–10 critical events. You can always add more later.' },
                  { icon: '🏷️', tip: 'Use consistent naming across web and mobile — e.g. "Product Viewed" not "view_product" on one platform and "ProductView" on another.' },
                  { icon: '💰', tip: 'Always record purchases using the Charged event, not a custom event. Use Amount as a Float in a single currency for accurate LTV.' },
                  { icon: '🚫', tip: 'Do not track raw page views, button clicks, or form submissions as events. Track meaningful user actions tied to business goals instead.' },
                  { icon: '👤', tip: 'Store user attributes (age, gender, city) as User Profile properties — not as event properties.' },
                  { icon: '🔢', tip: 'Max 512 custom event types per account. Max 256 properties per event. Event property values max 512 characters.' },
                  { icon: '🔤', tip: 'Avoid prohibited characters in property keys: & $ " \ % > < !' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                    <span style={{ flexShrink: 0, fontSize: 15 }}>{item.icon}</span>
                    <span>{item.tip}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Limits */}
            <div style={{ padding: '12px 16px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Platform Limits
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {[
                  { label: 'Custom event types',       value: '512 max' },
                  { label: 'Properties per event',      value: '256 max' },
                  { label: 'Items in Charged event',    value: '256 max' },
                  { label: 'Property key length',       value: '120 chars' },
                  { label: 'Property value length',     value: '512 chars' },
                  { label: 'Supported value types',     value: 'String, Integer, Float, Boolean, Date' },
                ].map(l => (
                  <div key={l.label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{l.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{l.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-3)' }}>
              📖 Full reference: <a href="https://developer.clevertap.com/docs/events" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'none' }}>developer.clevertap.com/docs/events</a>
            </div>
          </div>
        </>
      )}
    </div>
  );
}