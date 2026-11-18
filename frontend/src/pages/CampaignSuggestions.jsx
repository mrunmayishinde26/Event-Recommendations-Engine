// /**
//  * CampaignSuggestions.jsx
//  *
//  * Displays 3–5 campaign logic cards based on the recommended events from the scan.
//  * Drop this below the SDK Code block in Wizard.jsx and pass `result` + `selected` as props.
//  *
//  * Usage in Wizard.jsx:
//  *   import CampaignSuggestions from './CampaignSuggestions';
//  *   ...
//  *   {step === 3 && result && (
//  *     <>
//  *       ... existing cards ...
//  *       <CampaignSuggestions result={result} selected={selected} />
//  *     </>
//  *   )}
//  */

// import React, { useState, useMemo } from 'react';

// // ─── Channel meta ─────────────────────────────────────────────────────────────
// const CHANNEL_META = {
//   'Push':   { color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)', icon: '🔔' },
//   'Email':  { color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.25)', icon: '✉️' },
//   'SMS':    { color: '#22c55e', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)',  icon: '💬' },
//   'In-App': { color: '#a78bfa', bg: 'rgba(167,139,250,0.10)',border: 'rgba(167,139,250,0.25)',icon: '📱' },
//   'Web':    { color: '#ff5533', bg: 'rgba(255,85,51,0.10)',  border: 'rgba(255,85,51,0.25)',  icon: '🌐' },
// };

// // ─── Campaign templates per trigger event (partial match on eventName) ────────
// const CAMPAIGN_TEMPLATES = [
//   // ── CART / CHECKOUT ABANDONMENT ──────────────────────────────────────────
//   {
//     match: ['checkout started', 'cart viewed', 'checkout abandoned'],
//     campaign: {
//       name: 'Checkout Recovery',
//       icon: '🛒',
//       goal: 'Recover users who started checkout but didn\'t complete payment',
//       trigger: 'User does Checkout Started but NOT Charged within 60 minutes',
//       channels: ['Push', 'Email', 'SMS'],
//       steps: [
//         { delay: '30 min',  channel: 'Push',  message: '"You left something behind! Complete your order before it sells out." → Deep-link to checkout' },
//         { delay: '2 hrs',   channel: 'Email', message: 'Cart reminder email with product images, price, and a prominent "Complete Purchase" CTA' },
//         { delay: '24 hrs',  channel: 'SMS',   message: '"Your cart expires soon. Use code SAVE10 for 10% off — complete now."' },
//       ],
//       segmentHint: 'Users who triggered Checkout Started but NOT Charged in the last 1 hour',
//       kpi: 'Cart recovery rate, Revenue recovered per campaign',
//       accentColor: '#f59e0b',
//     }
//   },

//   // ── PAYMENT FAILURE RETRY ────────────────────────────────────────────────
//   {
//     match: ['payment failed', 'transaction failed'],
//     campaign: {
//       name: 'Payment Failure Recovery',
//       icon: '💳',
//       goal: 'Help users who hit a payment error complete their purchase',
//       trigger: 'User does Payment Failed event',
//       channels: ['Push', 'In-App', 'Email'],
//       steps: [
//         { delay: 'Instant',  channel: 'In-App', message: 'Modal: "Payment didn\'t go through. Try a different method?" with UPI / Wallet options shown inline' },
//         { delay: '15 min',   channel: 'Push',   message: '"Still having trouble? Your cart is saved — try again with UPI or Net Banking."' },
//         { delay: '2 hrs',    channel: 'Email',  message: 'Friendly email explaining possible reasons for failure + 3-click retry link' },
//       ],
//       segmentHint: 'Users with Payment Failed event in last 24 hours and no subsequent Charged event',
//       kpi: 'Retry conversion rate, Revenue rescued',
//       accentColor: '#ef4444',
//     }
//   },

//   // ── ONBOARDING / ACTIVATION ──────────────────────────────────────────────
//   {
//     match: ['account created', 'onboarding started', 'email verified', 'signup'],
//     campaign: {
//       name: 'New User Activation',
//       icon: '🚀',
//       goal: 'Guide new users to their first key action within 48 hours of signup',
//       trigger: 'User does Account Created but has NOT done their first key action in 48 hours',
//       channels: ['Push', 'Email', 'In-App'],
//       steps: [
//         { delay: 'Instant',  channel: 'In-App', message: 'Welcome modal with a 3-step checklist highlighting the core value action (e.g. Browse, Save, Buy)' },
//         { delay: '1 hr',     channel: 'Push',   message: '"Welcome! Here\'s how to get the most out of [App Name] →" with a quick-start tip' },
//         { delay: '24 hrs',   channel: 'Email',  message: 'Onboarding email: "Your account is ready — here\'s what to do first" with 2–3 feature highlights' },
//         { delay: '48 hrs',   channel: 'Push',   message: 'Urgency nudge: "Don\'t miss out — [X] users just [key action]. Start now →"' },
//       ],
//       segmentHint: 'New users in first 48 hrs who haven\'t completed any purchase or core engagement event',
//       kpi: 'Day-1 activation rate, Day-7 retention, First purchase conversion',
//       accentColor: '#22c55e',
//     }
//   },

