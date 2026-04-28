"""
Campus Layout Algorithm v2.0 - Topology-Aware Radial Layout

Upgrades:
1. Connection-Aware Sector Alignment - Pods placed near their uplink Core nodes
2. Meta-Node Force-Directed Packing - Physics simulation for tight, organic clustering
3. Strict HA Pair Locking - Siamese twin nodes placed side-by-side
4. Adaptive Wedge/Fan Pods - Trapezoidal layouts instead of rectangles
"""
import math
from engine.layouts.utils import normalize_layout, balance_layout


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════════════

def identify_ha_pairs(nodes):
    """
    Identifies High Availability pairs (e.g., Core-A/Core-B, Dist-1/Dist-2).
    Pairs are nodes at the same level that share naming patterns or heavy interconnection.
    """
    pairs = []
    used = set()
    
    # Group nodes by level
    levels = {}
    for n in nodes:
        lvl = n.get('level', 3)
        if lvl not in levels:
            levels[lvl] = []
        levels[lvl].append(n)
    
    # For each level, find pairs by naming convention
    for lvl, level_nodes in levels.items():
        for i, n1 in enumerate(level_nodes):
            if n1['id'] in used:
                continue
            
            name1 = n1.get('label', n1['id']).lower()
            
            for j, n2 in enumerate(level_nodes):
                if i >= j or n2['id'] in used:
                    continue
                
                name2 = n2.get('label', n2['id']).lower()
                
                # Check for common HA naming patterns
                is_pair = False
                
                # Pattern 1: "core-a" / "core-b" or "core1" / "core2"
                for suffix_a, suffix_b in [('-a', '-b'), ('1', '2'), ('-1', '-2'), 
                                            ('_a', '_b'), ('_1', '_2'), ('a', 'b')]:
                    if name1.endswith(suffix_a) and name2.endswith(suffix_b):
                        base1 = name1[:-len(suffix_a)]
                        base2 = name2[:-len(suffix_b)]
                        if base1 == base2:
                            is_pair = True
                            break
                
                # Pattern 2: Same name with different identifiers
                if not is_pair:
                    # Check similarity (80%+ match)
                    common_len = 0
                    for k in range(min(len(name1), len(name2))):
                        if name1[k] == name2[k]:
                            common_len += 1
                        else:
                            break
                    if common_len > 0 and common_len / max(len(name1), len(name2)) > 0.7:
                        is_pair = True
                
                if is_pair:
                    pairs.append((n1, n2))
                    used.add(n1['id'])
                    used.add(n2['id'])
                    break
    
    return pairs


def calculate_uplink_angle(node, core_nodes, node_map, cx, cy):
    """
    Calculate the ideal angle for a pod based on its uplink Core node position.
    Returns angle in radians.
    """
    # Find the parent chain up to Core
    current = node
    while current:
        parent_id = current.get('parent')
        if not parent_id:
            break
        
        parent = node_map.get(parent_id)
        if not parent:
            break
        
        # Check if parent is a Core node
        if parent.get('level', 3) == 1:
            # Found the uplink Core - calculate its angle
            core_x = parent.get('campus_x', 0)
            core_y = parent.get('campus_y', 0)
            return math.atan2(core_y - cy, core_x - cx)
        
        current = parent
    
    # Default: no specific angle preference
    return None


