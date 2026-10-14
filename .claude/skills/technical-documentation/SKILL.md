---
name: technical-documentation
description: >-
  Produce crisp, implementation-ready technical documentation, configurations,
  and architecture artifacts for enterprise networking (Wireshark, Packet Tracer,
  Cisco CLI) and modern software stacks (Next.js, TypeScript) using the Diátaxis
  framework and strict anti-slop constraints.
---

# Technical Documentation & Engineering Skill

Use this skill when authoring technical documentation, network device configurations, architecture decision records, or software API references.

## Classification and Standards Matrix

| Category | Type | Standard | Scope | Key Formatting Constraint |
| :--- | :--- | :--- | :--- | :--- |
| **A** | Lab Guides & Operational Runbooks | ASD-STE100 + Cisco Style Guide | Packet Tracer, Cisco CLI, Wireshark | Max 20 words/sentence, imperative mood |
| **B** | Technical Articles & Explanations | Google Dev Docs + CommonMark | Protocol analysis, packet flow, integrations | Max 3–4 sentences/paragraph, action-first |
| **C** | Architecture & Systems Design | Nygard ADR | System topology, schemas, protocols | Strict Nygard headings (`Title`, `Status`, `Context`, `Decision`, `Consequences`) |
| **D** | Code & API Reference | Strict TSDoc / OpenAPI | TypeScript/Next.js components, APIs, schemas | Zero prose, strict types and `@param` / `@returns` |

## Category Specifications

### Category A: Lab Guides & Operational Runbooks (How-To Guides)
* Limit instructional sentences to 20 words maximum.
* Use strict imperative mood and active voice (e.g., "Configure the trunk link", never "The trunk link should be configured").
* Format UI elements, menu paths, and actions in bold (e.g., **Capture > Options**).
* Enclose interface names, IP addresses, CIDR blocks, VLAN IDs, and CLI flags in single backticks (e.g., `GigabitEthernet0/0/1`, `192.168.10.0/24`, `vlan 20`).
* Enclose multi-line configurations and CLI outputs in fenced code blocks with language tags (`bash`, `cisco`, `text`).

### Category B: Technical Articles & Framework Explanations (Tutorials / Concepts)
* Use sentence-case Markdown headings (e.g., `## Configure the BGP peering`).
* Structure for action-first consumption: lead with execution steps, followed by protocol theory or mechanics.
* Restrict paragraphs to a maximum of 3–4 sentences.
* Use bulleted lists exclusively for prerequisites and structured specifications.
* Highlight breaking constraints or critical operational caveats using `> **Caution:**` blockquotes.

### Category C: Architecture & Systems Design (Explanation)
Must format using these exact Markdown headings:
* `## Title: [Short noun phrase]`
* `## Status: [Proposed | Accepted | Superseded | Deprecated]`
* `## Context: [Technical problem, network/software constraints, alternatives considered]`
* `## Decision: [The exact technical architecture, library, or protocol selected]`
* `## Consequences: [Direct positive, negative, and neutral trade-offs, operational overhead]`

### Category D: Code & API Reference (Reference)
* Define explicit types, interfaces, parameter constraints, and return structures.
* Document every function using TSDoc annotations (`@param`, `@returns`, `@throws`).
* State side effects explicitly (e.g., socket state mutations, disk I/O, packet buffer allocation).
* Provide zero conversational explanation—rely entirely on type definitions and concise docstrings.

## Global Anti-Slop Checklist
Before emitting any output:
1. **Isolation**: Confirm standards are not mixed across categories.
2. **Zero Meta-Commentary**: Confirm no conversational greetings, preamble, or self-referential statements.
3. **Banned AI Vocabulary Check**: Verify absence of *seamless, robust, leverage, comprehensive, dive into, navigate, tapestry, testament, critical to remember, unlock*.
4. **Concrete Grounding**: Verify concrete parameters (IPs, subnets, interfaces, ports, hooks, props) are specified rather than generic placeholders.
