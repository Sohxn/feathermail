import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
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
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="space-y-8 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-4">Introduction</h2>
            <p className="text-base leading-relaxed mb-4">
              Welcome to Feathermail ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our email client application.
            </p>
            <p className="text-base leading-relaxed">
              By using Feathermail, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Information We Collect</h2>
            <p className="text-base leading-relaxed mb-4">
              We collect information that you provide directly to us when you:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Create an account with Feathermail</li>
              <li>Connect your email accounts (Gmail, Outlook, etc.)</li>
              <li>Use our email management features</li>
              <li>Contact our support team</li>
            </ul>
            <p className="text-base leading-relaxed">
              The types of information we may collect include your name, email address, authentication credentials, and email content that you choose to access through our application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Google API Services User Data Policy</h2>
            <p className="text-base leading-relaxed mb-4">
              Feathermail's use and transfer of information received from Google APIs adheres to the <a href="https://developers.google.com/terms/api-services-user-data-policy" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Google API Services User Data Policy</a>, including the Limited Use requirements.
            </p>
            <p className="text-base leading-relaxed mb-4">
              Specifically, Feathermail requests access to your Gmail account to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Read your email messages and metadata (subject, sender, date, etc.)</li>
              <li>Organize and categorize your emails</li>
              <li>Send emails on your behalf when you compose messages</li>
              <li>Modify email labels and properties (read/unread, starred, archived)</li>
              <li>Access your email account information</li>
            </ul>
            <p className="text-base leading-relaxed">
              We only access the Gmail data that is necessary to provide you with our email management features. We do not access any other Google services or data beyond what is explicitly required for the functionality you use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">How We Use Your Information</h2>
            <p className="text-base leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed">
              <li>Provide, maintain, and improve our email management services</li>
              <li>Display your emails in a unified inbox across multiple accounts</li>
              <li>Enable email organization features (folders, labels, filters)</li>
              <li>Process and send emails when you compose messages</li>
              <li>Sync your email data between our application and your email providers</li>
              <li>Authenticate your identity and maintain your account security</li>
              <li>Respond to your requests, questions, and feedback</li>
              <li>Detect, prevent, and address technical issues or fraudulent activity</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Data Storage and Security</h2>
            <p className="text-base leading-relaxed mb-4">
              Your email data is stored securely in our database hosted on Supabase (PostgreSQL). We implement industry-standard security measures including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Encrypted data transmission using HTTPS/TLS</li>
              <li>Secure authentication using OAuth 2.0</li>
              <li>Row-level security policies to ensure users can only access their own data</li>
              <li>Regular security updates and monitoring</li>
              <li>Access controls and authentication tokens that expire</li>
            </ul>
            <p className="text-base leading-relaxed">
              While we strive to protect your personal information, no method of transmission over the Internet or electronic storage is 100% secure. We cannot guarantee absolute security but we continuously work to improve our security measures.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Data Sharing and Disclosure</h2>
            <p className="text-base leading-relaxed mb-4">
              We do not sell, trade, or rent your personal information or email data to third parties. We do not share your information except in the following limited circumstances:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li><strong>With your consent:</strong> We may share information when you explicitly authorize us to do so</li>
              <li><strong>Service providers:</strong> We may share information with trusted third-party service providers who assist us in operating our application (e.g., hosting providers, authentication services). These providers are contractually obligated to keep your information confidential and secure</li>
              <li><strong>Legal requirements:</strong> We may disclose information if required by law, court order, or governmental regulation, or if we believe disclosure is necessary to protect our rights, your safety, or the safety of others</li>
              <li><strong>Business transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new owner, but only with the same privacy protections</li>
            </ul>
            <p className="text-base leading-relaxed">
              Your email content is used solely to provide you with email management functionality. We do not use your email content for advertising purposes or share it with advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Data Retention</h2>
            <p className="text-base leading-relaxed mb-4">
              We retain your information for as long as your account is active or as needed to provide you with our services. You can request deletion of your data at any time by contacting us or deleting your account through the application settings.
            </p>
            <p className="text-base leading-relaxed">
              When you delete your account, we will delete all your personal information and email data from our servers within 30 days, except where we are required to retain certain information for legal or regulatory purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Your Rights and Choices</h2>
            <p className="text-base leading-relaxed mb-4">
              You have the following rights regarding your information:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li><strong>Access and portability:</strong> You can access and download your email data at any time through our application</li>
              <li><strong>Correction:</strong> You can update or correct your account information through your account settings</li>
              <li><strong>Deletion:</strong> You can delete your account and all associated data at any time</li>
              <li><strong>Revoke access:</strong> You can revoke Feathermail's access to your Gmail account at any time through your <a href="https://myaccount.google.com/permissions" className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer">Google Account settings</a></li>
              <li><strong>Opt-out:</strong> You can disconnect individual email accounts without deleting your entire Feathermail account</li>
            </ul>
            <p className="text-base leading-relaxed">
              To exercise any of these rights, please contact us at privacy@feathermail.com or use the settings within the application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Third-Party Services</h2>
            <p className="text-base leading-relaxed mb-4">
              Our application integrates with third-party services including:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li><strong>Google Gmail API:</strong> For accessing and managing your Gmail emails</li>
              <li><strong>Supabase:</strong> For secure data storage and authentication</li>
            </ul>
            <p className="text-base leading-relaxed">
              These third-party services have their own privacy policies. We encourage you to review their privacy policies to understand how they handle your information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Children's Privacy</h2>
            <p className="text-base leading-relaxed">
              Feathermail is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately so we can delete such information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">International Data Transfers</h2>
            <p className="text-base leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that are different from the laws of your country. By using Feathermail, you consent to the transfer of your information to these countries.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Changes to This Privacy Policy</h2>
            <p className="text-base leading-relaxed mb-4">
              We may update this Privacy Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-base leading-relaxed mb-4">
              <li>Posting the updated policy on this page</li>
              <li>Updating the "Last Updated" date at the bottom of this page</li>
              <li>Sending you an email notification (for significant changes)</li>
            </ul>
            <p className="text-base leading-relaxed">
              Your continued use of Feathermail after any changes to this Privacy Policy constitutes your acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
            <p className="text-base leading-relaxed mb-4">
              If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
            </p>
            <div className="bg-secondary/50 p-4 rounded-md">
              <p className="text-base mb-2"><strong>Email:</strong> sohan@feathermail.app</p>
              <p className="text-base mb-2"><strong>Support:</strong> sohan@feathermail.app</p>
              <p className="text-base"><strong>Address:</strong> G.P. Greenwood, 12E Baishnabghata Lane, Kolkata, West Bengal 700047, India </p>
            </div>
          </section>
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-6 border-t border-border">
          <p className="text-sm text-muted-foreground">
            <strong>Last Updated:</strong> March 17, 2026
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            <strong>Effective Date:</strong> March 17, 2026
          </p>
        </div>
      </main>
    </div>
  );
}