//   // ── WINBACK / RE-ENGAGEMENT ───────────────────────────────────────────────
//   {
//     match: ['session started', 'page viewed', 'login completed'],
//     campaign: {
//       name: 'Lapsed User Win-Back',
//       icon: '💫',
//       goal: 'Re-engage users who were active but haven\'t returned in 14+ days',
//       trigger: 'User has NOT done any event in the last 14 days (inactivity trigger)',
//       channels: ['Push', 'Email'],
//       steps: [
//         { delay: 'Day 14',  channel: 'Push',  message: '"We miss you! Here\'s what\'s new since your last visit →" personalised with their last viewed item/category' },
//         { delay: 'Day 17',  channel: 'Email', message: 'Personalised re-engagement email with "Top picks for you" based on past behaviour' },
//         { delay: 'Day 21',  channel: 'Push',  message: '"Come back and get 15% off — just for you. Offer valid 48 hours."' },
//         { delay: 'Day 25',  channel: 'Email', message: 'Final win-back: "Last chance to claim your offer" with social proof (e.g. X people bought this week)' },
//       ],
//       segmentHint: 'Users with last_seen > 14 days ago who have at least 1 prior purchase or core engagement',
//       kpi: 'Win-back rate, Revenue per re-engaged user, Unsubscribe rate',
//       accentColor: '#3b82f6',
//     }
//   },

//   // ── PRODUCT / LISTING VIEWED (no purchase) ───────────────────────────────
//   {
//     match: ['product viewed', 'listing viewed', 'course viewed', 'restaurant viewed', 'content viewed'],
//     campaign: {
//       name: 'Browse-to-Buy Nudge',
//       icon: '👀',
//       goal: 'Convert high-intent browsers who viewed but didn\'t purchase',
//       trigger: 'User views a product/listing 2+ times but does NOT complete a purchase within 24 hours',
//       channels: ['Push', 'In-App', 'Web'],
//       steps: [
//         { delay: '2 hrs',   channel: 'Web',    message: 'Web push or sticky banner: "Still thinking about [Product]? Here\'s what others said →" showing top review' },
//         { delay: '6 hrs',   channel: 'Push',   message: '"[Product Name] is popular — X people viewed it today. Get it before it\'s gone."' },
//         { delay: '24 hrs',  channel: 'In-App', message: 'On next app open: personalised recommendation card with viewed item + similar alternatives' },
//       ],
//       segmentHint: 'Users with 2+ Product Viewed events for the same item in 24 hours, no Charged event',
//       kpi: 'Browse-to-purchase conversion rate, Revenue influenced by campaign',
//       accentColor: '#a78bfa',
//     }
//   },

//   // ── SEARCH WITH NO RESULTS ───────────────────────────────────────────────
//   {
//     match: ['search no results', 'search performed'],
//     campaign: {
//       name: 'Search → Discovery Bridge',
//       icon: '🔍',
//       goal: 'Help users who searched but found nothing to discover relevant alternatives',
//       trigger: 'User fires Search No Results or Search Performed with results_count = 0',
//       channels: ['In-App', 'Email'],
//       steps: [
//         { delay: 'Instant', channel: 'In-App', message: '"No results for \'[query]\' — but here are our top picks in [nearest category]." Inject personalised alternatives inline' },
//         { delay: '4 hrs',   channel: 'Push',   message: '"We heard you! [Category] just got new arrivals — you might love these →"' },
//         { delay: '48 hrs',  channel: 'Email',  message: '"Good news — items similar to what you searched are now available" with curated picks' },
//       ],
//       segmentHint: 'Users with Search No Results event, segmented by search_query to personalise messaging',
//       kpi: 'Recovery browse rate, Conversion from recovered search sessions',
//       accentColor: '#06b6d4',
//     }
//   },

//   // ── SUBSCRIPTION / TRIAL EXPIRY ───────────────────────────────────────────
//   {
//     match: ['trial started', 'subscription started', 'plan upgrade'],
//     campaign: {
//       name: 'Trial-to-Paid Conversion',
//       icon: '⭐',
//       goal: 'Convert trial users to paid subscribers before the trial expires',
//       trigger: 'User is in active trial and trial_days_remaining ≤ 3',
//       channels: ['In-App', 'Email', 'Push'],
//       steps: [
//         { delay: 'Day -7',   channel: 'Email',  message: 'Mid-trial check-in: "You\'re halfway through your trial — here\'s everything you\'ve unlocked so far" with usage stats' },
//         { delay: 'Day -3',   channel: 'In-App', message: 'Trial countdown banner: "3 days left on your trial. Lock in your rate →" with upgrade CTA' },
//         { delay: 'Day -1',   channel: 'Push',   message: '"Last day! Your trial ends tomorrow. Upgrade now and keep everything you\'ve built."' },
//         { delay: 'Day 0',    channel: 'Email',  message: 'Final email: "Your trial has ended — but your progress is saved. Upgrade to continue →" with a limited-time offer' },
//       ],
//       segmentHint: 'Users with Trial Started but no Charged event, sorted by trial_days_remaining',
//       kpi: 'Trial conversion rate, Time-to-convert, MRR from converted trials',
//       accentColor: '#f59e0b',
//     }
//   },

