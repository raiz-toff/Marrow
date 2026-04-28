import math

def calculate_subtree_weight(nodes, node_id, cache):
    """
    Recursively calculates the 'weight' of a node based on its leaf count.
    Cached for performance.
    """
    if node_id in cache: return cache[node_id]
    
    children = [n for n in nodes if n.get('parent') == node_id]
    
    # Base case: Leaf node = weight 1
    if not children:
        cache[node_id] = 1
        return 1
        
    weight = 0
    for child in children:
        weight += calculate_subtree_weight(nodes, child['id'], cache)
    
    cache[node_id] = weight
    return weight

def apply_radial_layout(nodes, edges=None, width=2000, height=2000):
    """
    'Galaxy' Radial Layout:
    1. Recursive Sector Partitioning (Allocates exact angles needed per branch).
    2. Leaf Staggering (Zig-zags outer nodes to prevent overlap).
    3. Dynamic Core Rotation (Aligns core nodes with their branches).
    """
    if not nodes: return
    
    cx, cy = 0, 0
    
    # Hierarchy buckets
    core_nodes = [n for n in nodes if n.get('level', 3) == 1]
    l2_nodes = [n for n in nodes if n.get('level', 3) == 2]
    
    # ---------------------------------------------------------
    # 1. WEIGHT CALCULATION
    # ---------------------------------------------------------
    # We need to know how "heavy" each L2 branch is to allocate pie slices.
    weight_cache = {}
    total_weight = 0
    
    for node in l2_nodes:
        w = calculate_subtree_weight(nodes, node['id'], weight_cache)
        total_weight += w
        
    if total_weight == 0: total_weight = 1

    # ---------------------------------------------------------
    # 2. RECURSIVE PLACEMENT FUNCTION
    # ---------------------------------------------------------
    def place_branch(node, start_angle, end_angle, depth):
        """
        Recursively places a node and its children within a specific angular sector.
        """
        # A. Position "Me"
        # Place parent in the geometric center of its assigned sector
        mid_angle = (start_angle + end_angle) / 2
        
        # Dynamic Radius: 
        # Core=400, Dist=1200, then +800 for every subsequent layer
        base_radius = 400 + (depth * 800) 
        
        # Check if Leaf (no children in the list passed to function context?)
        # We need to look up children from global 'nodes'
        my_children = [n for n in nodes if n.get('parent') == node['id']]
        is_leaf = len(my_children) == 0
        
        final_radius = base_radius
        
        # B. Leaf Staggering (The "Stadium Seating" logic)
        # If I am a leaf, I might need to push in/out to avoid neighbors
        if is_leaf and depth > 1:
            # We use a hash of the ID to deterministically stagger
            # Or use a simple counter if we had one. 
            # Here we use the angle to determine "odd/even" slots roughly.
            stagger_tier = int(mid_angle * 10) % 3 
            # 0 = normal, 1 = pushed out, 2 = pulled in
            offsets = [0, 150, -150]
            final_radius += offsets[stagger_tier]

        node['radial_x'] = cx + math.cos(mid_angle) * final_radius
        node['radial_y'] = cy + math.sin(mid_angle) * final_radius
        
        # C. Process Children
        if not my_children: return

        # Sum weight of these specific children to partition the current sector
        children_weight = 0
        local_weights = {}
        for child in my_children:
            cw = calculate_subtree_weight(nodes, child['id'], weight_cache)
            local_weights[child['id']] = cw
            children_weight += cw
            
        if children_weight == 0: children_weight = 1
        
        # The sweep of this parent's sector
        total_sweep = end_angle - start_angle
        
        # CLAMPING: If a node has 1 small child, don't give it 180 degrees.
        # Restrict the max spread for visual tightness.
        if len(my_children) == 1:
            # Keep the child on the same straight line, constrain sweep
            current_cursor = mid_angle - (total_sweep / 2)
        else:
            current_cursor = start_angle

        for child in my_children:
            # How big is my slice?
            ratio = local_weights[child['id']] / children_weight
            child_sweep = total_sweep * ratio
            
            # Recurse
            place_branch(child, current_cursor, current_cursor + child_sweep, depth + 1)
            
            # Advance cursor
            current_cursor += child_sweep

    # ---------------------------------------------------------
    # 3. EXECUTE RECURSION (Start from L2)
    # ---------------------------------------------------------
    # We ignore L1 (Core) for a moment and place the L2 ring first.
    # This ensures the branches define the shape, not the core.
    
    current_angle = 0
    for l2 in l2_nodes:
        w = weight_cache.get(l2['id'], 1)
        sweep = (w / total_weight) * 2 * math.pi
        
        # Place this L2 hub and all its descendants
        place_branch(l2, current_angle, current_angle + sweep, 1) # depth 1 relative to core
        
        current_angle += sweep

    # ---------------------------------------------------------
    # 4. CORE ALIGNMENT (Reverse Layout)
    # ---------------------------------------------------------
    # Now place Core nodes. Instead of a blind circle, 
    # place them closest to the L2 hubs they own.
    
    core_radius = 400
    
    if len(core_nodes) == 1:
        # Single core = Dead center
        core_nodes[0]['radial_x'] = cx
        core_nodes[0]['radial_y'] = cy
    else:
        for core in core_nodes:
            # Find my children (L2s)
            my_children = [n for n in l2_nodes if n.get('parent') == core['id']]
            
            if my_children:
                # Calculate average angle of my children
                avg_x, avg_y = 0, 0
                for child in my_children:
                    # We can use the coords we just calculated!
                    avg_x += child['radial_x']
                    avg_y += child['radial_y']
                
                # Get angle towards that average center of gravity
                angle_to_children = math.atan2(avg_y, avg_x)
                
                core['radial_x'] = cx + math.cos(angle_to_children) * core_radius
                core['radial_y'] = cy + math.sin(angle_to_children) * core_radius
            else:
                # Orphan core (backup: place in empty spot)
                core['radial_x'] = cx
                core['radial_y'] = cy
