# Troubleshooting Guide

This guide covers common errors and solutions when working with the Network Generator.

## Common Errors

### "Node not found" error

**Error Message:**

```text
Error: Link references unknown node "SWITCH1"
```

**Solution:**
Ensure all node IDs referenced in the `links` or `groups` sections exist in the `nodes` section. Node IDs are case-sensitive.

### "Duplicate node ID" error

**Error Message:**

```text
Error: Duplicate node ID "CORE"
```

**Solution:**
Make all node IDs unique. For example, use `CORE1` and `CORE2` instead of reusing `CORE`.

### Links not showing

**Problem:** Links defined in YAML but not visible in the diagram.

**Checklist:**

- Node IDs match exactly (case-sensitive).
- Nodes are defined _before_ links reference them (though order shouldn't strictly matter, it's good practice).
- Cable type is valid (see [Schema Guide](../reference/schema.md#cable-types-reference)).

### Groups not rendering

**Problem:** Group boxes not appearing.

**Checklist:**

- All node IDs listed in the group exist.
- Node positions are set (for campus/city layouts) or automatically calculated.
- Array syntax is correct: `nodes: ["A", "B"]`

### LACP bundle not merging

**Problem:** Multiple links show as separate lines instead of a single bundled connection.

**Checklist:**

- Port-channel IDs match exactly on both source and destination ports.
- Format is `PoN (interface)` with matching `PoN`.
- Example: `from_port: "Po1 (Gi0/1)"` matches `from_port: "Po1 (Gi0/2)"`.
- `from` and `to` node pairs are identical for all members.

### Icons not displaying

**Problem:** Generic shapes appear instead of vendor icons.

**Checklist:**

- Icon path is correct: `Cisco/Category/icon_name`.
- Check [Icon Library](../reference/icons.md) for valid paths.
- Ensure the SVG file exists in `assets/icons/`.

## Debug Tips

1.  **Start minimal:** Begin with just nodes, then add links, then groups.
2.  **Check console:** Open browser DevTools (F12) to see JavaScript errors.
3.  **Validate YAML:** Use the built-in validator:
    ```bash
    python3 main.py validate input/plan.yaml
    ```
4.  **Test incrementally:** Refresh the preview after each major addition.
5.  **Check orphan warnings:** The compiler warns about disconnected nodes—this often indicates a typo in Link IDs.
