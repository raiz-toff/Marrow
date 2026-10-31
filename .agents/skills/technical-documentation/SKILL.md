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

### Category E: Visual & Interactive Demonstrations (Live Documentation Components)
* **Demonstrate, don't just describe**: Never describe visual elements in prose or ASCII art when live code, vector SVGs, or interactive components can be rendered.
* **Brand & Identity Consistency**: Always use **Marrow** and the official Marrow mark (`docs/public/icon.svg` / arrowhead glyph) as the brand example in all configs, YAML templates, diagrams, and UI mockups. Never use "Acme" or generic placeholders.
* **Link Modes & Stroke Patterns**: Render actual vector swatches (`<LinkSymbol mode="..." />`) rather than writing words like "plain line", "double rail", "dotted", or "dashed" across speeds (1G, 10G, 40G, 100G) and modes (`access`, `trunk`, `routed`, `peering`, `tunnel`, `stack`).
* **Hardware Status & LEDs**: Render glowing SVG LED indicators and health stroke lines (`<StatusBadge status="..." />`) rather than describing "green LED" or "red stroke".
* **Device Anatomy & Chips**: Render actual device chips (vendor icon, device label, management IP chip, status LED, HA pair bracket, port chips) instead of describing component parts in text.
* **Brand Header & Blueprint Chrome**: Render the authentic Marrow brand strip with the official logo, and render formal CAD title block grids (`title_block:`) and dynamic auto-legend boxes rather than ASCII table mockups.
* **Layout Archetypes & Edge Routing**: Illustrate topology archetypes (Zoned, Hierarchical Tiered, Ring, Hub-and-Spoke, Full Mesh) with miniature vector schemas showing node placement and spline curve routing.
* **Density Presets & Scale**: Illustrate `compact` (48px nodes, tight spacing), `standard` (64px nodes, 48px gap), and `spacious` (80px nodes, 64px gap) using side-by-side visual node grids.
* **Drawer & Inspector Metadata**: Render real interactive HTML tables (`<table class="m-table">`) and native collapsible drawers (`<details>`) showing `custom_fields` (transceivers, optics, serials) and `sections` (BGP tables, interface statuses) rather than unrendered markdown snippets.
* **Embed & Kiosk Modes**: Render side-by-side frames demonstrating the UI differences between full standalone browser chrome, iframe embedding (`#embed=true` / `?chrome=minimal`), and kiosk presentation mode.
* **Micro-Topologies & Inline Links**: When illustrating 2–3 connected devices (e.g., Spine to Leaf, Router to Firewall) in prose or runbooks, render `<DeviceLink />` or `<CableBadge />` instead of launching an entire canvas or iframe. Support vendor SVGs (`icon="/icons/cisco/router.svg"`), port labels, and cable modes.
* **The Four-Layer Engine**: Illustrate the internal rendering pipeline as an exploded visual layer stack: Canvas Host → Grouping (Zones & Tiers) → Nodes & Chips → Links & Port Labels.

## Global Anti-Slop Checklist
Before emitting any output:
1. **Isolation**: Confirm standards are not mixed across categories.
2. **Zero Meta-Commentary**: Confirm no conversational greetings, preamble, or self-referential statements.
3. **Banned AI Vocabulary Check**: Verify absence of *seamless, robust, leverage, comprehensive, dive into, navigate, tapestry, testament, critical to remember, unlock*.
4. **Concrete Grounding**: Verify concrete parameters (IPs, subnets, interfaces, ports, hooks, props) are specified rather than generic placeholders.
5. **Demonstrate Visually**: Replace text descriptions of visual elements (lines, symbols, LEDs, boxes, frames) with live rendered SVG/Vue components.
6. **Marrow Brand Standard**: Ensure all examples, configs, and mockups use **Marrow** and the official Marrow logo (never "Acme" or generic placeholders).
