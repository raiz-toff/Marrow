"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "../lib/utils.js";
import { useTopologyShell } from "./topology-context.js";

export interface TopologySearchProps {
  className?: string;
}

export function TopologySearch({ className }: TopologySearchProps) {
  const {
    data,
    searchOpen,
    setSearchOpen,
    focusDevice,
    selectLink,
    setActiveZoneId,
    fitView,
    viewSettings,
    updateViewSetting,
  } = useTopologyShell();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (searchOpen) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [searchOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    const matchedDevices = data.devices.filter(
      (d) =>
        !q ||
        d.label.toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.ip?.toLowerCase().includes(q) ||
        d.role.toLowerCase().includes(q) ||
        d.zone.toLowerCase().includes(q) ||
        d.model?.toLowerCase().includes(q),
    );

    const matchedLinks = data.links.filter(
      (l) =>
        !q ||
        l.id.toLowerCase().includes(q) ||
        l.from.device.toLowerCase().includes(q) ||
        l.to.device.toLowerCase().includes(q) ||
        l.protocol?.toLowerCase().includes(q) ||
        l.speed.toLowerCase().includes(q),
    );

    const matchedZones = data.zones.filter(
      (z) =>
        !q ||
        z.label.toLowerCase().includes(q) ||
        z.id.toLowerCase().includes(q) ||
        z.subtitle?.toLowerCase().includes(q),
    );

    const items: Array<{
      id: string;
      category: "Device" | "Link" | "Zone" | "Command";
      title: string;
      subtitle: string;
      badge?: string;
      color?: string;
      onSelect: () => void;
    }> = [];

    for (const dev of matchedDevices.slice(0, 6)) {
      const zone = data.zones.find((z) => z.id === dev.zone);
      items.push({
        id: `dev:${dev.id}`,
        category: "Device",
        title: dev.label,
        subtitle: `${dev.ip ?? dev.id} · ${zone?.label ?? dev.zone}`,
        badge: dev.role,
        color: zone?.accent,
        onSelect: () => {
          focusDevice(dev.id);
          setSearchOpen(false);
        },
      });
    }

    for (const zone of matchedZones.slice(0, 4)) {
      items.push({
        id: `zone:${zone.id}`,
        category: "Zone",
        title: `Filter Zone: ${zone.label}`,
        subtitle: zone.subtitle ?? zone.id,
        badge: "Zone",
        color: zone.accent,
        onSelect: () => {
          setActiveZoneId(zone.id);
          setSearchOpen(false);
        },
      });
    }

    for (const link of matchedLinks.slice(0, 4)) {
      items.push({
        id: `link:${link.id}`,
        category: "Link",
        title: `${link.from.device} ↔ ${link.to.device}`,
        subtitle: `${link.from.port} → ${link.to.port}`,
        badge: `${link.speed} ${link.mode}`,
        onSelect: () => {
          selectLink(link.id);
          setSearchOpen(false);
        },
      });
    }

    const commands = [
      {
        id: "cmd:fit",
        title: "Fit Topology to Screen",
        subtitle: "Recenter camera and reset zoom to 100%",
        badge: "F",
        onSelect: () => {
          fitView();
          setSearchOpen(false);
        },
      },
      {
        id: "cmd:all-zones",
        title: "Show All Security Zones",
        subtitle: "Clear active security zone filter",
        badge: "All",
        onSelect: () => {
          setActiveZoneId(null);
          setSearchOpen(false);
        },
      },
      {
        id: "cmd:flow",
        title: "Toggle Animated Traffic Flow",
        subtitle: "Pause or resume packet flow animations on active links",
        badge: "Layer",
        onSelect: () => {
          updateViewSetting("motion", !viewSettings.motion);
          setSearchOpen(false);
        },
      },
    ].filter(
      (c) =>
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.subtitle.toLowerCase().includes(q),
    );

    for (const cmd of commands) {
      items.push({
        ...cmd,
        category: "Command",
      });
    }

    return items;
  }, [
    data,
    query,
    focusDevice,
    selectLink,
    setActiveZoneId,
    fitView,
    viewSettings.motion,
    updateViewSetting,
    setSearchOpen,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!searchOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (prev) => (prev - 1 + Math.max(1, results.length)) % Math.max(1, results.length),
      );
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      results[selectedIndex].onSelect();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSearchOpen(false);
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh] backdrop-blur-xs animate-in fade-in duration-150",
        className,
      )}
      onClick={() => setSearchOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Topology Command & Search"
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-fd-border bg-fd-popover text-fd-popover-foreground shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-fd-border px-4 py-3">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4 shrink-0 text-fd-muted-foreground"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search devices, IPs, security zones, links, or commands..."
            className="w-full bg-transparent text-sm text-fd-foreground placeholder:text-fd-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            className="rounded-md border border-fd-border bg-fd-muted/50 px-1.5 py-0.5 font-mono text-[10px] text-fd-muted-foreground hover:text-fd-foreground"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-[360px] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="py-10 text-center text-xs text-fd-muted-foreground">
              No matching devices, links, or commands for &ldquo;{query}&rdquo;.
            </div>
          ) : (
            <div className="space-y-1">
              {results.map((item, idx) => {
                const active = idx === selectedIndex;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={item.onSelect}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                      active
                        ? "bg-fd-accent text-fd-accent-foreground"
                        : "text-fd-foreground/85 hover:bg-fd-accent/50",
                    )}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            item.color ??
                            (item.category === "Command"
                              ? "#10b981"
                              : item.category === "Link"
                                ? "#6366f1"
                                : "#0ea5e9"),
                        }}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-xs font-medium text-fd-foreground">
                          {item.title}
                        </div>
                        <div className="truncate font-mono text-[11px] text-fd-muted-foreground">
                          {item.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="rounded-md border border-fd-border/70 bg-fd-background/70 px-1.5 py-0.5 font-mono text-[10px] uppercase text-fd-muted-foreground">
                        {item.badge ?? item.category}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Hints */}
        <div className="flex items-center justify-between border-t border-fd-border bg-fd-muted/30 px-4 py-2 text-[11px] text-fd-muted-foreground">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-fd-border bg-fd-background px-1 py-0.5 font-mono text-[10px]">
                ↑↓
              </kbd>{" "}
              Navigate
            </span>
            <span>
              <kbd className="rounded border border-fd-border bg-fd-background px-1 py-0.5 font-mono text-[10px]">
                ↵
              </kbd>{" "}
              Select
            </span>
          </div>
          <span className="font-mono text-[10px]">Marrow Command Center</span>
        </div>
      </div>
    </div>
  );
}
