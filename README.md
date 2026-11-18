
# CT Integrator ◈ CleverTap Event Recommendation Engine

> Paste any website URL. Get a fully customised CleverTap analytics plan in under 60 seconds.

CT Integrator scans any public website using a headless browser, analyses its content with AI, and generates a complete CleverTap implementation plan — custom events, SDK code, a downloadable CSV, and campaign strategies. All tailored to that specific business, not a generic template.

---

## ✦ What It Generates

| Output | Detail |
|--------|--------|
| **45–50 Custom Events** | Named, categorised by AARRR, prioritised (Must Have / Recommended / Nice-to-Have), with properties and trigger descriptions |
| **CleverTap SDK Code** | Ready-to-paste JavaScript for every selected event, with correct `Charged` event format for purchases |
| **CSV Export** | Three sections: Event Summary · Implementation Code · Properties Breakdown |
| **Campaign Strategies** | 4–6 AI-generated campaigns with step sequences, copy, channel selection, segments, and KPIs |

---

## ⚡ How It Works

```
You enter a URL
      │
      ▼
Puppeteer crawls up to 8 pages
(homepage, product, checkout, login, search, pricing…)
      │
      ▼
Signals extracted: H1s, H2s, CTAs, forms, nav, body text, JSON-LD
      │
      ▼
AI analyses site context + 60-event reference library (few-shot)
      │
      ▼
45–50 site-specific events + 4–6 campaign strategies returned
```

The AI provider is swappable — the system tries **Groq → Gemini → Claude** based on whichever key is set in your `.env`.

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6, CSS custom properties (dark + light theme) |
| Backend | Node.js, Express, Puppeteer (headless Chrome), native `https` module |
| AI | Groq `llama-3.3-70b` · Gemini 2.0 Flash · Anthropic Claude Sonnet 4 |

---

## 📁 Project Structure

```
├── src/
│   ├── App.jsx                    # Shell — sidebar, theme toggle, routing
│   ├── App.css                    # CSS variables, dark/light theme
│   └── pages/
│       ├── Wizard.jsx             # 3-step wizard (URL → scan → results)
│       └── CampaignSuggestions.jsx  # AI campaign panel
│
├── server/
│   ├── index.js                   # Express app — mounts /api routes
│   ├── scanner.js                 # Puppeteer crawler + event generation
│   └── campaignGenerator.js       # Platform detection + campaign generation
│
├── .env                           # API keys (not committed)
└── package.json
```

---

## 🚀 Setup

### 1. Clone & install

```bash
git clone https://github.com/your-username/ct-integrator.git
cd ct-integrator
npm install
```

### 2. Configure environment variables

Create a `.env` file in the root:

```env
# At least one AI key is required — first available is used
GROQ_API_KEY=your_groq_key_here
GEMINI_API_KEY=your_gemini_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here

# Optional
PORT=3001
CHROME_PATH=/path/to/chrome   # Auto-detected if not set
REACT_APP_API_URL=            # Leave empty for same-origin /api
```

> **Recommended:** Groq has a free tier and is the fastest provider for this use case.

### 3. Add the `/api/campaigns` route to your server

In `server/index.js`:

```js
const { generateCampaigns } = require('./campaignGenerator');

app.post('/api/campaigns', async (req, res) => {
  try {
    const { scanResult, selectedEvents } = req.body;
    if (!scanResult || !Array.isArray(selectedEvents)) {
      return res.status(400).json({ success: false, error: 'Missing params' });
    }
    const campaigns = await generateCampaigns(scanResult, selectedEvents);
    res.json({ success: true, campaigns });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
```

### 4. Run

```bash
# Start backend
node server/index.js

# Start frontend (in a separate terminal)
npm start
```

The frontend runs on `http://localhost:3000` and proxies `/api/*` to the backend on port `3001`.

> Scans take **30–60 seconds** depending on site size — the tool crawls up to 8 pages before sending to the AI.

---

## 🎯 Campaign Channel Logic

Campaign channels are automatically constrained by platform type. The backend detects mobile app signals (`app store`, `play store`, `iOS`, `Android`, `download app`, etc.) in the scan result before building the AI prompt — so a desktop-only SaaS tool will never receive Push Notification or In-App Message campaigns.

| Platform | Channels Available |
|----------|--------------------|
| 🌐 Web only | Email · SMS · Web Push Notification · Web Pop-up / Banner · WhatsApp |
| 📱 Web + Mobile App | All of the above + Push Notification · In-App Message |

---

## 📋 Event Categories & Priorities

Events follow the **AARRR framework**:

- `Acquisition` — first visit, search, UTM, CTA clicks
- `Activation` — signup, login, onboarding, profile setup
- `Retention` — product views, feature usage, content engagement
- `Revenue` — checkout, payment, subscription, `Charged` event
- `Referral` — sharing, referral links, loyalty points

Priority levels:
- **Must Have** — business-critical, fire from day one
- **Recommended** — high value, implement in sprint 2
- **Nice-to-Have** — extra insight, add when bandwidth allows

---

## 📦 CSV Export Structure

The exported CSV has three labelled sections:

```
EVENT SUMMARY
Event Name | Priority | Category | Reason | When to Fire | Properties | Website | Vertical | Type

IMPLEMENTATION CODE
Event Name | CleverTap SDK Call | Notes

PROPERTIES BREAKDOWN
Event Name | Property Name | Sample Value | Data Type
```

---

## ⚠️ Known Constraints

- Requires a headless browser environment — **does not run on serverless** (Vercel, Netlify) without a custom Chromium layer
- Sites with aggressive bot protection (Cloudflare, Akamai) may return degraded content
- AI output is non-deterministic — regenerating produces different but valid results

---

## 🔗 References

- [CleverTap Events Documentation](https://developer.clevertap.com/docs/events)
- [CleverTap Journeys (Campaign Automation)](https://developer.clevertap.com/docs/journeys)
- [CleverTap Charged Event](https://developer.clevertap.com/docs/concepts-and-apis#section-recording-customer-purchases)

---

## 📄 License

MIT