//   // ── POST-PURCHASE / REVIEW REQUEST ───────────────────────────────────────
//   {
//     match: ['charged', 'order tracked', 'booking confirmed', 'lesson completed'],
//     campaign: {
//       name: 'Post-Purchase Delight & Review',
//       icon: '⭐',
//       goal: 'Drive reviews, referrals, and repeat purchases right after a positive experience',
//       trigger: 'User does Charged (purchase confirmed), then delivery/completion milestone passes',
//       channels: ['Push', 'Email', 'In-App'],
//       steps: [
//         { delay: '2 hrs',    channel: 'Push',   message: '"Your order is confirmed! Track it live →" with order tracking deep-link' },
//         { delay: 'Delivery', channel: 'Push',   message: '"Your order arrived! How\'d we do?" with 1-tap star rating' },
//         { delay: '+1 day',   channel: 'Email',  message: 'Review request email with product photo, 5-star rating widget, and "Tell a friend" referral link' },
//         { delay: '+7 days',  channel: 'In-App', message: '"Loved it? Here\'s 15% off your next order" loyalty offer on app open' },
//       ],
//       segmentHint: 'Users who completed a Charged event in last 2–7 days with no Review Submitted event',
//       kpi: 'Review submission rate, NPS uplift, Repeat purchase rate, Referral rate',
//       accentColor: '#22c55e',
//     }
//   },

//   // ── PRICE DROP ALERT ─────────────────────────────────────────────────────
//   {
//     match: ['price alert set', 'notify me clicked', 'wishlist', 'added to wishlist'],
//     campaign: {
//       name: 'Price Drop Alert',
//       icon: '📉',
//       goal: 'Re-engage users who showed high intent when the price or availability changes',
//       trigger: 'User fires Notify Me Clicked or Price Alert Set — send when price drops or stock returns',
//       channels: ['Push', 'SMS', 'Email'],
//       steps: [
//         { delay: 'Instant (on trigger)',  channel: 'Push', message: '"Great news! [Product] you wanted is back in stock / just dropped to ₹[price]" → direct product link' },
//         { delay: '+4 hrs',               channel: 'SMS',  message: '"[Product] price alert: now ₹[price] (was ₹[original]). Selling fast — grab it now."' },
//         { delay: '+48 hrs',              channel: 'Email', message: '"Your saved item is running low — only X left at the new price."' },
//       ],
//       segmentHint: 'Users with Notify Me Clicked or Price Alert Set, filtered by the specific product/asset',
//       kpi: 'Alert click-through rate, Conversion from alerted users vs non-alerted',
//       accentColor: '#06b6d4',
//     }
//   },
// ];

// // ─── Select 3–5 most relevant campaigns ──────────────────────────────────────
// function selectCampaigns(recommendedEvents) {
//   const eventNames = recommendedEvents.map(e => e.eventName.toLowerCase());

//   const scored = CAMPAIGN_TEMPLATES.map(t => {
//     const matchScore = t.match.reduce((acc, keyword) => {
//       const hit = eventNames.some(n => n.includes(keyword.toLowerCase()));
//       return acc + (hit ? 1 : 0);
//     }, 0);
//     return { ...t, score: matchScore };
//   })
//   .filter(t => t.score > 0)
//   .sort((a, b) => b.score - a.score);

//   // Always include onboarding + charged if present, fill up to 5
//   const priority = ['New User Activation', 'Checkout Recovery', 'Post-Purchase Delight & Review'];
//   const result = [];

//   for (const name of priority) {
//     const found = scored.find(t => t.campaign.name === name);
//     if (found && result.length < 5) result.push(found);
//   }

//   for (const t of scored) {
//     if (result.length >= 5) break;
//     if (!result.find(r => r.campaign.name === t.campaign.name)) result.push(t);
//   }

//   // Fallback: if nothing matched, use the first 3 generic ones
//   if (result.length === 0) {
//     return CAMPAIGN_TEMPLATES.slice(0, 3);
//   }

//   return result.slice(0, 5);
// }

