"""
Layout Utilities - Shared functions for layout normalization and compaction
"""
import math

def normalize_layout(nodes, key_x, key_y, max_width=1600, max_height=1200, padding=100):
    """
    Auto-compacts a layout if it's too spread out.
    """
    if not nodes:
        return
    
    # Filter nodes that have been positioned
    positioned = [n for n in nodes if key_x in n and key_y in n]
    if not positioned:
        return
    
    # Calculate current bounding box
    xs = [n[key_x] for n in positioned]
    ys = [n[key_y] for n in positioned]
    
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    
    current_width = max_x - min_x
    current_height = max_y - min_y
    
    # Calculate center of current layout
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2
    
    # Target center (middle of canvas)
    target_center_x = max_width / 2
    target_center_y = max_height / 2
    
    # Calculate scale factors
    usable_width = max_width - (padding * 2)
    usable_height = max_height - (padding * 2)
    
    scale_x = usable_width / current_width if current_width > 0 else 1
    scale_y = usable_height / current_height if current_height > 0 else 1
    
    # Use the smaller scale to maintain aspect ratio, but only scale DOWN
    scale = min(scale_x, scale_y, 1.0)
    
    # Only apply normalization if we need to shrink
    if scale < 1.0:
        for node in positioned:
            # Translate to origin, scale, then translate to target center
            node[key_x] = (node[key_x] - center_x) * scale + target_center_x
            node[key_y] = (node[key_y] - center_y) * scale + target_center_y
    else:
        # Just re-center without scaling
        offset_x = target_center_x - center_x
        offset_y = target_center_y - center_y
        for node in positioned:
            node[key_x] += offset_x
            node[key_y] += offset_y


def compact_long_links(nodes, edges, key_x, key_y, max_link_distance=500):
    """
    Detects abnormally long links and compacts nodes to reduce distance.
    """
    if not nodes or not edges:
        return
    
    # Build quick lookup
    node_map = {n['id']: n for n in nodes if key_x in n and key_y in n}
    
    # Find the longest link
    max_found = 0
    for edge in edges:
        from_node = node_map.get(edge.get('from'))
        to_node = node_map.get(edge.get('to'))
        
        if from_node and to_node:
            dx = from_node[key_x] - to_node[key_x]
            dy = from_node[key_y] - to_node[key_y]
            dist = math.sqrt(dx*dx + dy*dy)
            max_found = max(max_found, dist)
    
    # If any link exceeds max, scale the whole layout proportionally
    if max_found > max_link_distance:
        scale = max_link_distance / max_found
        
        # Find center
        xs = [n[key_x] for n in node_map.values()]
        ys = [n[key_y] for n in node_map.values()]
        center_x = sum(xs) / len(xs)
        center_y = sum(ys) / len(ys)
        
        # Scale around center
        for node in node_map.values():
            node[key_x] = (node[key_x] - center_x) * scale + center_x
            node[key_y] = (node[key_y] - center_y) * scale + center_y

def balance_layout(nodes, edges, key_x, key_y, iterations=50, ideal_length=200):
    """
    Iterative 'Spring Relaxation' to equalize link lengths.
    
    This pulls nodes connected by long links closer together, 
    and pushes nodes overlap or connected by very short links apart.
    
    Args:
        iterations: Number of physics ticks to run (50 is usually enough)
        ideal_length: Target length for all edges
    """
    if not nodes or not edges: return

    # Build quick lookup
    node_map = {n['id']: n for n in nodes if key_x in n and key_y in n}
    positioned_nodes = list(node_map.values())
    if not positioned_nodes: return

    # Physics constants
    k_spring = 0.05  # Spring stiffness (pull)
    k_repel = 5000   # Repulsion strength (push)
    drag = 0.5       # Damping

    # Velocity map
    velocities = {n['id']: {'vx': 0, 'vy': 0} for n in positioned_nodes}

    for _ in range(iterations):
        # 1. Repulsion (Push apart all nodes)
        for i, n1 in enumerate(positioned_nodes):
            fx, fy = 0, 0
            for j, n2 in enumerate(positioned_nodes):
                if i == j: continue
                
                dx = n1[key_x] - n2[key_x]
                dy = n1[key_y] - n2[key_y]
                dist_sq = dx*dx + dy*dy
                
                if dist_sq < 0.1: dist_sq = 0.1 # Avoid div by zero
                if dist_sq > 250000: continue # Optimization: ignore far nodes
                
                force = k_repel / dist_sq
                dist = math.sqrt(dist_sq)
                
                fx += (dx / dist) * force
                fy += (dy / dist) * force
            
            # Apply repulsion to velocity
            velocities[n1['id']]['vx'] += fx
            velocities[n1['id']]['vy'] += fy

        # 2. Spring Attraction (Pull connected nodes)
        for edge in edges:
            n1 = node_map.get(edge.get('from'))
            n2 = node_map.get(edge.get('to'))
            
            if not n1 or not n2: continue
            
            dx = n1[key_x] - n2[key_x]
            dy = n1[key_y] - n2[key_y]
            dist = math.sqrt(dx*dx + dy*dy)
            if dist < 0.1: continue

            # Hooke's Law: F = k * (current_dist - ideal_dist)
            force = k_spring * (dist - ideal_length)
            
            fx = (dx / dist) * force
            fy = (dy / dist) * force
            
            # Apply forces symmetrically
            velocities[n2['id']]['vx'] += fx
            velocities[n2['id']]['vy'] += fy
            
            velocities[n1['id']]['vx'] -= fx
            velocities[n1['id']]['vy'] -= fy

        # 3. Update Positions & Dampen
        for n in positioned_nodes:
            v = velocities[n['id']]
            
            # Limit max speed
            speed = math.sqrt(v['vx']**2 + v['vy']**2)
            if speed > 50:
                v['vx'] = (v['vx'] / speed) * 50
                v['vy'] = (v['vy'] / speed) * 50

            # Move node
            n[key_x] += v['vx']
            n[key_y] += v['vy']
            
            # Apply drag/friction
            v['vx'] *= drag
            v['vy'] *= drag
