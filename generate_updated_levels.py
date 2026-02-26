# Generate updated level configurations
levels = []
level_num = 1

# Level 1: Primes
levels.append({'level_num': level_num, 'id': 1, 'sublevel': 'a', 'desc': 'Primes only'})
levels.append({'level_num': level_num, 'id': 2, 'sublevel': 'b', 'desc': 'Reciprocals only'})
levels.append({'level_num': level_num, 'id': 3, 'sublevel': 'c', 'desc': 'Primes + Recip.'})

# Level 2: 0-50, 0-100
level_num += 1
levels.append({'level_num': level_num, 'id': 4, 'sublevel': 'a', 'desc': 'Complexity 0-50'})
levels.append({'level_num': level_num, 'id': 5, 'sublevel': 'b', 'desc': 'Complexity 0-100'})

# Levels 3-12: incrementing by 50
complexity_ranges = [
    (100, 150), (150, 200), (200, 250), (250, 300), (300, 350),
    (350, 400), (400, 450), (450, 500), (500, 550), (550, 600)
]

for min_c, max_c in complexity_ranges:
    level_num += 1
    id_a = len(levels) + 1
    id_b = len(levels) + 2
    levels.append({'level_num': level_num, 'id': id_a, 'sublevel': 'a', 'desc': f'Complexity {min_c}-{max_c}'})
    levels.append({'level_num': level_num, 'id': id_b, 'sublevel': 'b', 'desc': f'Complexity 0-{max_c}'})

# Level 13: 600-700, 0-700
level_num += 1
levels.append({'level_num': level_num, 'id': len(levels) + 1, 'sublevel': 'a', 'desc': 'Complexity 600-700'})
levels.append({'level_num': level_num, 'id': len(levels) + 1, 'sublevel': 'b', 'desc': 'Complexity 0-700'})

# Level 14: 700-1000, 0-1000
level_num += 1
levels.append({'level_num': level_num, 'id': len(levels) + 1, 'sublevel': 'a', 'desc': 'Complexity 700-1000'})
levels.append({'level_num': level_num, 'id': len(levels) + 1, 'sublevel': 'b', 'desc': 'Complexity 0-1000'})

# Print JavaScript config object
print("// Level configuration")
print("function getLevelConfig(level) {")
print("    const configs = {")

for i, l in enumerate(levels):
    limit = 40
    if l['id'] <= 3:  # Primes levels
        mode = 'primes-2x'
        primeLimit = 40
        complexityMin = 0
        complexityMax = 1000000
        if l['id'] == 1:
            filterType = "'primes-only'"
            print(f"        {l['id']}: {{ mode: '{mode}', limit: {limit}, primeLimit: {primeLimit}, complexityMin: {complexityMin}, complexityMax: {complexityMax}, filterType: {filterType} }},")
        elif l['id'] == 2:
            filterType = "'reciprocals-only'"
            print(f"        {l['id']}: {{ mode: '{mode}', limit: {limit}, primeLimit: {primeLimit}, complexityMin: {complexityMin}, complexityMax: {complexityMax}, filterType: {filterType} }},")
        else:
            print(f"        {l['id']}: {{ mode: '{mode}', limit: {limit}, primeLimit: {primeLimit}, complexityMin: {complexityMin}, complexityMax: {complexityMax} }},")
    else:
        # Extract complexity from description
        import re
        match = re.search(r'(\d+)-(\d+)', l['desc'])
        if match:
            complexityMin = int(match.group(1))
            complexityMax = int(match.group(2))
        else:
            match = re.search(r'0-(\d+)', l['desc'])
            complexityMin = 0
            complexityMax = int(match.group(1))
        
        comma = "," if i < len(levels) - 1 else ""
        print(f"        {l['id']}: {{ mode: 'simple-limit', limit: {limit}, complexityMin: {complexityMin}, complexityMax: {complexityMax} }}{comma}")

print("    };")
print("    return configs[level];")
print("}")
print()
print(f"// Total levels: {level_num}")
print(f"// Total sublevels: {len(levels)}")

# Generate HTML
print()
print("<!-- HTML levels-grid -->")
from collections import defaultdict
grouped = defaultdict(list)
for l in levels:
    grouped[l['level_num']].append(l)

for level_num in sorted(grouped.keys()):
    print(f'                <div class="level-pair">')
    print(f'                    <h3 class="pair-title">Level {level_num}</h3>')
    for sublevel in grouped[level_num]:
        print(f'                    <div class="level-card">')
        print(f'                        <div class="level-info">')
        print(f'                            <span class="level-num">{sublevel["level_num"]}{sublevel["sublevel"]}</span>')
        print(f'                            <span class="level-desc">{sublevel["desc"]}</span>')
        print(f'                        </div>')
        print(f'                        <div class="mode-buttons">')
        print(f'                            <button class="mode-btn" data-level="{sublevel["id"]}" data-mode="normal">Normal</button>')
        print(f'                            <button class="mode-btn" data-level="{sublevel["id"]}" data-mode="reverse">Reverse</button>')
        print(f'                        </div>')
        print(f'                    </div>')
    print(f'                </div>')
    print()

