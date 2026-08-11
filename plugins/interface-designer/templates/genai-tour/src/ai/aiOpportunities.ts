/**
 * AI OPPORTUNITIES — the content of the demo overlay.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ This file is the AWS team's to edit. Everything else in the app is       │
 * │ scaffolding around it. Rewriting this file changes the entire pitch      │
 * │ without touching a single screen.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Rules that keep this credible in front of a client:
 *
 *  1. `evidence` is mandatory. Every opportunity traces to something real: a ticket
 *     key, a dated meeting note, a document. If you cannot cite it, cut it.
 *  2. Do not claim a service does something it does not.
 *  3. Do not state a saving the evidence does not support. Mark estimates as estimates.
 *  4. Nothing here is built. This is a proposal against the client's current system.
 *  5. Every `target` must resolve to a real `data-ai` attribute in the app. Run the
 *     tour end to end after editing; a spotlight on nothing is visible to the client.
 */

export type AIPhase = 'Quick Win' | 'Phase 2' | 'Horizon';
export type DataReadiness = 'Ready' | 'Needs work' | 'Unknown';
export type Effort = 'S' | 'M' | 'L' | 'XL';

export interface AIHighlight {
  /** CSS selector, normally [data-ai="..."] */
  target: string;
  /** One sentence about what is being pointed at and why it matters. */
  label: string;
}

export interface AIOpportunity {
  id: string;
  /** AI-01, AI-02, ... shown to the client. */
  ref: string;
  phase: AIPhase;
  title: string;
  /** What is broken today. */
  painPoint: string;
  /** Where that came from. Ticket key, meeting date, document name. Never empty. */
  evidence: string;
  /** What we would build. */
  proposal: string;
  awsServices: string[];
  /** The measurable effect. Say "estimated" when it is estimated. */
  businessValue: string;
  dataReadiness: DataReadiness;
  /** Why that readiness rating. */
  dataNote: string;
  effort: Effort;
  /** Route to navigate to before spotlighting. */
  route: string;
  highlights: AIHighlight[];
}

export const AI_OPPORTUNITIES: AIOpportunity[] = [
  // Replace with real opportunities derived from the project context.
  //
  // {
  //   id: 'example',
  //   ref: 'AI-01',
  //   phase: 'Quick Win',
  //   title: 'Short title in the client's own vocabulary',
  //   painPoint: 'What is broken today, in one or two sentences.',
  //   evidence: 'TICKET-123, TICKET-456; meeting note 2024-10-31',
  //   proposal: 'What we would build, concretely.',
  //   awsServices: ['Amazon Bedrock'],
  //   businessValue: 'The effect, with the client's own numbers where they exist.',
  //   dataReadiness: 'Ready',
  //   dataNote: 'Why that rating.',
  //   effort: 'M',
  //   route: '/',
  //   highlights: [
  //     { target: '[data-ai="some-element"]', label: 'What this is and why it matters.' },
  //   ],
  // },
];

export const TOTAL_HIGHLIGHTS = AI_OPPORTUNITIES.reduce(
  (n, o) => n + o.highlights.length,
  0,
);
