/**
 * campaignGenerator.js  –  AI-powered campaign strategy generator
 *
 * HOW IT WORKS:
 *  1. Receives the full scan result + user-selected events from the frontend
 *  2. Detects platform type (web-only vs has-mobile-app) to gate channel options
 *  3. Builds a rich AI prompt with business context, event details, and channel constraints
 *  4. AI generates 4–6 fully customised campaign strategies for that specific site
 *  5. Returns structured campaign objects ready for the React UI
 *
 * ADD ROUTE IN YOUR SERVER (server.js / index.js):
 *   const { generateCampaigns } = require('./campaignGenerator');
 *   app.post('/api/campaigns', async (req, res) => {
 *     try {
 *       const { scanResult, selectedEvents } = req.body;
 *       if (!scanResult || !Array.isArray(selectedEvents)) {
 *         return res.status(400).json({ success: false, error: 'Missing scanResult or selectedEvents' });
 *       }
 *       const campaigns = await generateCampaigns(scanResult, selectedEvents);
 *       res.json({ success: true, campaigns });
 *     } catch (err) {
 *       console.error('[Campaigns] Error:', err.message);
 *       res.status(500).json({ success: false, error: err.message });
 *     }
 *   });
 */

'use strict';

const https = require('https');

// ─── Generic HTTPS POST (same pattern as scanner.js) ─────────────────────────
function httpsPost({ hostname, path, headers, body, timeout = 90000 }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Campaign AI request timed out'));
    });
    req.write(body);
    req.end();
  });
}