// // ─── Channel pill ─────────────────────────────────────────────────────────────
// function ChannelPill({ channel }) {
//   const m = CHANNEL_META[channel] || { color: '#9aa0ae', bg: '#9aa0ae20', border: '#9aa0ae30', icon: '📡' };
//   return (
//     <span style={{
//       display: 'inline-flex', alignItems: 'center', gap: 4,
//       padding: '3px 10px', borderRadius: 999,
//       fontSize: 11, fontWeight: 700,
//       background: m.bg, border: `1px solid ${m.border}`, color: m.color,
//       fontFamily: 'var(--font-mono)',
//     }}>
//       {m.icon} {channel}
//     </span>
//   );
// }

// // ─── Step row ─────────────────────────────────────────────────────────────────
// function StepRow({ step, index, accentColor }) {
//   const m = CHANNEL_META[step.channel] || { color: '#9aa0ae', bg: '#9aa0ae20', border: '#9aa0ae30', icon: '📡' };
//   return (
//     <div style={{
//       display: 'flex', gap: 14, alignItems: 'flex-start',
//       padding: '12px 0',
//       borderBottom: '1px solid var(--border)',
//     }}>
//       {/* Step number + connector */}
//       <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
//         <div style={{
//           width: 24, height: 24, borderRadius: '50%',
//           background: `${accentColor}20`, border: `2px solid ${accentColor}50`,
//           display: 'grid', placeItems: 'center',
//           fontSize: 10, fontWeight: 800, color: accentColor,
//           fontFamily: 'var(--font-mono)',
//         }}>
//           {index + 1}
//         </div>
//       </div>

//       <div style={{ flex: 1, minWidth: 0 }}>
//         <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
//           <span style={{
//             fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
//             fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
//             background: 'var(--bg-input)', border: '1px solid var(--border)',
//             padding: '2px 8px', borderRadius: 4,
//           }}>
//             ⏱ {step.delay}
//           </span>
//           <ChannelPill channel={step.channel} />
//         </div>
//         <p style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.65, margin: 0, fontStyle: 'italic' }}>
//           {step.message}
//         </p>
//       </div>
//     </div>
//   );
// }

// // ─── Campaign card ────────────────────────────────────────────────────────────
// function CampaignCard({ campaign, index }) {
//   const [expanded, setExpanded] = useState(index === 0);
//   const accent = campaign.accentColor || '#ff5533';

//   return (
//     <div
//       style={{
//         border: `1px solid ${expanded ? accent + '40' : 'var(--border)'}`,
//         borderRadius: 'var(--radius)',
//         background: expanded ? `${accent}06` : 'var(--bg-input)',
//         marginBottom: 12,
//         transition: 'all 0.2s',
//         overflow: 'hidden',
//       }}
//     >
//       {/* ── Header ── */}
//       <div
//         onClick={() => setExpanded(e => !e)}
//         style={{
//           display: 'flex', alignItems: 'center', gap: 14,
//           padding: '16px 18px', cursor: 'pointer',
//           userSelect: 'none',
//         }}
//       >
//         {/* Icon badge */}
//         <div style={{
//           width: 40, height: 40, borderRadius: 10, flexShrink: 0,
//           background: `${accent}18`, border: `1px solid ${accent}35`,
//           display: 'grid', placeItems: 'center', fontSize: 18,
//         }}>
//           {campaign.icon}
//         </div>

//         <div style={{ flex: 1, minWidth: 0 }}>
//           <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
//             <span style={{
//               fontWeight: 700, fontSize: 14, color: 'var(--text-1)',
//               fontFamily: 'var(--font-mono)',
//             }}>
//               {campaign.name}
//             </span>
//             {/* Channel pills preview */}
//             <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
//               {campaign.channels.map(c => <ChannelPill key={c} channel={c} />)}
//             </div>
//           </div>
//           <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>
//             {campaign.goal}
//           </p>
//         </div>

//         {/* Expand chevron */}
//         <span style={{
//           color: 'var(--text-3)', fontSize: 18, flexShrink: 0,
//           transform: expanded ? 'rotate(180deg)' : 'none',
//           transition: 'transform 0.2s',
//         }}>
//           ⌄
//         </span>
//       </div>

//       {/* ── Expanded body ── */}
//       {expanded && (
//         <div style={{ padding: '0 18px 18px 18px', borderTop: `1px solid ${accent}20` }}>

//           {/* Trigger */}
//           <div style={{ paddingTop: 16, marginBottom: 16 }}>
//             <div style={{
//               display: 'inline-flex', alignItems: 'center', gap: 8,
//               padding: '8px 14px', borderRadius: 8,
//               background: `${accent}12`, border: `1px solid ${accent}30`,
//             }}>
//               <span style={{ fontSize: 14 }}>⚡</span>
//               <div>
//                 <span style={{
//                   fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
//                   textTransform: 'uppercase', color: accent,
//                   fontFamily: 'var(--font-mono)', display: 'block', marginBottom: 2,
//                 }}>
//                   Campaign Trigger
//                 </span>
//                 <span style={{ fontSize: 12.5, color: 'var(--text-1)', fontWeight: 600 }}>
//                   {campaign.trigger}
//                 </span>
//               </div>
//             </div>
//           </div>

