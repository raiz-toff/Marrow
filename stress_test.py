import yaml
import time

nodes = []
links = []
for i in range(1000):
    nodes.append({
        "id": f"node_{i}",
        "label": f"Node {i}",
        "type": "router"
    })
    if i > 0:
        links.append({
            "from": f"node_{i-1}",
            "to": f"node_{i}",
            "cable": "ethernet"
        })

data = {
    "title": "1000 Node Stress Test",
    "nodes": nodes,
    "links": links
}

with open("input/stress.yaml", "w") as f:
    yaml.dump(data, f)
