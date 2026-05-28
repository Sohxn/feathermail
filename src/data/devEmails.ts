import { Email, EmailAccount } from "@/types/email";

export const DEV_EMAIL_PAGE_SIZE = 4;
export const DEV_EMAIL_ROTATION_INTERVAL_MS = 15000;

export const devEmailAccounts: EmailAccount[] = [
  {
    id: "dev-account-1",
    user_id: "sohxn_001",
    email_address: "sohxn@devtest.com",
    display_name: "Sohxn",
    provider: "gmail",
    is_primary: true,
    is_connected: true,
    last_sync: "2026-01-10T09:40:00.000Z",
    created_at: "2026-01-01T08:00:00.000Z",
  },
  {
    id: "dev-account-2",
    user_id: "sohxn_001",
    email_address: "ops@devtest.com",
    display_name: "Ops Inbox",
    provider: "imap",
    is_primary: false,
    is_connected: true,
    last_sync: "2026-01-10T09:40:00.000Z",
    created_at: "2026-01-02T08:00:00.000Z",
  },
];

const devEmails: Email[] = [
  {
    id: "dev-email-001",
    user_id: "sohxn_001",
    account_id: "dev-account-1",
    gmail_id: "dev-gmail-001",
    thread_id: "thread-product-demo-01",
    subject: "Re: Product demo next steps",
    from_email: "alex@startup.io",
    from_name: "Alex Chen",
    to_email: ["sohxn@devtest.com"],
    body_text: "Thanks for the walkthrough today. We liked the inbox workflow and want to review the pricing + onboarding plan with our team.",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <p>Thanks for the walkthrough today.</p>
          <p>We liked the inbox workflow and want to review the pricing and onboarding plan with our team.</p>
          <p>Best,<br />Alex</p>
        </body>
      </html>
    `,
    snippet: "Thanks for the walkthrough today. We liked the inbox workflow and want to review the pricing...",
    received_at: "2026-01-13T10:10:00.000Z",
    labels: ["INBOX"],
    is_read: false,
    is_starred: true,
    is_archived: false,
    is_trashed: false,
    created_at: "2026-01-13T10:10:10.000Z",
    cc_email: ["design@startup.io"],
    bcc_email: [],
    reply_to: "alex@startup.io",
    sent_at: null,
  },
  {
    id: "dev-email-002",
    user_id: "sohxn_001",
    account_id: "dev-account-1",
    gmail_id: "dev-gmail-002",
    thread_id: "thread-product-demo-01",
    subject: "Re: Product demo next steps",
    from_email: "sohxn@devtest.com",
    from_name: "Sohxn",
    to_email: ["alex@startup.io"],
    body_text: "Great to hear. I will send a short proposal with scope, pilot timeline, and next actions by tomorrow.",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <p>Great to hear.</p>
          <p>I will send a short proposal with scope, pilot timeline, and next actions by tomorrow.</p>
          <p>Best regards,<br />Sohxn</p>
        </body>
      </html>
    `,
    snippet: "Great to hear. I will send a short proposal with scope, pilot timeline, and next actions...",
    received_at: "2026-01-13T09:42:00.000Z",
    labels: ["SENT"],
    is_read: true,
    is_starred: false,
    is_archived: false,
    is_trashed: false,
    created_at: "2026-01-13T09:42:10.000Z",
    cc_email: [],
    bcc_email: [],
    reply_to: "sohxn@devtest.com",
    sent_at: "2026-01-13T09:42:00.000Z",
  },
  {
    id: "dev-email-003",
    user_id: "sohxn_001",
    account_id: "dev-account-1",
    gmail_id: "dev-gmail-003",
    thread_id: "thread-contract-02",
    subject: "RE: Contract review comments",
    from_email: "sarah.miller@enterprise.com",
    from_name: "Sarah Miller",
    to_email: ["sohxn@devtest.com"],
    body_text: "We reviewed the draft with legal. Section 4.2 needs one wording change and we need the security appendix attached.",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <p>We reviewed the draft with legal.</p>
          <ul>
            <li>Section 4.2 needs one wording change</li>
            <li>We need the security appendix attached</li>
            <li>Please confirm the pilot start date</li>
          </ul>
          <p>Thanks,<br />Sarah</p>
        </body>
      </html>
    `,
    snippet: "We reviewed the draft with legal. Section 4.2 needs one wording change and we need the security appendix...",
    received_at: "2026-01-13T08:15:00.000Z",
    labels: ["INBOX"],
    is_read: false,
    is_starred: true,
    is_archived: false,
    is_trashed: false,
    created_at: "2026-01-13T08:15:08.000Z",
    cc_email: ["legal@enterprise.com"],
    bcc_email: [],
    reply_to: "sarah.miller@enterprise.com",
    sent_at: null,
  },
  {
    id: "dev-email-004",
    user_id: "sohxn_001",
    account_id: "dev-account-2",
    gmail_id: "dev-gmail-004",
    thread_id: "thread-invoice-01",
    subject: "Your January invoice is ready",
    from_email: "billing@stripe.com",
    from_name: "Stripe Billing",
    to_email: ["ops@devtest.com"],
    body_text: "Invoice #INV-2026-0110 for $2,847.00 is ready. The billing period is Jan 1 - Jan 31 and payment is due in 14 days.",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <h2 style="margin: 0 0 12px;">Your January invoice is ready</h2>
          <table cellpadding="8" cellspacing="0" border="1" style="border-collapse: collapse; width: 100%; max-width: 540px;">
            <tr><td>Invoice</td><td>INV-2026-0110</td></tr>
            <tr><td>Amount</td><td>$2,847.00</td></tr>
            <tr><td>Due date</td><td>2026-01-27</td></tr>
          </table>
        </body>
      </html>
    `,
    snippet: "Invoice #INV-2026-0110 for $2,847.00 is ready. The billing period is Jan 1 - Jan 31...",
    received_at: "2026-01-12T19:30:00.000Z",
    labels: ["INBOX"],
    is_read: true,
    is_starred: false,
    is_archived: false,
    is_trashed: false,
    created_at: "2026-01-12T19:30:05.000Z",
    cc_email: [],
    bcc_email: [],
    reply_to: "billing@stripe.com",
    sent_at: null,
  },
  {
    id: "dev-email-005",
    user_id: "sohxn_001",
    account_id: "dev-account-1",
    gmail_id: "dev-gmail-005",
    thread_id: "thread-newsletter-01",
    subject: "Issue #203: The State of AI in 2026",
    from_email: "gergely@pragmaticengineer.com",
    from_name: "The Pragmatic Engineer",
    to_email: ["sohxn@devtest.com"],
    body_text: "This week we look at how teams are using smaller models, evaluation loops, and inbox automation to reduce noise and ship faster.",
    body_html: `
      <html>
        <body style="font-family: Georgia, serif; color: #111827;">
          <h1>The State of AI in 2026</h1>
          <p>This week we look at how teams are using smaller models, evaluation loops, and inbox automation to reduce noise and ship faster.</p>
          <p>Read more in the full issue.</p>
        </body>
      </html>
    `,
    snippet: "This week we look at how teams are using smaller models, evaluation loops, and inbox automation...",
    received_at: "2026-01-12T08:00:00.000Z",
    labels: ["INBOX"],
    is_read: true,
    is_starred: false,
    is_archived: false,
    is_trashed: false,
    created_at: "2026-01-12T08:00:04.000Z",
    cc_email: [],
    bcc_email: [],
    reply_to: "newsletter@pragmaticengineer.com",
    sent_at: null,
  },
  {
    id: "dev-email-006",
    user_id: "sohxn_001",
    account_id: "dev-account-1",
    gmail_id: "dev-gmail-006",
    thread_id: "thread-personal-01",
    subject: "Sunday dinner?",
    from_email: "mom@family.com",
    from_name: "Mom",
    to_email: ["sohxn@devtest.com"],
    body_text: "Are you free this Sunday? Dad wants to try the new Italian place downtown and we'd like you to come along.",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <p>Are you free this Sunday?</p>
          <p>Dad wants to try the new Italian place downtown and we'd like you to come along.</p>
          <p>Love,<br />Mom</p>
        </body>
      </html>
    `,
    snippet: "Are you free this Sunday? Dad wants to try the new Italian place downtown and we'd like you...",
    received_at: "2026-01-11T16:20:00.000Z",
    labels: ["INBOX"],
    is_read: false,
    is_starred: false,
    is_archived: false,
    is_trashed: false,
    created_at: "2026-01-11T16:20:02.000Z",
    cc_email: [],
    bcc_email: [],
    reply_to: "mom@family.com",
    sent_at: null,
  },
  {
    id: "dev-email-007",
    user_id: "sohxn_001",
    account_id: "dev-account-2",
    gmail_id: "dev-gmail-007",
    thread_id: "thread-travel-01",
    subject: "Trip confirmation for Lisbon",
    from_email: "travel@airline.com",
    from_name: "SkyJet Travel",
    to_email: ["ops@devtest.com"],
    body_text: "Your Lisbon trip is confirmed. Check-in opens 24 hours before departure and the itinerary is attached below.",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <p>Your Lisbon trip is confirmed.</p>
          <p>Check-in opens 24 hours before departure and the itinerary is attached below.</p>
        </body>
      </html>
    `,
    snippet: "Your Lisbon trip is confirmed. Check-in opens 24 hours before departure and the itinerary is attached...",
    received_at: "2026-01-11T10:00:00.000Z",
    labels: ["INBOX"],
    is_read: true,
    is_starred: false,
    is_archived: true,
    is_trashed: false,
    created_at: "2026-01-11T10:00:03.000Z",
    cc_email: [],
    bcc_email: [],
    reply_to: "travel@airline.com",
    sent_at: null,
  },
  {
    id: "dev-email-008",
    user_id: "sohxn_001",
    account_id: "dev-account-1",
    gmail_id: "dev-gmail-008",
    thread_id: "thread-security-01",
    subject: "New sign-in to your account",
    from_email: "security@github.com",
    from_name: "GitHub Security",
    to_email: ["sohxn@devtest.com"],
    body_text: "We noticed a sign-in from a new device in Amsterdam. If this was you, no action is needed.",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <p>We noticed a sign-in from a new device in Amsterdam.</p>
          <p>If this was you, no action is needed.</p>
        </body>
      </html>
    `,
    snippet: "We noticed a sign-in from a new device in Amsterdam. If this was you, no action is needed.",
    received_at: "2026-01-10T22:00:00.000Z",
    labels: ["INBOX"],
    is_read: true,
    is_starred: false,
    is_archived: false,
    is_trashed: false,
    created_at: "2026-01-10T22:00:01.000Z",
    cc_email: [],
    bcc_email: [],
    reply_to: "security@github.com",
    sent_at: null,
  },
  {
    id: "dev-email-009",
    user_id: "sohxn_001",
    account_id: "dev-account-1",
    gmail_id: "dev-gmail-009",
    thread_id: "thread-product-demo-01",
    subject: "Re: Product demo next steps",
    from_email: "alex@startup.io",
    from_name: "Alex Chen",
    to_email: ["sohxn@devtest.com"],
    body_text: "One more thing - can you include the AI summary workflow in the proposal? Our leadership team wants to see the full review flow.",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <p>One more thing: can you include the AI summary workflow in the proposal?</p>
          <p>Our leadership team wants to see the full review flow.</p>
        </body>
      </html>
    `,
    snippet: "One more thing - can you include the AI summary workflow in the proposal? Our leadership team...",
    received_at: "2026-01-10T18:35:00.000Z",
    labels: ["INBOX"],
    is_read: false,
    is_starred: false,
    is_archived: false,
    is_trashed: false,
    created_at: "2026-01-10T18:35:02.000Z",
    cc_email: ["design@startup.io"],
    bcc_email: [],
    reply_to: "alex@startup.io",
    sent_at: null,
  },
  {
    id: "dev-email-010",
    user_id: "sohxn_001",
    account_id: "dev-account-2",
    gmail_id: "dev-gmail-010",
    thread_id: "thread-promotions-01",
    subject: "25% off your next deployment",
    from_email: "promo@cloudprovider.com",
    from_name: "CloudProvider",
    to_email: ["ops@devtest.com"],
    body_text: "Upgrade your plan today and get 25% off for the first three months. Click through to learn more.",
    body_html: `
      <html>
        <body style="font-family: Arial, sans-serif; color: #1f2937;">
          <p>Upgrade your plan today and get 25% off for the first three months.</p>
          <p>Click through to learn more.</p>
        </body>
      </html>
    `,
    snippet: "Upgrade your plan today and get 25% off for the first three months. Click through to learn more.",
    received_at: "2026-01-10T12:00:00.000Z",
    labels: ["INBOX"],
    is_read: true,
    is_starred: false,
    is_archived: false,
    is_trashed: true,
    created_at: "2026-01-10T12:00:02.000Z",
    cc_email: [],
    bcc_email: [],
    reply_to: "promo@cloudprovider.com",
    sent_at: null,
  },
];