//           {/* Steps */}
//           <div style={{
//             fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
//             textTransform: 'uppercase', color: 'var(--text-3)',
//             fontFamily: 'var(--font-mono)', marginBottom: 4,
//           }}>
//             Message Sequence
//           </div>

//           <div style={{ marginBottom: 16 }}>
//             {campaign.steps.map((step, i) => (
//               <StepRow key={i} step={step} index={i} accentColor={accent} />
//             ))}
//           </div>

//           {/* Segment hint + KPI row */}
//           <div style={{
//             display: 'grid',
//             gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
//             gap: 10,
//             marginTop: 6,
//           }}>
//             {/* Segment */}
//             <div style={{
//               padding: '10px 14px', borderRadius: 8,
//               background: 'var(--bg-input)', border: '1px solid var(--border)',
//             }}>
//               <div style={{
//                 fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
//                 textTransform: 'uppercase', color: 'var(--text-3)',
//                 fontFamily: 'var(--font-mono)', marginBottom: 5,
//               }}>
//                 🎯 Target Segment
//               </div>
//               <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
//                 {campaign.segmentHint}
//               </p>
//             </div>

//             {/* KPIs */}
//             <div style={{
//               padding: '10px 14px', borderRadius: 8,
//               background: 'var(--bg-input)', border: '1px solid var(--border)',
//             }}>
//               <div style={{
//                 fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
//                 textTransform: 'uppercase', color: 'var(--text-3)',
//                 fontFamily: 'var(--font-mono)', marginBottom: 5,
//               }}>
//                 📊 KPIs to Track
//               </div>
//               <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
//                 {campaign.kpi}
//               </p>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }

// // ─── Main component ───────────────────────────────────────────────────────────
// export default function CampaignSuggestions({ result, selected }) {
//   const campaigns = useMemo(() => {
//     if (!result?.recommendedEvents) return [];
//     const eventsToUse = result.recommendedEvents.filter(e =>
//       selected && selected.size > 0 ? selected.has(e.eventName) : true
//     );
//     return selectCampaigns(eventsToUse);
//   }, [result, selected]);

//   if (!campaigns.length) return null;

//   return (
//     <div
//       className="card"
//       style={{
//         marginTop: 20,
//         borderColor: 'rgba(255,85,51,0.25)',
//         background: 'rgba(255,85,51,0.02)',
//       }}
//     >
//       {/* ── Header ── */}
//       <div style={{
//         display: 'flex', justifyContent: 'space-between',
//         alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 6,
//       }}>
//         <div>
//           <div className="card-title" style={{ marginBottom: 4 }}>
//             🎯 Starter Campaign Playbook
//           </div>
//           <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
//             Based on your selected events, here are <strong style={{ color: 'var(--text-1)' }}>
//               {campaigns.length} ready-to-launch campaign strategies
//             </strong> tailored for <em>{result?.businessVertical}</em>.
//             Each campaign includes a trigger, multi-step message sequence, target segment, and KPIs.
//           </p>
//         </div>

//         {/* Badge */}
//         <div style={{
//           display: 'flex', alignItems: 'center', gap: 6,
//           padding: '6px 14px', borderRadius: 999,
//           background: 'rgba(255,85,51,0.12)', border: '1px solid rgba(255,85,51,0.3)',
//           fontSize: 12, fontWeight: 700, color: '#ff5533',
//           fontFamily: 'var(--font-mono)', flexShrink: 0,
//           letterSpacing: '0.04em',
//         }}>
//           ⚡ {campaigns.length} campaigns
//         </div>
//       </div>

//       {/* ── Channel legend ── */}
//       <div style={{
//         display: 'flex', flexWrap: 'wrap', gap: 8,
//         padding: '10px 14px', borderRadius: 8,
//         background: 'var(--bg-input)', border: '1px solid var(--border)',
//         marginBottom: 20, marginTop: 14,
//       }}>
//         <span style={{
//           fontSize: 11, color: 'var(--text-3)', fontWeight: 700,
//           fontFamily: 'var(--font-mono)', letterSpacing: '0.06em',
//           textTransform: 'uppercase', marginRight: 4, alignSelf: 'center',
//         }}>
//           Channels:
//         </span>
//         {Object.entries(CHANNEL_META).map(([name, m]) => (
//           <span key={name} style={{
//             display: 'inline-flex', alignItems: 'center', gap: 5,
//             fontSize: 12, color: m.color, fontWeight: 600,
//           }}>
//             {m.icon} {name}
//           </span>
//         ))}
//       </div>

//       {/* ── Campaign cards ── */}
//       {campaigns.map((t, i) => (
//         <CampaignCard key={t.campaign.name} campaign={t.campaign} index={i} />
//       ))}

