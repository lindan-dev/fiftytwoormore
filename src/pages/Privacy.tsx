import { Heart } from "lucide-react";
import { Link } from "react-router-dom";

// NOTE: this content is a starting-point draft, not legal advice. It
// should be reviewed by someone with legal competence before relying on
// it for a public App Store submission - especially given the app
// collects a sensitive data category and has EU/GDPR-covered users.
export default function Privacy() {
  return (
    <div className="min-h-screen bg-[hsl(var(--beige))]">
      <header className="py-6 px-6 border-b border-[hsl(var(--warm-text))]/10">
        <div className="container max-w-3xl mx-auto">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[hsl(var(--warm-text))] hover:text-[hsl(var(--coral))] transition-colors"
          >
            <Heart className="w-5 h-5 text-[hsl(var(--coral))]" />
            <span className="font-medium">fiftytwoormore</span>
          </Link>
        </div>
      </header>

      <main className="py-12 px-6">
        <div className="container max-w-3xl mx-auto space-y-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-medium text-[hsl(var(--warm-text))]">
              Privacy Policy
            </h1>
            <p className="text-sm text-[hsl(var(--warm-text-light))]">
              Last updated: October 2026
            </p>
          </div>

          <section className="space-y-4">
            <p className="text-[hsl(var(--warm-text))]">
              fiftytwoormore ("we", "us") is operated by Lindan AB. This policy explains what
              information we collect and how we use it.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-medium text-[hsl(var(--warm-text))]">
              What we collect
            </h2>
            <ul className="list-disc list-inside space-y-2 text-[hsl(var(--warm-text))]">
              <li>
                <strong>Account information:</strong> name and email address, provided when you sign up
              </li>
              <li>
                <strong>Activity data:</strong> dates, optional notes, optional location, and optional emoji tags you choose to log
              </li>
              <li>
                <strong>Partner connection:</strong> your invite code and the fact that you're connected to another user's account, if applicable
              </li>
              <li>
                <strong>Push notification token:</strong> a device identifier used to deliver notifications, if you enable them
              </li>
            </ul>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-medium text-[hsl(var(--warm-text))]">
              How we use it
            </h2>
            <p className="text-[hsl(var(--warm-text))]">
              We use this information solely to provide the app's core functionality: your
              account, your shared data with your connected partner, and basic product analytics
              to understand how the app is used (e.g. which features are used, not the content of
              what you log).
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-medium text-[hsl(var(--warm-text))]">
              Who can see your data
            </h2>
            <p className="text-[hsl(var(--warm-text))]">
              Only you and the partner you've connected with can see your logged activities. We do
              not sell your data, and we do not share it with third parties for advertising
              purposes.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-medium text-[hsl(var(--warm-text))]">
              Data storage
            </h2>
            <p className="text-[hsl(var(--warm-text))]">
              Your data is stored with Supabase, our backend infrastructure provider, using
              industry-standard security practices including row-level access controls.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-medium text-[hsl(var(--warm-text))]">
              Your rights
            </h2>
            <p className="text-[hsl(var(--warm-text))]">
              You can request deletion of your account and all associated data at any time from
              within the app (Profile → Forget Me), or by contacting us at{" "}
              <a href="mailto:fiftytwoormore@lindaninc.com" className="text-primary hover:underline">
                fiftytwoormore@lindaninc.com
              </a>
              . If you are located in the EU/EEA, you have additional rights under GDPR, including
              the right to access, correct, or export your data.
            </p>
            <p className="text-[hsl(var(--warm-text))] mt-3">
              Your activity history belongs to you and your partner together. If either of you
              deletes their account or disconnects from the other, the shared history is deleted
              for both of you, so it never remains with only one of you.
            </p>
          </section>

          <section className="space-y-4">
            <h2 className="text-xl font-medium text-[hsl(var(--warm-text))]">
              Contact
            </h2>
            <p className="text-[hsl(var(--warm-text))]">
              <a href="mailto:fiftytwoormore@lindaninc.com" className="text-primary hover:underline">
                fiftytwoormore@lindaninc.com
              </a>
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}