def run_meta_node_physics(meta_nodes, cx, cy, iterations=100):
    """
    Run force-directed simulation on meta-nodes (pods as circles).
    
    Forces:
    - Gravity toward center
    - Strong repulsion between meta-nodes
    - Sector affinity (pods try to stay in their ideal angular sector)
    """
    if not meta_nodes:
        return
    
    # Physics constants
    k_gravity = 0.02        # Pull toward center
    k_repel = 50000         # Strong repulsion
    k_sector = 0.1          # Sector affinity strength
    drag = 0.7              # Damping
    min_radius = 800        # Minimum distance from center
    
    # Initialize velocities
    for mn in meta_nodes:
        mn['vx'] = 0
        mn['vy'] = 0
    
    for _ in range(iterations):
        for mn in meta_nodes:
            fx, fy = 0, 0
            
            # 1. Gravity toward center (but not too close)
            dx_center = mn['x'] - cx
            dy_center = mn['y'] - cy
            dist_center = math.sqrt(dx_center**2 + dy_center**2)
            
            if dist_center > min_radius:
                # Pull toward center
                fx -= k_gravity * (dist_center - min_radius) * (dx_center / dist_center)
                fy -= k_gravity * (dist_center - min_radius) * (dy_center / dist_center)
            elif dist_center < min_radius * 0.9:
                # Push away if too close
                fx += k_gravity * 2 * (dx_center / max(dist_center, 1))
                fy += k_gravity * 2 * (dy_center / max(dist_center, 1))
            
            # 2. Repulsion from other meta-nodes
            for other in meta_nodes:
                if other['id'] == mn['id']:
                    continue
                
                dx = mn['x'] - other['x']
                dy = mn['y'] - other['y']
                dist_sq = dx**2 + dy**2
                
                if dist_sq < 1:
                    dist_sq = 1
                
                # Minimum separation based on radii
                min_sep = (mn['radius'] + other['radius']) * 1.2
                dist = math.sqrt(dist_sq)
                
                if dist < min_sep * 2:
                    force = k_repel / dist_sq
                    fx += (dx / dist) * force
                    fy += (dy / dist) * force
            
            # 3. Sector affinity (try to stay in ideal angle sector)
            if mn.get('ideal_angle') is not None:
                current_angle = math.atan2(mn['y'] - cy, mn['x'] - cx)
                angle_diff = mn['ideal_angle'] - current_angle
                
                # Normalize to [-π, π]
                while angle_diff > math.pi:
                    angle_diff -= 2 * math.pi
                while angle_diff < -math.pi:
                    angle_diff += 2 * math.pi
                
                # Apply tangential force
                fx += -math.sin(current_angle) * angle_diff * k_sector * dist_center
                fy += math.cos(current_angle) * angle_diff * k_sector * dist_center
            
            # Apply forces to velocity
            mn['vx'] += fx
            mn['vy'] += fy
            
            # Limit speed
            speed = math.sqrt(mn['vx']**2 + mn['vy']**2)
            max_speed = 80
            if speed > max_speed:
                mn['vx'] = (mn['vx'] / speed) * max_speed
                mn['vy'] = (mn['vy'] / speed) * max_speed
        
        # Update positions
        for mn in meta_nodes:
            mn['x'] += mn['vx']
            mn['y'] += mn['vy']
            mn['vx'] *= drag
            mn['vy'] *= drag


def pack_wedge_layout(hub, descendants, pod_x, pod_y, cx, cy, spacing=300):
    """
    Pack descendants in a radial wedge/fan pattern behind the hub.
    The hub is at the narrow end (closest to center), descendants fan out.
    """
    if not descendants:
        hub['campus_x'] = pod_x
        hub['campus_y'] = pod_y
        return
    
    # Calculate the angle from center to pod
    pod_angle = math.atan2(pod_y - cy, pod_x - cx)
    
    # Place hub
    hub['campus_x'] = pod_x
    hub['campus_y'] = pod_y
    
    # Sort descendants by their original level/hierarchical depth
    descendants.sort(key=lambda d: d.get('level', 3))
    
    # Group descendants by "row" (distance from hub)
    rows = []
    row_size = max(3, int(math.sqrt(len(descendants))))
    
    for i, desc in enumerate(descendants):
        row_idx = i // row_size
        if row_idx >= len(rows):
            rows.append([])
        rows[row_idx].append(desc)
    
    # Place each row as an arc
    base_distance = 300  # Distance from hub to first row
    row_spacing = spacing * 0.9
    
    for row_idx, row in enumerate(rows):
        row_distance = base_distance + row_idx * row_spacing
        
        # Calculate arc spread based on row size and distance
        # Outer rows need wider arcs
        arc_width = min(math.pi * 0.6, (len(row) * 0.25) + 0.3)
        
        for j, node in enumerate(row):
            # Distribute nodes across the arc
            if len(row) == 1:
                node_angle = pod_angle
            else:
                # Fan out from center of arc
                offset = (j - (len(row) - 1) / 2) / max(len(row) - 1, 1)
                node_angle = pod_angle + offset * arc_width
            
            # Place node
            node['campus_x'] = hub['campus_x'] + math.cos(node_angle) * row_distance
            node['campus_y'] = hub['campus_y'] + math.sin(node_angle) * row_distance


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN LAYOUT FUNCTION
# ═══════════════════════════════════════════════════════════════════════════════

