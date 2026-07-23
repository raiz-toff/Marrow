---
title: Marrow
navigation: false
description: Marrow compiles topology YAML into self-contained, offline, interactive HTML network diagrams. You declare structure; the engine computes the layout.
---

::marrow-hero
::

## See it

Same compiler, three descriptions. Nothing was positioned by hand — switch tabs
and watch the shape change because the *declaration* changed.

::marrow-demo
::

## At scale

Those three are small on purpose. Here is the other end: a slice of a fictional
global enterprise — **15,591 devices across 194 sites** — authored as YAML and
compiled by the same command. The diagram below is one datacenter from it.

::marrow-scale
::

## What you get

::card-group
  ::card
  ---
  title: Interactive, not a screenshot
  icon: lucide:mouse-pointer-click
  to: /guides/output
  ---
  Pan, zoom, click a device for its interfaces and config, trace a path,
  search across pages, export to PNG or SVG.
  ::

  ::card
  ---
  title: Offline and self-contained
  icon: lucide:wifi-off
  to: /decisions/0004-self-contained-output
  ---
  Icons, styles, and the ~20 KB runtime are inlined. No CDN, no fonts to
  fetch, no telemetry. Open the file on a plane.
  ::

  ::card
  ---
  title: Diagnostics built for machines
  icon: lucide:terminal
  to: /reference/diagnostics
  ---
  Every error carries a stable code, a line and column, a snippet, a fix
  hint, and did-you-mean suggestions.
  ::

  ::card
  ---
  title: ~2,850 real vendor icons
  icon: lucide:shapes
  to: /reference/icon-packs
  ---
  Cisco, AWS, Azure, GCP, Kubernetes, and vendor-neutral packs — searchable,
  never guessable.
  ::
::

## Where to go next

- **[Getting started](/getting-started/installation)** — clone, `npm run setup`, first diagram.
- **[Why Marrow](/why)** — how it differs from draw.io, Mermaid, and `diagrams`.
- **[Guides](/guides/authoring)** — the practical how-to, one topic at a time.
- **[Reference](/reference/schema)** — every key, flag, and diagnostic code.
- **[Decisions](/decisions/overview)** — why the tool is shaped the way it is.