//       {/* ── Footer note ── */}
//       <div style={{
//         marginTop: 16, paddingTop: 14,
//         borderTop: '1px solid var(--border)',
//         display: 'flex', alignItems: 'flex-start', gap: 10,
//       }}>
//         <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
//         <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, margin: 0 }}>
//           These are starting templates. Personalise message copy with user attributes (name, product browsed, cart total) using
//           CleverTap's <strong style={{ color: 'var(--text-2)' }}>Liquid Tags</strong>.
//           Set up Journeys in CleverTap Dashboard → <em>Campaigns → Journeys</em> to automate multi-step sequences.
//           Full reference: <a
//             href="https://developer.clevertap.com/docs/journeys"
//             target="_blank"
//             rel="noopener noreferrer"
//             style={{ color: 'var(--blue, #3b82f6)', textDecoration: 'none' }}
//           >
//             developer.clevertap.com/docs/journeys
//           </a>
//         </p>
//       </div>
//     </div>
//   );
// }


/**
 * CampaignSuggestions.jsx  –  AI-powered campaign strategy panel
 *
 * Calls /api/campaigns with the scan result + selected events.
 * The backend (campaignGenerator.js) uses AI to generate campaigns that are:
 *   • Specific to the scanned website and business vertical
 *   • Channel-aware: no Push/In-App for web-only sites
 *   • Triggered by the actual selected events
 *
 * Props:
 *   result   – full scan result object from /api/scan
 *   selected – Set<string> of selected event names
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : '/api';

// ─── Channel visual metadata ──────────────────────────────────────────────────
const CHANNEL_META = {
  'Email':                 { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.28)',  icon: '✉️',  label: 'Email' },
  'SMS':                   { color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.28)',   icon: '💬',  label: 'SMS' },
  'Web Push Notification': { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.28)', icon: '🔔',  label: 'Web Push' },
  'Web Pop-up / Banner':   { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',border: 'rgba(167,139,250,0.28)',icon: '💭',  label: 'Web Pop-up' },
  'WhatsApp':              { color: '#25d366', bg: 'rgba(37,211,102,0.12)', border: 'rgba(37,211,102,0.28)', icon: '📲',  label: 'WhatsApp' },
  'Push Notification':     { color: '#f97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.28)', icon: '📳',  label: 'Push' },
  'In-App Message':        { color: '#e879f9', bg: 'rgba(232,121,249,0.12)',border: 'rgba(232,121,249,0.28)',icon: '📱',  label: 'In-App' },
};

function getChannelMeta(channel) {
  return CHANNEL_META[channel] || {
    color: '#9aa0ae', bg: 'rgba(154,160,174,0.12)',
    border: 'rgba(154,160,174,0.28)', icon: '📡', label: channel,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChannelPill({ channel }) {
  const m = getChannelMeta(channel);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.03em',
      background: m.bg, border: `1px solid ${m.border}`, color: m.color,
      fontFamily: 'var(--font-mono)',
    }}>
      {m.icon} {m.label}
    </span>
  );
}

function StepRow({ step, index, accentColor }) {
  return (
    <div style={{
      display: 'flex', gap: 14, alignItems: 'flex-start',
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      {/* Step circle */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: `${accentColor}18`, border: `2px solid ${accentColor}45`,
          display: 'grid', placeItems: 'center',
          fontSize: 10, fontWeight: 800, color: accentColor,
          fontFamily: 'var(--font-mono)',
        }}>
          {index + 1}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Delay + channel */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 7, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.05em',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            padding: '2px 9px', borderRadius: 5,
          }}>
            ⏱ {step.delay}
          </span>
          <ChannelPill channel={step.channel} />
        </div>
        {/* Message copy */}
        <p style={{
          fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.7,
          margin: 0, fontStyle: 'italic',
          padding: '8px 12px',
          background: 'var(--bg-input)',
          borderRadius: 6,
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${accentColor}50`,
        }}>
          "{step.message}"
        </p>
      </div>
    </div>
  );
}

function CampaignCard({ campaign, index }) {
  const [expanded, setExpanded] = useState(index === 0);
  const accent = campaign.accentColor || '#ff5533';

  return (
    <div style={{
      border: `1px solid ${expanded ? accent + '40' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      background: expanded ? `${accent}05` : 'var(--bg-input)',
      marginBottom: 12,
      transition: 'all 0.2s',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 18px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 42, height: 42, borderRadius: 11, flexShrink: 0,
          background: `${accent}18`, border: `1px solid ${accent}35`,
          display: 'grid', placeItems: 'center', fontSize: 20,
        }}>
          {campaign.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>
              {campaign.name}
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(campaign.channels || []).map(c => <ChannelPill key={c} channel={c} />)}
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, lineHeight: 1.55 }}>
            {campaign.goal}
          </p>
        </div>

        <span style={{
          color: 'var(--text-3)', fontSize: 18, flexShrink: 0,
          transform: expanded ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}>
          ⌄
        </span>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 18px 18px 18px', borderTop: `1px solid ${accent}20` }}>

          {/* Trigger */}
          <div style={{ paddingTop: 16, marginBottom: 18 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'flex-start', gap: 10,
              padding: '10px 16px', borderRadius: 8,
              background: `${accent}10`, border: `1px solid ${accent}30`,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>⚡</span>
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                  textTransform: 'uppercase', color: accent,
                  fontFamily: 'var(--font-mono)', marginBottom: 4,
                }}>
                  Campaign Trigger
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600, lineHeight: 1.5 }}>
                  {campaign.trigger}
                </div>
              </div>
            </div>
          </div>

          {/* Message sequence */}
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase',
            color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginBottom: 4,
          }}>
            Message Sequence
          </div>
          <div style={{ marginBottom: 16 }}>
            {(campaign.steps || []).map((step, i) => (
              <StepRow key={i} step={step} index={i} accentColor={accent} />
            ))}
          </div>

          {/* Segment + KPI */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 10, marginTop: 4,
          }}>
            <div style={{
              padding: '11px 14px', borderRadius: 8,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)', marginBottom: 6,
              }}>
                🎯 Target Segment
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>
                {campaign.segmentHint}
              </p>
            </div>

            <div style={{
              padding: '11px 14px', borderRadius: 8,
              background: 'var(--bg-input)', border: '1px solid var(--border)',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
                textTransform: 'uppercase', color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)', marginBottom: 6,
              }}>
                📊 KPIs to Track
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.65, margin: 0 }}>
                {campaign.kpi}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────
