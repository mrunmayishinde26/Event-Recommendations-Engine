/**
 * scanner.js  –  Multi-page intelligent website analyser
 *
 * HOW IT WORKS:
 *  1. Puppeteer crawls up to 8 pages of the target site
 *  2. Merges signals from all pages (H1s, nav, CTAs, forms, body text, JSON-LD)
 *  3. Sends merged site signals + full EVENT_LIBRARY_EXAMPLES to AI as few-shot reference
 *  4. AI reads real site content, learns from library patterns, generates 45-50 CUSTOM events
 *  5. Returns deeply site-specific events — not a fixed list, not a copy of examples
 */

const puppeteer = require('puppeteer');
const https     = require('https');
const fs        = require('fs');

const MAX_PAGES    = 8;
const PAGE_TIMEOUT = 18000;
const JS_SETTLE_MS = 1800;

// ─── Chrome path detection ────────────────────────────────────────────────────
function findChromePath() {
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser', '/usr/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const p of candidates) {
    try { if (fs.existsSync(p)) { console.log(`[Scanner] Chrome: ${p}`); return p; } }
    catch (_) {}
  }
  console.warn('[Scanner] No system Chrome — using bundled Chromium.');
  return null;
}

function getLaunchOptions() {
  const args = [
    '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
    '--disable-gpu', '--window-size=1280,900', '--disable-extensions',
    '--disable-background-networking', '--mute-audio', '--no-first-run',
  ];
  const opts = { headless: 'new', args, ignoreHTTPSErrors: true };
  const chrome = process.env.CHROME_PATH || findChromePath();
  if (chrome) opts.executablePath = chrome;
  return opts;
}

// ─── Page goto with fallback strategies ──────────────────────────────────────
async function gotoSafe(page, url) {
  const strategies = [
    { waitUntil: 'networkidle2',     timeout: PAGE_TIMEOUT },
    { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT },
    { waitUntil: 'load',             timeout: PAGE_TIMEOUT },
  ];
  for (const s of strategies) {
    try {
      const resp   = await page.goto(url, s);
      const status = resp ? resp.status() : 0;
      if (status < 500) return true;
    } catch (_) {}
  }
  return false;
}

// ─── Apply stealth headers ────────────────────────────────────────────────────
async function applyStealth(page) {
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
    window.chrome = { runtime: {} };
  });
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );
  await page.setViewport({ width: 1280, height: 900 });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-US,en;q=0.9' });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (['image', 'media', 'font'].includes(req.resourceType())) req.abort();
    else req.continue();
  });
  page.on('console', () => {});
  page.on('pageerror', () => {});
}

