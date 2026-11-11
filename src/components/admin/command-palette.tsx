"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ADMIN_NAVIGATION } from "@/types/admin";

interface Command {
  id: string;
  label: string;
  description: string;
  href?: string;
  action?: () => void;
  keywords: string[];
  section: string;
  icon?: string;
}

/**
 * Command Palette (⌘K) for Admin Panel
 * Provides quick keyboard navigation to any admin page
 */
export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commands] = useState<Command[]>(() => buildCommands());
  const inputRef = useRef<HTMLInputElement>(null);

  // Build searchable commands from navigation + common actions
  function buildCommands(): Command[] {
    const cmds: Command[] = [];

    // Navigation commands
    ADMIN_NAVIGATION.forEach((nav) => {
      cmds.push({
        id: `nav-${nav.href}`,
        label: nav.label,
        description: `Navigate to ${nav.label}`,
        href: nav.href,
        keywords: [nav.label.toLowerCase(), nav.href.replace("/admin/", "")],
        section: "Navigation",
        icon: nav.icon,
      });
    });

    // Quick actions
    const actions: Omit<Command, "id" | "section">[] = [
      {
        label: "New Shop Application",
        description: "Review pending shop applications",
        href: "/admin/shops?tab=pending",
        keywords: ["shop", "application", "pending", "approve", "review"],
        icon: "🏪",
      },
      {
        label: "New Rider Application",
        description: "Review pending rider applications",
        href: "/admin/riders?tab=pending",
        keywords: ["rider", "application", "pending", "approve", "delivery"],
        icon: "🛵",
      },
      {
        label: "Pending Products",
        description: "Approve vendor product submissions",
        href: "/admin/products/pending",
        keywords: ["product", "pending", "approval", "vendor", "catalog"],
        icon: "🔧",
      },
      {
        label: "Pending Orders",
        description: "View orders awaiting confirmation",
        href: "/admin/orders?status=pending",
        keywords: ["order", "pending", "confirm", "dispatch"],
        icon: "📦",
      },
      {
        label: "Active Deliveries",
        description: "Track ongoing deliveries",
        href: "/admin/orders?status=delivering",
        keywords: ["delivery", "active", "rider", "track", "dispatch"],
        icon: "🚚",
      },
      {
        label: "Payments & Payouts",
        description: "View payments and record vendor payouts",
        href: "/admin/payments",
        keywords: ["payment", "payout", "commission", "vendor", "money"],
        icon: "💰",
      },
      {
        label: "Marketplace Settings",
        description: "Configure marketplace settings",
        href: "/admin/settings",
        keywords: ["settings", "config", "commission", "feature", "flag"],
        icon: "⚙️",
      },
    ];

    actions.forEach((action, i) => {
      cmds.push({ ...action, id: `action-${i}`, section: "Quick Actions" });
    });

    return cmds;
  }

  // Filter commands based on query
  const filteredCommands = commands
    .filter((cmd) => {
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        cmd.label.toLowerCase().includes(q) ||
        cmd.description.toLowerCase().includes(q) ||
        cmd.keywords.some((k) => k.includes(q))
      );
    })
    .sort((a, b) => {
      // Prioritize exact matches
      const aExact = a.label.toLowerCase() === query.toLowerCase();
      const bExact = b.label.toLowerCase() === query.toLowerCase();
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      // Then by section (Navigation first)
      if (a.section !== b.section) return a.section === "Navigation" ? -1 : 1;
      return 0;
    });

  const selectedCommand = filteredCommands[selectedIndex];

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          );
          break;
        case "Enter":
          e.preventDefault();
          if (selectedCommand) executeCommand(selectedCommand);
          break;
        case "Escape":
          close();
          break;
      }
    },
    [isOpen, filteredCommands, selectedCommand]
  );

  const executeCommand = (cmd: Command) => {
    if (cmd.href) {
      window.location.href = cmd.href;
    } else if (cmd.action) {
      cmd.action();
    }
    close();
  };

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setSelectedIndex(0);
  };

  const open = () => {
    setIsOpen(true);
    setQuery("");
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  // Global keyboard shortcut (⌘K / Ctrl+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) close();
        else open();
      }
      if (e.key === "Escape" && isOpen) {
        close();
      }
    };

    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen, close, open]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20" onClick={close}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={(e) => e.stopPropagation()} />

      {/* Palette */}
      <div
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 rounded border border-gray-200">
              ⌘K
            </kbd>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent text-lg text-gray-900 placeholder-gray-400 outline-none"
              autoComplete="off"
            />
            <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 rounded border border-gray-200 text-gray-500">
              Esc
            </kbd>
          </div>
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No commands found for "<span className="font-mono">{query}</span>"
            </div>
          ) : (
            <ul role="listbox" className="divide-y divide-gray-100">
              {filteredCommands.map((cmd, index) => (
                <li key={cmd.id} role="option" aria-selected={index === selectedIndex}>
                  <Link
                    href={cmd.href || "#"}
                    onClick={(e) => {
                      if (!cmd.href) e.preventDefault();
                      executeCommand(cmd);
                    }}
                    className={`flex items-center gap-4 px-4 py-3 transition-colors ${
                      index === selectedIndex
                        ? "bg-orange-50 border-l-4 border-orange-500"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    {cmd.icon && <span className="text-lg">{cmd.icon}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{cmd.label}</p>
                      <p className="text-sm text-gray-500 truncate">{cmd.description}</p>
                    </div>
                    <span className="px-2 py-0.5 text-xs text-gray-400 bg-gray-100 rounded">
                      {cmd.section}
                    </span>
                    <kbd className="px-2 py-1 text-xs font-mono bg-gray-100 rounded border border-gray-200 text-gray-500 hidden sm:block">
                      ↩
                    </kbd>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Hint */}
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 text-center">
            Press <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-300 rounded">⌘K</kbd> to open, <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-300 rounded">↑↓</kbd> to navigate, <kbd className="px-1.5 py-0.5 font-mono bg-white border border-gray-300 rounded">Enter</kbd> to select
          </p>
        </div>
      </div>
    </div>
  );
}