def apply_campus_layout(nodes, edges=None, width=2000, height=2000):
    """
    'Campus Cluster' Layout v2.0 (Topology-Aware Hybrid):
    
    Combines:
    - Radial Core placement with HA pair locking
    - Connection-aware sector alignment for pods
    - Meta-node physics for tight packing
    - Wedge/fan layouts for descendant placement
    """
    if not nodes:
        return
    
    cx, cy = 0, 0  # Center at Origin
    
    # Build node map for quick lookup
    node_map = {n['id']: n for n in nodes}
    
    # Pre-calculate connections (degree) for each node
    for node in nodes:
        connections = 0
        if node.get('parent'):
            connections += 1
        connections += len([n for n in nodes if n.get('parent') == node['id']])
        node['connections'] = connections

    # ═══════════════════════════════════════════════════════════════════════════
    # PHASE 1: Identify HA Pairs
    # ═══════════════════════════════════════════════════════════════════════════
    ha_pairs = identify_ha_pairs(nodes)
    paired_ids = set()
    for n1, n2 in ha_pairs:
        paired_ids.add(n1['id'])
        paired_ids.add(n2['id'])

    # ═══════════════════════════════════════════════════════════════════════════
    # PHASE 2: Place Core Nodes (with HA Pair Locking)
    # ═══════════════════════════════════════════════════════════════════════════
    core_nodes = [n for n in nodes if n.get('level', 3) == 1]
    core_pairs = [(n1, n2) for n1, n2 in ha_pairs if n1.get('level', 3) == 1]
    core_singles = [n for n in core_nodes if n['id'] not in paired_ids]
    
    # Count total "core units" (pairs count as 1)
    core_units = len(core_pairs) + len(core_singles)
    core_radius = 400
    ha_gap = 180  # Distance between HA partners
    
    unit_idx = 0
    for pair in core_pairs:
        angle = (unit_idx / max(core_units, 1)) * 2 * math.pi
        center_x = cx + math.cos(angle) * core_radius
        center_y = cy + math.sin(angle) * core_radius
        
        # Place pair side-by-side, perpendicular to radial line
        perp_angle = angle + math.pi / 2
        pair[0]['campus_x'] = center_x + math.cos(perp_angle) * ha_gap / 2
        pair[0]['campus_y'] = center_y + math.sin(perp_angle) * ha_gap / 2
        pair[1]['campus_x'] = center_x - math.cos(perp_angle) * ha_gap / 2
        pair[1]['campus_y'] = center_y - math.sin(perp_angle) * ha_gap / 2
        unit_idx += 1
    
    for node in core_singles:
        angle = (unit_idx / max(core_units, 1)) * 2 * math.pi
        node['campus_x'] = cx + math.cos(angle) * core_radius
        node['campus_y'] = cy + math.sin(angle) * core_radius
        unit_idx += 1

    # ═══════════════════════════════════════════════════════════════════════════
    # PHASE 3: Build Pods (Hub + Descendants)
    # ═══════════════════════════════════════════════════════════════════════════
    l2_nodes = [n for n in nodes if n.get('level', 3) == 2]
    base_spacing = 350
    pods = []
    
    for hub in l2_nodes:
        # Gather all descendants (BFS)
        descendants = []
        queue = [hub['id']]
        visited = {hub['id']}
        
        while queue:
            pid = queue.pop(0)
            children = [n for n in nodes if n.get('parent') == pid and n['id'] not in visited]
            for c in children:
                visited.add(c['id'])
                descendants.append(c)
                queue.append(c['id'])
        
        # Dynamic spacing based on density
        current_spacing = base_spacing
        if hub.get('connections', 0) > 10:
            current_spacing *= 1.4
        
        # Calculate pod "radius" (for meta-node physics)
        count = len(descendants)
        if count == 0:
            pod_radius = 100
        else:
            # Approximate radius of a circle containing count nodes
            pod_radius = math.sqrt(count) * current_spacing / 2 + 150
        
        # Calculate ideal angle based on uplink
        ideal_angle = calculate_uplink_angle(hub, core_nodes, node_map, cx, cy)
        
        pods.append({
            'id': f"pod_{hub['id']}",
            'hub': hub,
            'descendants': descendants,
            'radius': pod_radius,
            'spacing': current_spacing,
            'ideal_angle': ideal_angle,
            'x': 0, 'y': 0
        })

    # ═══════════════════════════════════════════════════════════════════════════
    # PHASE 4: Initialize Pod Positions Based on Sector
    # ═══════════════════════════════════════════════════════════════════════════
    initial_radius = 1000
    
    # Group pods by their ideal sector
    sector_pods = {}  # angle -> list of pods
    no_sector_pods = []
    
    for pod in pods:
        if pod['ideal_angle'] is not None:
            # Round angle to nearest 30° sector
            sector = round(pod['ideal_angle'] / (math.pi / 6)) * (math.pi / 6)
            if sector not in sector_pods:
                sector_pods[sector] = []
            sector_pods[sector].append(pod)
        else:
            no_sector_pods.append(pod)
    
    # Place pods within their sectors with fan-out for collisions
    for sector, sector_pod_list in sector_pods.items():
        for i, pod in enumerate(sector_pod_list):
            # Fan out within sector
            spread = 0.4  # radians
            angle_offset = (i - (len(sector_pod_list) - 1) / 2) * spread / max(len(sector_pod_list), 1)
            angle = sector + angle_offset
            
            # Stagger radii for multiple pods
            radius = initial_radius + i * 200
            
            pod['x'] = cx + math.cos(angle) * radius
            pod['y'] = cy + math.sin(angle) * radius
    
    # Place pods without clear sectors evenly in remaining space
    for i, pod in enumerate(no_sector_pods):
        angle = (i / max(len(no_sector_pods), 1)) * 2 * math.pi
        pod['x'] = cx + math.cos(angle) * initial_radius
        pod['y'] = cy + math.sin(angle) * initial_radius

    # ═══════════════════════════════════════════════════════════════════════════
    # PHASE 5: Meta-Node Physics Simulation
    # ═══════════════════════════════════════════════════════════════════════════
    if pods:
        run_meta_node_physics(pods, cx, cy, iterations=80)

    # ═══════════════════════════════════════════════════════════════════════════
    # PHASE 6: Unpack Pods with Wedge/Fan Layout
    # ═══════════════════════════════════════════════════════════════════════════
    for pod in pods:
        pack_wedge_layout(
            pod['hub'], 
            pod['descendants'],
            pod['x'], 
            pod['y'],
            cx, cy,
            spacing=pod['spacing']
        )

    # ═══════════════════════════════════════════════════════════════════════════
    # PHASE 7: Fine-Tuning with Spring Relaxation
    # ═══════════════════════════════════════════════════════════════════════════
    if edges:
        balance_layout(nodes, edges, 'campus_x', 'campus_y', iterations=30, ideal_length=220)
    
    # Normalize to fit within bounds
    normalize_layout(nodes, 'campus_x', 'campus_y', 
                     max_width=1600, max_height=1200, padding=80)