// ─── Page type classifier ─────────────────────────────────────────────────────
function classifyUrl(url) {
  const u = url.toLowerCase();
  if (/\/checkout|\/payment|\/order\/new/.test(u))                        return 'checkout';
  if (/\/login|\/signin|\/sign-in/.test(u))                               return 'login';
  if (/\/signup|\/register|\/join|\/create-account/.test(u))              return 'signup';
  if (/\/search|\?q=|\?query=|\?s=/.test(u))                              return 'search';
  if (/\/product\/|\/item\/|\/p\/|\/dp\/|\/pd\/|productid=/.test(u))      return 'product';
  if (/\/category\/|\/collection\/|\/catalog\/|\/browse\/|\/dept\//.test(u)) return 'category';
  if (/\/contact|\/support|\/help|\/faq/.test(u))                         return 'support';
  if (/\/about|\/team|\/company/.test(u))                                 return 'about';
  if (/\/pricing|\/plans|\/subscription/.test(u))                         return 'pricing';
  if (/\/blog|\/news|\/article|\/post/.test(u))                           return 'blog';
  if (/\/account|\/profile|\/dashboard|\/my-/.test(u))                   return 'account';
  if (/\/order|\/track/.test(u))                                          return 'orders';
  return 'other';
}

// ─── Discover internal links ──────────────────────────────────────────────────
async function discoverLinks(page, baseHostname) {
  return page.evaluate((hostname) => {
    return Array.from(document.querySelectorAll('a[href]'))
      .map(a => {
        try {
          const u = new URL(a.href);
          if (u.hostname !== hostname) return null;
          if (u.pathname === '/') return null;
          if (/\.(pdf|jpg|png|gif|zip|exe|js|css|xml|json)$/i.test(u.pathname)) return null;
          return u.href.split('#')[0];
        } catch { return null; }
      })
      .filter(Boolean);
  }, baseHostname);
}

// ─── Extract signals from a single loaded page ───────────────────────────────
async function extractSignals(page, pageType) {
  await new Promise(r => setTimeout(r, JS_SETTLE_MS));
  const data = await page.evaluate((ptype) => {
    const getText = (sel, n) =>
      Array.from(document.querySelectorAll(sel))
        .map(el => (el.innerText || el.textContent || '').trim())
        .filter(Boolean).slice(0, n);

    const navLinks = Array.from(document.querySelectorAll('nav a, header a, [role="navigation"] a'))
      .map(a => ({ text: a.innerText.trim().slice(0, 60), href: a.href }))
      .filter(l => l.text).slice(0, 30);

    const ctaTexts = Array.from(document.querySelectorAll(
      'button, a.btn, [class*="button"], [class*="cta"], input[type="submit"], [role="button"]'
    )).map(el => (el.innerText || el.textContent || el.value || '').trim())
      .filter(t => t && t.length < 80).slice(0, 40);

    const forms = Array.from(document.querySelectorAll('form')).map(f => ({
      action: f.action || '',
      id: f.id || '',
      fields: Array.from(f.querySelectorAll('input,textarea,select'))
        .map(i => i.name || i.placeholder || i.type || '').filter(Boolean).slice(0, 6),
    })).slice(0, 8);

    const jsonLd = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
      .map(s => { try { return JSON.parse(s.textContent); } catch { return null; } })
      .filter(Boolean).slice(0, 2);

    return {
      pageType:   ptype,
      url:        window.location.href,
      pageTitle:  document.title,
      metaDesc:   document.querySelector('meta[name="description"]')?.getAttribute('content') || '',
      ogType:     document.querySelector('meta[property="og:type"]')?.getAttribute('content') || '',
      ogSiteName: document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || '',
      h1s:        getText('h1', 4),
      h2s:        getText('h2', 8),
      navLinks,
      ctaTexts,
      forms,
      jsonLd,
      bodyText:   (document.body?.innerText || '').slice(0, 1500),
    };
  }, pageType);
  return data;
}

// ─── Select best pages to crawl ───────────────────────────────────────────────
function selectPages(links) {
  const PRIORITY = [
    'product', 'checkout', 'login', 'signup',
    'search', 'category', 'pricing', 'orders',
    'support', 'account', 'blog', 'about', 'other',
  ];
  const byType = {};
  for (const link of links) {
    const type = classifyUrl(link);
    if (!byType[type]) byType[type] = link;
  }
  const selected = [];
  for (const type of PRIORITY) {
    if (byType[type]) selected.push({ url: byType[type], type });
    if (selected.length >= MAX_PAGES - 1) break;
  }
  return selected;
}

// ─── Merge signals from all crawled pages ────────────────────────────────────
function mergeSignals(allPageData) {
  const merged = {
    pagesScanned:   allPageData.length,
    pagesSummary:   allPageData.map(p => `[${p.pageType}] ${p.pageTitle} — ${p.url}`),
    siteName:       allPageData[0]?.ogSiteName || '',
    homeTitle:      allPageData[0]?.pageTitle  || '',
    homeMetaDesc:   allPageData[0]?.metaDesc   || '',
    allH1s:         [],
    allH2s:         [],
    allNavLinks:    [],
    allCtaTexts:    [],
    allForms:       [],
    allJsonLd:      [],
    bodyTextByPage: [],
    pageTypes:      [],
  };

  for (const p of allPageData) {
    merged.allH1s.push(...(p.h1s || []));
    merged.allH2s.push(...(p.h2s || []));
    merged.allNavLinks.push(...(p.navLinks || []).map(l => l.text));
    merged.allCtaTexts.push(...(p.ctaTexts || []));
    merged.allForms.push(...(p.forms || []));
    merged.allJsonLd.push(...(p.jsonLd || []));
    merged.bodyTextByPage.push(`[${p.pageType} page] ${p.bodyText?.slice(0, 600) || ''}`);
    merged.pageTypes.push(p.pageType);
  }

  merged.allH1s      = [...new Set(merged.allH1s)].slice(0, 15);
  merged.allH2s      = [...new Set(merged.allH2s)].slice(0, 20);
  merged.allNavLinks = [...new Set(merged.allNavLinks)].slice(0, 30);
  merged.allCtaTexts = [...new Set(merged.allCtaTexts)].slice(0, 50);
  merged.pageTypes   = [...new Set(merged.pageTypes)];

  return merged;
}

// ─── EVENT LIBRARY — full reference sent to AI as design examples ─────────────
//
// NOT a fixed output list. The AI receives all examples below as few-shot
// design patterns and uses them to learn schema, naming, priority, and property
// conventions — then generates 45-50 NEW events tailored to the actual website.
//
const EVENT_LIBRARY_EXAMPLES = [
  // ACQUISITION
  { category: 'Acquisition', priority: 'must-have',    eventName: 'Page Viewed',                triggerDescription: 'Every page or screen load', suggestedProperties: ['page_url','page_title','referrer','utm_source','utm_medium','utm_campaign','device_type'] },
  { category: 'Acquisition', priority: 'must-have',    eventName: 'Search Performed',           triggerDescription: 'User submits a search query', suggestedProperties: ['search_query','results_count','search_source','category','did_autocomplete','filter_applied'] },
  { category: 'Acquisition', priority: 'recommended',  eventName: 'Banner Clicked',             triggerDescription: 'User clicks a hero or promotional banner', suggestedProperties: ['banner_id','banner_name','destination_url','position','campaign_name'] },
  { category: 'Acquisition', priority: 'recommended',  eventName: 'App Downloaded',             triggerDescription: 'User clicks an app store download link', suggestedProperties: ['platform','source_page','campaign'] },
  { category: 'Acquisition', priority: 'recommended',  eventName: 'CTA Clicked',                triggerDescription: 'User clicks a primary call-to-action on a marketing page', suggestedProperties: ['cta_text','cta_location','page_url','plan_context'] },
  { category: 'Acquisition', priority: 'recommended',  eventName: 'Pricing Page Viewed',        triggerDescription: 'User visits the pricing or plans page', suggestedProperties: ['plan_highlighted','referrer','time_on_page_secs','cta_clicked'] },
  { category: 'Acquisition', priority: 'nice-to-have', eventName: 'Referral Landing',           triggerDescription: 'User arrives via a referral or invite link', suggestedProperties: ['referral_code','referrer_user','landing_page','utm_source'] },
  { category: 'Acquisition', priority: 'nice-to-have', eventName: 'Demo Requested',             triggerDescription: 'User submits a demo or contact-sales form', suggestedProperties: ['company_name','team_size','use_case','source','email'] },
  // ACTIVATION
  { category: 'Activation',  priority: 'must-have',    eventName: 'Account Created',            triggerDescription: 'User completes registration and creates an account', suggestedProperties: ['signup_method','referral_source','email','phone','has_phone','device_type'] },
  { category: 'Activation',  priority: 'must-have',    eventName: 'Login Completed',            triggerDescription: 'User successfully logs into their account', suggestedProperties: ['login_method','device_type','is_returning_user','days_since_last_login','mfa_used'] },
  { category: 'Activation',  priority: 'must-have',    eventName: 'Onboarding Started',         triggerDescription: 'User begins the onboarding or getting-started flow', suggestedProperties: ['onboarding_step','total_steps','source','plan'] },
  { category: 'Activation',  priority: 'must-have',    eventName: 'Onboarding Completed',       triggerDescription: 'User finishes all onboarding steps', suggestedProperties: ['steps_completed','skipped_steps','time_to_complete_mins','plan'] },
  { category: 'Activation',  priority: 'recommended',  eventName: 'Email Verified',             triggerDescription: 'User verifies their email address after registration', suggestedProperties: ['time_to_verify_mins','signup_source','resent_count'] },
  { category: 'Activation',  priority: 'recommended',  eventName: 'Profile Updated',            triggerDescription: 'User updates their profile or account information', suggestedProperties: ['fields_updated','profile_completeness_pct','added_phone','added_address'] },
  { category: 'Activation',  priority: 'recommended',  eventName: 'Address Saved',              triggerDescription: 'User saves a delivery or billing address', suggestedProperties: ['address_type','city','pincode','is_default','address_count'] },
  { category: 'Activation',  priority: 'recommended',  eventName: 'Push Notification Opted In', triggerDescription: 'User grants push notification permission', suggestedProperties: ['device_type','opt_in_source','prompt_trigger','page_url'] },
  { category: 'Activation',  priority: 'recommended',  eventName: 'Team Member Invited',        triggerDescription: 'User invites a colleague or friend to the platform', suggestedProperties: ['invitee_email','role_assigned','inviter_plan','team_size_after'] },
  { category: 'Activation',  priority: 'nice-to-have', eventName: 'Email Subscribed',           triggerDescription: 'User subscribes to newsletter or marketing emails', suggestedProperties: ['subscription_source','email','preferences','incentive_used'] },
  { category: 'Activation',  priority: 'nice-to-have', eventName: 'Profile Photo Uploaded',     triggerDescription: 'User uploads a profile or workspace avatar', suggestedProperties: ['upload_source','file_type','plan'] },
  // RETENTION
  { category: 'Retention',   priority: 'must-have',    eventName: 'Product Viewed',             triggerDescription: 'User views a product detail page', suggestedProperties: ['product_id','product_name','category','subcategory','price','brand','in_stock','rating','source'] },
  { category: 'Retention',   priority: 'must-have',    eventName: 'Category Browsed',           triggerDescription: 'User visits a category or collection listing page', suggestedProperties: ['category_name','subcategory','products_shown','page_number','sort_applied'] },
  { category: 'Retention',   priority: 'must-have',    eventName: 'Feature Used',               triggerDescription: 'User engages with a core product feature', suggestedProperties: ['feature_name','feature_category','plan','usage_count_today','session_number'] },
  { category: 'Retention',   priority: 'must-have',    eventName: 'Session Started',            triggerDescription: 'User begins a new app or web session', suggestedProperties: ['days_since_last_session','device_type','plan','feature_last_used'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Filter Applied',             triggerDescription: 'User applies a filter on a listing or search results page', suggestedProperties: ['filter_type','filter_value','category','results_count','active_filters_count'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Sort Applied',               triggerDescription: 'User changes sort order on a listing page', suggestedProperties: ['sort_type','previous_sort','category','products_count'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Search No Results',          triggerDescription: 'A user search returns zero results', suggestedProperties: ['search_query','category','suggestions_shown','did_refine'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Content Viewed',             triggerDescription: 'User opens an article, video, or piece of content', suggestedProperties: ['content_id','content_title','content_type','category','author','subscription_required'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Video Played',               triggerDescription: 'User starts video playback', suggestedProperties: ['video_id','video_title','category','duration_secs','autoplay','quality'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Dashboard Viewed',           triggerDescription: 'User opens their main dashboard or home screen', suggestedProperties: ['widgets_count','last_login_days_ago','plan','personalised'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Report Generated',           triggerDescription: 'User creates, views, or exports a report', suggestedProperties: ['report_type','date_range','export_format','record_count'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Notification Clicked',       triggerDescription: 'User taps a push or in-app notification', suggestedProperties: ['notification_type','content_id','campaign_id','cta_text'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Review Submitted',           triggerDescription: 'User submits a product or service rating and review', suggestedProperties: ['product_id','rating','review_length','has_photo','verified_buyer','order_id'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Order Tracked',              triggerDescription: 'User checks the live status of their order or delivery', suggestedProperties: ['order_id','order_status','estimated_delivery','items_count','days_since_order'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Feedback Submitted',         triggerDescription: 'User submits NPS score or product feedback', suggestedProperties: ['nps_score','feedback_type','feature_context','plan','verbatim_length'] },
  { category: 'Retention',   priority: 'recommended',  eventName: 'Live Chat Started',          triggerDescription: 'User initiates a live chat or support session', suggestedProperties: ['page_url','product_id','issue_type','wait_time_secs'] },
  { category: 'Retention',   priority: 'nice-to-have', eventName: 'Recommendation Clicked',     triggerDescription: 'User clicks a recommended or similar item', suggestedProperties: ['product_id','recommendation_type','source_product_id','position'] },
  { category: 'Retention',   priority: 'nice-to-have', eventName: 'Recently Viewed Clicked',    triggerDescription: 'User clicks a product from their recently-viewed list', suggestedProperties: ['product_id','product_name','position_in_list','source_page'] },
  { category: 'Retention',   priority: 'nice-to-have', eventName: 'Reorder Clicked',            triggerDescription: 'User reorders from a previous order', suggestedProperties: ['order_id','product_count','total_value','days_since_original_order'] },
  { category: 'Retention',   priority: 'nice-to-have', eventName: 'FAQ Viewed',                 triggerDescription: 'User reads a FAQ or help article', suggestedProperties: ['article_title','category','source_page','helpful_clicked'] },
  { category: 'Retention',   priority: 'nice-to-have', eventName: 'Return Initiated',           triggerDescription: 'User starts a return or refund request', suggestedProperties: ['order_id','product_id','return_reason','refund_method','refund_amount'] },
  //{ category: 'Retention',   priority: 'nice-to-have', eventName: 'Wishlist Updated',           triggerDescription: 'User adds or removes an item from their wishlist', suggestedProperties: ['product_id','product_name','action','wishlist_size','price'] },
  { category: 'Retention',   priority: 'nice-to-have', eventName: 'Integration Connected',      triggerDescription: 'User connects a third-party tool or integration', suggestedProperties: ['integration_name','integration_category','plan','is_first_integration'] },
  { category: 'Retention',   priority: 'nice-to-have', eventName: 'Export Downloaded',          triggerDescription: 'User downloads a data export or document', suggestedProperties: ['export_type','file_format','records_count','feature_context'] },
  { category: 'Retention',   priority: 'nice-to-have', eventName: 'Checkout Abandoned',         triggerDescription: 'User drops off mid-checkout flow', suggestedProperties: ['checkout_step','cart_total','payment_method_selected','time_on_checkout_mins'] },
  { category: 'Retention',   priority: 'nice-to-have', eventName: 'Automation Created',         triggerDescription: 'User creates a workflow or automation rule', suggestedProperties: ['automation_type','trigger_event','action_count','plan'] },
  // REVENUE
  { category: 'Revenue',     priority: 'must-have',    eventName: 'Charged',                    triggerDescription: 'Use CleverTap reserved Charged event for every completed transaction — unlocks built-in revenue analytics and LTV', suggestedProperties: ['Amount','Payment Mode','Charged ID','Items','coupon_used','is_first_purchase','delivery_type'] },
  { category: 'Revenue',     priority: 'must-have',    eventName: 'Checkout Started',           triggerDescription: 'User proceeds from cart to the checkout flow', suggestedProperties: ['cart_total','items_count','has_coupon','is_guest_checkout','payment_options_shown'] },
  { category: 'Revenue',     priority: 'must-have',    eventName: 'Payment Method Selected',    triggerDescription: 'User selects a payment method at checkout', suggestedProperties: ['payment_method','order_total','is_saved_method','emi_selected'] },
  { category: 'Revenue',     priority: 'must-have',    eventName: 'Trial Started',              triggerDescription: 'User begins a free trial period', suggestedProperties: ['plan_name','trial_days','source','company_size','credit_card_required'] },
  { category: 'Revenue',     priority: 'must-have',    eventName: 'Trial Converted',            triggerDescription: 'Trial user upgrades to a paid subscription', suggestedProperties: ['plan_selected','trial_duration_used','features_used_count','upgrade_source'] },
  { category: 'Revenue',     priority: 'recommended',  eventName: 'Coupon Applied',             triggerDescription: 'User applies a promo or coupon code at checkout', suggestedProperties: ['coupon_code','discount_amount','discount_pct','cart_total','coupon_source'] },
  { category: 'Revenue',     priority: 'recommended',  eventName: 'Payment Failed',             triggerDescription: 'A payment transaction fails', suggestedProperties: ['failure_reason','payment_method','order_total','retry_count','error_code'] },
  { category: 'Revenue',     priority: 'recommended',  eventName: 'Subscription Started',       triggerDescription: 'User subscribes to a paid plan or membership', suggestedProperties: ['plan_name','plan_price','billing_cycle','trial_used','benefits_shown'] },
  { category: 'Revenue',     priority: 'recommended',  eventName: 'Plan Upgraded',              triggerDescription: 'User upgrades from a lower to a higher-tier plan', suggestedProperties: ['from_plan','to_plan','trigger_source','upgrade_reason','mrr_change'] },
  { category: 'Revenue',     priority: 'recommended',  eventName: 'Subscription Cancelled',     triggerDescription: 'User cancels their subscription', suggestedProperties: ['plan_name','cancellation_reason','tenure_months','mrr_lost','offered_pause'] },
  { category: 'Revenue',     priority: 'recommended',  eventName: 'Delivery Option Selected',   triggerDescription: 'User picks a shipping or delivery method at checkout', suggestedProperties: ['delivery_type','delivery_charge','estimated_days','cart_total'] },
  { category: 'Revenue',     priority: 'recommended',  eventName: 'Notify Me Clicked',          triggerDescription: 'User requests a back-in-stock or price-drop alert', suggestedProperties: ['product_id','product_name','category','current_stock_status'] },
  { category: 'Revenue',     priority: 'nice-to-have', eventName: 'Add-on Purchased',           triggerDescription: 'User buys an additional add-on, upsell, or extra feature', suggestedProperties: ['addon_name','addon_price','quantity','current_plan'] },
  { category: 'Revenue',     priority: 'nice-to-have', eventName: 'Gift Card Purchased',        triggerDescription: 'User buys a gift card or voucher', suggestedProperties: ['amount','recipient_type','occasion','payment_method'] },
  { category: 'Revenue',     priority: 'nice-to-have', eventName: 'Booking Initiated',          triggerDescription: 'User starts a booking or reservation flow', suggestedProperties: ['listing_id','listing_name','price','travel_dates','listing_type'] },
  // REFERRAL
  { category: 'Referral',    priority: 'must-have',    eventName: 'Referral Link Shared',       triggerDescription: 'User shares their referral or invite link with others', suggestedProperties: ['share_channel','referral_code','plan','incentive_type','source_page'] },
  { category: 'Referral',    priority: 'recommended',  eventName: 'Product Shared',             triggerDescription: 'User shares a product or listing link on social or messaging', suggestedProperties: ['product_id','product_name','share_channel','price','category'] },
  { category: 'Referral',    priority: 'recommended',  eventName: 'Content Shared',             triggerDescription: 'User shares an article, video, or piece of content externally', suggestedProperties: ['content_id','content_title','share_channel','content_type','author'] },
  { category: 'Referral',    priority: 'recommended',  eventName: 'Loyalty Points Redeemed',    triggerDescription: 'User redeems loyalty or reward points at checkout', suggestedProperties: ['points_redeemed','cash_value','remaining_points','order_total'] },
  { category: 'Referral',    priority: 'nice-to-have', eventName: 'Loyalty Points Viewed',      triggerDescription: 'User checks their loyalty or reward points balance', suggestedProperties: ['points_balance','tier','points_expiring_soon','next_tier_points'] },
  { category: 'Referral',    priority: 'nice-to-have', eventName: 'App Rating Prompted',        triggerDescription: 'App store rating dialog is shown to the user', suggestedProperties: ['trigger_event','days_since_install','orders_count'] },
];

// ─── Build the AI prompt ──────────────────────────────────────────────────────
function buildPrompt(originalUrl, merged) {
  // Compact the full library — one line per event to maximise token efficiency
  const examplesCompact = EVENT_LIBRARY_EXAMPLES.map(e =>
    `{"cat":"${e.category}","pri":"${e.priority}","name":"${e.eventName}","trigger":"${e.triggerDescription}","props":${JSON.stringify(e.suggestedProperties)}}`
  ).join(',\n');

  const siteContext = [
    `URL: ${originalUrl}`,
    `Site name: ${merged.siteName || merged.homeTitle}`,
    `Meta description: ${merged.homeMetaDesc.slice(0, 300)}`,
    `Pages crawled: ${merged.pageTypes.join(', ')}`,
    `H1 headings: ${merged.allH1s.slice(0, 12).join(' | ')}`,
    `H2 headings: ${merged.allH2s.slice(0, 15).join(' | ')}`,
    `Navigation items: ${merged.allNavLinks.slice(0, 30).join(', ')}`,
    `CTA buttons: ${merged.allCtaTexts.slice(0, 25).join(', ')}`,
    `Forms (field names): ${merged.allForms.map(f => `[${f.fields.join(',')}]`).join('; ')}`,
    ``,
    `--- PAGE CONTENT SAMPLES ---`,
    ...merged.bodyTextByPage.map(t => t.slice(0, 600)),
  ].join('\n');

  return `You are a world-class CleverTap analytics architect. Analyse this real website and generate a comprehensive, deeply customised event tracking plan.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEBSITE DATA (crawled live)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${siteContext}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EVENT DESIGN REFERENCE (${EVENT_LIBRARY_EXAMPLES.length} examples — learn the patterns)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Study these examples carefully. Learn from them:
• Schema: category, priority, eventName, triggerDescription, suggestedProperties
• Naming: Title Case, verb+noun — "Product Viewed", "Filter Applied", "Checkout Started"
• Categories (exactly 5): Acquisition | Activation | Retention | Revenue | Referral
• Priority: must-have = business-critical | recommended = high value | nice-to-have = extra insight
• triggerDescription: ONE precise sentence telling a developer exactly when to fire it
• suggestedProperties: 4-8 snake_case keys a PM would use to segment and funnel-analyse

REFERENCE LIBRARY:
[${examplesCompact}]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK: GENERATE EXACTLY 45-50 CUSTOM EVENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generate a complete, deeply customised event plan for THIS specific website.
Do NOT copy from the reference — generate fresh events based on what this site actually does.

HARD REQUIREMENTS:

① COUNT: You MUST generate between 45 and 50 events. Fewer than 45 = failure.

② CATEGORY MINIMUMS:
   Acquisition → at least 6 events
   Activation  → at least 8 events
   Retention   → at least 16 events
   Revenue     → at least 10 events
   Referral    → at least 5 events

③ PRIORITY DISTRIBUTION:
   must-have    → 8 to 12 events
   recommended  → 18 to 24 events
   nice-to-have → 14 to 20 events

④ SITE-SPECIFIC LANGUAGE: Read the nav, H1s, CTAs, body text above carefully.
   Use THIS site's actual words. If nav says "Jewellery" use "Jewellery Viewed" not "Product Viewed".
   If body text mentions "Try at Home", create "Try At Home Requested".
   If there is a calculator, create "Calculator Used". Every unique feature = unique event.

⑤ UNIQUE EVENTS: At least 6 events must be for features unique to this site
   (things found in the crawled content, not in the reference library).

⑥ CHARGED EVENT (if site has any payment/purchase flow):
   Include exactly one event named "Charged", category "Revenue", priority "must-have".

⑦ FULL FUNNEL: Cover the entire lifecycle:
   first visit → discovery → registration → first action → repeat use → purchase → post-purchase → loyalty → referral

⑧ PROPERTIES: Every event needs 4-8 snake_case properties. Think like a data analyst.

⑨ REASON: Each event needs a "reason" field (1 sentence) — why this event matters for THIS business.

⑩ STRICT EXCLUSIONS:
   Do NOT generate any events related to:
   • Add to Cart (e.g. "Add to Cart", "Cart Updated", "Item Added to Cart")
   • Wishlist (e.g. "Wishlist Added", "Wishlist Updated", "Saved for Later")

   These events must NOT appear in the output under any variation or naming.

Respond with ONLY a raw JSON object. No markdown, no backticks, no preamble, no trailing text.

{
  "businessVertical": "specific vertical e.g. Fine Jewellery E-commerce",
  "businessDescription": "2-3 sentences about this site and its users",
  "websiteType": "specific type e.g. D2C Jewellery Brand with Try-at-Home",
  "analyticsInsight": "2-3 sentences of strategic CleverTap insight for this business",
  "recommendedEvents": [
    {
      "eventName": "...",
      "priority": "must-have",
      "category": "Acquisition",
      "reason": "Why this event matters for this specific business",
      "triggerDescription": "Exactly when a developer fires this event",
      "suggestedProperties": ["prop_one","prop_two","prop_three","prop_four","prop_five"]
    },
    ... 45 to 50 total objects in this array ...
  ]
}

Output ONLY valid JSON. Start with { end with }. No other text.`;
}

// ─── Generic HTTPS POST ───────────────────────────────────────────────────────
function httpsPost({ hostname, path, headers, body, timeout = 90000 }) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('Request timed out')); });
    req.write(body);
    req.end();
  });
}

// ─── AI provider router ───────────────────────────────────────────────────────
async function callAI(prompt) {
  if (process.env.GROQ_API_KEY) {
    console.log('[AI] Using Groq (llama-3.3-70b)');
    const raw = await httpsPost({
      hostname: 'api.groq.com',
      path:     '/openai/v1/chat/completions',
      headers:  { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model:       'llama-3.3-70b-versatile',
        max_tokens:  20000,   // 45-50 events needs ~10k-14k output tokens //change the token count to increase the number of events that can be generated 
        temperature: 0.4,
        messages:    [{ role: 'user', content: prompt }],
      }),
    });
    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error(`Groq error: ${parsed.error.message}`);
    return parsed.choices?.[0]?.message?.content || '';
  }

  if (process.env.GEMINI_API_KEY) {
    console.log('[AI] Using Gemini 2.0 Flash');
    const raw = await httpsPost({
      hostname: 'generativelanguage.googleapis.com',
      path:     `/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      headers:  { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents:         [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 16000, temperature: 0.4 },
      }),
    });
    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error(`Gemini error: ${parsed.error.message}`);
    return parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  if (process.env.ANTHROPIC_API_KEY) {
    console.log('[AI] Using Anthropic Claude');
    const raw = await httpsPost({
      hostname: 'api.anthropic.com',
      path:     '/v1/messages',
      headers:  {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 16000,   // raised from 8000
        messages:   [{ role: 'user', content: prompt }],
      }),
    });
    const parsed = JSON.parse(raw);
    if (parsed.error) throw new Error(`Anthropic error: ${parsed.error.message}`);
    return parsed.content?.[0]?.text || '';
  }

  throw new Error('No AI API key found. Set GROQ_API_KEY, GEMINI_API_KEY, or ANTHROPIC_API_KEY in your .env file.');
}

// ─── Parse and validate AI response ──────────────────────────────────────────
function parseAIResponse(rawReply, homeTitle) {
  try {
    const cleaned = rawReply
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON object found in AI response');

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed.recommendedEvents)) {
      throw new Error('recommendedEvents is not an array');
    }

    parsed.recommendedEvents = parsed.recommendedEvents.map(e => ({
      eventName:           e.eventName           || 'Unknown Event',
      priority:            ['must-have','recommended','nice-to-have'].includes(e.priority) ? e.priority : 'recommended',
      category:            ['Acquisition','Activation','Retention','Revenue','Referral'].includes(e.category) ? e.category : 'Retention',
      reason:              e.reason              || `Tracks ${(e.eventName || '').toLowerCase()} for analytics.`,
      triggerDescription:  e.triggerDescription  || 'Fire when this action occurs.',
      suggestedProperties: Array.isArray(e.suggestedProperties) ? e.suggestedProperties : ['Date'],
    }));

    console.log(`[Scanner] Parsed ${parsed.recommendedEvents.length} events`);
    return parsed;

  } catch (err) {
    console.warn('[Scanner] AI response parse failed:', err.message);
    console.warn('[Scanner] Raw reply (first 600 chars):', rawReply.slice(0, 600));

    return {
      businessVertical:    'E-commerce',
      businessDescription: `${homeTitle} — an online platform.`,
      websiteType:         'Website',
      analyticsInsight:    'Track user behaviour across the full funnel to optimise conversions.',
      recommendedEvents: [
        { eventName: 'Page Viewed',     priority: 'must-have', category: 'Acquisition', reason: 'Baseline page tracking.',           triggerDescription: 'Every page load.',                       suggestedProperties: ['page_url','page_title','referrer','utm_source'] },
        { eventName: 'Account Created', priority: 'must-have', category: 'Activation',  reason: 'Tracks new registrations.',         triggerDescription: 'User completes registration.',           suggestedProperties: ['signup_method','referral_source','device_type'] },
        { eventName: 'Charged',         priority: 'must-have', category: 'Revenue',     reason: 'Tracks all completed transactions.', triggerDescription: 'Fire on successful payment completion.', suggestedProperties: ['Amount','Payment Mode','Charged ID'] },
      ],
    };
  }
}

// ─── Main exported scan function ─────────────────────────────────────────────
async function scanWebsite(originalUrl) {
  let browser;
  const allPageData = [];

  try {
    browser = await puppeteer.launch(getLaunchOptions());
    const baseHostname = new URL(originalUrl).hostname;

    console.log(`[Scanner] Step 1/3 — Loading homepage: ${originalUrl}`);
    const homePage = await browser.newPage();
    await applyStealth(homePage);
    const homeLoaded = await gotoSafe(homePage, originalUrl);
    if (!homeLoaded) throw new Error('Could not load homepage');

    const homeSignals = await extractSignals(homePage, 'homepage');
    allPageData.push(homeSignals);
    console.log(`[Scanner] Homepage loaded: "${homeSignals.pageTitle}"`);

    console.log(`[Scanner] Step 2/3 — Discovering internal links...`);
    const allLinks     = await discoverLinks(homePage, baseHostname);
    const uniqueLinks  = [...new Set(allLinks)];
    const pagesToCrawl = selectPages(uniqueLinks);
    console.log(`[Scanner] Will crawl: ${pagesToCrawl.map(p => p.type).join(', ')}`);
    await homePage.close();

    console.log(`[Scanner] Step 3/3 — Crawling ${pagesToCrawl.length} pages in parallel...`);
    const BATCH_SIZE = 3;
    for (let i = 0; i < pagesToCrawl.length; i += BATCH_SIZE) {
      const batch = pagesToCrawl.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async ({ url, type }) => {
        const page = await browser.newPage();
        try {
          await applyStealth(page);
          const ok = await gotoSafe(page, url);
          if (ok) {
            const signals = await extractSignals(page, type);
            allPageData.push(signals);
            console.log(`[Scanner]  ✓ [${type}] ${signals.pageTitle}`);
          }
        } catch (err) {
          console.warn(`[Scanner]  ✗ [${type}]: ${err.message}`);
        } finally {
          await page.close().catch(() => {});
        }
      }));
    }

    const merged = mergeSignals(allPageData);
    console.log(`[Scanner] Merged signals from ${allPageData.length} pages`);

    console.log(`[Scanner] Sending to AI — requesting 45-50 custom events...`);
    const prompt   = buildPrompt(originalUrl, merged);
    const rawReply = await callAI(prompt);

    const aiResult = parseAIResponse(rawReply, homeSignals.pageTitle);
    console.log(`[Scanner] ✓ ${aiResult.recommendedEvents.length} events generated for "${aiResult.businessVertical}"`);

    const recommendedEvents = aiResult.recommendedEvents;

    return {
      url:                 homeSignals.url,
      pageTitle:           homeSignals.pageTitle,
      pagesScanned:        allPageData.length,
      pageTypes:           merged.pageTypes,
      businessVertical:    aiResult.businessVertical,
      businessDescription: aiResult.businessDescription,
      websiteType:         aiResult.websiteType,
      recommendedEvents,
      analyticsInsight:    aiResult.analyticsInsight,
      scanSummary: {
        totalEventsRecommended: recommendedEvents.length,
        mustHave:    recommendedEvents.filter(e => e.priority === 'must-have').length,
        recommended: recommendedEvents.filter(e => e.priority === 'recommended').length,
        niceToHave:  recommendedEvents.filter(e => e.priority === 'nice-to-have').length,
        pagesScanned: allPageData.length,
      },
    };

  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { scanWebsite };