// ─── AI router (mirrors scanner.js to support all 3 providers) ───────────────
async function callAI(prompt) {
  if (process.env.GROQ_API_KEY) {
    console.log('[Campaigns] Using Groq (llama-3.3-70b)');
    const raw = await httpsPost({
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 8000,
        temperature: 0.45,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error(`Groq error: ${parsed.error.message}`);
    return parsed.choices?.[0]?.message?.content || '';
  }

  if (process.env.GEMINI_API_KEY) {
    console.log('[Campaigns] Using Gemini 2.0 Flash');
    const raw = await httpsPost({
      hostname: 'generativelanguage.googleapis.com',
      path: `/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 8000, temperature: 0.45 },
      }),
    });
    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error(`Gemini error: ${parsed.error.message}`);
    return parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (process.env.ANTHROPIC_API_KEY) {
    console.log('[Campaigns] Using Anthropic Claude');
    const raw = await httpsPost({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error(`Anthropic error: ${parsed.error.message}`);
    return parsed.content?.[0]?.text || '';
  }

  throw new Error('No AI API key found. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY.');
}

// ─── Detect platform and derive available channels ────────────────────────────
/**
 * Returns an object describing the platform and which engagement channels are
 * valid so the AI never suggests mobile-only channels for a pure web product.
 *
 * Logic:
 *  - Scan websiteType + businessDescription + pageTypes for app indicators
 *  - "App" indicators: "mobile app", "ios", "android", "app store", "play store",
 *    "download app", "native app", "flutter", "react native"
 *  - Pure web → Email, SMS, Web Push, Web Pop-up/Banner, WhatsApp
 *  - Has mobile app → additionally allow Push Notification, In-App Message
 */
function detectPlatform(scanResult) {
  const haystack = [
    scanResult.websiteType || '',
    scanResult.businessDescription || '',
    scanResult.businessVertical || '',
    (scanResult.pageTypes || []).join(' '),
  ]
    .join(' ')
    .toLowerCase();

  const mobileAppSignals = [
    'mobile app', 'ios app', 'android app', 'app store', 'play store',
    'download app', 'native app', 'flutter', 'react native',
    'download on the', 'get it on google play',
  ];

  const hasMobileApp = mobileAppSignals.some((sig) => haystack.includes(sig));

  const webChannels = ['Email', 'SMS', 'Web Push Notification', 'Web Pop-up / Banner', 'WhatsApp'];
  const appChannels = ['Push Notification', 'In-App Message'];

  return {
    hasMobileApp,
    platformLabel: hasMobileApp
      ? 'Web + Mobile App'
      : 'Web / Desktop Platform',
    availableChannels: hasMobileApp
      ? [...webChannels, ...appChannels]
      : webChannels,
    channelNote: hasMobileApp
      ? 'This business has a mobile app AND a website. You may use all channels including Push Notification and In-App Message.'
      : 'This is a WEB-ONLY platform. There is NO mobile app. You MUST NOT suggest Push Notification or In-App Message. Use only: Email, SMS, Web Push Notification, Web Pop-up / Banner, WhatsApp.',
  };
}

// ─── Build the AI prompt ──────────────────────────────────────────────────────
function buildPrompt(scanResult, selectedEvents) {
  const platform = detectPlatform(scanResult);

  const eventsBlock = selectedEvents
    .map(
      (e) =>
        `• [${e.category} | ${e.priority}] "${e.eventName}"\n` +
        `  Trigger: ${e.triggerDescription}\n` +
        `  Properties: ${(e.suggestedProperties || []).join(', ')}\n` +
        `  Why it matters: ${e.reason || ''}`
    )
    .join('\n\n');

  return `You are a world-class CleverTap campaign strategist. Your job is to generate 4–6 campaign strategies that are DEEPLY SPECIFIC to this exact business.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BUSINESS CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Website URL:        ${scanResult.url || 'N/A'}
Business Vertical:  ${scanResult.businessVertical}
Website Type:       ${scanResult.websiteType}
Platform:           ${platform.platformLabel}
Pages Found:        ${(scanResult.pageTypes || []).join(', ')}

Business Description:
${scanResult.businessDescription}

Analytics Insight (from site scan):
${scanResult.analyticsInsight || 'N/A'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLATFORM & CHANNEL CONSTRAINTS — READ CAREFULLY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${platform.channelNote}

AVAILABLE CHANNELS (use ONLY these):
${platform.availableChannels.map((c) => `  ✓ ${c}`).join('\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SELECTED EVENTS (${selectedEvents.length} events the user has chosen to track)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${eventsBlock}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK: GENERATE 4–6 CAMPAIGN STRATEGIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Requirements:

① BUSINESS-SPECIFIC: Every campaign must reference this business's specific context.
  - Use the actual event names from the selected events list above as triggers.
  - Reference the business vertical in the campaign name and messaging.
  - Message copy must feel written for THIS site, not a generic template.

② CHANNEL ENFORCEMENT: 
  - ONLY use channels from the "AVAILABLE CHANNELS" list above.
  - If platform is web-only, NEVER include "Push Notification" or "In-App Message" — this is a hard rule.

③ TRIGGER ACCURACY: The campaign trigger MUST reference real event names from the selected events.
   Example: "User triggers 'Checkout Started' but NOT 'Charged' within 60 minutes"

④ LIFECYCLE COVERAGE: Span different stages — acquisition, activation, retention, revenue, win-back.

⑤ REALISTIC COPY: Message steps should have copy that sounds human, personalised, and specific to this business.
   Include relevant product types, features, and user actions from the business description.

⑥ STEP TIMING: Be precise with delays (e.g., "30 minutes", "2 hours", "Day 3", "Day 7").

⑦ ACCENT COLOURS: Assign a distinct hex accent colour to each campaign (use a varied, visually distinct palette).

⑧ ICON: Pick a single relevant emoji icon per campaign.

Output ONLY a raw JSON object — no markdown, no backticks, no preamble, no commentary.

{
  "platformNote": "one sentence confirming channel constraints applied",
  "campaigns": [
    {
      "name": "Campaign name specific to this business and vertical",
      "icon": "🛒",
      "goal": "Specific measurable goal for this campaign",
      "trigger": "Exact CleverTap trigger condition using real event names from the selected list",
      "channels": ["Email", "Web Push Notification"],
      "steps": [
        {
          "delay": "30 minutes",
          "channel": "Email",
          "message": "Specific, realistic message copy for this business. Include CTA."
        },
        {
          "delay": "4 hours",
          "channel": "Web Push Notification",
          "message": "Follow-up message copy"
        }
      ],
      "segmentHint": "Precise segment definition using event names and specific property conditions",
      "kpi": "3–4 specific KPIs to measure this campaign's success",
      "accentColor": "#f59e0b"
    }
  ]
}

Respond with ONLY valid JSON. Start with { end with }.`;
}

// ─── Parse + validate AI response ────────────────────────────────────────────
function parseResponse(raw) {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON object found in AI campaign response');

  const parsed = JSON.parse(jsonMatch[0]);

  if (!Array.isArray(parsed.campaigns)) {
    throw new Error('campaigns is not an array in AI response');
  }

  // Validate and normalise each campaign
  const validChannels = new Set([
    'Email', 'SMS', 'Web Push Notification', 'Web Pop-up / Banner',
    'WhatsApp', 'Push Notification', 'In-App Message',
  ]);

  parsed.campaigns = parsed.campaigns.map((c) => ({
    name:         c.name         || 'Campaign',
    icon:         c.icon         || '🎯',
    goal:         c.goal         || '',
    trigger:      c.trigger      || '',
    channels:     Array.isArray(c.channels)
      ? c.channels.filter((ch) => validChannels.has(ch))
      : ['Email'],
    steps: Array.isArray(c.steps)
      ? c.steps.map((s) => ({
          delay:   s.delay   || 'Immediate',
          channel: s.channel || 'Email',
          message: s.message || '',
        }))
      : [],
    segmentHint:  c.segmentHint  || '',
    kpi:          c.kpi          || '',
    accentColor:  /^#[0-9a-fA-F]{3,6}$/.test(c.accentColor || '')
      ? c.accentColor
      : '#ff5533',
  }));

  console.log(`[Campaigns] Parsed ${parsed.campaigns.length} campaigns`);
  return parsed.campaigns;
}

// ─── Main exported function ───────────────────────────────────────────────────
async function generateCampaigns(scanResult, selectedEvents) {
  if (!scanResult || !Array.isArray(selectedEvents) || selectedEvents.length === 0) {
    throw new Error('scanResult and at least one selectedEvent are required');
  }

  const prompt   = buildPrompt(scanResult, selectedEvents);
  const rawReply = await callAI(prompt);
  return parseResponse(rawReply);
}

module.exports = { generateCampaigns };