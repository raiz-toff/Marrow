"""
Manhattan City Layout V2 - Dynamic Boulevard Spacing with Skyscraper Packing

Upgrades from V1:
1. Dynamic Boulevard Spacing - Core nodes spaced based on density of children
2. Skyscraper Packing - Access nodes packed in grids, not infinite vertical lines
3. Skyline Balancing - Smart North/South placement to minimize height difference
"""
import math
from engine.layouts.utils import normalize_layout


def apply_city_layout(nodes, edges=None, width=2000, height=2000):
    """
    'Manhattan City' V2:
    - Dynamic Boulevard: Core nodes spaced based on density of children.
    - Skyscrapers: Access nodes packed in grids, not lines.
    - Skyline Balance: Smartly places blocks North/South to minimize height.
    """
    if not nodes:
        return
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 1: ORGANIZE DATA
    # ═══════════════════════════════════════════════════════════════════════════
    # Map by ID and by Parent
    node_map = {n['id']: n for n in nodes}
    children_map = {n['id']: [] for n in nodes}
    
    # Zones
    core_nodes = []
    dist_nodes = []
    access_nodes = []
    
    for n in nodes:
        lvl = n.get('level', 3)
        if lvl == 1:
            core_nodes.append(n)
        elif lvl == 2:
            dist_nodes.append(n)
        else:
            access_nodes.append(n)
        
        # Build hierarchy
        pid = n.get('parent')
        if pid and pid in children_map:
            children_map[pid].append(n)

    # Handle edge case: no core nodes
    if not core_nodes:
        # Fallback to simple grid for flat networks
        cols = math.ceil(math.sqrt(len(nodes)))
        for i, n in enumerate(nodes):
            n['x'] = (i % cols) * 200
            n['y'] = (i // cols) * 200
        normalize_layout(nodes, 'x', 'y', max_width=width, max_height=height, padding=100)
        return

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 2: BUILD "CITY BLOCKS"
    # ═══════════════════════════════════════════════════════════════════════════
    # A "Block" is a Dist node + all its Access children
    # We pre-calculate the size of every block to pack them efficiently
    blocks = {}  # Key: Dist ID, Value: {width, height, nodes}
    
    block_padding = 100
    device_size = 120  # rough size of node + gap
    
    for dist in dist_nodes:
        my_access = children_map.get(dist['id'], [])
        
        # Calculate Skyscraper Dimensions (Grid)
        count = len(my_access)
        if count == 0:
            cols, rows = 0, 0
            b_w, b_h = 150, 150  # Minimum size for just the Dist node
        else:
            cols = math.ceil(math.sqrt(count))
            rows = math.ceil(count / cols)
            b_w = max(cols * device_size, 150)
            b_h = (rows * device_size) + 200  # +200 for the Dist node itself
            
        blocks[dist['id']] = {
            'dist': dist,
            'access': my_access,
            'w': b_w,
            'h': b_h,
            'cols': cols,
            'rows': rows
        }

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 3: PLACE CORE (MAIN STREET) - DYNAMIC SPACING
    # ═══════════════════════════════════════════════════════════════════════════
    # We assign Blocks to Cores, then calculate how much space each Core needs
    core_assignments = {c['id']: [] for c in core_nodes}
    
    # Assign blocks to Core
    for dist in dist_nodes:
        pid = dist.get('parent')
        # If explicit parent exists in core, use it. Else Round Robin fallback.
        if pid in core_assignments:
            core_assignments[pid].append(blocks[dist['id']])
        else:
            # Fallback for orphans - assign to core with least blocks
            min_core = min(core_nodes, key=lambda c: len(core_assignments[c['id']]))
            core_assignments[min_core['id']].append(blocks[dist['id']])

    # Calculate X positions dynamically based on cluster width
    current_x = 0
    street_gap = 300  # Gap between Core clusters
    
    for core in core_nodes:
        my_blocks = core_assignments[core['id']]
        
        # Calculate total width required for this Core's "suburbs"
        # We split blocks Top and Bottom. 
        # Approx width is Sum(Widths) / 2 (since we stack them top/bottom)
        total_block_width = sum(b['w'] for b in my_blocks)
        cluster_width = max(total_block_width / 1.5, 400)
        
        # Place Core in middle of its allocation
        core['x'] = current_x + (cluster_width / 2)
        core['y'] = 0
        
        # Store the left-start for the blocks
        core['block_start_x'] = current_x
        core['cluster_width'] = cluster_width
        
        # Advance cursor
        current_x += cluster_width + street_gap

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 4: PLACE BLOCKS (NORTH/SOUTH BALANCING)
    # ═══════════════════════════════════════════════════════════════════════════
    dist_y_gap = 250  # Distance from Core to Dist
    
    for core in core_nodes:
        my_blocks = core_assignments[core['id']]
        
        # Sort by size (place biggest skyscrapers first for better balance)
        my_blocks.sort(key=lambda b: b['h'], reverse=True)
        
        # Track cumulative width on each side for proper spacing
        north_offset = 0
        south_offset = 0
        
        for i, block in enumerate(my_blocks):
            is_north = i % 2 == 0
            
            if is_north:
                # Place North (Negative Y) - growing upward
                bx = core['x'] + north_offset - (block['w'] / 4)
                by = -dist_y_gap
                direction = -1  # Grow Upwards
                
                # Update offset for next north block
                north_offset += block['w'] * 0.6
                if i > 1:
                    north_offset -= block['w'] * 0.3  # Overlap slightly for density
            else:
                # Place South (Positive Y) - growing downward
                bx = core['x'] + south_offset - (block['w'] / 4)
                by = dist_y_gap
                direction = 1  # Grow Downwards
                
                # Update offset for next south block
                south_offset += block['w'] * 0.6
                if i > 2:
                    south_offset -= block['w'] * 0.3

            # A. Place Distribution Node
            dist = block['dist']
            dist['x'] = bx
            dist['y'] = by
            
            # B. Place Access Nodes (The Skyscraper Grid)
            # They grow AWAY from the core
            access_list = block['access']
            cols = block['cols']
            if not access_list:
                continue
            
            # Grid start position (centered on Dist node)
            grid_w = cols * device_size
            start_rx = bx - (grid_w / 2) + (device_size / 2)
            start_ry = by + (180 * direction)  # Start 180px away from Dist
            
            for k, acc in enumerate(access_list):
                c = k % cols
                r = k // cols
                
                acc['x'] = start_rx + (c * device_size)
                acc['y'] = start_ry + (r * device_size * direction)

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 5: HANDLE ORPHAN ACCESS NODES
    # ═══════════════════════════════════════════════════════════════════════════
    # Access nodes that weren't assigned to any Dist block
    assigned_access = set()
    for block in blocks.values():
        for acc in block['access']:
            assigned_access.add(acc['id'])
    
    orphan_access = [n for n in access_nodes if n['id'] not in assigned_access]
    
    if orphan_access and dist_nodes:
        # Attach orphans to the last distribution node
        last_dist = dist_nodes[-1]
        base_x = last_dist.get('x', 0) + 300
        for i, orphan in enumerate(orphan_access):
            orphan['x'] = base_x + (i % 4) * device_size
            orphan['y'] = last_dist.get('y', 0) + ((i // 4) + 1) * device_size

    # ═══════════════════════════════════════════════════════════════════════════
    # STEP 6: NORMALIZE
    # ═══════════════════════════════════════════════════════════════════════════
    # Auto-center everything (skip spring balance to preserve the rigid grid)
    normalize_layout(nodes, 'x', 'y', max_width=width, max_height=height, padding=100)