function CampaignSkeleton() {
  return (
    <div>
      {[1, 2, 3].map(i => (
        <div key={i} style={{
          border: '1px solid var(--border)', borderRadius: 'var(--radius)',
          background: 'var(--bg-input)', marginBottom: 12, padding: '16px 18px',
          display: 'flex', gap: 14, alignItems: 'center',
          animation: 'pulse 1.6s ease-in-out infinite',
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11, flexShrink: 0,
            background: 'var(--border)',
          }} />
          <div style={{ flex: 1 }}>
            <div style={{ height: 14, borderRadius: 6, background: 'var(--border)', marginBottom: 8, width: '45%' }} />
            <div style={{ height: 11, borderRadius: 6, background: 'var(--border)', width: '75%' }} />
          </div>
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
      `}</style>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CampaignSuggestions({ result, selected }) {
  const [campaigns, setCampaigns] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [generated, setGenerated] = useState(false);   // has at least one fetch succeeded?
  const lastFetchKey = useRef('');                      // debounce guard

  // Build a stable "key" from result + selected so we only re-fetch when they change
  const fetchKey = [
    result?.url || '',
    [...(selected || [])].sort().join(','),
  ].join('|');

  const fetchCampaigns = useCallback(async (key) => {
    if (!result?.recommendedEvents || !selected || selected.size === 0) return;

    // Guard: don't re-fetch if nothing changed
    if (key === lastFetchKey.current) return;
    lastFetchKey.current = key;

    const selectedEvents = result.recommendedEvents.filter(e => selected.has(e.eventName));
    if (selectedEvents.length === 0) return;

    setLoading(true);
    setError('');

    try {
      const res  = await fetch(`${API}/campaigns`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ scanResult: result, selectedEvents }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Campaign generation failed');
      setCampaigns(data.campaigns || []);
      setGenerated(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [result, selected]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fetch on mount (when result first arrives) — not on every selection change
  useEffect(() => {
    if (result && selected?.size > 0 && !generated && !loading) {
      fetchCampaigns(fetchKey);
    }
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!result) return null;

  // ── Detect platform for the channel legend ──
  const haystack = [
    result.websiteType || '', result.businessDescription || '',
  ].join(' ').toLowerCase();
  const hasMobileApp = ['mobile app','ios app','android app','app store','play store','download app'].some(s => haystack.includes(s));
  const visibleChannels = hasMobileApp
    ? ['Email','SMS','Web Push Notification','Web Pop-up / Banner','WhatsApp','Push Notification','In-App Message']
    : ['Email','SMS','Web Push Notification','Web Pop-up / Banner','WhatsApp'];

  return (
    <div style={{
      marginTop: 24,
      border: '1px solid rgba(255,85,51,0.22)',
      borderRadius: 'var(--radius)',
      background: 'rgba(255,85,51,0.02)',
      padding: '20px 20px 16px',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 14,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="card-title" style={{ marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
            🎯 Starter Campaign Playbook
            {/* Platform badge */}
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 4,
              background: hasMobileApp ? 'rgba(167,139,250,0.15)' : 'rgba(59,130,246,0.15)',
              color: hasMobileApp ? '#a78bfa' : '#3b82f6',
              border: `1px solid ${hasMobileApp ? 'rgba(167,139,250,0.3)' : 'rgba(59,130,246,0.3)'}`,
              fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.04em',
            }}>
              {hasMobileApp ? '📱 Web + App' : '🌐 Web Only'}
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }}>
            {generated && campaigns.length > 0
              ? <>AI-generated <strong style={{ color: 'var(--text-1)' }}>{campaigns.length} campaign strategies</strong> tailored for <em>{result.businessVertical}</em>, based on your {selected.size} selected event{selected.size !== 1 ? 's' : ''}.</>
              : loading
                ? <>Analysing your selected events and generating campaign strategies…</>
                : <>Click <strong style={{ color: 'var(--text-1)' }}>Generate Campaigns</strong> to get AI-tailored strategies based on your selected events.</>
            }
          </p>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0, alignItems: 'center' }}>
          {generated && !loading && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 999,
              background: 'rgba(255,85,51,0.12)', border: '1px solid rgba(255,85,51,0.3)',
              fontSize: 11, fontWeight: 700, color: '#ff5533',
              fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
            }}>
              ⚡ {campaigns.length} campaigns
            </span>
          )}
          <button
            onClick={() => {
              lastFetchKey.current = ''; // force re-fetch
              fetchCampaigns(fetchKey + '_manual_' + Date.now());
            }}
            disabled={loading || selected.size === 0}
            style={{
              padding: '8px 16px', borderRadius: 'var(--radius)',
              background: loading ? 'var(--bg-input)' : 'var(--accent)',
              color: loading ? 'var(--text-3)' : 'white',
              border: `1px solid ${loading ? 'var(--border)' : 'var(--accent)'}`,
              cursor: loading || selected.size === 0 ? 'not-allowed' : 'pointer',
              fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)',
              display: 'flex', alignItems: 'center', gap: 7,
              transition: 'all 0.15s',
              opacity: selected.size === 0 ? 0.5 : 1,
            }}
          >
            {loading
              ? <><span className="spinner" style={{ width: 12, height: 12 }} /> Generating…</>
              : generated
                ? '↺ Regenerate'
                : '✦ Generate Campaigns'}
          </button>
        </div>
      </div>

      {/* ── Channel legend ── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        padding: '9px 14px', borderRadius: 8,
        background: 'var(--bg-input)', border: '1px solid var(--border)',
        marginBottom: 20,
      }}>
        <span style={{
          fontSize: 10, color: 'var(--text-3)', fontWeight: 800,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.07em',
          textTransform: 'uppercase', marginRight: 2,
        }}>
          Channels:
        </span>
        {visibleChannels.map(c => {
          const m = getChannelMeta(c);
          return (
            <span key={c} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 11, color: m.color, fontWeight: 600,
            }}>
              {m.icon} {m.label}
            </span>
          );
        })}
        {!hasMobileApp && (
          <span style={{
            marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)',
            fontStyle: 'italic', fontFamily: 'var(--font-mono)',
          }}>
            Push & In-App excluded (web-only site)
          </span>
        )}
      </div>

      {/* ── States ── */}

      {/* Empty / not yet generated */}
      {!loading && !generated && !error && (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          color: 'var(--text-3)', fontSize: 13,
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
          <div style={{ fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
            Ready to generate campaigns
          </div>
          <div style={{ fontSize: 12 }}>
            Select events above, then click "Generate Campaigns" to get AI-tailored strategies.
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && <CampaignSkeleton />}

      {/* Error */}
      {error && !loading && (
        <div style={{
          padding: '14px 18px', borderRadius: 8,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
          color: '#f87171', fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>❌</span>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 3 }}>Campaign generation failed</div>
            <div style={{ opacity: 0.8 }}>{error}</div>
          </div>
        </div>
      )}

      {/* Campaign cards */}
      {!loading && generated && campaigns.length > 0 && (
        <div>
          {campaigns.map((c, i) => (
            <CampaignCard key={`${c.name}-${i}`} campaign={c} index={i} />
          ))}
        </div>
      )}

      {/* Footer */}
      {generated && campaigns.length > 0 && !loading && (
        <div style={{
          marginTop: 16, paddingTop: 14,
          borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
          <p style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.7, margin: 0 }}>
            Personalise message copy with user attributes using CleverTap's{' '}
            <strong style={{ color: 'var(--text-2)' }}>Liquid Tags</strong>.
            Build multi-step sequences in{' '}
            <em>CleverTap Dashboard → Campaigns → Journeys</em>.
            Full reference:{' '}
            <a
              href="https://developer.clevertap.com/docs/journeys"
              target="_blank" rel="noopener noreferrer"
              style={{ color: 'var(--blue, #3b82f6)', textDecoration: 'none' }}
            >
              developer.clevertap.com/docs/journeys
            </a>
          </p>
        </div>
      )}
    </div>
  );
}