# /// script
# requires-python = ">=3.10"
# ///
"""
Generate a Figma plugin snippet that creates a CGA color variable collection.

Usage:
    uv run scripts/figma_cga_variables.py

Then paste the output into Figma:
    Plugins > Development > Open console > paste > Enter
"""

CGA_COLORS = [
    ("black",         0x00, 0x00, 0x00),
    ("dark-gray",     0x55, 0x55, 0x55),
    ("blue",          0x00, 0x00, 0xAA),
    ("light-blue",    0x55, 0x55, 0xFF),
    ("green",         0x00, 0xAA, 0x00),
    ("light-green",   0x55, 0xFF, 0x55),
    ("cyan",          0x00, 0xAA, 0xAA),
    ("light-cyan",    0x55, 0xFF, 0xFF),
    ("red",           0xAA, 0x00, 0x00),
    ("light-red",     0xFF, 0x55, 0x55),
    ("magenta",       0xAA, 0x00, 0xAA),
    ("light-magenta", 0xFF, 0x55, 0xFF),
    ("brown",         0xAA, 0x55, 0x00),
    ("yellow",        0xFF, 0xFF, 0x55),
    ("light-gray",    0xAA, 0xAA, 0xAA),
    ("white",         0xFF, 0xFF, 0xFF),
]


def generate_plugin_snippet():
    lines = [
        "// CGA Color Variables — paste into Figma dev console",
        "// Plugins > Development > Open console",
        "(async () => {",
        "  const collection = figma.variables.createVariableCollection('CGA');",
        "  const modeId = collection.modes[0].modeId;",
        "",
    ]

    for name, r, g, b in CGA_COLORS:
        var_name = f"cga/{name}"
        lines.append(f"  const v_{name.replace('-', '_')} = figma.variables.createVariable('{var_name}', collection, 'COLOR');")
        lines.append(f"  v_{name.replace('-', '_')}.setValueForMode(modeId, {{r: {r/255:.4f}, g: {g/255:.4f}, b: {b/255:.4f}, a: 1}});")
        lines.append("")

    lines.extend([
        "  // Bind 'cga/black' to the Background layer of Character-8x16 component",
        "  const char = figma.root.findOne(n => n.id === '38:127');",
        "  if (char) {",
        "    const bg = char.findOne(n => n.name === 'Background');",
        "    if (bg) {",
        "      const fill = JSON.parse(JSON.stringify(bg.fills[0]));",
        f"      fill.boundVariables = {{color: {{id: v_black.id, type: 'VARIABLE_ALIAS'}}}};",
        "      bg.fills = [fill];",
        "      console.log('Bound cga/black to Background layer');",
        "    }",
        "  }",
        "",
        "  console.log(`Created CGA collection with ${collection.variableIds.length} variables`);",
        "})();",
    ])

    return "\n".join(lines)


if __name__ == "__main__":
    print(generate_plugin_snippet())
