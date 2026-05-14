import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
        
        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-base leading-relaxed mb-4">
              Welcome to Feathermail. By accessing or using our email client application ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you may not use our Service.
            </p>
            <p className="text-base leading-relaxed">
              These Terms constitute a legally binding agreement between you and Feathermail, Inc. ("Feathermail," "we," "us," or "our"). Please read them carefully before using our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-base leading-relaxed mb-4">
              Feathermail is an email client application that allows users to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Connect and manage multiple email accounts in a unified inbox</li>
              <li>Read, compose, send, and organize email messages</li>
              <li>Access email accounts from providers including Gmail, Outlook, and others</li>
              <li>Utilize email management features such as folders, labels, search, and filters</li>
              <li>Sync email data across multiple devices</li>
            </ul>
            <p className="text-base leading-relaxed">
              Feathermail is provided as a tool to help users manage their email more efficiently. The Service integrates with third-party email providers through their respective APIs to access your email data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Accounts and Registration</h2>
            <p className="text-base leading-relaxed mb-4">
              To use Feathermail, you must:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Create an account by providing accurate and complete information</li>
              <li>Be at least 13 years of age (or the minimum age required in your jurisdiction)</li>
              <li>Maintain the security of your account credentials</li>
              <li>Promptly update your account information if it changes</li>
              <li>Accept full responsibility for all activities that occur under your account</li>
            </ul>
            <p className="text-base leading-relaxed">
              You are responsible for maintaining the confidentiality of your account password and for restricting access to your devices. You agree to accept responsibility for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Email Account Connection</h2>
            <p className="text-base leading-relaxed mb-4">
              When you connect an email account to Feathermail:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>You authorize us to access your email data through the email provider's API</li>
              <li>You grant us permission to read, send, and modify emails on your behalf</li>
              <li>You acknowledge that we will store copies of your email data on our servers</li>
              <li>You understand that you can revoke this access at any time through your email provider's settings</li>
            </ul>
            <p className="text-base leading-relaxed">
              You represent and warrant that you have the legal right to connect any email account to our Service and to grant us the permissions described above.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Acceptable Use Policy</h2>
            <p className="text-base leading-relaxed mb-4">
              You agree to use Feathermail only for lawful purposes and in accordance with these Terms. You agree NOT to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Use the Service to send spam, unsolicited emails, or bulk commercial messages</li>
              <li>Use the Service to transmit malware, viruses, or harmful code</li>
              <li>Attempt to gain unauthorized access to our systems or other users' accounts</li>
              <li>Reverse engineer, decompile, or disassemble any portion of the Service</li>
              <li>Use automated systems (bots, scrapers) to access the Service without permission</li>
              <li>Violate any applicable laws, regulations, or third-party rights</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Use the Service for any fraudulent or malicious purpose</li>
            </ul>
            <p className="text-base leading-relaxed">
              We reserve the right to investigate and take appropriate legal action against anyone who violates this Acceptable Use Policy, including removing content and terminating accounts.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Third-Party Services and Content</h2>
            <p className="text-base leading-relaxed mb-4">
              Feathermail integrates with third-party email providers and services:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>We are not responsible for the content, availability, or practices of third-party services</li>
              <li>Your use of third-party services is governed by their respective terms and privacy policies</li>
              <li>We do not endorse or assume any responsibility for third-party services</li>
              <li>Any dealings between you and third parties are solely between you and such third parties</li>
            </ul>
            <p className="text-base leading-relaxed">
              Feathermail is not affiliated with, endorsed by, or sponsored by Google, Microsoft, Yahoo, or any other email provider. All trademarks and brand names are the property of their respective owners.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property Rights</h2>
            <p className="text-base leading-relaxed mb-4">
              The Service and its original content, features, and functionality are owned by Feathermail and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p className="text-base leading-relaxed mb-4">
              You retain all rights to the email content you create, send, or receive through the Service. By using the Service, you grant us a limited license to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Store and process your email data to provide the Service</li>
              <li>Display your emails within the application interface</li>
              <li>Transmit your emails to recipients when you send messages</li>
            </ul>
            <p className="text-base leading-relaxed">
              This license terminates when you delete your account or disconnect your email accounts from the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Privacy and Data Protection</h2>
            <p className="text-base leading-relaxed mb-4">
              Your privacy is important to us. Our Privacy Policy explains how we collect, use, and protect your personal information and email data. By using the Service, you agree to our Privacy Policy.
            </p>
            <p className="text-base leading-relaxed">
              Please review our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a> to understand our practices regarding your data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Subscription Plans and Payments</h2>
            <p className="text-base leading-relaxed mb-4">
              Feathermail offers only paid subscription plans:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              {/* <li><strong>Free Plan:</strong> Limited features with restrictions on number of accounts and storage</li> */}
              <li><strong>Pro Plan:</strong> Enhanced features with unlimited accounts and increased storage</li>
              <li><strong>Team Plan:</strong> Business features with team collaboration and priority support</li>
            </ul>
            <p className="text-base leading-relaxed mb-4">
              If you choose a paid subscription:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>You agree to pay all fees associated with your selected plan</li>
              <li>Subscriptions automatically renew unless canceled before the renewal date</li>
              <li>We reserve the right to change pricing with 30 days' notice</li>
              <li>Refunds are provided at our discretion and in accordance with our refund policy</li>
              <li>Failure to pay may result in suspension or termination of your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Disclaimer of Warranties</h2>
            <p className="text-base leading-relaxed mb-4">
              THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Warranties of merchantability, fitness for a particular purpose, or non-infringement</li>
              <li>Warranties that the Service will be uninterrupted, secure, or error-free</li>
              <li>Warranties regarding the accuracy, reliability, or completeness of any content</li>
            </ul>
            <p className="text-base leading-relaxed">
              We do not warrant that the Service will meet your requirements or that any defects will be corrected. Your use of the Service is at your own risk.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Limitation of Liability</h2>
            <p className="text-base leading-relaxed mb-4">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, Feathermail SHALL NOT BE LIABLE FOR:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Any indirect, incidental, special, consequential, or punitive damages</li>
              <li>Loss of profits, revenue, data, or use</li>
              <li>Damages resulting from unauthorized access to your email accounts</li>
              <li>Interruption or cessation of the Service</li>
              <li>Any damages arising from your use or inability to use the Service</li>
            </ul>
            <p className="text-base leading-relaxed">
              Our total liability to you for any claims arising from these Terms or your use of the Service shall not exceed the amount you paid us in the twelve (12) months preceding the claim, or $100, whichever is greater.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Indemnification</h2>
            <p className="text-base leading-relaxed">
              You agree to indemnify, defend, and hold harmless Feathermail and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising from:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mt-4">
              <li>Your use or misuse of the Service</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights</li>
              <li>Any content you transmit through the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Account Termination</h2>
            <p className="text-base leading-relaxed mb-4">
              We reserve the right to suspend or terminate your account:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>If you violate these Terms or our Acceptable Use Policy</li>
              <li>If we are required to do so by law</li>
              <li>If we determine that your use of the Service poses a security or legal risk</li>
              <li>At our discretion, with or without notice</li>
            </ul>
            <p className="text-base leading-relaxed mb-4">
              You may terminate your account at any time by:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Deleting your account through the application settings</li>
              <li>Contacting our support team at support@feathermail.com</li>
            </ul>
            <p className="text-base leading-relaxed">
              Upon termination, your right to use the Service will immediately cease, and we will delete your account data in accordance with our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Modifications to Terms</h2>
            <p className="text-base leading-relaxed mb-4">
              We reserve the right to modify these Terms at any time. We will notify you of material changes by:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Posting the updated Terms on this page</li>
              <li>Updating the "Last Updated" date</li>
              <li>Sending you an email notification (for significant changes)</li>
            </ul>
            <p className="text-base leading-relaxed">
              Your continued use of the Service after any modifications constitutes acceptance of the updated Terms. If you do not agree to the modified Terms, you must stop using the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Governing Law and Dispute Resolution</h2>
            <p className="text-base leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with the laws of the State of California, United States, without regard to its conflict of law provisions.
            </p>
            <p className="text-base leading-relaxed mb-4">
              Any disputes arising from these Terms or your use of the Service shall be resolved through:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Good faith negotiations between the parties</li>
              <li>If negotiations fail, binding arbitration in San Francisco, California</li>
              <li>The arbitration shall be conducted under the rules of the American Arbitration Association</li>
            </ul>
            <p className="text-base leading-relaxed">
              You agree to waive any right to a jury trial or to participate in a class action lawsuit.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">16. Severability</h2>
            <p className="text-base leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">17. Entire Agreement</h2>
            <p className="text-base leading-relaxed">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Feathermail regarding the Service and supersede all prior agreements and understandings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">18. Contact Information</h2>
            <p className="text-base leading-relaxed mb-4">
              If you have questions or concerns about these Terms, please contact us:
            </p>
            <div className="bg-secondary/50 p-4 rounded-md">
              <p className="text-base mb-2"><strong>Email:</strong> sohan@feathermail.app</p>
              <p className="text-base mb-2"><strong>Support:</strong> sohan@feathermail.app</p>
              <p className="text-base"><strong>Address:</strong> G.P. Greenwood, 12E Baishnabghata Lane, Kolkata, West Bengal 700047, India </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">19. User Responsibilities</h2>
            <p className="text-base leading-relaxed">
              As a user of Feathermail, you are solely responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
              <li>The content of emails you send through the Service</li>
              <li>Compliance with all applicable email regulations (CAN-SPAM, GDPR, etc.)</li>
              <li>Maintaining backups of important email data</li>
              <li>Securing your devices and network connections</li>
              <li>Monitoring your account for unauthorized access</li>
            </ul>
          </section>
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Last Updated:</strong> March 19, 2026
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>Effective Date:</strong> March 19, 2026
          </p>
          <p className="text-sm text-muted-foreground mt-4">
            By using Feathermail, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </div>
      </main>
    </div>
  );
}