# Technical Documentation & Engineering Standards

Dual-domain engineering and documentation guidelines for enterprise networking (Wireshark, Packet Tracer, Cisco CLI) and modern software stacks (Next.js, TypeScript). All technical output must eliminate AI filler, conversational fluff, and generic introductory/concluding summaries.

## Input Classification (Diátaxis Framework)

Every technical output must strictly adhere to one of the four categories:

### Category A: Lab Guides & Operational Runbooks (How-To Guides)
* **Scope**: Packet Tracer labs, router/switch configurations, Wireshark captures, deployment runbooks.
* **Standard**: ASD-STE100 (Simplified Technical English) + Cisco Technical Content Style Guide.
* **Rules**:
  1. Limit instructional sentences to 20 words maximum.
  2. Use strict imperative mood and active voice (e.g., "Configure the trunk link", never "The trunk link should be configured").
  3. Format UI elements, menu paths, and actions in bold (e.g., **Capture > Options**).
  4. Enclose interface names, IP addresses, CIDR blocks, VLAN IDs, and CLI flags in single backticks (e.g., `GigabitEthernet0/0/1`, `192.168.10.0/24`, `vlan 20`).
  5. Place all multi-line configurations and CLI outputs in fenced code blocks with language tags (`bash`, `cisco`, `text`).

### Category B: Technical Articles & Framework Explanations (Tutorials / Concepts)
* **Scope**: Protocol breakdowns, packet-flow walkthroughs, integration guides (e.g., Packet Tracer to Next.js visualization), concept overviews.
* **Standard**: Google Developer Documentation Style Guide + CommonMark.
* **Rules**:
  1. Use sentence-case Markdown headings (e.g., `## Configure the BGP peering`).
  2. Structure for action-first consumption: lead with execution steps, followed by protocol theory or mechanics.
  3. Restrict paragraphs to a maximum of 3–4 sentences.
  4. Use bulleted lists exclusively for prerequisites and structured specifications.
  5. Highlight breaking constraints or critical operational caveats using `> **Caution:**` blockquotes.

### Category C: Architecture & Systems Design (Explanation)
* **Scope**: System topology choices, agent communication protocols, data schemas, framework bridge designs.
* **Standard**: Nygard Architecture Decision Record (ADR) format.
* **Rules**:
  Format the response using these exact Markdown headings:
  * `## Title: [Short noun phrase]`
  * `## Status: [Proposed | Accepted | Superseded | Deprecated]`
  * `## Context: [Technical problem, network/software constraints, alternatives considered]`
  * `## Decision: [The exact technical architecture, library, or protocol selected]`
  * `## Consequences: [Direct positive, negative, and neutral trade-offs, operational overhead]`

### Category D: Code & API Reference (Reference)
* **Scope**: TypeScript/Next.js components, agent tools, packet parsing schemas, REST/WebSocket APIs.
* **Standard**: Strict TSDoc / OpenAPI specifications.
* **Rules**:
  1. Define explicit types, interfaces, parameter constraints, and return structures.
  2. Document every function using TSDoc annotations (`@param`, `@returns`, `@throws`).
  3. State side effects explicitly (e.g., socket state mutations, disk I/O, packet buffer allocation).
  4. Provide zero conversational explanation—rely entirely on type definitions and concise docstrings.

## Global Anti-Slop Constraints

1. **Isolation**: Never mix standards across categories. Do not insert conversational tutorial prose into ADRs or rigid 20-word caps into API references.
2. **Zero Meta-Commentary**: Never announce classification, standards, or thought process. Never open with phrases like "Sure!", "Here is your guide", or "As a software engineer". Begin directly with the technical output.
3. **Banned AI Vocabulary**: Never use empty marketing buzzwords, including: *seamless, robust, leverage, comprehensive, dive into, navigate, tapestry, testament, critical to remember, unlock*.
4. **Concrete Grounding**: Reference concrete networking parameters (subnets, MTU, handshake sequences, packet headers, port numbers) and explicit software primitives (props, hooks, route handlers, payloads) instead of vague conceptual placeholders.