const orderedDevEmails = [...devEmails].sort(
  (left, right) => new Date(right.received_at).getTime() - new Date(left.received_at).getTime(),
);

let devRotationCounter = 0;

function buildRotatingDevEmail(previousEmail: Email): Email {
  devRotationCounter += 1;
  const now = new Date();
  const tick = String(devRotationCounter).padStart(3, "0");
  const variant = devRotationCounter % 5;

  const subjects = [
    "Re: Updated design notes",
    "New invoice draft arrived",
    "Follow-up on the dev inbox flow",
    "Shipping checklist for the next build",
    "Testing a simulated incoming message",
  ];

  const senders = [
    { from_email: "alex@startup.io", from_name: "Alex Chen" },
    { from_email: "billing@stripe.com", from_name: "Stripe Billing" },
    { from_email: "sarah.miller@enterprise.com", from_name: "Sarah Miller" },
    { from_email: "mom@family.com", from_name: "Mom" },
    { from_email: "security@github.com", from_name: "GitHub Security" },
  ];

  const bodies = [
    "This is a simulated incoming email for local development. The message rotates every 15 seconds so the inbox feels alive.",
    "The dev inbox has been refreshed with another fake message so you can test unread counts and selection changes.",
    "Dummy mode is active. This mail replaces the oldest visible one to mimic a constantly updating inbox.",
    "A new local-only email just arrived. Use it to test summaries, lists, and quick navigation.",
    "Fresh simulated mail is flowing into the inbox so the UI can be tested without authentication.",
  ];

  const sender = senders[variant];

  return {
    id: `dev-live-${tick}`,
    user_id: previousEmail.user_id,
    account_id: previousEmail.account_id,
    gmail_id: `dev-live-gmail-${tick}`,
    thread_id: `thread-live-${tick}`,
    subject: subjects[variant],
    from_email: sender.from_email,
    from_name: sender.from_name,
    to_email: previousEmail.to_email,
    body_text: bodies[devRotationCounter % bodies.length],
    body_html: null,
    snippet: "Simulated local dev mail for testing the rotating inbox.",
    received_at: now.toISOString(),
    labels: ["INBOX"],
    is_read: false,
    is_starred: false,
    is_archived: false,
    is_trashed: false,
    created_at: now.toISOString(),
    cc_email: [],
    bcc_email: [],
    reply_to: sender.from_email,
    sent_at: null,
  };
}

export function rotateDevEmails(currentEmails: Email[]): Email[] {
  if (currentEmails.length === 0) {
    return [];
  }

  const freshEmail = buildRotatingDevEmail(currentEmails[0]);
  return [freshEmail, ...currentEmails.slice(0, currentEmails.length - 1)];
}

export function getDevEmailsPage(cursor: string | null, limit = DEV_EMAIL_PAGE_SIZE): Email[] {
  const startIndex = cursor
    ? orderedDevEmails.findIndex((email) => new Date(email.received_at).getTime() < new Date(cursor).getTime())
    : 0;

  if (startIndex === -1) {
    return [];
  }

  return orderedDevEmails.slice(startIndex, startIndex + limit);
}

export function hasMoreDevEmails(cursor: string | null, limit = DEV_EMAIL_PAGE_SIZE): boolean {
  const page = getDevEmailsPage(cursor, limit);
  if (page.length === 0) {
    return false;
  }

  const lastEmail = page[page.length - 1];
  const nextIndex = orderedDevEmails.findIndex(
    (email) => new Date(email.received_at).getTime() < new Date(lastEmail.received_at).getTime(),
  );

  return nextIndex !== -1;
}
